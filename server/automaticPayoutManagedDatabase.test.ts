import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { automaticPayoutLegs, bookingServiceLines, bookings, operationsJobs, users } from "../drizzle/schema";
import { AUTOMATIC_PAYOUT_LEASE_MS, type AutomaticPayoutSpec } from "../shared/automaticPayout";
import { OPERATIONS_JOB_KEY } from "../shared/operations";
import { createAutomaticPayoutStore } from "./automaticPayoutDb";
import { getDb } from "./db";
import { safeErrorDetails } from "./securityLogging";

/**
 * Run ONLY after migration, with BOTH explicit approvals:
 * RUN_AUTOMATIC_PAYOUT_MANAGED_FIXTURE_TEST=true
 * AUTOMATIC_PAYOUT_ALLOW_DISPOSABLE_FIXTURES=true
 * Uses the existing managed getDb connection; never migrates or activates a job.
 * "live" fake IDs/readiness are SQL-only eligibility fixtures, NOT Stripe accounts.
 * No Stripe/payment methods, application mutation helpers, emails, or SMS are used.
 */
const enabled = process.env.RUN_AUTOMATIC_PAYOUT_MANAGED_FIXTURE_TEST === "true";
describe.skipIf(!enabled)("automatic payout managed SQL-only disposable fixtures", () => {
  it("reads candidates, owns each PI once, reconciles without redispatch, and fences lost leases", async () => {
    if (process.env.AUTOMATIC_PAYOUT_ALLOW_DISPOSABLE_FIXTURES !== "true") {
      throw new Error("Explicit disposable-fixture approval is required before connecting");
    }
    const db = await getDb();
    if (!db) throw new Error("Managed database unavailable");
    // FIRST database operation: fail closed, never create/update the production job.
    const [job] = await db.select({ mode: operationsJobs.executionMode }).from(operationsJobs)
      .where(and(eq(operationsJobs.jobKey, OPERATIONS_JOB_KEY), eq(operationsJobs.environment, "production"))).limit(1);
    if (job?.mode !== "observe_only") {
      throw new Error("Refusing fixtures: production operations job must exist in observe_only mode");
    }
    const tag = randomUUID();
    const token = tag.replaceAll("-", "");
    const fixtureName = `Managed SQL-only ${tag}`;
    const openIds = [`payout_client_${tag}`, `payout_tech_${tag}`];
    const fake = (prefix: string, kind: string) => `${prefix}_ManagedFixture${kind}${token}`;
    const customer = fake("cus", "Client"), account = fake("acct", "Tech");
    const servicePI = fake("pi", "Service"), tipPI = fake("pi", "Tip");
    const serviceTransfer = fake("tr", "Service"), tipTransfer = fake("tr", "Tip");
    // Whole seconds match booking TIMESTAMP precision; capture is strictly after cutoff.
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const capturedAt = new Date(now.getTime() - 1000);
    const cutoff = new Date(capturedAt.getTime() - 1000);
    const completedAt = new Date(now.getTime() - 2 * 86_400_000);
    const eligibleAt = new Date(completedAt.getTime() + 86_400_000);
    const userIds: number[] = [], bookingIds: number[] = [], lineIds: number[] = [];
    const failures: string[] = [];
    let phase = "fixture creation";
    // Preserve stage/UUID/SQL code, never raw messages, rows, SQL parameters or credentials.
    const diagnose = (stage: string, error: unknown) => {
      const cause = (error as { cause?: unknown } | null)?.cause ?? error;
      const code = (cause as { code?: unknown } | null)?.code;
      const safeCode = typeof code === "string" && /^(ER_[A-Z_]+|ECONNRESET|ECONNREFUSED|ETIMEDOUT)$/.test(code) ? code : "unclassified";
      failures.push(`${stage}: ${safeErrorDetails(error).name}/${safeCode}`);
    };
    const store = createAutomaticPayoutStore(async () => db);
    try {
      await db.transaction(async tx => {
        const [client] = await tx.insert(users).values({
          openId: openIds[0], name: fixtureName, userType: "client", stripeCustomerId: customer,
          stripeCustomerMode: "live", email: null, phone: null, smsConsent: false,
        });
        userIds.push(Number(client.insertId));
        const [tech] = await tx.insert(users).values({
          openId: openIds[1], name: fixtureName, userType: "nail_tech", stripeConnectedAccountId: account,
          stripeConnectedAccountMode: "live", stripeConnectedAccountReady: true,
          email: null, phone: null, smsConsent: false,
        });
        userIds.push(Number(tech.insertId));
        // Second owned booking deliberately references the same fake PI to test ownership.
        for (let index = 0; index < 2; index++) {
          const [booking] = await tx.insert(bookings).values({
            clientId: userIds[0], techId: userIds[1], serviceType: fixtureName, scheduledAt: completedAt,
            status: "completed", completedAt, paymentCapturedAt: capturedAt, payoutEligibleAt: eligibleAt,
            paymentStatus: "paid", payoutStatus: "pending_dispute_window", stripePaymentIntentId: servicePI,
            tipStatus: "paid", stripeTipPaymentIntentId: tipPI, tipAmountInCents: 200, isQaTest: false,
          });
          bookingIds.push(Number(booking.insertId));
          const [line] = await tx.insert(bookingServiceLines).values({
            bookingId: Number(booking.insertId), serviceName: fixtureName, priceInCents: 1000,
          });
          lineIds.push(Number(line.insertId));
        }
      });
      const bookingId = bookingIds[0];
      const readBooking = async () => (await db.select({ transfer: bookings.stripeTransferId, status: bookings.payoutStatus })
        .from(bookings).where(eq(bookings.id, bookingId)))[0];
      const service: AutomaticPayoutSpec = {
        mode: "live", kind: "service", bookingId, feeEventId: null, techId: userIds[1], clientId: userIds[0],
        customerId: customer, destination: account, paymentIntentId: servicePI, chargeId: fake("ch", "Service"),
        amountInCents: 950, originalGrossInCents: 1000, currency: "usd", cutoff,
      };
      phase = "read-only eligible candidate SQL";
      const candidates = await store.getAutomaticPayoutCandidates({ cutoff, now, limit: 5 });
      // Filter before assertions: failures must never print unrelated real candidate records.
      const owned = candidates.filter(candidate => candidate.booking.id === bookingId);
      expect(owned).toHaveLength(1);
      expect(owned[0].serviceTotalInCents).toBe(1000);
      expect(owned[0].booking).toMatchObject({ paymentStatus: "paid", tipStatus: "paid", payoutStatus: "pending_dispute_window" });
      phase = "concurrent claim serialization";
      // Await both settlements even on an error, so no claim can outlive cleanup.
      const settled = await Promise.all([service, service].map(async spec => {
        try { return { claim: await store.claimAutomaticPayout(spec, now) }; }
        catch (error) { return { error }; }
      }));
      for (const result of settled) if ("error" in result) throw result.error;
      const claims = settled.flatMap(result => result.claim ? [result.claim] : []);
      expect(claims.map(claim => claim.status).sort()).toEqual(["acquired", "busy"]);
      const first = claims.find(claim => claim.status === "acquired")!;
      if (first.status !== "acquired") throw new Error("Missing first lease");
      expect(first.leg.firstAttemptAt).toBeNull();
      phase = "cross-booking PI ownership rejection";
      await expect(store.claimAutomaticPayout({ ...service, bookingId: bookingIds[1] }, now)).rejects.toThrow("immutable");
      expect(await db.select({ id: automaticPayoutLegs.id }).from(automaticPayoutLegs)
        .where(and(inArray(automaticPayoutLegs.bookingId, bookingIds), eq(automaticPayoutLegs.customerId, customer)))).toHaveLength(1);
      phase = "first dispatch and expired-lease fencing";
      expect(await store.markAutomaticPayoutDispatching(first.leg.id, first.leaseToken, now)).toBe(true);
      const later = new Date(now.getTime() + AUTOMATIC_PAYOUT_LEASE_MS + 1);
      const replacement = await store.claimAutomaticPayout(service, later);
      if (replacement.status !== "acquired") throw new Error("Missing replacement lease");
      expect(replacement.reconciliationRequired).toBe(true);
      expect(replacement.leg.firstAttemptAt).toEqual(now);
      expect(await store.markAutomaticPayoutDispatching(replacement.leg.id, replacement.leaseToken, later)).toBe(false);
      expect(await store.markAutomaticPayoutTransferred(first.leg.id, first.leaseToken, serviceTransfer, later)).toBe(false);
      phase = "exact service evidence with pending paid tip";
      expect(await store.markAutomaticPayoutTransferred(replacement.leg.id, replacement.leaseToken, serviceTransfer, later)).toBe(true);
      expect(await readBooking()).toEqual({ transfer: serviceTransfer, status: "pending_dispute_window" });
      const tip: AutomaticPayoutSpec = { ...service, kind: "tip", paymentIntentId: tipPI, chargeId: fake("ch", "Tip"), amountInCents: 200, originalGrossInCents: 200 };
      const tipClaim = await store.claimAutomaticPayout(tip, later);
      if (tipClaim.status !== "acquired") throw new Error("Missing tip lease");
      phase = "uncertain tip cannot redispatch or erase service evidence";
      expect(await store.markAutomaticPayoutDispatching(tipClaim.leg.id, tipClaim.leaseToken, later)).toBe(true);
      expect(await store.markAutomaticPayoutUncertain(tipClaim.leg.id, tipClaim.leaseToken, "provider_uncertain", later)).toBe(true);
      const retry = await store.claimAutomaticPayout(tip, later);
      if (retry.status !== "acquired") throw new Error("Missing reconciliation lease");
      expect(retry.reconciliationRequired).toBe(true);
      expect(retry.leg.firstAttemptAt).toEqual(later);
      expect(await store.markAutomaticPayoutDispatching(retry.leg.id, retry.leaseToken, later)).toBe(false);
      expect(await store.markAutomaticPayoutTransferred(tipClaim.leg.id, tipClaim.leaseToken, tipTransfer, later)).toBe(false);
      expect(await readBooking()).toEqual({ transfer: serviceTransfer, status: "pending_dispute_window" });
      const pending = await store.getAutomaticPayoutCandidates({ cutoff, now: later, limit: 5 });
      expect(pending.some(candidate => candidate.booking.id === bookingId)).toBe(true);
      phase = "exact independent tip evidence and final release";
      expect(await store.markAutomaticPayoutTransferred(retry.leg.id, retry.leaseToken, tipTransfer, later)).toBe(true);
      expect(await readBooking()).toEqual({ transfer: serviceTransfer, status: "released" });
      const legs = await db.select({ kind: automaticPayoutLegs.kind, state: automaticPayoutLegs.state, transferId: automaticPayoutLegs.transferId })
        .from(automaticPayoutLegs).where(eq(automaticPayoutLegs.bookingId, bookingId));
      expect(legs.sort((a, b) => a.kind.localeCompare(b.kind))).toEqual([
        { kind: "service", state: "transferred", transferId: serviceTransfer },
        { kind: "tip", state: "transferred", transferId: tipTransfer },
      ]);
      expect(await store.claimAutomaticPayout(service, later)).toMatchObject({ status: "already_transferred", transferId: serviceTransfer });
    } catch (error) {
      diagnose(phase, error);
    } finally {
      // Tracked IDs AND UUID ownership predicates only; dependent rows first.
      const cleanup: [string, () => Promise<unknown>][] = [];
      if (bookingIds.length) cleanup.push(
        ["ledger cleanup", () => db.delete(automaticPayoutLegs).where(and(inArray(automaticPayoutLegs.bookingId, bookingIds), eq(automaticPayoutLegs.customerId, customer), eq(automaticPayoutLegs.destination, account), inArray(automaticPayoutLegs.paymentIntentId, [servicePI, tipPI])))],
        ["line cleanup", () => lineIds.length ? db.delete(bookingServiceLines).where(and(inArray(bookingServiceLines.id, lineIds), inArray(bookingServiceLines.bookingId, bookingIds), eq(bookingServiceLines.serviceName, fixtureName))) : Promise.resolve()],
        ["booking cleanup", () => db.delete(bookings).where(and(inArray(bookings.id, bookingIds), eq(bookings.serviceType, fixtureName), eq(bookings.clientId, userIds[0]), eq(bookings.techId, userIds[1]), eq(bookings.stripePaymentIntentId, servicePI)))],
      );
      if (userIds.length) cleanup.push(["user cleanup", () => db.delete(users).where(and(inArray(users.id, userIds), inArray(users.openId, openIds)))]);
      for (const [stage, remove] of cleanup) {
        try { await remove(); } catch (error) { diagnose(stage, error); }
      }
      // Do not close/replace the application's shared managed connection.
    }
    if (failures.length) throw new Error(`Managed fixture ${tag}; owned users=${userIds.join(",")}; bookings=${bookingIds.join(",")}; lines=${lineIds.join(",")}; ${failures.join("; ")}`);
  }, 60_000);
});
