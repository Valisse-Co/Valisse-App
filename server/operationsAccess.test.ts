import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";
import { operationsHealth } from "../shared/operationsPresentation";
const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), stripe: vi.fn(), funds: vi.fn(), telnyx: vi.fn(), resend: vi.fn() }));
vi.mock("./operationsDb", () => ({ getOperationsSnapshot: mocks.snapshot }));
vi.mock("./stripe", () => ({ getStripeIntegrationStatus: mocks.stripe, getStripePlatformFundsStatus: mocks.funds }));
vi.mock("./telnyx", () => ({ isTelnyxConfigured: mocks.telnyx }));
vi.mock("./resend", () => ({ isResendConfigured: mocks.resend }));
import { operationsRouter } from "./operationsRouter";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
const baseUser = { id: 7, openId: "owner", name: "Owner", role: "admin", onboardingCompleted: true, deactivatedAt: null, emailVerificationRequired: false } as User;
function caller(user: User | null) { return operationsRouter.createCaller({ user, req: { headers: {} } as Request, res: {} as Response } as TrpcContext); }
beforeEach(() => {
  vi.clearAllMocks(); mocks.snapshot.mockResolvedValue({ environment: "production", generatedAt: new Date(), job: null, recentRuns: [], counts: { overduePayouts: 0, failedTransfers: 0, paymentsDue: 0, unresolvedDisputes: 0, appointmentCodesDue: 0 }, queues: { overduePayouts: [], failedTransfers: [], paymentsDue: [], unresolvedDisputes: [] } });
  mocks.stripe.mockReturnValue({ mode: "disabled", configured: false, webhookConfigured: false, connectWebhookConfigured: false }); mocks.telnyx.mockReturnValue(false); mocks.resend.mockReturnValue(false);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("private admin operations API", () => {
  it("rejects signed-out users without reading operational data", async () => { await expect(caller(null).snapshot({ environment: "production" })).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(mocks.snapshot).not.toHaveBeenCalled(); });
  it("rejects normal clients and techs without reading operational data", async () => { await expect(caller({ ...baseUser, role: "user" }).snapshot({ environment: "production" })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(mocks.snapshot).not.toHaveBeenCalled(); });
  it("rejects deactivated administrators", async () => { await expect(caller({ ...baseUser, deactivatedAt: new Date() }).snapshot({ environment: "production" })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(mocks.snapshot).not.toHaveBeenCalled(); });
  it("returns configuration-only diagnostics and the selected environment to administrators", async () => { const data = await caller(baseUser).snapshot({ environment: "production" }); expect(mocks.snapshot).toHaveBeenCalledWith("production"); expect(data.job).toBeNull(); expect(data.providers.resend.configured).toBe(false); expect(data.providers.stripe.configured).toBe(false); });
  it("offers no Run Now, transfer, charge, scheduling or policy-changing mutation", () => { expect(Object.keys(operationsRouter._def.procedures)).toEqual(["snapshot"]); });
});
describe("admin-only environment-scoped platform funds monitoring", () => {
  it("never queries Stripe for a normal technician", async () => {
    await expect(caller({ ...baseUser, role: "user" }).snapshot()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.funds).not.toHaveBeenCalled();
  });
  it("does not query live Stripe balances when QA is selected", async () => {
    mocks.stripe.mockReturnValue({ configured: true, mode: "live" });
    const data = await caller(baseUser).snapshot({ environment: "development" });
    expect(data.platformFunds.status).toBe("scope_mismatch");
    expect(mocks.funds).not.toHaveBeenCalled();
  });
  it("shows a zero live balance and monthly platform payout schedule without claiming a technician bank payout", async () => {
    mocks.stripe.mockReturnValue({ configured: true, mode: "live" });
    mocks.funds.mockResolvedValue({ status: "available", mode: "live", observedAt: new Date(), availableUsdInCents: 0, pendingUsdInCents: 0, payoutSchedule: "monthly", automaticBankPayouts: true });
    const data = await caller(baseUser).snapshot({ environment: "production" });
    expect(mocks.funds).toHaveBeenCalledWith("live");
    expect(data.platformFunds).toMatchObject({ status: "available", availableUsdInCents: 0, automaticBankPayouts: true });
    expect(data.platformFunds).not.toHaveProperty("bankAccountId");
  });
  it("keeps application queues visible when Stripe is unavailable and does not report an unknown balance as zero", async () => {
    mocks.stripe.mockReturnValue({ configured: true, mode: "live" });
    mocks.funds.mockRejectedValue(new Error("private request payload"));
    const data = await caller(baseUser).snapshot({ environment: "production" });
    expect(data.platformFunds).toEqual({ status: "unavailable" });
    expect(data.counts.overduePayouts).toBe(0);
    expect(JSON.stringify(data)).not.toContain("private request payload");
  });
});
describe("cron authentication without account synchronization", () => {
  const req = { headers: { cookie: `${COOKIE_NAME}=mock-cookie` } } as Request;
  const session = { appId: ENV.appId, openId: "cron_task", name: "Scheduled Task", sessionVersion: 0 };
  it("rejects ordinary sessions before querying the platform", async () => { vi.spyOn(sdk, "verifySession").mockResolvedValue({ ...session, openId: "ordinary_user" }); const lookup = vi.spyOn(sdk, "getUserInfoWithJwt"); await expect(sdk.authenticateCronRequest(req)).rejects.toThrow(); expect(lookup).not.toHaveBeenCalled(); });
  it("rejects foreign app sessions before querying the platform", async () => { vi.spyOn(sdk, "verifySession").mockResolvedValue({ ...session, appId: "another-project" }); const lookup = vi.spyOn(sdk, "getUserInfoWithJwt"); await expect(sdk.authenticateCronRequest(req)).rejects.toThrow(); expect(lookup).not.toHaveBeenCalled(); });
  it.each([
    { openId: "cron_task", projectId: "another-project", taskUid: "T_owned", name: "Task" },
    { openId: "cron_other", projectId: ENV.appId, taskUid: "T_owned", name: "Task" },
    { openId: "cron_task", projectId: ENV.appId, taskUid: null, name: "Task" },
  ])("rejects mismatched platform identity or missing UID", async info => { vi.spyOn(sdk, "verifySession").mockResolvedValue(session); vi.spyOn(sdk, "getUserInfoWithJwt").mockResolvedValue(info); await expect(sdk.authenticateCronRequest(req)).rejects.toThrow(); });
  it("returns only a cron actor after both identities match", async () => { vi.spyOn(sdk, "verifySession").mockResolvedValue(session); vi.spyOn(sdk, "getUserInfoWithJwt").mockResolvedValue({ openId: session.openId, projectId: ENV.appId, name: "Task", taskUid: "T_owned" }); const user = await sdk.authenticateCronRequest(req); expect(user.isCron).toBe(true); expect(user.taskUid).toBe("T_owned"); expect(user.id).toBe(-1); });
});
describe("dashboard does not mistake configuration for execution", () => {
  const now = new Date("2026-11-08T04:00:00Z");
  const job = { scheduleCronTaskUid: "T_owned", scheduleEnabled: true, executionMode: "observe_only" };
  const run = { status: "succeeded", executionMode: "observe_only", startedAt: now, completedAt: now };
  it("shows no registration and empty history as unverified", () => { expect(operationsHealth(null, [], now).label).toBe("Not scheduled"); expect(operationsHealth(job, [], now).label).toBe("Awaiting first delivery"); });
  it("distinguishes observation delivery from actual processing", () => { expect(operationsHealth(job, [run], now).label).toBe("Observation verified"); expect(operationsHealth({ ...job, executionMode: "execute" }, [run], now).label).toBe("Policy change not verified"); });
  it("shows stale, failed, paused and stalled states instead of a green execution claim", () => { expect(operationsHealth(job, [run], new Date(now.getTime() + 16 * 60_000)).label).toBe("Heartbeat overdue"); expect(operationsHealth(job, [{ ...run, status: "partial_failure" }], now).label).toBe("Needs attention"); expect(operationsHealth({ ...job, scheduleEnabled: false }, [run], now).label).toBe("Schedule paused"); expect(operationsHealth(job, [{ ...run, status: "running", completedAt: null }], new Date(now.getTime() + 4 * 60_000)).label).toBe("Run stalled"); });
});
