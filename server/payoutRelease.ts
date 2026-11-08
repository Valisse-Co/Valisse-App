import { getBookingServiceTotalInCents, getFeeEventsReadyForPayout, getPayoutEligibleBookings, markBookingPayoutResult, updateBookingFeeEvent, updateUserStripeReferences } from "./db";
import { getConnectedAccountReadiness, getStripeIntegrationStatus, releaseAppointmentFeePayout, releaseBookingPayout } from "./stripe";
import { isStripeObjectInConfiguredEnvironment } from "../shared/stripeMode";
import { safeErrorDetails } from "./securityLogging";

function batchSize(maxItems: number) {
  return Number.isSafeInteger(maxItems) && maxItems > 0 ? Math.min(maxItems, 100) : 5;
}

function payoutSummary(checked: number) {
  return { released: 0, deferred: 0, failed: 0, checked, reasonCounts: {} as Record<string, number> };
}

type PayoutSummary = ReturnType<typeof payoutSummary>;
function defer(result: PayoutSummary, reason: string) {
  result.deferred += 1;
  result.reasonCounts[reason] = (result.reasonCounts[reason] ?? 0) + 1;
}

/** Infrastructure/credential failures are not a terminal business payout result. */
function isProviderUnavailable(error: unknown) {
  const { name, status } = safeErrorDetails(error);
  if (status === 401 || status === 403 || status === 408 || status === 429 || (status !== undefined && status >= 500)) return true;
  if (["AbortError", "StripeAPIError", "StripeAuthenticationError", "StripeConnectionError", "StripeRateLimitError"].includes(name)) return true;
  try {
    const value = error as { code?: unknown; type?: unknown } | null;
    return ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ERR_NETWORK", "ECONNABORTED", "ABORT_ERR", "api_key_expired", "invalid_api_key", "authentication_required"].includes(String(value?.code)) ||
      ["StripeAPIError", "StripeAuthenticationError", "StripeConnectionError", "StripeRateLimitError", "api_error", "authentication_error"].includes(String(value?.type));
  } catch { return false; }
}

export async function releaseEligiblePayouts(now = new Date(), maxItems = 5) {
  const limit = batchSize(maxItems);
  const candidates = (await getPayoutEligibleBookings(now, limit)).slice(0, limit);
  const result = payoutSummary(candidates.length);
  const stripeMode = getStripeIntegrationStatus().mode;

  for (const { booking, tech } of candidates) {
    // Defense in depth: scheduled money movement never processes QA fixtures.
    if (booking.isQaTest) { defer(result, "qa_excluded"); continue; }
    if (stripeMode !== "test" && stripeMode !== "live") { defer(result, "stripe_unconfigured"); continue; }
    if (!booking.stripePaymentIntentId || !tech?.stripeConnectedAccountId || !tech.stripeConnectedAccountReady ||
      !isStripeObjectInConfiguredEnvironment(tech.stripeConnectedAccountMode, stripeMode)) {
      defer(result, "recipient_not_ready");
      continue;
    }
    let stage: "readiness" | "input" | "transfer" | "marker" = "readiness";
    try {
      const readiness = await getConnectedAccountReadiness(tech.stripeConnectedAccountId);
      // Readiness caching is observational: a cache write cannot block a transfer
      // or make a healthy provider look unavailable.
      try {
        await updateUserStripeReferences(tech.id, {
          stripeConnectedAccountReady: readiness.ready,
          stripeConnectedAccountMode: stripeMode,
        });
      } catch (error) {
        console.warn("[Payout release] Readiness cache unavailable", safeErrorDetails(error));
      }
      if (!readiness.ready) { defer(result, "recipient_not_ready"); continue; }
      stage = "input";
      const totalInCents = await getBookingServiceTotalInCents(booking.id);
      stage = "transfer";
      const transfer = await releaseBookingPayout({
        bookingId: booking.id,
        techAccountId: tech.stripeConnectedAccountId,
        servicePaymentIntentId: booking.stripePaymentIntentId,
        serviceTotalInCents: totalInCents,
        tipPaymentIntentId: booking.stripeTipPaymentIntentId,
      });
      stage = "marker";
      await markBookingPayoutResult(booking.id, "released", transfer.id);
      result.released += 1;
    } catch (error) {
      console.error("[Payout release] Attempt incomplete", safeErrorDetails(error));
      if (stage === "marker") defer(result, "reconciliation_needed");
      else if (stage !== "transfer" || isProviderUnavailable(error)) defer(result, "dependency_unavailable");
      else result.failed += 1;
      // Do not mark failed or clear transfer IDs. Stable provider idempotency
      // keys make pending items retryable, including partially successful calls.
    }
  }

  // Always inspect fees too, even when Stripe is unconfigured. Queue snapshots
  // count the full backlog independently; checked here means this bounded batch.
  const appointmentFeePayouts = await releaseEligibleAppointmentFeePayouts(now, limit);
  const reasonCounts = { ...result.reasonCounts };
  for (const [reason, count] of Object.entries(appointmentFeePayouts.reasonCounts)) {
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + count;
  }
  return {
    released: result.released + appointmentFeePayouts.released,
    deferred: result.deferred + appointmentFeePayouts.deferred,
    failed: result.failed + appointmentFeePayouts.failed,
    checked: result.checked + appointmentFeePayouts.checked,
    reasonCounts,
    appointmentFeePayouts,
  };
}

/** Releases the exact fee amount after its separate 24-hour issue window. */
export async function releaseEligibleAppointmentFeePayouts(now = new Date(), maxItems = 5) {
  const limit = batchSize(maxItems);
  const candidates = (await getFeeEventsReadyForPayout(now, limit)).slice(0, limit);
  const result = payoutSummary(candidates.length);
  const mode = getStripeIntegrationStatus().mode;
  for (const { event, tech, booking } of candidates) {
    if (!booking || booking.isQaTest) { defer(result, "qa_or_missing_booking"); continue; }
    if (mode !== "test" && mode !== "live") { defer(result, "stripe_unconfigured"); continue; }
    const accountId = tech?.stripeConnectedAccountId;
    if (!event.stripePaymentIntentId || !tech || !accountId || !tech.stripeConnectedAccountReady ||
      !isStripeObjectInConfiguredEnvironment(tech.stripeConnectedAccountMode, mode)) {
      defer(result, "recipient_not_ready");
      continue;
    }
    let stage: "readiness" | "transfer" | "marker" = "readiness";
    try {
      const readiness = await getConnectedAccountReadiness(accountId, mode);
      if (!readiness.ready) { defer(result, "recipient_not_ready"); continue; }
      stage = "transfer";
      const transfer = await releaseAppointmentFeePayout({
        feeEventId: event.id,
        bookingId: booking.id,
        techAccountId: accountId,
        paymentIntentId: event.stripePaymentIntentId,
        amountInCents: event.amountInCents,
        mode,
      });
      stage = "marker";
      await updateBookingFeeEvent(event.id, { payoutStatus: "released", stripeTransferId: transfer.id });
      result.released += 1;
    } catch (error) {
      console.error("[Appointment fee payout] Attempt incomplete", safeErrorDetails(error));
      if (stage === "marker") defer(result, "reconciliation_needed");
      else if (stage === "readiness" || isProviderUnavailable(error)) defer(result, "dependency_unavailable");
      else result.failed += 1;
      // Retain pending status and any existing transfer ID for stable-key retries.
    }
  }
  return result;
}
