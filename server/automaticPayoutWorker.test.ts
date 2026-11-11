import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ candidates: vi.fn(), claim: vi.fn(), dispatch: vi.fn(), transferred: vi.fn(), uncertain: vi.fn(), pending: vi.fn(), verify: vi.fn(), lookup: vi.fn(), create: vi.fn() }));
vi.mock("./automaticPayoutDb", () => ({ getAutomaticPayoutCandidates: mock.candidates, claimAutomaticPayout: mock.claim, markAutomaticPayoutDispatching: mock.dispatch, markAutomaticPayoutTransferred: mock.transferred, markAutomaticPayoutUncertain: mock.uncertain, markAutomaticPayoutPending: mock.pending }));
vi.mock("./automaticPayoutStripe", async importOriginal => ({ ...await importOriginal<typeof import("./automaticPayoutStripe")>(), verifyAutomaticPayoutFunding: mock.verify, lookupAutomaticPayoutTransfer: mock.lookup, createAutomaticPayoutTransfer: mock.create }));
import { releaseFutureAutomaticPayouts, assertFuturePayoutPolicy, PayoutRunBudget } from "./automaticPayout";
import { AutomaticPayoutPreflightError } from "./automaticPayoutStripe";
const now = new Date("2030-02-05T00:00:00Z");
const cutoff = new Date("2030-02-01T00:00:00Z");
const policy = { environment: "production" as const, cutoff, approvedAt: cutoff };
const candidate = { booking: { id: 10, isQaTest: false, stripePaymentIntentId: "pi_service", stripeTransferId: null, tipStatus: "none", stripeTipPaymentIntentId: null, tipAmountInCents: 0 }, tech: { id: 20, stripeConnectedAccountId: "acct_tech" }, client: { id: 30, stripeCustomerId: "cus_client" }, serviceTotalInCents: 200, legs: [] };
const ledgerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks(); vi.spyOn(console, "warn").mockImplementation(() => {});
  mock.candidates.mockResolvedValue([candidate]); mock.verify.mockResolvedValue({ chargeId: "ch_service" });
  mock.claim.mockImplementation(async spec => ({ status: "acquired", reconciliationRequired: false, leaseToken: "lease", leg: { ...spec, id: ledgerId, firstAttemptAt: null } }));
  mock.lookup.mockResolvedValue(null); mock.dispatch.mockResolvedValue(true); mock.transferred.mockResolvedValue(true); mock.uncertain.mockResolvedValue(true); mock.pending.mockResolvedValue(true); mock.create.mockResolvedValue({ id: "tr_verified" });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("future-only automatic payout worker", () => {
  it.each([{ ...policy, environment: "development" as const }, { ...policy, approvedAt: new Date(now.getTime()+1) }, { ...policy, cutoff: new Date(cutoff.getTime()-1) }, { ...policy, cutoff: new Date("invalid") }])("rejects unapproved/preview/backdated policies without querying money", async denied => { await expect(releaseFutureAutomaticPayouts(denied, now)).rejects.toThrow(); expect(mock.candidates).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled(); });
  it("accepts a production cutoff fixed at approval", () => expect(() => assertFuturePayoutPolicy(policy, now)).not.toThrow());
  it("queries only the approved cutoff and transfers the 95% service share after recording dispatch", async () => {
    const result = await releaseFutureAutomaticPayouts(policy, now);
    expect(mock.candidates).toHaveBeenCalledWith({ cutoff, now, limit: 3 });
    expect(mock.verify).toHaveBeenCalledWith(expect.objectContaining({ amountInCents: 190, grossInCents: 200, cutoff, customerId: "cus_client", accountId: "acct_tech" }));
    expect(mock.dispatch.mock.invocationCallOrder[0]).toBeLessThan(mock.create.mock.invocationCallOrder[0]);
    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ amountInCents: 190, firstAttemptAt: now }), expect.any(Number));
    expect(mock.transferred).toHaveBeenCalledWith(ledgerId, "lease", "tr_verified", now);
    expect(result).toEqual({ checked: 1, released: 1, deferred: 0, failed: 0 });
  });
  it("does not dispatch without a confirmed durable claim", async () => { mock.claim.mockResolvedValue({ status: "busy" }); await releaseFutureAutomaticPayouts(policy, now); expect(mock.create).not.toHaveBeenCalled(); });
  it("does not dispatch if the lease is lost before send", async () => { mock.dispatch.mockResolvedValue(false); await releaseFutureAutomaticPayouts(policy, now); expect(mock.create).not.toHaveBeenCalled(); });
  it("skips QA fixtures even when a data adapter returns them", async () => { mock.candidates.mockResolvedValue([{ ...candidate, booking: { ...candidate.booking, isQaTest: true } }]); await releaseFutureAutomaticPayouts(policy, now); expect(mock.verify).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled(); });
  it("records exact existing transfers instead of sending again", async () => { mock.lookup.mockResolvedValue({ id: "tr_existing" }); await releaseFutureAutomaticPayouts(policy, now); expect(mock.create).not.toHaveBeenCalled(); expect(mock.transferred).toHaveBeenCalledWith(ledgerId, "lease", "tr_existing", now); });
  it("reconciles a prior attempt even when the platform balance was consumed by that transfer", async () => {
    const prior = { mode: "live", kind: "service", bookingId: 10, feeEventId: null, techId: 20, clientId: 30, customerId: "cus_client", destination: "acct_tech", paymentIntentId: "pi_service", chargeId: "ch_service", amountInCents: 190, originalGrossInCents: 200, currency: "usd", cutoff, id: ledgerId, firstAttemptAt: new Date(now.getTime()-60_000), state: "needs_reconciliation" };
    mock.candidates.mockResolvedValue([{ ...candidate, legs: [prior] }]); mock.claim.mockResolvedValue({ status: "acquired", reconciliationRequired: true, leg: prior, leaseToken: "lease" }); mock.lookup.mockResolvedValue({ id: "tr_existing" });
    await releaseFutureAutomaticPayouts(policy, now); expect(mock.verify).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled(); expect(mock.transferred).toHaveBeenCalled();
  });
  it("never resends an ambiguous prior attempt based on an empty listing", async () => { mock.claim.mockImplementation(async spec => ({ status: "acquired", reconciliationRequired: true, leaseToken: "lease", leg: { ...spec, id: ledgerId, firstAttemptAt: now } })); await releaseFutureAutomaticPayouts(policy, now); expect(mock.create).not.toHaveBeenCalled(); expect(mock.uncertain).toHaveBeenCalledWith(ledgerId, "lease", "reconciliation_not_found", now); });
  it("keeps an already-persisted service transfer when the independent full tip fails", async () => {
    mock.candidates.mockResolvedValue([{ ...candidate, booking: { ...candidate.booking, tipStatus: "paid", stripeTipPaymentIntentId: "pi_tip", tipAmountInCents: 100 } }]);
    mock.create.mockResolvedValueOnce({ id: "tr_service" }).mockRejectedValueOnce(new AutomaticPayoutPreflightError("reconciliation_required"));
    const result = await releaseFutureAutomaticPayouts(policy, now);
    expect(mock.transferred).toHaveBeenCalledTimes(1); expect(mock.transferred).toHaveBeenCalledWith(ledgerId, "lease", "tr_service", now);
    expect(mock.create.mock.calls[1][0].amountInCents).toBe(100); expect(result).toEqual({ checked: 2, released: 1, deferred: 1, failed: 0 }); expect(mock.uncertain).toHaveBeenCalled();
  });
  it("defers insufficient funds without recording dispatch or sending money", async () => { mock.verify.mockRejectedValue(new AutomaticPayoutPreflightError("insufficient_balance")); const result = await releaseFutureAutomaticPayouts(policy, now); expect(result.deferred).toBe(1); expect(mock.dispatch).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled(); });
  it("does not treat an unpersisted successful transfer as released", async () => { mock.transferred.mockResolvedValue(false); const result = await releaseFutureAutomaticPayouts(policy, now); expect(result.released).toBe(0); expect(result.deferred).toBe(1); expect(mock.uncertain).toHaveBeenCalled(); });
  it("stops new work near its absolute callback deadline", async () => { const result = await releaseFutureAutomaticPayouts(policy, now, now.getTime()+45_000); expect(result.deferred).toBe(1); expect(mock.verify).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled(); });
  it("bounds an unresponsive database await without starting any transfer", async () => { mock.candidates.mockReturnValue(new Promise(() => {})); const promise = releaseFutureAutomaticPayouts(policy, now); const rejection = expect(promise).rejects.toThrow("PAYOUT_RUN_DEADLINE"); await vi.advanceTimersByTimeAsync(12_001); await rejection; expect(mock.create).not.toHaveBeenCalled(); });
  it("expires a budget deterministically", async () => { const budget = new PayoutRunBudget(now.getTime()+100); expect(() => budget.check(101)).toThrow("PAYOUT_RUN_DEADLINE"); });
});
