import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const mocks = vi.hoisted(() => ({
  getPayoutEligibleBookings: vi.fn(), getFeeEventsReadyForPayout: vi.fn(),
  markBookingPayoutResult: vi.fn(), updateBookingFeeEvent: vi.fn(), updateUserStripeReferences: vi.fn(),
  getBookingServiceTotalInCents: vi.fn(), getBookingServiceDurationMinutes: vi.fn(), getBookingFeeEvents: vi.fn(),
  getAttendanceFeeEligibilityCandidates: vi.fn(), createBookingFeeEvent: vi.fn(), getAppointmentFeePolicy: vi.fn(),
  createNotification: vi.fn(), markBookingFeeEventNotified: vi.fn(),
  getBookingsDueForAppointmentCodeSms: vi.fn(), markAppointmentCodeSmsSent: vi.fn(),
  getStripeIntegrationStatus: vi.fn(), getConnectedAccountReadiness: vi.fn(),
  releaseBookingPayout: vi.fn(), releaseAppointmentFeePayout: vi.fn(), sendValisseTransactionalSms: vi.fn(),
  drizzle: vi.fn(),
}));
vi.mock("./db", () => mocks);
vi.mock("./stripe", () => mocks);
vi.mock("./telnyx", () => mocks);
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: mocks.drizzle }));
import { releaseEligiblePayouts, releaseEligibleAppointmentFeePayouts } from "./payoutRelease";
import { createEligibleAttendanceFee, evaluateAttendanceFeeEligibility } from "./appointmentFees";
import { sendDueAppointmentCodeSms } from "./appointmentSms";

