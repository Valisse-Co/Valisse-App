import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ exchangeGoogle: vi.fn(), exchangeApple: vi.fn(), session: vi.fn() }));
vi.mock("google-auth-library", () => ({ OAuth2Client: class {
  generateAuthUrl(input: { state: string }) { return `https://provider.invalid?state=${encodeURIComponent(input.state)}`; }
  getToken = mock.exchangeGoogle;
} }));
vi.mock("apple-signin-auth", () => ({ default: {
  getAuthorizationUrl(input: { state: string }) { return `https://provider.invalid?state=${encodeURIComponent(input.state)}`; },
  getClientSecret: vi.fn(() => "synthetic-secret"), getAuthorizationToken: mock.exchangeApple,
} }));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: mock.session } }));
import { registerSocialAuthRoutes } from "./socialAuth";
import { OAUTH_STATE_COOKIES, decodeOAuthState } from "../shared/oauthState";
const response = () => { const res: any = { status: vi.fn(), json: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() }; res.status.mockReturnValue(res); return res; };
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"]) vi.stubEnv(key, "synthetic-unused");
});
describe("native OAuth browser binding", () => {
  it.each(["google", "apple"] as const)("requires a browser-bound %s callback before any code exchange", async provider => {
    const handlers = new Map<string, Function>();
    const app: any = { get: (path: string, fn: Function) => handlers.set(path, fn), post: (path: string, fn: Function) => handlers.set(path, fn) };
    await registerSocialAuthRoutes(app);
    const start = response();
    handlers.get(`/api/oauth/${provider}/start`)!({ query: { origin: "https://www.valisseco.com" } }, start);
    const rawState = new URL(start.redirect.mock.calls[0][1]).searchParams.get("state")!;
    const parsed = decodeOAuthState(rawState, provider)!;
    expect(parsed.redirectUri).toBe(`https://www.valisseco.com/api/oauth/${provider}/callback`);
    expect(start.cookie).toHaveBeenCalledWith(OAUTH_STATE_COOKIES[provider], parsed.nonce, expect.objectContaining({ httpOnly: true, secure: true, sameSite: "none" }));
    for (const cookie of ["", `${OAUTH_STATE_COOKIES[provider]}=${"z".repeat(43)}`]) {
      const res = response();
      await handlers.get(`/api/oauth/${provider}/callback`)!({ headers: { cookie }, query: { code: "not-redeemed", state: rawState }, body: { code: "not-redeemed", id_token: "not-used", state: rawState } }, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.cookie).not.toHaveBeenCalled();
    }
    expect(mock.exchangeGoogle).not.toHaveBeenCalled(); expect(mock.exchangeApple).not.toHaveBeenCalled(); expect(mock.session).not.toHaveBeenCalled();
  });
  it.each(["google", "apple"] as const)("rejects missing, credential-bearing and plaintext remote %s origins", async provider => {
    const handlers = new Map<string, Function>();
    const app: any = { get: (path: string, fn: Function) => handlers.set(path, fn), post: (path: string, fn: Function) => handlers.set(path, fn) };
    await registerSocialAuthRoutes(app);
    for (const origin of [undefined, "https://secret@example.com", "http://remote.invalid"]) {
      const res = response(); handlers.get(`/api/oauth/${provider}/start`)!({ query: { origin } }, res);
      expect(res.status).toHaveBeenCalledWith(400); expect(res.redirect).not.toHaveBeenCalled(); expect(res.cookie).not.toHaveBeenCalled();
    }
  });
});
