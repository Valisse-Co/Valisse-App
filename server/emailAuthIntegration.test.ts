import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
const state = vi.hoisted(() => ({ user: null as any }));
vi.mock("./db", async original => ({ ...await original<object>(), getUserByOpenId: vi.fn(async () => state.user), upsertUser: vi.fn(async () => undefined) }));
import { sdk } from "./_core/sdk";
import { router, authenticatedProcedure, protectedProcedure, adminProcedure } from "./_core/trpc";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { ENV } from "./_core/env";
const accessRouter = router({ verification: authenticatedProcedure.query(() => true), marketplace: protectedProcedure.query(() => true), admin: adminProcedure.query(() => true) });
const context = (user: any) => ({ user, req: { headers: {}, protocol: "https" } as any, res: { clearCookie: vi.fn() } as any });
describe("email auth integration", () => {
  beforeEach(() => { state.user = { id: 1, openId: "email_test", name: "Test Person", email: "test@example.com", sessionVersion: 0, role: "user", passwordHash: "never-public", emailVerificationRequired: true, emailVerifiedAt: null }; });
  it("permits only the narrow verification procedure before mailbox verification", async () => {
    const caller = accessRouter.createCaller(context(state.user));
    expect(await caller.verification()).toBe(true);
    await expect(caller.marketplace()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller.admin()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("allows verified accounts and preserves legacy accounts without relaunch onboarding", async () => {
    expect(await accessRouter.createCaller(context({ ...state.user, emailVerifiedAt: new Date() })).marketplace()).toBe(true);
    expect(await accessRouter.createCaller(context({ ...state.user, emailVerificationRequired: false })).marketplace()).toBe(true);
  });
  it("does not expose the password hash through auth.me", async () => {
    const result = await appRouter.createCaller(context(state.user)).auth.me();
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).toMatchObject({ hasPassword: true });
  });
  it("rejects anonymous verification-resend access", async () => {
    await expect(accessRouter.createCaller(context(null)).verification()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("rejects all prior sessions after a password reset increments the version", async () => {
    const token = await sdk.signSession({ openId: state.user.openId, name: state.user.name, appId: ENV.appId, sessionVersion: 0 });
    const request = { headers: { cookie: `${COOKIE_NAME}=${token}` } } as Request;
    expect((await sdk.authenticateRequest(request)).id).toBe(1);
    state.user.sessionVersion = 1;
    await expect(sdk.authenticateRequest(request)).rejects.toThrow("session expired");
    const freshToken = await sdk.createSessionToken(state.user.openId, { name: state.user.name });
    expect((await sdk.authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=${freshToken}` } } as Request)).id).toBe(1);
  });
});