const now = new Date("2026-11-08T04:00:00Z");
const policy = { version: "test-policy", rules: [{
  ruleType: "no_show", enabled: true, noticeHours: 24, gracePeriodMinutes: 60,
  thresholdMode: "fixed_minutes", thresholdValue: 15, feeType: "flat",
  flatFeeInCents: 2500, feePercentBasisPoints: 0,
}] };
function booking(id = 1, extra = {}) {
  return { id, clientId: 2, techId: 3, isQaTest: false, scheduledAt: new Date(now.getTime() - 60 * 60_000),
    duration: 60, status: "confirmed", arrivedAt: null, feePolicySnapshot: policy,
    stripePaymentIntentId: `pi_${id}`, stripeTipPaymentIntentId: null,
    payoutStatus: "pending_dispute_window", stripeTransferId: "tr_previous", ...extra };
}
function tech() {
  return { id: 3, stripeConnectedAccountId: "acct_normal", stripeConnectedAccountReady: true,
    stripeConnectedAccountMode: "live", stripeTestConnectedAccountId: "acct_qa", stripeTestConnectedAccountReady: true };
}
function service(id = 1, extra = {}) { return { booking: booking(id, extra), tech: tech() }; }
function fee(id = 1, extra = {}) {
  return { event: { id, bookingId: id, amountInCents: 2500, stripePaymentIntentId: `pi_fee_${id}`,
    payoutStatus: "pending_dispute_window", stripeTransferId: "tr_previous" }, tech: tech(), booking: booking(id, extra) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.getPayoutEligibleBookings.mockResolvedValue([]);
  mocks.getFeeEventsReadyForPayout.mockResolvedValue([]);
  mocks.getAttendanceFeeEligibilityCandidates.mockResolvedValue([]);
  mocks.getBookingsDueForAppointmentCodeSms.mockResolvedValue([]);
  mocks.getStripeIntegrationStatus.mockReturnValue({ mode: "live" });
  mocks.getConnectedAccountReadiness.mockResolvedValue({ ready: true });
  mocks.releaseBookingPayout.mockResolvedValue({ id: "tr_service" });
  mocks.releaseAppointmentFeePayout.mockResolvedValue({ id: "tr_fee" });
  mocks.getBookingServiceTotalInCents.mockResolvedValue(10_000);
  mocks.getBookingServiceDurationMinutes.mockResolvedValue(60);
  mocks.getBookingFeeEvents.mockResolvedValue([]);
  mocks.createBookingFeeEvent.mockImplementation(async ({ bookingId }) => ({ event: { id: bookingId }, created: true }));
  mocks.sendValisseTransactionalSms.mockResolvedValue({ sent: false, reason: "not_configured" });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function expectNoPayoutMarkers() {
  expect(mocks.markBookingPayoutResult).not.toHaveBeenCalled();
  expect(mocks.updateBookingFeeEvent).not.toHaveBeenCalled();
}

describe("scheduled payout safety", () => {
  it("defensively suppresses QA service and fee candidates, never selecting test recipients", async () => {
    mocks.getPayoutEligibleBookings.mockResolvedValue([service(1, { isQaTest: true })]);
    mocks.getFeeEventsReadyForPayout.mockResolvedValue([fee(2, { isQaTest: true })]);
    expect(await releaseEligiblePayouts(now)).toMatchObject({ released: 0, deferred: 2, failed: 0, checked: 2 });
    expect(mocks.getConnectedAccountReadiness).not.toHaveBeenCalled();
    expect(mocks.releaseBookingPayout).not.toHaveBeenCalled();
    expect(mocks.releaseAppointmentFeePayout).not.toHaveBeenCalled();
    expectNoPayoutMarkers();
  });
  it("requires a joined booking for automatic fees", async () => {
    mocks.getFeeEventsReadyForPayout.mockResolvedValue([{ ...fee(), booking: null }]);
    expect(await releaseEligibleAppointmentFeePayouts(now)).toMatchObject({ deferred: 1, checked: 1 });
    expect(mocks.releaseAppointmentFeePayout).not.toHaveBeenCalled();
  });
  it("counts service AND fee batches and always returns the fee shape when Stripe is missing", async () => {
    mocks.getStripeIntegrationStatus.mockReturnValue({ mode: "unconfigured" });
    mocks.getPayoutEligibleBookings.mockResolvedValue([service()]);
    mocks.getFeeEventsReadyForPayout.mockResolvedValue([fee(2), fee(3)]);
    expect(await releaseEligiblePayouts(now)).toMatchObject({ released: 0, deferred: 3, failed: 0, checked: 3,
      appointmentFeePayouts: { released: 0, deferred: 2, failed: 0, checked: 2 } });
    expect(mocks.getConnectedAccountReadiness).not.toHaveBeenCalled();
    expectNoPayoutMarkers();
  });
  it("defers arbitrary readiness errors without terminal payout writes", async () => {
    mocks.getPayoutEligibleBookings.mockResolvedValue([service()]);
    mocks.getFeeEventsReadyForPayout.mockResolvedValue([fee()]);
    mocks.getConnectedAccountReadiness.mockRejectedValue(new Error("secret provider payload"));
    expect(await releaseEligiblePayouts(now)).toMatchObject({ released: 0, deferred: 2, failed: 0 });
    expectNoPayoutMarkers();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret");
  });
  it.each([
    { name: "StripeRateLimitError", statusCode: 429 },
    { name: "StripeAuthenticationError", statusCode: 401 },
    { name: "StripeConnectionError" },
    { name: "Error", code: "ETIMEDOUT" },
    { name: "AxiosError", response: { status: 503 } },
    { name: "Error", type: "StripeAuthenticationError" },
  ])("defers provider transfer outages without status mutations: %j", async (error) => {
    mocks.getPayoutEligibleBookings.mockResolvedValue([service()]);
    mocks.getFeeEventsReadyForPayout.mockResolvedValue([fee()]);
    mocks.releaseBookingPayout.mockRejectedValue(error);
    mocks.releaseAppointmentFeePayout.mockRejectedValue(error);
    expect(await releaseEligiblePayouts(now)).toMatchObject({ released: 0, deferred: 2, failed: 0 });
    expectNoPayoutMarkers();
  });
  it("counts actual transfer rejection but keeps pending records and IDs intact", async () => {
    const serviceRow = service(), feeRow = fee();
    mocks.getPayoutEligibleBookings.mockResolvedValue([serviceRow]);
    mocks.getFeeEventsReadyForPayout.mockResolvedValue([feeRow]);
    mocks.releaseBookingPayout.mockRejectedValue({ name: "StripeInvalidRequestError", statusCode: 400 });
    mocks.releaseAppointmentFeePayout.mockRejectedValue({ name: "StripeInvalidRequestError", statusCode: 400 });
    expect(await releaseEligiblePayouts(now)).toMatchObject({ released: 0, deferred: 0, failed: 2 });
    expectNoPayoutMarkers();
    expect(serviceRow.booking).toMatchObject({ payoutStatus: "pending_dispute_window", stripeTransferId: "tr_previous" });
    expect(feeRow.event).toMatchObject({ payoutStatus: "pending_dispute_window", stripeTransferId: "tr_previous" });
  });
  it("reports transfer success followed by marker failure as reconciliation, without clearing IDs", async () => {
    mocks.getPayoutEligibleBookings.mockResolvedValue([service()]);
    mocks.getFeeEventsReadyForPayout.mockResolvedValue([fee()]);
    mocks.markBookingPayoutResult.mockRejectedValue(new Error("DB unavailable"));
    mocks.updateBookingFeeEvent.mockRejectedValue(new Error("DB unavailable"));
    const result = await releaseEligiblePayouts(now);
    expect(result).toMatchObject({ released: 0, deferred: 2, failed: 0, reasonCounts: { reconciliation_needed: 2 },
      appointmentFeePayouts: { reasonCounts: { reconciliation_needed: 1 } } });
    expect(mocks.markBookingPayoutResult.mock.calls).toEqual([[1, "released", "tr_service"]]);
    expect(mocks.updateBookingFeeEvent.mock.calls).toEqual([[1, { payoutStatus: "released", stripeTransferId: "tr_fee" }]]);
  });
  it("a readiness cache write failure cannot stop a successful transfer", async () => {
    mocks.getPayoutEligibleBookings.mockResolvedValue([service()]);
    mocks.updateUserStripeReferences.mockRejectedValue(new Error("DB cache failure"));
    expect(await releaseEligiblePayouts(now)).toMatchObject({ released: 1, deferred: 0, failed: 0 });
    expect(mocks.releaseBookingPayout).toHaveBeenCalledOnce();
  });
  it("retains partial provider success for a stable-parameter retry", async () => {
    const row = service(1, { stripeTipPaymentIntentId: "pi_tip" });
    mocks.getPayoutEligibleBookings.mockResolvedValue([row]);
    mocks.releaseBookingPayout.mockRejectedValueOnce({ name: "StripeConnectionError" });
    expect(await releaseEligiblePayouts(now)).toMatchObject({ deferred: 1, released: 0 });
    expectNoPayoutMarkers();
    mocks.releaseBookingPayout.mockResolvedValueOnce({ id: "tr_service" });
    expect(await releaseEligiblePayouts(now)).toMatchObject({ released: 1 });
    expect(mocks.releaseBookingPayout.mock.calls[0]).toEqual(mocks.releaseBookingPayout.mock.calls[1]);
  });
  it("uses bounded queries and loops even if a mock returns more than requested", async () => {
    mocks.getPayoutEligibleBookings.mockResolvedValue(Array.from({ length: 7 }, (_, i) => service(i + 1)));
    mocks.getFeeEventsReadyForPayout.mockResolvedValue(Array.from({ length: 7 }, (_, i) => fee(i + 1)));
    expect(await releaseEligiblePayouts(now)).toMatchObject({ released: 10, checked: 10 });
    expect(mocks.getPayoutEligibleBookings).toHaveBeenCalledWith(now, 5);
    expect(mocks.getFeeEventsReadyForPayout).toHaveBeenCalledWith(now, 5);
    expect(mocks.releaseBookingPayout).toHaveBeenCalledTimes(5);
    expect(mocks.releaseAppointmentFeePayout).toHaveBeenCalledTimes(5);
  });
  it("surfaces unavailable candidate DB rather than a successful empty run", async () => {
    mocks.getPayoutEligibleBookings.mockRejectedValue(new Error("DB unavailable"));
    await expect(releaseEligiblePayouts(now)).rejects.toThrow("DB unavailable");
  });
});

describe("scheduled SMS and attendance eligibility", () => {
  it("suppresses QA appointment codes and never marks sent:false as delivered", async () => {
    mocks.getBookingsDueForAppointmentCodeSms.mockResolvedValue([booking(1, { isQaTest: true }), booking(2)]);
    expect(await sendDueAppointmentCodeSms(now)).toEqual({ found: 2, sent: 0, skipped: 2, failed: 0 });
    expect(mocks.sendValisseTransactionalSms).toHaveBeenCalledOnce();
    expect(mocks.markAppointmentCodeSmsSent).not.toHaveBeenCalled();
    expect(mocks.getBookingsDueForAppointmentCodeSms).toHaveBeenCalledWith(now, 5);
  });
  it("SMS sent:false does not set a fee SMS notified timestamp", async () => {
    const result = await createEligibleAttendanceFee({ booking: booking(), feeType: "no_show", now });
    expect(result).toMatchObject({ id: 1, wasCreated: true });
    expect(mocks.markBookingFeeEventNotified.mock.calls).toEqual([[1, "in_app"]]);
  });
  it("records a fee SMS timestamp only for delivered.sent true", async () => {
    mocks.sendValisseTransactionalSms.mockResolvedValue({ sent: true });
    await createEligibleAttendanceFee({ booking: booking(), feeType: "no_show", now });
    expect(mocks.markBookingFeeEventNotified).toHaveBeenCalledWith(1, "sms");
  });
  it("does not count existing fee events as new, isolates failures, and skips QA only in the scheduler", async () => {
    mocks.getAttendanceFeeEligibilityCandidates.mockResolvedValue([booking(1), booking(2), booking(3), booking(4, { isQaTest: true })]);
    mocks.createBookingFeeEvent.mockImplementation(async ({ bookingId }) => {
      if (bookingId === 2) throw new Error("one item failed");
      return { event: { id: bookingId }, created: bookingId !== 1 };
    });
    expect(await evaluateAttendanceFeeEligibility(now)).toEqual({ checked: 4, created: 1, failed: 1 });
    expect(mocks.getAttendanceFeeEligibilityCandidates).toHaveBeenCalledWith(now, 5);
    expect(mocks.createBookingFeeEvent).toHaveBeenCalledTimes(3);
    const manualQa = await createEligibleAttendanceFee({ booking: booking(4, { isQaTest: true }), feeType: "no_show", now });
    expect(manualQa).toMatchObject({ id: 4, wasCreated: true });
    expect(mocks.createNotification).toHaveBeenCalledOnce();
  });
});

describe("actual candidate helpers using mocked DB construction only", () => {
  it("all four throw when unavailable and use non-QA deterministic bounded SQL when available", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const actual = await vi.importActual<typeof import("./db")>("./db");
    const helpers = [actual.getBookingsDueForAppointmentCodeSms, actual.getPayoutEligibleBookings,
      actual.getFeeEventsReadyForPayout, actual.getAttendanceFeeEligibilityCandidates];
    for (const helper of helpers) await expect(helper(now)).rejects.toThrow("DB unavailable");
    const captured: Array<{ selection: any; where: any; order: any[]; limit: number; joins: any[] }> = [];
    mocks.drizzle.mockImplementation(() => ({ select(selection: any) {
      const query = { selection, where: null as any, order: [] as any[], limit: 0, joins: [] as any[] };
      captured.push(query);
      const chain: any = {
        from() { return chain; }, innerJoin(table: any) { query.joins.push(table); return chain; },
        leftJoin() { return chain; }, where(value: any) { query.where = value; return chain; },
        orderBy(...values: any[]) { query.order = values; return chain; },
        limit(value: number) { query.limit = value; return Promise.resolve([]); },
      };
      return chain;
    } }));
    vi.stubEnv("DATABASE_URL", "mock-only-no-network");
    for (const helper of helpers) await helper(now, 5);
    const dialect = new MySqlDialect();
    for (const query of captured) {
      const sql = dialect.sqlToQuery(query.where);
      expect(sql.sql).toContain("`bookings`.`isQaTest` = ?");
      expect(sql.params).toContain(false);
      expect(query.limit).toBe(5);
      expect(query.order).toHaveLength(2);
    }
    expect(captured[0].selection).toHaveProperty("isQaTest");
    expect(captured[2].selection).toHaveProperty("booking");
    expect(captured[2].joins).toHaveLength(1);
  });
});
