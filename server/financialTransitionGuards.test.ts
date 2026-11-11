import { getTableName, type SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FINANCIAL_ISSUE_WINDOW_MS,
  assertBookingIssueReport,
  assertGenericBookingStatus,
  assertStoredTipCompletion,
  isWithinOriginalIssueWindow,
  validateFinancialServiceLines,
} from "../shared/financialTransitions";

const mocks = vi.hoisted(() => ({
  db: null as any,
  charge: vi.fn(),
  createTip: vi.fn(),
  retrieveTip: vi.fn(),
  verifyTip: vi.fn(),
  sms: vi.fn(),
}));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => new Proxy({}, { get: (_target, key) => typeof mocks.db[key] === "function" ? mocks.db[key].bind(mocks.db) : mocks.db[key] }) }));
vi.mock("./stripe", async (original) => ({
  ...await original<typeof import("./stripe")>(),
  chargeSavedCard: mocks.charge,
  createTipPaymentIntent: mocks.createTip,
  verifyTipPaymentIntent: mocks.verifyTip,
  getStripe: () => ({ paymentIntents: { retrieve: mocks.retrieveTip } }),
  getStripeIntegrationStatus: () => ({ configured: true, mode: "test" }),
}));
vi.mock("./telnyx", async (original) => ({ ...await original<typeof import("./telnyx")>(), sendValisseTransactionalSms: mocks.sms }));

import {
  createBookingRevision,
  createPendingBookingTip,
  declineBookingTip,
  markBookingPaymentResult,
  replaceBookingServiceLines,
  reportBookingIssue,
  reportBookingFeeIssue,
  resolveBookingRevision,
  setBookingTipPaymentIntent,
  updateBookingStatus,
} from "./db";
import { appRouter } from "./routers";

const now = new Date("2026-11-10T18:00:00.000Z");
const completedAt = new Date("2026-11-10T12:00:00.000Z");
const eligibleAt = new Date(completedAt.getTime() + FINANCIAL_ISSUE_WINDOW_MS);
const line = { techServiceId: 7, serviceName: "Gel manicure", lineType: "primary" as const, priceInCents: 5000, durationMinutes: 60, position: 0 };
function booking(overrides: Record<string, unknown> = {}): any {
  return {
    id: 77, clientId: 1, techId: 2, postId: null, scheduledAt: completedAt,
    status: "completed", paymentStatus: "paid", payoutStatus: "pending_dispute_window", revisionStatus: "none",
    paymentMethodStatus: "saved", startedAt: new Date(completedAt.getTime() - 60 * 60 * 1000), completedAt,
    paymentCapturedAt: completedAt, payoutEligibleAt: eligibleAt, stripePaymentIntentId: "pi_service",
    stripeTipPaymentIntentId: null, tipStatus: "none", tipAmountInCents: 0,
    issueReportedAt: null, issueReason: null, issueResolution: "none", issueResolvedAt: null,
    isQaTest: false, needsReview: false, duration: 60, ...overrides,
  };
}
function pending(overrides: Record<string, unknown> = {}) {
  return booking({ status: "pending", paymentStatus: "unpaid", payoutStatus: "not_ready", startedAt: null, completedAt: null, paymentCapturedAt: null, payoutEligibleAt: null, stripePaymentIntentId: null, ...overrides });
}
function intent(id = "pi_tip", amount = 500): any {
  return { id, client_secret: `${id}_secret`, customer: "cus_client", amount, amount_received: amount, currency: "usd", livemode: false, status: "requires_payment_method", metadata: { booking_id: "77", kind: "tip" } };
}
function caller(id = 1) {
  return appRouter.createCaller({ user: { id, userType: id === 2 ? "nail_tech" : "client", role: "user", deactivatedAt: null, emailVerificationRequired: false, stripeCustomerId: "cus_client", stripeCustomerMode: "test" }, req: { headers: {} }, res: {} } as any);
}

