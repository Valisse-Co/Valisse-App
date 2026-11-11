import * as store from "./automaticPayoutDb";
import { automaticServicePayoutInCents, type AutomaticPayoutSpec } from "../shared/automaticPayout";
import { createAutomaticPayoutTransfer, lookupAutomaticPayoutTransfer, verifyAutomaticPayoutFunding, AutomaticPayoutPreflightError, type AutomaticTransferLeg, type AutomaticPayoutFundingInput } from "./automaticPayoutStripe";
import { safeErrorDetails } from "./securityLogging";

export type AutomaticPayoutPolicy = { cutoff: Date; approvedAt: Date; environment: "production" | "development" };
export function assertFuturePayoutPolicy(policy: AutomaticPayoutPolicy, now = new Date()) {
  if (policy.environment !== "production" || !Number.isFinite(policy.cutoff?.getTime()) ||
      !Number.isFinite(policy.approvedAt?.getTime()) || policy.approvedAt.getTime() > now.getTime() ||
      policy.cutoff.getTime() < policy.approvedAt.getTime() || policy.cutoff.getTime() > now.getTime()) {
    throw new Error("FUTURE_PAYOUT_POLICY_NOT_APPROVED");
  }
}

/** Does not cancel a remote committed payment. It fences all subsequent local work. */
export class PayoutRunBudget {
  constructor(private readonly endsAt = Date.now() + 85_000) {}
  check(reserveMs = 0) { if (Date.now() + reserveMs >= this.endsAt) throw new Error("PAYOUT_RUN_DEADLINE"); }
  async wait<T>(operation: () => Promise<T>, maxMs = 12_000): Promise<T> {
    this.check();
    const timeoutMs = Math.min(maxMs, this.endsAt - Date.now());
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("PAYOUT_RUN_DEADLINE")), timeoutMs); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }
}

function transferLeg(leg: store.AutomaticPayoutLeg): AutomaticTransferLeg {
  if (leg.mode !== "live") throw new Error("AUTOMATIC_PAYOUT_LIVE_ONLY");
  return {
    id: leg.id, bookingId: leg.bookingId, feeEventId: leg.feeEventId, kind: leg.kind,
    customerId: leg.customerId, techId: leg.techId, destinationAccountId: leg.destination,
    paymentIntentId: leg.paymentIntentId, chargeId: leg.chargeId, amountInCents: leg.amountInCents,
    grossInCents: leg.originalGrossInCents, mode: "live", firstAttemptAt: leg.firstAttemptAt,
  };
}
function candidateInputs(candidate: store.AutomaticPayoutCandidate, cutoff: Date, now: Date): AutomaticPayoutFundingInput[] {
  const { booking, tech, client, event, serviceTotalInCents, legs } = candidate;
  if (booking.isQaTest || !client.stripeCustomerId || !tech.stripeConnectedAccountId) return [];
  const base = { bookingId: booking.id, techId: tech.id, customerId: client.stripeCustomerId,
    accountId: tech.stripeConnectedAccountId, cutoff, now };
  if (event) return event.stripePaymentIntentId ? [{ ...base, kind: "appointment_fee", feeEventId: event.id,
    paymentIntentId: event.stripePaymentIntentId, grossInCents: event.amountInCents, amountInCents: event.amountInCents }] : [];
  const inputs: AutomaticPayoutFundingInput[] = [];
  if (booking.stripePaymentIntentId && !booking.stripeTransferId &&
      !legs.some(leg => leg.kind === "service" && ["transferred", "blocked"].includes(leg.state))) {
    inputs.push({ ...base, kind: "service", paymentIntentId: booking.stripePaymentIntentId,
      grossInCents: serviceTotalInCents, amountInCents: automaticServicePayoutInCents(serviceTotalInCents) });
  }
  if (booking.tipStatus === "paid" && booking.stripeTipPaymentIntentId && booking.tipAmountInCents > 0 &&
      !legs.some(leg => leg.kind === "tip" && ["transferred", "blocked"].includes(leg.state))) {
    inputs.push({ ...base, kind: "tip", paymentIntentId: booking.stripeTipPaymentIntentId,
      grossInCents: booking.tipAmountInCents, amountInCents: booking.tipAmountInCents });
  }
  return inputs;
}

