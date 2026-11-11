import { randomUUID } from "node:crypto";
import { getTableName, type SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";
import { type AutomaticPayoutLeg } from "../drizzle/schema";
import {
  AUTOMATIC_PAYOUT_LEASE_MS,
  assertAutomaticPayoutSpec,
  automaticPayoutIdempotencyKey,
  automaticServicePayoutInCents,
  type AutomaticPayoutSpec,
} from "../shared/automaticPayout";
vi.mock("./db", () => ({ getDb: async () => null }));
import {
  createAutomaticPayoutStore,
  type AutomaticPayoutBooking,
  type AutomaticPayoutFeeEvent,
} from "./automaticPayoutDb";

const now = new Date("2026-11-10T22:00:00.123Z");
const cutoff = new Date("2026-11-01T00:00:00.123Z");
const earlier = new Date("2026-11-08T00:00:00.123Z");
function booking(
  overrides: Partial<AutomaticPayoutBooking> = {}
): AutomaticPayoutBooking {
  return {
    id: 77,
    clientId: 1,
    techId: 2,
    status: "completed",
    completedAt: earlier,
    paymentStatus: "paid",
    paymentCapturedAt: earlier,
    payoutStatus: "pending_dispute_window",
    payoutEligibleAt: new Date(earlier.getTime() + 86_400_000),
    stripePaymentIntentId: "pi_service",
    stripeTipPaymentIntentId: "pi_tip",
    stripeTransferId: null,
    stripeRefundId: null,
    stripeTipRefundId: null,
    tipStatus: "paid",
    tipAmountInCents: 200,
    refundAmountInCents: 0,
    issueReportedAt: null,
    issueResolvedAt: null,
    issueResolution: "none",
    isQaTest: false,
    needsReview: false,
    revisionStatus: "none",
    ...overrides,
  };
}
function spec(
  overrides: Partial<AutomaticPayoutSpec> = {}
): AutomaticPayoutSpec {
  return {
    mode: "live",
    kind: "service",
    bookingId: 77,
    feeEventId: null,
    techId: 2,
    clientId: 1,
    customerId: "cus_client",
    destination: "acct_tech",
    paymentIntentId: "pi_service",
    chargeId: "ch_service",
    amountInCents: 950,
    originalGrossInCents: 1000,
    currency: "usd",
    cutoff,
    ...overrides,
  };
}
function fee(
  overrides: Partial<AutomaticPayoutFeeEvent> = {}
): AutomaticPayoutFeeEvent {
  return {
    id: 4,
    bookingId: 77,
    clientId: 1,
    techId: 2,
    feeType: "late_arrival",
    status: "charged",
    amountInCents: 150,
    chargedAt: earlier,
    eligibleAt: earlier,
    payoutEligibleAt: new Date(earlier.getTime() + 86_400_000),
    stripePaymentIntentId: "pi_fee",
    stripeTransferId: null,
    stripeRefundId: null,
    payoutStatus: "pending_dispute_window",
    clientDisputedAt: null,
    adminResolvedAt: null,
    ...overrides,
  };
}
const dialect = new MySqlDialect();
function matches(row: any, where?: SQL): boolean {
  if (!where) return true;
  const query = dialect.sqlToQuery(where);
  // Mutation/locator predicates are conjunctions of exact equalities. Candidate
  // filtering is tested separately via the generated SQL and final pure guards.
  let param = 0;
  const comparisons = [...query.sql.matchAll(/`[^`]+`\.`([^`]+)`\s*=\s*\?/g)];
  return comparisons.every(([, key]) => {
    const expected = query.params[param++];
    return row[key] === expected;
  });
}
/** Offline fake DB: serialized transactions with rollback and ordered lock logs. */
function memoryDb(b = booking(), events: AutomaticPayoutFeeEvent[] = []) {
  const state = {
    bookings: [b],
    events,
    legs: [] as AutomaticPayoutLeg[],
    total: 1000,
    minimum: 1000,
    tech: {
      id: 2,
      stripeConnectedAccountId: "acct_tech",
      stripeConnectedAccountMode: "live",
      stripeConnectedAccountReady: true,
      deactivatedAt: null,
    },
    client: {
      id: 1,
      stripeCustomerId: "cus_client",
      stripeCustomerMode: "live",
      deactivatedAt: null,
    },
    locks: [] as string[],
    queries: [] as string[],
    writes: 0,
    failWrite: false,
  };
  const rows = (name: string): any[] =>
    name === "bookings"
      ? state.bookings
      : name === "booking_fee_events"
        ? state.events
        : name === "automatic_payout_legs"
          ? state.legs
          : [];
  let tail = Promise.resolve();
  const db: any = {
    select(selection?: any) {
      let table: any;
      let where: SQL | undefined;
      let cap = Infinity;
      let joined = false;
      const chain: any = {
        from(t: any) {
          table = t;
          return chain;
        },
        where(w: SQL) {
          where = w;
          return chain;
        },
        limit(value: number) {
          cap = value;
          return chain;
        },
        orderBy() {
          return chain;
        },
        innerJoin() {
          joined = true;
          return chain;
        },
        for() {
          state.locks.push(getTableName(table));
          return chain;
        },
        then(resolve: any, reject: any) {
          const name = getTableName(table);
          if (where) state.queries.push(dialect.sqlToQuery(where).sql);
          let found: any[];
          if (joined)
            found =
              name === "bookings"
                ? state.bookings.map(booking => ({
                    booking,
                    tech: state.tech,
                    client: state.client,
                  }))
                : state.events.map(event => ({
                    booking: b,
                    tech: state.tech,
                    client: state.client,
                    event,
                  }));
          else if (name === "automatic_payout_tech") found = [state.tech];
          else if (name === "automatic_payout_client") found = [state.client];
          else if (name === "booking_service_lines")
            found = [{ total: String(state.total), minimum: state.minimum }];
          else found = rows(name).filter(row => matches(row, where));
          return Promise.resolve(
            found.slice(0, cap).map(row => ({ ...row }))
          ).then(resolve, reject);
        },
      };
      return chain;
    },
    insert(table: any) {
      return {
        async values(value: any) {
          if (state.failWrite) throw new Error("connection lost");
          state.writes++;
          if (
            state.legs.some(
              leg =>
                leg.mode === value.mode &&
                leg.paymentIntentId === value.paymentIntentId
            )
          )
            throw new Error("duplicate payment");
          rows(getTableName(table)).push({
            state: "ready",
            transferId: null,
            firstAttemptAt: null,
            attemptedAt: null,
            leaseToken: null,
            leaseUntil: null,
            reason: null,
            reasonAt: null,
            transferredAt: null,
            ...value,
          });
          return [{ affectedRows: 1 }];
        },
      };
    },
    update(table: any) {
      return {
        set(value: any) {
          return {
            async where(where: SQL) {
              if (state.failWrite) throw new Error("connection lost");
              state.writes++;
              rows(getTableName(table))
                .filter(row => matches(row, where))
                .forEach(row => Object.assign(row, value));
              return [{ affectedRows: 1 }];
            },
          };
        },
      };
    },
    async transaction(work: any) {
      const prior = tail;
      let release!: () => void;
      tail = new Promise<void>(resolve => {
        release = resolve;
      });
      await prior;
      const snapshot = structuredClone({
        bookings: state.bookings,
        events: state.events,
        legs: state.legs,
      });
      try {
        return await work(db);
      } catch (error) {
        state.bookings = snapshot.bookings;
        state.events = snapshot.events;
        state.legs = snapshot.legs;
        throw error;
      } finally {
        release();
      }
    },
  };
  return { state, store: createAutomaticPayoutStore(async () => db) };
}
async function acquired(
  store: ReturnType<typeof createAutomaticPayoutStore>,
  source = spec(),
  at = now
) {
  const claim = await store.claimAutomaticPayout(source, at);
  expect(claim.status).toBe("acquired");
  if (claim.status !== "acquired") throw new Error("claim not acquired");
  return claim;
}

describe("automatic payout ledger (offline; no provider or real database)", () => {
  it("validates safe cents, USD, IDs, modes, associations and explicit clocks", () => {
    expect(() => assertAutomaticPayoutSpec(spec(), now)).not.toThrow();
    for (const invalid of [
      spec({ amountInCents: 1.1 }),
      spec({ originalGrossInCents: Number.MAX_SAFE_INTEGER + 1 }),
      spec({ mode: "other" as any }),
      spec({ currency: "eur" as any }),
      spec({ paymentIntentId: "pi_ bad" }),
      spec({ customerId: "acct_wrong" }),
      spec({ feeEventId: 4 }),
      spec({ cutoff: new Date(NaN) }),
      spec({ cutoff: new Date(now.getTime() + 1) }),
    ])
      expect(() => assertAutomaticPayoutSpec(invalid, now)).toThrow();
    expect(automaticServicePayoutInCents(190)).toBe(180);
    expect(
      automaticServicePayoutInCents(Number.MAX_SAFE_INTEGER)
    ).toBeGreaterThan(0);
  });
  it("requires a database for reads and writes; connection loss is not an empty queue", async () => {
    const store = createAutomaticPayoutStore(async () => null);
    await expect(
      store.getAutomaticPayoutCandidates({ cutoff, now, limit: 5 })
    ).rejects.toThrow("unavailable");
    await expect(store.claimAutomaticPayout(spec(), now)).rejects.toThrow(
      "unavailable"
    );
  });
  it("serializes duplicate claims to one immutable UUID and one active lease", async () => {
    const { state, store } = memoryDb();
    const claims = await Promise.all([
      store.claimAutomaticPayout(spec(), now),
      store.claimAutomaticPayout(spec(), now),
      store.claimAutomaticPayout(spec(), now),
    ]);
    expect(claims.map(result => result.status)).toEqual([
      "acquired",
      "busy",
      "busy",
    ]);
    expect(state.legs).toHaveLength(1);
    expect(state.legs[0].firstAttemptAt).toBeNull();
    expect(state.legs[0].state).toBe("ready");
    expect(automaticPayoutIdempotencyKey(state.legs[0].id)).toBe(
      `valisse_auto_${state.legs[0].id}`
    );
    expect(state.locks.slice(0, 3)).toEqual([
      "bookings",
      "automatic_payout_legs",
      "automatic_payout_legs",
    ]);
  });
  it("sets first attempt only immediately before create; cannot reset an ambiguous attempt", async () => {
    const { state, store } = memoryDb();
    const claim = await acquired(store);
    expect(
      await store.markAutomaticPayoutDispatching(
        claim.leg.id,
        claim.leaseToken,
        now
      )
    ).toBe(true);
    expect(state.legs[0].firstAttemptAt).toEqual(now);
    expect(
      await store.markAutomaticPayoutPending(
        claim.leg.id,
        claim.leaseToken,
        now
      )
    ).toBe(false);
    expect(
      await store.markAutomaticPayoutUncertain(
        claim.leg.id,
        claim.leaseToken,
        "provider_uncertain",
        now
      )
    ).toBe(true);
    const retry = await acquired(
      store,
      spec(),
      new Date(now.getTime() + 86_400_001)
    );
    expect(retry.reconciliationRequired).toBe(true);
    expect(retry.leg.firstAttemptAt).toEqual(now);
    expect(
      await store.markAutomaticPayoutDispatching(
        retry.leg.id,
        retry.leaseToken,
        new Date(now.getTime() + 86_400_001)
      )
    ).toBe(false);
  });
  it("reclaims stale dispatching as reconciliation and fences stale completion", async () => {
    const { store } = memoryDb();
    const first = await acquired(store);
    await store.markAutomaticPayoutDispatching(
      first.leg.id,
      first.leaseToken,
      now
    );
    const later = new Date(now.getTime() + AUTOMATIC_PAYOUT_LEASE_MS + 1);
    const second = await acquired(store, spec(), later);
    expect(second.reconciliationRequired).toBe(true);
    expect(
      await store.markAutomaticPayoutTransferred(
        first.leg.id,
        first.leaseToken,
        "tr_service",
        later
      )
    ).toBe(false);
    expect(
      await store.markAutomaticPayoutTransferred(
        second.leg.id,
        second.leaseToken,
        "tr_service",
        later
      )
    ).toBe(true);
  });
  it("defers unattempted preflight without resetting any attempt timestamps", async () => {
    const { state, store } = memoryDb();
    const first = await acquired(store);
    expect(
      await store.markAutomaticPayoutPending(
        first.leg.id,
        first.leaseToken,
        now
      )
    ).toBe(true);
    const next = await acquired(store);
    expect(next.reconciliationRequired).toBe(false);
    expect(state.legs[0].firstAttemptAt).toBeNull();
  });
  it("persists service immediately, leaves pending while paid tip is absent, then releases both", async () => {
    const { state, store } = memoryDb();
    const service = await acquired(store);
    await store.markAutomaticPayoutDispatching(
      service.leg.id,
      service.leaseToken,
      now
    );
    expect(
      await store.markAutomaticPayoutTransferred(
        service.leg.id,
        service.leaseToken,
        "tr_service",
        now
      )
    ).toBe(true);
    expect(state.bookings[0].stripeTransferId).toBe("tr_service");
    expect(state.bookings[0].payoutStatus).toBe("pending_dispute_window");
    const tip = await acquired(
      store,
      spec({
        kind: "tip",
        paymentIntentId: "pi_tip",
        chargeId: "ch_tip",
        originalGrossInCents: 200,
        amountInCents: 200,
      })
    );
    await store.markAutomaticPayoutDispatching(tip.leg.id, tip.leaseToken, now);
    await store.markAutomaticPayoutUncertain(
      tip.leg.id,
      tip.leaseToken,
      "provider_uncertain",
      now
    );
    expect(state.bookings[0].stripeTransferId).toBe("tr_service");
    const retry = await acquired(
      store,
      spec({
        kind: "tip",
        paymentIntentId: "pi_tip",
        chargeId: "ch_tip",
        originalGrossInCents: 200,
        amountInCents: 200,
      })
    );
    expect(
      await store.markAutomaticPayoutTransferred(
        retry.leg.id,
        retry.leaseToken,
        "tr_tip",
        now
      )
    ).toBe(true);
    expect(state.bookings[0].payoutStatus).toBe("released");
    const already = await store.claimAutomaticPayout(spec(), now);
    expect(already).toMatchObject({
      status: "already_transferred",
      transferId: "tr_service",
    });
    expect(state.legs.map(leg => leg.transferId)).toEqual([
      "tr_service",
      "tr_tip",
    ]);
  });
  it("returns released service groups when a paid tip ledger is still missing", async () => {
    const { state, store } = memoryDb();
    const service = await acquired(store);
    await store.markAutomaticPayoutTransferred(
      service.leg.id,
      service.leaseToken,
      "tr_service",
      now
    );
    state.bookings[0].payoutStatus = "released";
    const candidates = await store.getAutomaticPayoutCandidates({
      cutoff,
      now,
      limit: 5,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].booking.tipStatus).toBe("paid");
    expect(candidates[0].serviceTotalInCents).toBe(1000);
    expect(
      state.queries.some(
        query =>
          query.includes("paymentCapturedAt") &&
          query.includes("DATE_SUB") &&
          query.includes("isQaTest")
      )
    ).toBe(true);
  });
  it("excludes historical $1.90, QA, unresolved issues, invalid clocks and legacy transfers", async () => {
    for (const overrides of [
      { paymentCapturedAt: new Date("2026-10-01"), id: 1920002 },
      { isQaTest: true },
      { issueReportedAt: earlier },
      { completedAt: now },
      { payoutEligibleAt: null },
      { paymentStatus: "refunded" as const },
      { stripeTransferId: "tr_legacy" },
    ]) {
      const { state, store } = memoryDb(booking(overrides));
      expect(
        await store.getAutomaticPayoutCandidates({ cutoff, now, limit: 99 })
      ).toEqual([]);
      expect(state.writes).toBe(0);
    }
    await expect(
      memoryDb().store.getAutomaticPayoutCandidates({
        cutoff,
        now: new Date(NaN),
        limit: 5,
      })
    ).rejects.toThrow();
    await expect(
      memoryDb().store.getAutomaticPayoutCandidates({ cutoff, now, limit: 0 })
    ).rejects.toThrow();
  });
  it("rejects every mutable source association before dispatch and before evidence completion", async () => {
    for (const change of [
      (s: any) => (s.bookings[0].techId = 3),
      (s: any) => (s.bookings[0].clientId = 3),
      (s: any) => (s.tech.stripeConnectedAccountId = "acct_other"),
      (s: any) => (s.client.stripeCustomerId = "cus_other"),
      (s: any) => (s.tech.stripeConnectedAccountMode = "test"),
      (s: any) => (s.client.stripeCustomerMode = "test"),
      (s: any) => (s.bookings[0].stripePaymentIntentId = "pi_other"),
      (s: any) => (s.total = 1001),
      (s: any) => (s.bookings[0].refundAmountInCents = 1),
      (s: any) => (s.bookings[0].stripeRefundId = "re_refund"),
      (s: any) => (s.bookings[0].issueReportedAt = now),
      (s: any) => (s.bookings[0].stripeTransferId = "tr_other"),
    ]) {
      const { state, store } = memoryDb();
      const claim = await acquired(store);
      change(state);
      await expect(
        store.markAutomaticPayoutDispatching(
          claim.leg.id,
          claim.leaseToken,
          now
        )
      ).rejects.toThrow();
      await expect(
        store.markAutomaticPayoutTransferred(
          claim.leg.id,
          claim.leaseToken,
          "tr_service",
          now
        )
      ).rejects.toThrow();
      expect(state.legs[0].transferId).toBeNull();
    }
  });
  it("rejects immutable charge changes on reclaims", async () => {
    const { store } = memoryDb();
    await acquired(store);
    await expect(
      store.claimAutomaticPayout(spec({ chargeId: "ch_other" }), now)
    ).rejects.toThrow("immutable");
  });
  it("cannot replace a claimed booking payment with a newly keyed leg", async () => {
    const { state, store } = memoryDb();
    await acquired(store);
    state.bookings[0].stripePaymentIntentId = "pi_replacement";
    await expect(
      store.claimAutomaticPayout(
        spec({ paymentIntentId: "pi_replacement", chargeId: "ch_replacement" }),
        now
      )
    ).rejects.toThrow("immutable");
    expect(state.legs).toHaveLength(1);
  });
  it("rejects clocks before durable ledger creation and attempts", async () => {
    const { store } = memoryDb();
    const claim = await acquired(store);
    await expect(
      store.markAutomaticPayoutDispatching(
        claim.leg.id,
        claim.leaseToken,
        new Date(now.getTime() - 1)
      )
    ).rejects.toThrow("clock");
  });
  it("fee transitions lock booking then fee then ledger; release fee independently", async () => {
    const { state, store } = memoryDb(
      booking({ status: "cancelled", paymentStatus: "unpaid" }),
      [fee()]
    );
    const source = spec({
      kind: "appointment_fee",
      feeEventId: 4,
      paymentIntentId: "pi_fee",
      chargeId: "ch_fee",
      amountInCents: 150,
      originalGrossInCents: 150,
    });
    const claim = await acquired(store, source);
    expect(state.locks.slice(0, 3)).toEqual([
      "bookings",
      "booking_fee_events",
      "automatic_payout_legs",
    ]);
    await store.markAutomaticPayoutDispatching(
      claim.leg.id,
      claim.leaseToken,
      now
    );
    await store.markAutomaticPayoutTransferred(
      claim.leg.id,
      claim.leaseToken,
      "tr_fee",
      now
    );
    expect(state.events[0]).toMatchObject({
      payoutStatus: "released",
      stripeTransferId: "tr_fee",
    });
    expect(state.bookings[0].stripeTransferId).toBeNull();
  });
  it("fee capture has its own future cutoff and 24h clock and cannot ignore client issues", async () => {
    for (const changed of [
      { chargedAt: new Date("2026-10-01") },
      { chargedAt: now },
      { clientDisputedAt: now },
      { stripeRefundId: "re_refund" },
      { status: "refunded" as const },
      { payoutEligibleAt: new Date(now.getTime() + 1) },
    ]) {
      const { store } = memoryDb(booking({ status: "cancelled" }), [
        fee(changed),
      ]);
      const source = spec({
        kind: "appointment_fee",
        feeEventId: 4,
        paymentIntentId: "pi_fee",
        chargeId: "ch_fee",
        amountInCents: 150,
        originalGrossInCents: 150,
      });
      await expect(store.claimAutomaticPayout(source, now)).rejects.toThrow();
    }
  });
  it("never persists secrets as reasons, and does not convert a connection failure into success", async () => {
    const { state, store } = memoryDb();
    const claim = await acquired(store);
    await expect(
      store.markAutomaticPayoutUncertain(
        claim.leg.id,
        claim.leaseToken,
        "sk_live_secret" as any,
        now
      )
    ).rejects.toThrow("reason");
    state.failWrite = true;
    await expect(
      store.markAutomaticPayoutDispatching(claim.leg.id, claim.leaseToken, now)
    ).rejects.toThrow("connection lost");
    expect(state.legs[0].firstAttemptAt).toBeNull();
    expect(
      await store.markAutomaticPayoutDispatching(
        claim.leg.id,
        randomUUID(),
        now
      )
    ).toBe(false);
  });
});
