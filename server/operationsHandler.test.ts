import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { OPERATIONS_CALLBACK_PATH, OPERATIONS_JOB_KEY, emptyOperationsSteps } from "../shared/operations";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), lookup: vi.fn(), begin: vi.fn(), finish: vi.fn(), snapshot: vi.fn(), payouts: vi.fn(), sms: vi.fn(), fees: vi.fn(), futurePayouts: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateCronRequest: mocks.auth } }));
vi.mock("./operationsDb", () => ({ getOperationsJobByTaskUid: mocks.lookup, beginOperationsRun: mocks.begin, finishOperationsRun: mocks.finish, getOperationsSnapshot: mocks.snapshot }));
vi.mock("./payoutRelease", () => ({ releaseEligiblePayouts: mocks.payouts }));
vi.mock("./appointmentSms", () => ({ sendDueAppointmentCodeSms: mocks.sms }));
vi.mock("./appointmentFees", () => ({ evaluateAttendanceFeeEligibility: mocks.fees }));
vi.mock("./automaticPayout", async importOriginal => ({ ...await importOriginal<typeof import("./automaticPayout")>(), releaseFutureAutomaticPayouts: mocks.futurePayouts }));
import { handlePayoutRelease, executeOperationsSteps } from "./payoutReleaseHandler";
const job = { jobId: 1, jobKey: OPERATIONS_JOB_KEY, environment: "production", scheduleCronTaskUid: "T_owned", callbackPath: OPERATIONS_CALLBACK_PATH, executionMode: "observe_only", scheduleEnabled: true };
function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res);
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}
function request(body: unknown = {}) { return { path: OPERATIONS_CALLBACK_PATH, body, headers: {} } as Request; }
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VALISSE_OPERATIONS_EXECUTION_APPROVED", "false");
  mocks.auth.mockResolvedValue({ isCron: true, taskUid: "T_owned" }); mocks.lookup.mockResolvedValue(job);
  mocks.begin.mockResolvedValue({ runId: "R_one", job }); mocks.finish.mockResolvedValue(true);
  mocks.snapshot.mockResolvedValue({ counts: { overduePayouts: 3, failedTransfers: 1, paymentsDue: 2, unresolvedDisputes: 4, appointmentCodesDue: 5 } });
  mocks.payouts.mockResolvedValue({ checked: 1, released: 1, deferred: 0, failed: 0 });
  mocks.sms.mockResolvedValue({ found: 1, sent: 1, skipped: 0, failed: 0 }); mocks.fees.mockResolvedValue({ checked: 1, created: 1, failed: 0 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const noBusinessCalls = () => { expect(mocks.payouts).not.toHaveBeenCalled(); expect(mocks.sms).not.toHaveBeenCalled(); expect(mocks.fees).not.toHaveBeenCalled(); };
describe("registered operations callback", () => {
  it("rejects ordinary accounts before job lookup", async () => { mocks.auth.mockRejectedValue(new Error("not cron")); const res = response(); await handlePayoutRelease(request(), res); expect(res.status).toHaveBeenCalledWith(403); expect(mocks.lookup).not.toHaveBeenCalled(); noBusinessCalls(); });
  it("rejects missing task identity", async () => { mocks.auth.mockResolvedValue({ isCron: true }); const res = response(); await handlePayoutRelease(request(), res); expect(res.status).toHaveBeenCalledWith(403); noBusinessCalls(); });
  it.each([null, { ...job, scheduleEnabled: false }, { ...job, callbackPath: "/api/scheduled/other" }, { ...job, jobKey: "other" }])("rejects an unregistered/disabled or wrong-kind callback", async denied => { mocks.lookup.mockResolvedValue(denied); const res = response(); await handlePayoutRelease(request(), res); expect(res.status).toHaveBeenCalledWith(403); expect(mocks.begin).not.toHaveBeenCalled(); noBusinessCalls(); });
  it("uses the server scope and authenticated UID, ignoring body mode and identity", async () => { const res = response(); await handlePayoutRelease(request({ taskUid: "T_foreign", environment: "development", mode: "execute", approved: true }), res); expect(mocks.lookup).toHaveBeenCalledWith("T_owned", "production"); noBusinessCalls(); expect(mocks.finish).toHaveBeenCalledWith("R_one", "succeeded", { payouts: { status: "observed", counts: { overduePayouts: 3, failedTransfers: 1, paymentsDue: 2, unresolvedDisputes: 4 } }, appointment_codes: { status: "observed", counts: { appointmentCodesDue: 5 } }, attendance_fees: { status: "skipped", counts: {} } }); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mode: "observe_only", ok: true })); });
  it("rejects an incorrect actual callback path", async () => { const res = response(); await handlePayoutRelease({ ...request(), path: "/wrong" } as Request, res); expect(res.status).toHaveBeenCalledWith(403); noBusinessCalls(); });
  it("never reports execution as approved from a request body", async () => { mocks.lookup.mockResolvedValue({ ...job, executionMode: "execute" }); const res = response(); await handlePayoutRelease(request({ approved: true }), res); expect(res.status).toHaveBeenCalledWith(403); expect(mocks.begin).not.toHaveBeenCalled(); noBusinessCalls(); });
  it("rejects overlapping callback leases without observing or running work", async () => { mocks.begin.mockResolvedValue(null); const res = response(); await handlePayoutRelease(request(), res); expect(res.status).toHaveBeenCalledWith(429); expect(mocks.snapshot).not.toHaveBeenCalled(); noBusinessCalls(); });
  it("never reports a successful run when completion is fenced", async () => { mocks.finish.mockResolvedValue(false); const res = response(); await handlePayoutRelease(request(), res); expect(res.status).toHaveBeenCalledWith(409); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: "run-lease-expired" })); noBusinessCalls(); });
  it("does not turn failed observation reads into healthy empty queues or expose errors", async () => { vi.spyOn(console, "error").mockImplementation(() => {}); mocks.snapshot.mockRejectedValue(new Error("mysql secret=do-not-disclose")); const res = response(); await handlePayoutRelease(request(), res); expect(res.status).toHaveBeenCalledWith(500); expect(JSON.stringify(res.json.mock.calls)).not.toContain("do-not-disclose"); expect(mocks.finish).toHaveBeenCalledWith("R_one", "failed", expect.any(Object)); noBusinessCalls(); });
  it("records deferred/failed processing as partial failure with all step results", async () => { vi.stubEnv("VALISSE_OPERATIONS_EXECUTION_APPROVED", "true"); mocks.lookup.mockResolvedValue({ ...job, executionMode: "execute" }); mocks.begin.mockResolvedValue({ runId: "R_one", job: { ...job, executionMode: "execute" } }); mocks.sms.mockResolvedValue({ found: 2, sent: 0, failed: 1, skipped: 1 }); const res = response(); await handlePayoutRelease(request(), res); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, state: "partial_failure", steps: expect.objectContaining({ payouts: expect.objectContaining({ status: "succeeded" }), appointment_codes: expect.objectContaining({ status: "failed" }), attendance_fees: expect.objectContaining({ status: "succeeded" }) }) })); });
});
describe("settled operations steps", () => {
  it("preserves other step outcomes when one worker rejects and redacts sensitive failures", async () => { vi.spyOn(console, "error").mockImplementation(() => {}); mocks.payouts.mockRejectedValue(new Error("provider-secret")); const steps = await executeOperationsSteps(new Date()); expect(steps.payouts).toEqual({ status: "failed", counts: {}, errorCode: "STEP_FAILED" }); expect(steps.appointment_codes.status).toBe("succeeded"); expect(steps.attendance_fees.status).toBe("succeeded"); expect(JSON.stringify(steps)).not.toContain("provider-secret"); });
  it("reports skipped SMS as deferred, not a delivered message", async () => { mocks.sms.mockResolvedValue({ found: 1, sent: 0, skipped: 1, failed: 0 }); const steps = await executeOperationsSteps(new Date()); expect(steps.appointment_codes.status).toBe("deferred"); });
  it("copies only allowlisted numeric counts, never nested provider payloads", async () => { mocks.payouts.mockResolvedValue({ checked: 1, released: 0, deferred: 1, failed: 0, customer: "cus_secret", appointmentFeePayouts: { secret: "hidden" } }); const steps = await executeOperationsSteps(new Date()); expect(steps.payouts.counts).toEqual({ checked: 1, released: 0, deferred: 1, failed: 0 }); expect(JSON.stringify(steps)).not.toContain("secret"); });
});