/** No charge/refund/funding APIs. Only captured, future, verified payment legs can transfer. */
export async function releaseFutureAutomaticPayouts(policy: AutomaticPayoutPolicy, now = new Date(), deadlineAt = Date.now() + 85_000) {
  assertFuturePayoutPolicy(policy, now);
  const budget = new PayoutRunBudget(deadlineAt);
  const result = { checked: 0, released: 0, deferred: 0, failed: 0 };
  const candidates = await budget.wait(() => store.getAutomaticPayoutCandidates({ cutoff: policy.cutoff, now, limit: 3 }));
  let stop = false;
  for (const candidate of candidates) {
    if (stop) break;
    for (const input of candidateInputs(candidate, policy.cutoff, now)) {
      if (stop) break;
      // This bounds one complete preflight/reconciliation/dispatch/persistence chain
      // below the host's two-minute callback deadline. Next heartbeat handles backlog.
      try { budget.check(50_000); } catch { result.deferred++; stop = true; break; }
      result.checked++;
      let claim: Extract<store.AutomaticPayoutClaim, { status: "acquired" }> | undefined;
      let dispatching = false;
      try {
        // Reconcile already-dispatched evidence before requiring additional available
        // funds. A successful prior transfer may have consumed the platform balance.
        const prior = candidate.legs.find(leg => leg.kind === input.kind && leg.paymentIntentId === input.paymentIntentId);
        let spec: AutomaticPayoutSpec;
        if (prior?.firstAttemptAt || prior?.state === "needs_reconciliation") {
          spec = { ...prior, cutoff: policy.cutoff };
        } else {
          const funding = await budget.wait(() => verifyAutomaticPayoutFunding({ ...input, now: new Date() }), 20_000);
          spec = {
            mode: "live", kind: input.kind, bookingId: input.bookingId, feeEventId: input.feeEventId ?? null,
            techId: input.techId, clientId: candidate.client.id, customerId: input.customerId,
            destination: input.accountId, paymentIntentId: input.paymentIntentId, chargeId: funding.chargeId,
            amountInCents: input.amountInCents, originalGrossInCents: input.grossInCents, currency: "usd", cutoff: policy.cutoff,
          };
        }
        const acquired = await budget.wait(() => store.claimAutomaticPayout(spec, new Date()));
        if (acquired.status === "already_transferred") continue;
        if (acquired.status !== "acquired") { result.deferred++; continue; }
        claim = acquired;
        const existing = await budget.wait(() => lookupAutomaticPayoutTransfer(transferLeg(acquired.leg)), 22_000);
        if (existing) {
          const recorded = await budget.wait(() => store.markAutomaticPayoutTransferred(acquired.leg.id, acquired.leaseToken, existing.id, new Date()));
          if (!recorded) throw new Error("PAYOUT_PERSISTENCE_NOT_CONFIRMED");
          result.released++;
          continue;
        }
        // Ambiguous first attempts are never resent based on an empty listing,
        // including after Stripe's idempotency-key retention window expires.
        if (acquired.reconciliationRequired) {
          await budget.wait(() => store.markAutomaticPayoutUncertain(acquired.leg.id, acquired.leaseToken, "reconciliation_not_found", new Date()));
          result.deferred++;
          continue;
        }
        budget.check(30_000);
        const firstAttemptAt = new Date();
        const dispatchRecorded = await budget.wait(() => store.markAutomaticPayoutDispatching(acquired.leg.id, acquired.leaseToken, firstAttemptAt));
        if (!dispatchRecorded) throw new Error("PAYOUT_DISPATCH_LEASE_LOST");
        dispatching = true;
        const transfer = await budget.wait(() => createAutomaticPayoutTransfer({ ...transferLeg(acquired.leg), firstAttemptAt }, Math.min(deadlineAt - 8_000, Date.now() + 25_000)), 27_000);
        const recorded = await budget.wait(() => store.markAutomaticPayoutTransferred(acquired.leg.id, acquired.leaseToken, transfer.id, new Date()));
        if (!recorded) throw new Error("PAYOUT_PERSISTENCE_NOT_CONFIRMED");
        result.released++;
      } catch (error) {
        const deadline = error instanceof Error && error.message === "PAYOUT_RUN_DEADLINE";
        const preflight = error instanceof AutomaticPayoutPreflightError;
        const uncertain = dispatching || Boolean(claim?.reconciliationRequired) || (preflight && error.reconciliationRequired);
        console.warn("[Automatic payouts] Transfer deferred", { ...safeErrorDetails(error), code: preflight ? error.code : deadline ? "deadline" : "persistence_or_source_check" });
        if (claim && !deadline) {
          try {
            await budget.wait(() => uncertain
              ? store.markAutomaticPayoutUncertain(claim!.leg.id, claim!.leaseToken, "provider_uncertain", new Date())
              : store.markAutomaticPayoutPending(claim!.leg.id, claim!.leaseToken, new Date()), 5_000);
          } catch { /* Never re-send. Lease expiry and firstAttemptAt preserve reconciliation. */ }
        }
        if (preflight && !error.retryAllowed && !uncertain) result.failed++;
        else result.deferred++;
        if (deadline || (preflight && ["provider_unavailable", "platform_payouts_automatic", "insufficient_balance"].includes(error.code))) stop = true;
      }
    }
  }
  return result;
}
