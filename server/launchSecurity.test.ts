import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), info: vi.fn(), session: vi.fn(), reactivate: vi.fn(), lookup: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { exchangeCodeForToken: mocks.exchange, getUserInfo: mocks.info, createSessionToken: mocks.session } }));
vi.mock("./db", async original => ({ ...await original<object>(), reactivateAccount: mocks.reactivate, getUserByOpenId: mocks.lookup, getUserByEmail: vi.fn(async () => undefined), upsertUser: vi.fn(async () => undefined) }));
import { registerDemoLoginRoutes } from "./_core/demoLogin";
import { registerOAuthRoutes } from "./_core/oauth";
import { accountRecoveryProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { appRouter } from "./routers";
import { encodeOAuthState, decodeOAuthState, OAUTH_STATE_COOKIES } from "../shared/oauthState";
import { consumeBrowserOAuthState, createBrowserOAuthState } from "./browserOAuth";
import { safeErrorDetails } from "./securityLogging";
import { securityHeaders, privateApiHeaders } from "./securityHeaders";
const nonce = "a".repeat(43);
const state = encodeOAuthState({ provider: "manus", nonce, redirectUri: "https://www.valisseco.com/api/oauth/callback" });
const response = () => { const res: any = { status: vi.fn(), json: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn(), setHeader: vi.fn() }; res.status.mockReturnValue(res); return res; };
const user = { id: 123, openId: "synthetic_identity", name: "Synthetic", userType: "nail_tech", role: "admin", onboardingCompleted: true, hasDualRole: false, activeMode: "nail_tech", emailVerificationRequired: false, deactivatedAt: new Date() };
const context = () => ({ user, req: { headers: {}, protocol: "https" } as any, res: response() });

describe("launch security boundaries", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.exchange.mockResolvedValue({ accessToken: "synthetic" }); mocks.info.mockResolvedValue(user); mocks.lookup.mockResolvedValue(user); mocks.session.mockResolvedValue("synthetic-session"); });
  it.each(["production", "development"])("never issues a legacy demo session in %s", environment => {
    const prior = process.env.NODE_ENV;
    process.env.NODE_ENV = environment;
    try {
      const app: any = { all: vi.fn() }; registerDemoLoginRoutes(app);
      const res = response(); app.all.mock.calls[0][1]({}, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(mocks.session).not.toHaveBeenCalled();
    } finally { process.env.NODE_ENV = prior; }
  });
  it("blocks inactive accounts from marketplace/admin but allows identity-bound recovery", async () => {
    const api = router({ marketplace: protectedProcedure.query(() => true), admin: adminProcedure.query(() => true), recover: accountRecoveryProcedure.query(() => true) }).createCaller(context());
    await expect(api.marketplace()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.admin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await api.recover()).toBe(true);
    await appRouter.createCaller(context()).settings.reactivateAccount();
    expect(mocks.reactivate).toHaveBeenCalledWith(user.id);
  });
  it("allows active verified accounts to use marketplace operations", async () => {
    const api = router({ access: protectedProcedure.query(() => true) }).createCaller({ ...context(), user: { ...user, deactivatedAt: null } });
    expect(await api.access()).toBe(true);
  });
  it("rejects anonymous recovery and keeps email verification necessary for reactivation", async () => {
    await expect(appRouter.createCaller({ ...context(), user: null }).settings.reactivateAccount()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller({ ...context(), user: { ...user, emailVerificationRequired: true, emailVerifiedAt: null } }).settings.reactivateAccount()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it.each([undefined, "bad", btoa("https://www.valisseco.com/api/oauth/callback")])("rejects malformed/legacy OAuth state without throwing", raw => {
    expect(decodeOAuthState(raw, "manus")).toBeNull();
  });
  it("binds state to the provider and rejects wrong callback destinations", () => {
    expect(decodeOAuthState(state, "google")).toBeNull();
    expect(() => encodeOAuthState({ provider: "manus", nonce, redirectUri: "https://www.valisseco.com/evil" })).toThrow();
    expect(() => encodeOAuthState({ provider: "manus", nonce, redirectUri: "http://untrusted.invalid/api/oauth/callback" })).toThrow();
  });
  it("rejects missing, different-browser and malformed Unicode nonce cookies", () => {
    for (const cookie of ["", `${OAUTH_STATE_COOKIES.manus}=${"b".repeat(43)}`, `${OAUTH_STATE_COOKIES.manus}=${encodeURIComponent("é".repeat(43))}`]) {
      expect(consumeBrowserOAuthState({ headers: { cookie } } as any, response(), state, "manus")).toBeNull();
    }
  });
  it("consumes a valid pending cookie and fails after the browser clears it", () => {
    const res = response();
    expect(consumeBrowserOAuthState({ headers: { cookie: `${OAUTH_STATE_COOKIES.manus}=${nonce}` } } as any, res, state, "manus")?.redirectUri).toContain("/api/oauth/callback");
    expect(res.clearCookie).toHaveBeenCalledWith(OAUTH_STATE_COOKIES.manus, expect.objectContaining({ secure: true, path: "/", sameSite: "none" }));
    expect(consumeBrowserOAuthState({ headers: {} } as any, response(), state, "manus")).toBeNull();
  });
  it("creates Secure host-only pending state for native provider starts", () => {
    const res = response();
    const created = createBrowserOAuthState(res, "apple", "https://www.valisseco.com/api/oauth/apple/callback");
    expect(decodeOAuthState(created, "apple")).not.toBeNull();
    expect(res.cookie).toHaveBeenCalledWith(OAUTH_STATE_COOKIES.apple, expect.any(String), expect.objectContaining({ secure: true, httpOnly: true, path: "/", maxAge: 600000 }));
  });
  it("rejects forged callback state before provider exchange or session creation", async () => {
    const app: any = { get: vi.fn() }; registerOAuthRoutes(app);
    const handler = app.get.mock.calls[0][1];
    const res = response();
    await handler({ query: { code: "synthetic-unredeemed-code", state }, headers: {} }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });
  it("validates a matching browser callback before using the normal session flow", async () => {
    const app: any = { get: vi.fn() }; registerOAuthRoutes(app);
    const handler = app.get.mock.calls[0][1];
    const res = response();
    await handler({ query: { code: "synthetic", state }, headers: { cookie: `${OAUTH_STATE_COOKIES.manus}=${nonce}` }, protocol: "https" }, res);
    expect(mocks.exchange).toHaveBeenCalledWith("synthetic", state);
    expect(res.cookie).toHaveBeenCalled();
  });
  it("never emits error bodies, credentials, URLs, stacks or arbitrary object names", () => {
    const error = { name: "AxiosError", message: "secret-password", stack: "secret-token", config: { headers: { Authorization: "secret-key" }, url: "secret-url" }, response: { status: 401, data: "secret-person" } };
    expect(safeErrorDetails(error)).toEqual({ name: "AxiosError", status: 401 });
    expect(JSON.stringify(safeErrorDetails(error))).not.toContain("secret");
    expect(safeErrorDetails({ name: "secret-person" })).toEqual({ name: "Error" });
    expect(safeErrorDetails({ get name() { throw new Error("secret"); } })).toEqual({ name: "Error" });
  });
  it("sets private cache headers and keeps third-party embedding policies unchanged", () => {
    const res = response(); const next = vi.fn();
    securityHeaders({} as any, res, next); privateApiHeaders({} as any, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(res.setHeader.mock.calls.some(([name]: string[]) => name === "Content-Security-Policy" || name === "X-Frame-Options")).toBe(false);
  });
});
