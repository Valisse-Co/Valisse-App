import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), create: vi.fn(), issue: vi.fn(), limit: vi.fn(), configured: vi.fn() }));
vi.mock("./db", async original => ({ ...await original<object>(), getUserByEmail: mocks.lookup, createEmailUser: mocks.create, updateUserProfile: vi.fn() }));
vi.mock("./emailSecurity", async original => ({ ...await original<object>(), issueVerificationEmail: mocks.issue, checkAuthRateLimit: mocks.limit }));
vi.mock("./resend", async original => ({ ...await original<object>(), isResendConfigured: mocks.configured }));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: vi.fn(async () => "synthetic-session") } }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "synthetic-hash"), compare: vi.fn(async () => true) } }));
import { appRouter } from "./routers";
const user = { id: 123, openId: "email_disposable", name: "Test", email: "test@example.invalid", passwordHash: "synthetic-hash", onboardingCompleted: false, emailVerificationRequired: true, emailVerifiedAt: null, sessionVersion: 0, userType: "client", activeMode: "client", hasDualRole: false };
const context = () => ({ user: null, req: { socket: { remoteAddress: "synthetic-origin" }, protocol: "https", headers: {} } as any, res: { cookie: vi.fn(), clearCookie: vi.fn() } as any });
const input = { name: "Test Person", email: "test@example.invalid", password: "ValidPassword123!" };
describe("verification-aware registration and login", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.lookup.mockResolvedValue(undefined); mocks.create.mockResolvedValue(user); mocks.issue.mockResolvedValue({ success: true }); mocks.limit.mockResolvedValue(true); mocks.configured.mockReturnValue(true); });
  it("sends verification after credentials are created and reports no completed onboarding", async () => {
    const result = await appRouter.createCaller(context()).auth.register(input);
    expect(result).toEqual({ success: true, verificationEmailSent: true });
    expect(mocks.issue).toHaveBeenCalledWith(user.id);
    expect(mocks.create.mock.calls[0][0].openId).toMatch(/^email_[a-f0-9-]{36}$/);
  });
  it("returns recoverable email-send failure instead of falsely claiming verification", async () => {
    mocks.issue.mockRejectedValue(new Error("Synthetic delivery failure"));
    expect(await appRouter.createCaller(context()).auth.register(input)).toEqual({ success: true, verificationEmailSent: false });
  });
  it("does not create an account when the sender is unconfigured", async () => {
    mocks.configured.mockReturnValue(false);
    await expect(appRouter.createCaller(context()).auth.register(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("preserves existing identities and refuses duplicate email registration", async () => {
    mocks.lookup.mockResolvedValue(user);
    await expect(appRouter.createCaller(context()).auth.register(input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns verification requirements after valid password login", async () => {
    mocks.lookup.mockResolvedValue(user);
    expect(await appRouter.createCaller(context()).auth.emailLogin({ email: user.email, password: input.password })).toMatchObject({ needsEmailVerification: true, emailVerified: false, onboardingCompleted: false });
  });
  it("does not silently truncate an overlong UTF-8 password", async () => {
    await expect(appRouter.createCaller(context()).auth.register({ ...input, password: "é".repeat(40) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