describe("future-only payout callback policy", () => {
  function futureJob() { const approved = new Date(Date.now()-60_000); return { ...job, executionMode: "payouts_only", payoutsFrom: approved, payoutsApprovedAt: approved }; }
  it("executes only the future payout lane using the fixed server cutoff", async () => {
    const future = futureJob(); mocks.lookup.mockResolvedValue(future); mocks.begin.mockResolvedValue({ runId: "R_future", job: future }); mocks.futurePayouts.mockResolvedValue({ checked: 0, released: 0, deferred: 0, failed: 0 });
    const res = response(); await handlePayoutRelease(request({ cutoff: "2000-01-01", sms: true }), res);
    expect(mocks.futurePayouts).toHaveBeenCalledWith({ environment: "production", cutoff: future.payoutsFrom, approvedAt: future.payoutsApprovedAt }, expect.any(Date), expect.any(Number));
    noBusinessCalls(); expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith("R_future", "succeeded", expect.objectContaining({ appointment_codes: { status: "skipped", counts: {} }, attendance_fees: { status: "skipped", counts: {} } }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mode: "payouts_only", ok: true }));
  });
  it.each([null, new Date("invalid"), new Date(Date.now()+86_400_000)])("fails closed on a missing, invalid, or future cutoff", async cutoff => {
    vi.spyOn(console, "error").mockImplementation(() => {}); mocks.lookup.mockResolvedValue({ ...futureJob(), payoutsFrom: cutoff });
    const res = response(); await handlePayoutRelease(request(), res); expect(res.status).toHaveBeenCalledWith(500); expect(mocks.begin).not.toHaveBeenCalled(); expect(mocks.futurePayouts).not.toHaveBeenCalled(); noBusinessCalls();
  });
  it("revalidates the policy returned under the job lease", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); const future = futureJob(); mocks.lookup.mockResolvedValue(future); mocks.begin.mockResolvedValue({ runId: "R_future", job: { ...future, payoutsApprovedAt: new Date() } });
    const res = response(); await handlePayoutRelease(request(), res); expect(mocks.futurePayouts).not.toHaveBeenCalled(); noBusinessCalls(); expect(res.status).toHaveBeenCalledWith(500);
  });
  it("records unsettled or insufficient funds as deferred, not a verified bank payout", async () => {
    const future = futureJob(); mocks.lookup.mockResolvedValue(future); mocks.begin.mockResolvedValue({ runId: "R_future", job: future }); mocks.futurePayouts.mockResolvedValue({ checked: 1, released: 0, deferred: 1, failed: 0 });
    const res = response(); await handlePayoutRelease(request(), res); noBusinessCalls(); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, state: "partial_failure", steps: expect.objectContaining({ payouts: expect.objectContaining({ status: "deferred" }) }) }));
  });
});