const dialect = new MySqlDialect();
function matches(row: any, predicate?: SQL): boolean {
  if (!predicate) return true;
  const query = dialect.sqlToQuery(predicate);
  const comparisons = [...query.sql.matchAll(/`[^`]+`\.`([^`]+)`\s*=\s*\?/g)];
  return comparisons.every(([, key], index) => row[key] === query.params[index]);
}
/** Serialized transactions, actual lock logs, failure injection, and rollback; no network/database access. */
function memoryDb(initial = booking()) {
  const state = {
    rows: {
      bookings: [initial], booking_service_lines: [{ id: 1, bookingId: 77, ...line }], booking_revisions: [] as any[],
      users: [{ id: 1, stripeCustomerId: "cus_client", stripeCustomerMode: "test" }], notifications: [] as any[],
      post_analytics: [] as any[],
    } as Record<string, any[]>,
    locks: [] as string[], writes: [] as string[], transactions: 0, depth: 0,
    lockHook: undefined as undefined | ((table: string) => void),
    failWriteTable: "", failNotification: false,
  };
  let tail = Promise.resolve();
  const db: any = {
    select(selection?: any) {
      let table = ""; let predicate: SQL | undefined; let limit = Infinity; let locked = false;
      const chain: any = {
        from(t: any) { table = getTableName(t); return chain; },
        where(w: SQL) { predicate = w; return chain; },
        limit(n: number) { limit = n; return chain; },
        orderBy() { return chain; },
        for(mode: string) { if (mode !== "update") throw new Error("Expected update lock"); locked = true; return chain; },
        then(resolve: any, reject: any) {
          return Promise.resolve().then(() => {
            if (locked) {
              if (!state.depth) throw new Error("Lock outside transaction");
              state.locks.push(table);
              state.lockHook?.(table);
            }
            return (state.rows[table] ?? []).filter((row) => matches(row, predicate)).slice(0, limit).map((row) => {
              if (!selection) return structuredClone(row);
              return Object.fromEntries(Object.entries(selection).map(([key, column]: [string, any]) => [key, row[column.name]]));
            });
          }).then(resolve, reject);
        },
      };
      return chain;
    },
    update(t: any) {
      const table = getTableName(t);
      return { set: (values: any) => ({ where: async (predicate: SQL) => {
        if (state.failWriteTable === table) throw new Error("Injected write failure");
        state.writes.push(table);
        for (const row of state.rows[table] ?? []) if (matches(row, predicate)) Object.assign(row, Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)));
      } }) };
    },
    delete(t: any) {
      const table = getTableName(t);
      return { where: async (predicate: SQL) => { state.writes.push(table); state.rows[table] = (state.rows[table] ?? []).filter((row) => !matches(row, predicate)); } };
    },
    insert(t: any) {
      const table = getTableName(t);
      return { values: async (values: any) => {
        if (state.failWriteTable === table || (table === "notifications" && state.failNotification)) throw new Error("Injected write failure");
        state.writes.push(table);
        const rows = Array.isArray(values) ? values : [values];
        const target = state.rows[table] ??= [];
        const firstId = target.length + 1;
        for (const row of rows) target.push({ id: target.length + 1, ...(table === "booking_revisions" ? { status: "pending", createdAt: now } : {}), ...structuredClone(row) });
        return [{ insertId: firstId }];
      } };
    },
    transaction(work: any) {
      // Queue all independent operations; the production resolver itself must
      // not call getDb/a root helper and open a nested transaction.
      const result = tail.then(async () => {
        const snapshot = structuredClone(state.rows);
        state.transactions++; state.depth++;
        try { return await work(db); } catch (error) { state.rows = snapshot; throw error; } finally { state.depth--; }
      });
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  mocks.db = db;
  return state;
}

let state: ReturnType<typeof memoryDb>;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("DATABASE_URL", "mysql://offline-only.invalid/never-connect");
  vi.clearAllMocks();
  mocks.sms.mockResolvedValue({ sent: false });
  mocks.charge.mockResolvedValue({ id: "pi_service", status: "succeeded" });
  mocks.createTip.mockResolvedValue(intent()); mocks.retrieveTip.mockResolvedValue(intent());
  mocks.verifyTip.mockResolvedValue({ ...intent(), status: "succeeded" });
  state = memoryDb();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("financial status and payment guards", () => {
  it("rejects generic completion instead of bypassing verified start and capture", async () => {
    state = memoryDb(pending());
    await expect(updateBookingStatus(77, "completed", 2)).rejects.toThrow("code-verified");
    expect(state.rows.bookings[0].status).toBe("pending"); expect(state.writes).toEqual([]);
  });
  it.each(["confirmed", "declined"] as const)("rejects %s for paid bookings and unresolved revisions", async (status) => {
    await expect(updateBookingStatus(77, status, 2)).rejects.toThrow("unpaid, pending");
    state = memoryDb(pending({ revisionStatus: "pending" }));
    await expect(updateBookingStatus(77, status, 2)).rejects.toThrow("pending revised quote");
    expect(state.writes).toEqual([]);
  });
  it("confirms once only and preserves assigned-technician ownership", async () => {
    state = memoryDb(pending());
    await expect(updateBookingStatus(77, "confirmed", 1)).rejects.toThrow("assigned");
    await updateBookingStatus(77, "confirmed", 2);
    await expect(updateBookingStatus(77, "confirmed", 2)).rejects.toThrow("pending");
    expect(state.rows.bookings[0].status).toBe("confirmed"); expect(state.writes).toEqual(["bookings"]);
  });
  it("rejects an actual pending revision even when a legacy booking flag is inconsistent", async () => {
    state = memoryDb(pending());
    state.rows.booking_revisions.push({ id: 9, bookingId: 77, techId: 2, status: "pending" });
    await expect(updateBookingStatus(77, "confirmed", 2)).rejects.toThrow("pending revised quote");
    await expect(updateBookingStatus(77, "declined", 2)).rejects.toThrow("pending revised quote");
    await expect(replaceBookingServiceLines(77, [line])).rejects.toThrow("awaits the client");
    expect(state.writes).toEqual([]);
  });
  it.each([booking(), booking({ status: "in_progress", paymentStatus: "unpaid" }), pending({ status: "cancelled" })])("rejects cancelling a paid, started, or terminal booking", async (row) => {
    state = memoryDb(row); await expect(updateBookingStatus(77, "cancelled", 1)).rejects.toThrow("not started"); expect(state.writes).toEqual([]);
  });
  it("allows an unpaid unstarted confirmed participant cancellation", async () => {
    state = memoryDb(pending({ status: "confirmed" })); await updateBookingStatus(77, "cancelled", 1); expect(state.rows.bookings[0].status).toBe("cancelled");
  });
  it.each(["payment_due", "unpaid", "failed"] as const)("never downgrades a capture to %s", async (paymentStatus) => {
    const original = structuredClone(state.rows.bookings[0]);
    const result = await markBookingPaymentResult(77, { paymentStatus, status: "payment_due", payoutStatus: "not_ready" });
    expect(result.paymentStatus).toBe("paid"); expect(state.rows.bookings[0]).toEqual(original); expect(state.writes).toEqual([]);
  });
  it("keeps duplicate capture time and a claimed payout immutable", async () => {
    state = memoryDb(booking({ payoutStatus: "released" }));
    await markBookingPaymentResult(77, { paymentStatus: "paid", stripePaymentIntentId: "pi_service", paymentCapturedAt: now, payoutStatus: "pending_dispute_window" });
    expect(state.rows.bookings[0].paymentCapturedAt).toEqual(completedAt); expect(state.rows.bookings[0].payoutStatus).toBe("released");
    await expect(markBookingPaymentResult(77, { paymentStatus: "paid", stripePaymentIntentId: "pi_other" })).rejects.toThrow("different service payment");
  });
  it("continues recording genuine unpaid charge failures", async () => {
    state = memoryDb(pending({ status: "completed" }));
    await markBookingPaymentResult(77, { paymentStatus: "payment_due", status: "payment_due", payoutStatus: "not_ready" });
    expect(state.rows.bookings[0].paymentStatus).toBe("payment_due");
  });
});

describe("issue reports are transaction-time bounded", () => {
  it("records the locked current time rather than a caller-supplied historical date", async () => {
    await reportBookingIssue(77, "The service caused a problem", completedAt);
    expect(state.rows.bookings[0]).toMatchObject({ status: "disputed", payoutStatus: "on_hold", issueReportedAt: now });
    expect(state.locks).toEqual(["bookings"]);
  });
  it("rejects the exact original 24-hour boundary even with an extended payout hold", async () => {
    state = memoryDb(booking({ payoutEligibleAt: new Date(eligibleAt.getTime() + FINANCIAL_ISSUE_WINDOW_MS) }));
    vi.setSystemTime(eligibleAt);
    await expect(reportBookingIssue(77, "The service caused a problem", completedAt)).rejects.toThrow("24-hour"); expect(state.writes).toEqual([]);
  });
  it("checks time after the locking query rather than before a lock wait", async () => {
    vi.setSystemTime(new Date(eligibleAt.getTime() - 1));
    state.lockHook = () => { vi.setSystemTime(eligibleAt); };
    await expect(reportBookingIssue(77, "The service caused a problem")).rejects.toThrow("24-hour"); expect(state.writes).toEqual([]);
  });
  it("rejects after automatic payout claim updates the locked booking", async () => {
    state.lockHook = () => { state.rows.bookings[0].payoutStatus = "released"; };
    await expect(reportBookingIssue(77, "The service caused a problem")).rejects.toThrow("not currently eligible"); expect(state.writes).toEqual([]);
  });
  it.each([
    { completedAt: new Date(now.getTime() + 1) }, { paymentCapturedAt: new Date(now.getTime() + 1) },
    { completedAt: new Date("invalid") }, { payoutEligibleAt: new Date(now.getTime() - 1) },
    { issueReportedAt: completedAt }, { issueReason: "Existing report" }, { payoutStatus: "on_hold" },
  ])("rejects invalid dates, ended holds, and existing issues", async (overrides) => {
    state = memoryDb(booking(overrides)); await expect(reportBookingIssue(77, "The service caused a problem")).rejects.toThrow(); expect(state.writes).toEqual([]);
  });
  it("does not allow future supplied report time", async () => {
    await expect(reportBookingIssue(77, "The service caused a problem", new Date(now.getTime() + 1))).rejects.toThrow("date is invalid");
  });
});

describe("immutable quotes and atomic booking revisions", () => {
  function addRevision(overrides: Record<string, unknown> = {}) {
    state.rows.bookings[0].revisionStatus = "pending";
    state.rows.booking_revisions.push({ id: 9, bookingId: 77, techId: 2, status: "pending", serviceLines: [{ ...line, priceInCents: 6000 }], totalPriceInCents: 6000, totalDurationMinutes: 60, ...overrides });
  }
  it.each([booking(), pending({ status: "confirmed" }), pending({ status: "in_progress", startedAt: now })])("does not replace paid, confirmed, or started service amounts", async (row) => {
    state = memoryDb(row); await expect(replaceBookingServiceLines(77, [{ ...line, priceInCents: 1 }])).rejects.toThrow("unpaid, pending"); expect(state.rows.booking_service_lines[0].priceInCents).toBe(5000);
  });
  it("validates all lines before deletion and strips unexpected JSON columns", async () => {
    state = memoryDb(pending());
    await expect(replaceBookingServiceLines(77, [{ ...line, priceInCents: -1 }])).rejects.toThrow("invalid"); expect(state.writes).toEqual([]);
    await replaceBookingServiceLines(77, [{ ...line, bookingId: 888, id: 999 } as any]);
    expect(state.rows.booking_service_lines[0]).toMatchObject({ bookingId: 77, id: 1 });
  });
  it("locks booking then revisions when proposing, and prevents a second pending quote", async () => {
    state = memoryDb(pending());
    await createBookingRevision({ bookingId: 77, techId: 2, serviceLines: [line] });
    expect(state.locks).toEqual(["bookings", "booking_revisions"]);
    await expect(createBookingRevision({ bookingId: 77, techId: 2, serviceLines: [line] })).rejects.toThrow("pending revised quote");
    expect(state.rows.booking_revisions).toHaveLength(1);
  });
  it("enforces proposal ownership and pending unpaid state", async () => {
    state = memoryDb(pending()); await expect(createBookingRevision({ bookingId: 77, techId: 3, serviceLines: [line] })).rejects.toThrow("assigned");
    state = memoryDb(booking()); await expect(createBookingRevision({ bookingId: 77, techId: 2, serviceLines: [line] })).rejects.toThrow("unpaid, pending");
  });
  it("resolves accepted snapshots within exactly one booking-first transaction", async () => {
    state = memoryDb(pending()); addRevision();
    await resolveBookingRevision({ bookingId: 77, revisionId: 9, clientId: 1, accepted: true });
    expect(state.transactions).toBe(1); expect(state.locks).toEqual(["bookings", "booking_revisions"]);
    expect(state.rows.bookings[0]).toMatchObject({ status: "confirmed", revisionStatus: "accepted", duration: 60 });
    expect(state.rows.booking_service_lines[0].priceInCents).toBe(6000); expect(state.rows.booking_revisions[0].status).toBe("accepted");
  });
  it("rolls back snapshot deletion and revision acceptance when the final booking write fails", async () => {
    state = memoryDb(pending()); addRevision(); state.failWriteTable = "bookings";
    await expect(resolveBookingRevision({ bookingId: 77, revisionId: 9, clientId: 1, accepted: true })).rejects.toThrow("Injected");
    expect(state.rows.booking_service_lines[0].priceInCents).toBe(5000); expect(state.rows.booking_revisions[0].status).toBe("pending"); expect(state.rows.bookings[0].status).toBe("pending");
  });
  it.each([{ totalPriceInCents: 1 }, { status: "accepted" }, { techId: 3 }, { serviceLines: [{ ...line, priceInCents: -1 }] }])("rejects stale or malformed persisted revisions without writes", async (overrides) => {
    state = memoryDb(pending()); addRevision(overrides);
    await expect(resolveBookingRevision({ bookingId: 77, revisionId: 9, clientId: 1, accepted: true })).rejects.toThrow(); expect(state.writes).toEqual([]);
  });
  it("rejects another client and a quote that became paid before resolution", async () => {
    state = memoryDb(pending()); addRevision();
    await expect(resolveBookingRevision({ bookingId: 77, revisionId: 9, clientId: 5, accepted: false })).rejects.toThrow("client");
    state.rows.bookings[0].paymentStatus = "paid";
    await expect(resolveBookingRevision({ bookingId: 77, revisionId: 9, clientId: 1, accepted: true })).rejects.toThrow("unpaid, pending");
  });
  it("declines only the pending quote without changing the old snapshot", async () => {
    state = memoryDb(pending()); addRevision(); await resolveBookingRevision({ bookingId: 77, revisionId: 9, clientId: 1, accepted: false });
    expect(state.rows.bookings[0].status).toBe("declined"); expect(state.rows.booking_service_lines[0].priceInCents).toBe(5000);
  });
});

describe("single pending tip reservation and immutable final choices", () => {
  const tip = { stripeTipPaymentIntentId: "pi_tip", amountInCents: 500 };
  it("reserves the intent and amount before a charge may be confirmed", async () => {
    await createPendingBookingTip(77, tip);
    expect(state.rows.bookings[0]).toMatchObject({ stripeTipPaymentIntentId: "pi_tip", tipAmountInCents: 500, tipStatus: "none" });
    await setBookingTipPaymentIntent(77, tip); expect(state.rows.bookings[0].tipStatus).toBe("paid");
  });
  it("permits exact same paid tip completion as a no-write idempotent success", async () => {
    state = memoryDb(booking({ tipStatus: "paid", stripeTipPaymentIntentId: "pi_tip", tipAmountInCents: 500, payoutStatus: "released" }));
    await expect(setBookingTipPaymentIntent(77, tip)).resolves.toEqual({ wasRecorded: false }); expect(state.writes).toEqual([]);
    await expect(setBookingTipPaymentIntent(77, { ...tip, stripeTipPaymentIntentId: "pi_other" })).rejects.toThrow();
    await expect(setBookingTipPaymentIntent(77, { ...tip, amountInCents: 600 })).rejects.toThrow();
  });
  it("rejects an unreserved successful tip and a concurrently declined final choice", async () => {
    await expect(setBookingTipPaymentIntent(77, tip)).rejects.toThrow("pending tip");
    state = memoryDb(booking({ tipStatus: "declined" })); await expect(setBookingTipPaymentIntent(77, tip)).rejects.toThrow("final tip");
  });
  it("does not discard a pending intent when decline races verification", async () => {
    await createPendingBookingTip(77, tip);
    await expect(declineBookingTip(77)).rejects.toThrow("pending payment");
    await setBookingTipPaymentIntent(77, tip); expect(state.rows.bookings[0].stripeTipPaymentIntentId).toBe("pi_tip");
  });
  it("serializes competing reservations so only one can return a secret", async () => {
    const results = await Promise.allSettled([createPendingBookingTip(77, tip), createPendingBookingTip(77, { ...tip, stripeTipPaymentIntentId: "pi_other" })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1); expect(state.rows.bookings[0].stripeTipPaymentIntentId).toBe("pi_tip");
  });
  it("serializes decline against reservation and prevents both from succeeding", async () => {
    const results = await Promise.allSettled([declineBookingTip(77), createPendingBookingTip(77, tip)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(state.rows.bookings[0]).toMatchObject({ tipStatus: "declined", stripeTipPaymentIntentId: null, tipAmountInCents: 0 });
  });
  it("never overwrites a tip paid between the initial read and booking lock", async () => {
    const winner = { stripeTipPaymentIntentId: "pi_winner", amountInCents: 700 };
    await createPendingBookingTip(77, winner); state.writes = [];
    const results = await Promise.allSettled([setBookingTipPaymentIntent(77, winner), setBookingTipPaymentIntent(77, tip)]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(state.rows.bookings[0]).toMatchObject({ tipStatus: "paid", stripeTipPaymentIntentId: "pi_winner", tipAmountInCents: 700 }); expect(state.writes).toEqual(["bookings"]);
  });
  it("permits late verified completion of the stored intent after service payout without orphaning it", async () => {
    await createPendingBookingTip(77, tip); vi.setSystemTime(new Date(eligibleAt.getTime() + 1)); state.rows.bookings[0].payoutStatus = "released";
    await setBookingTipPaymentIntent(77, tip); expect(state.rows.bookings[0].tipStatus).toBe("paid"); expect(state.rows.bookings[0].payoutStatus).toBe("released");
  });
  it("rejects new tip reservations after the original window and unresolved issues", async () => {
    vi.setSystemTime(eligibleAt); await expect(createPendingBookingTip(77, tip)).rejects.toThrow("24-hour");
    vi.setSystemTime(now); state = memoryDb(booking({ issueReportedAt: completedAt }));
    await expect(createPendingBookingTip(77, tip)).rejects.toThrow("unresolved issue");
  });
  it("does not complete a reserved tip after an unresolved issue won the booking lock", async () => {
    await createPendingBookingTip(77, tip); state.rows.bookings[0].issueReportedAt = now; state.rows.bookings[0].payoutStatus = "on_hold";
    await expect(setBookingTipPaymentIntent(77, tip)).rejects.toThrow("unresolved issue"); expect(state.rows.bookings[0].tipStatus).toBe("none");
  });
});

describe("authenticated router financial flows (all provider calls mocked)", () => {
  it("returns paid completion when notification inserts fail, never paymentDue", async () => {
    state = memoryDb(pending({ status: "in_progress", startedAt: completedAt })); state.failNotification = true;
    await expect(caller(2).appointment.complete({ bookingId: 77 })).resolves.toEqual({ success: true, paymentDue: false });
    expect(state.rows.bookings[0].paymentStatus).toBe("paid"); expect(mocks.charge).toHaveBeenCalledTimes(1);
  });
  it("returns paymentDue for an actual failed service charge", async () => {
    state = memoryDb(pending({ status: "in_progress", startedAt: completedAt })); mocks.charge.mockRejectedValue(new Error("declined")); state.failNotification = true;
    await expect(caller(2).appointment.complete({ bookingId: 77 })).resolves.toEqual({ success: true, paymentDue: true }); expect(state.rows.bookings[0].paymentStatus).toBe("payment_due");
  });
  it("does not attempt payment when service snapshots are unavailable", async () => {
    state = memoryDb(pending({ status: "in_progress", startedAt: completedAt })); state.rows.booking_service_lines = [];
    await expect(caller(2).appointment.complete({ bookingId: 77 })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(mocks.charge).not.toHaveBeenCalled(); expect(state.rows.bookings[0].status).toBe("in_progress");
  });
  it("does not label a post-capture database failure as a failed charge", async () => {
    state = memoryDb(pending({ status: "in_progress", startedAt: completedAt }));
    mocks.charge.mockImplementation(async () => { state.failWriteTable = "bookings"; return { id: "pi_service", status: "succeeded" }; });
    await expect(caller(2).appointment.complete({ bookingId: 77 })).rejects.toThrow("Injected"); expect(state.rows.bookings[0].paymentStatus).toBe("unpaid"); expect(state.rows.bookings[0].status).toBe("completed");
  });
  it("reveals only a persisted pending tip and retrieves it for same-amount reopening", async () => {
    const api = caller().appointment;
    const first = await api.createTip({ bookingId: 77, amountInCents: 500 }); expect(first.paymentIntentId).toBe(state.rows.bookings[0].stripeTipPaymentIntentId);
    const reopened = await api.createTip({ bookingId: 77, amountInCents: 500 }); expect(reopened.clientSecret).toBe(first.clientSecret);
    expect(mocks.createTip).toHaveBeenCalledTimes(1); expect(mocks.retrieveTip).toHaveBeenCalledWith("pi_tip");
    await expect(api.createTip({ bookingId: 77, amountInCents: 600 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("Finish the current tip first") }); expect(mocks.createTip).toHaveBeenCalledTimes(1);
  });
  it("never returns a race-loser client secret", async () => {
    let sequence = 0; mocks.createTip.mockImplementation(async () => intent(`pi_tip_${++sequence}`));
    const results = await Promise.allSettled([caller().appointment.createTip({ bookingId: 77, amountInCents: 500 }), caller().appointment.createTip({ bookingId: 77, amountInCents: 500 })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const successful = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>;
    expect(successful.value.paymentIntentId).toBe(state.rows.bookings[0].stripeTipPaymentIntentId);
  });
  it("rejects wrong-customer pending intent reuse and mismatched completion before verification", async () => {
    await createPendingBookingTip(77, { stripeTipPaymentIntentId: "pi_tip", amountInCents: 500 });
    mocks.retrieveTip.mockResolvedValue({ ...intent(), customer: "cus_other" });
    await expect(caller().appointment.createTip({ bookingId: 77, amountInCents: 500 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().appointment.tipComplete({ bookingId: 77, paymentIntentId: "pi_other", amountInCents: 500 })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(mocks.verifyTip).not.toHaveBeenCalled();
  });
  it("verifies late stored tip completion and makes paid retries idempotent", async () => {
    await createPendingBookingTip(77, { stripeTipPaymentIntentId: "pi_tip", amountInCents: 500 }); vi.setSystemTime(new Date(eligibleAt.getTime() + 1)); state.rows.bookings[0].payoutStatus = "released";
    const request = { bookingId: 77, paymentIntentId: "pi_tip", amountInCents: 500 };
    await expect(caller().appointment.tipComplete(request)).resolves.toEqual({ success: true });
    await expect(caller().appointment.tipComplete(request)).resolves.toEqual({ success: true }); expect(mocks.verifyTip).toHaveBeenCalledTimes(1);
  });
  it("checks currency, mode, and received amount after successful tip verification", async () => {
    await createPendingBookingTip(77, { stripeTipPaymentIntentId: "pi_tip", amountInCents: 500 }); mocks.verifyTip.mockResolvedValue({ ...intent(), status: "succeeded", amount_received: 100 });
    await expect(caller().appointment.tipComplete({ bookingId: 77, paymentIntentId: "pi_tip", amountInCents: 500 })).rejects.toMatchObject({ code: "BAD_REQUEST" }); expect(state.rows.bookings[0].tipStatus).toBe("none");
  });
  it("preserves ownership and reports expired windows using clear BAD_REQUEST errors", async () => {
    await expect(caller(2).appointment.createTip({ bookingId: 77, amountInCents: 500 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.setSystemTime(eligibleAt); await expect(caller().appointment.reportIssue({ bookingId: 77, reason: "The service caused a problem" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("24-hour") });
    const summary = await caller().appointment.tipSummary({ bookingId: 77 }); expect(summary.canChooseTip).toBe(false);
  });
  it("sets the verified-start code after an authenticated pending quote acceptance", async () => {
    state = memoryDb(pending({ revisionStatus: "pending" }));
    state.rows.booking_revisions.push({ id: 9, bookingId: 77, techId: 2, status: "pending", serviceLines: [line], totalPriceInCents: 5000, totalDurationMinutes: 60 });
    await expect(caller().smartService.respondToRevision({ bookingId: 77, revisionId: 9, accepted: true })).resolves.toEqual({ success: true });
    expect(state.rows.bookings[0]).toMatchObject({ status: "confirmed", revisionStatus: "accepted", appointmentCodeHash: expect.any(String), appointmentCodeVisibleAt: expect.any(Date) });
  });
  it("blocks paid revision responses using BAD_REQUEST while preserving client ownership", async () => {
    await expect(caller().smartService.respondToRevision({ bookingId: 77, revisionId: 9, accepted: true })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("unpaid, pending") });
    await expect(caller(2).smartService.respondToRevision({ bookingId: 77, revisionId: 9, accepted: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("pure financial validation boundaries", () => {
  it("does not reopen issue windows with later payout eligibility", () => {
    const row = booking({ payoutEligibleAt: new Date(eligibleAt.getTime() + FINANCIAL_ISSUE_WINDOW_MS) });
    expect(isWithinOriginalIssueWindow(row, new Date(eligibleAt.getTime() - 1))).toBe(true);
    expect(isWithinOriginalIssueWindow(row, eligibleAt)).toBe(false); expect(() => assertBookingIssueReport(row, eligibleAt)).toThrow("24-hour");
  });
  it("keeps already-paid legacy tips exact-match idempotent without rewriting them", () => {
    expect(() => assertStoredTipCompletion(booking({ tipStatus: "paid", stripeTipPaymentIntentId: "pi_legacy", tipAmountInCents: 500 }), "pi_legacy", 500)).not.toThrow();
  });
  it("rejects invalid service snapshots, duplicate selections, and fractional cents", () => {
    for (const invalid of [[], [{ ...line, priceInCents: 1.5 }], [{ ...line, durationMinutes: -1 }], [line, { ...line, position: 1 }]]) expect(() => validateFinancialServiceLines(invalid)).toThrow();
    expect(() => assertGenericBookingStatus(pending({ paymentCapturedAt: now }), "confirmed")).toThrow("unpaid, pending");
  });
});

describe("fee disputes share payout lock order and original review deadline", () => {
  function fee(overrides: Record<string, unknown> = {}) { state.rows.booking_fee_events = [{ id: 88, bookingId: 77, clientId: 1, status: "charged", payoutStatus: "pending_dispute_window", chargedAt: completedAt, payoutEligibleAt: eligibleAt, stripeTransferId: null, clientDisputedAt: null, ...overrides }]; }
  it("places a timely fee report on hold under booking then fee locks", async () => { fee(); await reportBookingFeeIssue(88, 1, "Fee applied despite timely arrival"); expect(state.locks).toEqual(["bookings", "booking_fee_events"]); expect(state.rows.booking_fee_events[0].status).toBe("disputed"); expect(state.rows.booking_fee_events[0].payoutStatus).toBe("on_hold"); });
  it("checks the clock after acquiring locks, not before waiting", async () => { fee(); state.lockHook = table => { if (table === "booking_fee_events") vi.setSystemTime(eligibleAt); }; await expect(reportBookingFeeIssue(88, 1, "Late lock contention")).rejects.toThrow("24-hour"); expect(state.writes).toEqual([]); });
  it("refuses a foreign client", async () => { fee(); await expect(reportBookingFeeIssue(88, 2, "Wrong party")).rejects.toThrow(); expect(state.writes).toEqual([]); });
  it.each([{ payoutStatus: "released", stripeTransferId: "tr_existing" }, { clientDisputedAt: now }, { chargedAt: new Date("invalid") }, { payoutEligibleAt: new Date(now.getTime()-1) }, { chargedAt: new Date(now.getTime()+1) }])("refuses stale, already-paid or invalid fee evidence", async overrides => { fee(overrides); await expect(reportBookingFeeIssue(88, 1, "Should not reopen")).rejects.toThrow(); expect(state.writes).toEqual([]); });
});
