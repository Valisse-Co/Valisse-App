import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailAuthToken } from "../drizzle/schema";
import {
  getPasswordValidationError,
  isValidPassword,
  normalizeEmail,
  PASSWORD_RESET_TOKEN_TTL_MS,
  requiresEmailVerification,
  VERIFY_EMAIL_TOKEN_TTL_MS,
} from "../shared/emailSecurity";
import { COOKIE_NAME } from "../shared/const";
import { ENV } from "./_core/env";
import type { TrpcContext } from "./_core/context";
import {
  BAD_SECURITY_LINK_MESSAGE,
  createAuthRateLimiter,
  createEmailSecurityService,
  EmailSecurityError,
  hashSecurityToken,
  PASSWORD_RESET_REQUEST_MESSAGE,
  type RateBucket,
  type SecurityRepository,
  type SecurityTransaction,
  type SecurityUser,
} from "./emailSecurity";
import { createEmailSecurityRouter } from "./emailSecurityRouter";
import type { SecurityEmailInput } from "./resend";

// Models serializable DB transactions with a mutex, detached rows, and rollback.
// Tests execute the same service and router code as production, not source text.
class MemoryRepository implements SecurityRepository {
  users = new Map<number, SecurityUser>();
  tokens: EmailAuthToken[] = [];
  buckets = new Map<string, RateBucket>();
  failTransactions = false;
  failUserUpdate = false;
  calls: string[] = [];
  private pending: Promise<void> = Promise.resolve();

  async tokenOwner(hash: string) {
    return this.tokens.find(token => token.tokenHash === hash)?.userId;
  }

  async transaction<T>(
    work: (tx: SecurityTransaction) => Promise<T>
  ): Promise<T> {
    const previous = this.pending;
    let release!: () => void;
    this.pending = new Promise(resolve => {
      release = resolve;
    });
    await previous;
    const saved = {
      users: structuredClone(this.users),
      tokens: structuredClone(this.tokens),
      buckets: structuredClone(this.buckets),
    };
    try {
      if (this.failTransactions)
        throw new Error("simulated database failure containing secrets");
      const tx: SecurityTransaction = {
        lockUser: async id => {
          this.calls.push(`user:${id}`);
          return structuredClone(this.users.get(id));
        },
        findUserByEmail: async email =>
          structuredClone(
            [...this.users.values()].find(
              user => user.email && normalizeEmail(user.email) === email
            )
          ),
        lockToken: async hash => {
          this.calls.push("token");
          return structuredClone(
            this.tokens.find(token => token.tokenHash === hash)
          );
        },
        latestToken: async (userId, purpose) =>
          structuredClone(
            this.tokens
              .filter(
                token => token.userId === userId && token.purpose === purpose
              )
              .at(-1)
          ),
        insertToken: async token => {
          this.tokens.push({
            ...structuredClone(token),
            id: this.tokens.length + 1,
          });
        },
        revokeTokens: async (id, now, purpose) => {
          for (const token of this.tokens)
            if (
              token.userId === id &&
              !token.consumedAt &&
              (!purpose || token.purpose === purpose)
            )
              token.consumedAt = now;
        },
        markDelivered: async (hash, now) => {
          const token = this.tokens.find(token => token.tokenHash === hash);
          if (
            !token ||
            token.consumedAt ||
            token.deliveredAt ||
            token.expiresAt <= now
          )
            return false;
          token.deliveredAt = now;
          return true;
        },
        consumeToken: async (hash, email, now) => {
          const token = this.tokens.find(token => token.tokenHash === hash);
          if (
            !token ||
            token.email !== email ||
            token.consumedAt ||
            !token.deliveredAt ||
            token.expiresAt <= now
          )
            return false;
          token.consumedAt = now;
          return true;
        },
        markVerified: async (snapshot, now) => {
          const user = this.users.get(snapshot.id);
          if (
            this.failUserUpdate ||
            !user ||
            user.email !== snapshot.email ||
            user.emailVerifiedAt
          )
            return false;
          user.emailVerifiedAt = now;
          return true;
        },
        changePassword: async (snapshot, passwordHash) => {
          const user = this.users.get(snapshot.id);
          if (
            this.failUserUpdate ||
            !user ||
            !user.passwordHash ||
            user.passwordHash !== snapshot.passwordHash ||
            user.email !== snapshot.email
          )
            return false;
          user.passwordHash = passwordHash;
          user.sessionVersion += 1;
          return true;
        },
        lockBucket: async (hash, now) => {
          if (!this.buckets.has(hash))
            this.buckets.set(hash, {
              bucketHash: hash,
              windowStartedAt: now,
              requestCount: 0,
              lastRequestedAt: null,
            });
          return structuredClone(this.buckets.get(hash)!);
        },
        saveBucket: async bucket => {
          this.buckets.set(bucket.bucketHash, structuredClone(bucket));
        },
      };
      return await work(tx);
    } catch (error) {
      this.users = saved.users;
      this.tokens = saved.tokens;
      this.buckets = saved.buckets;
      throw error;
    } finally {
      release();
    }
  }
}

function fixture() {
  const repository = new MemoryRepository();
  const user: SecurityUser = {
    id: 1,
    email: "member@example.com",
    passwordHash: "old-bcrypt-hash",
    emailVerifiedAt: null,
    emailVerificationRequired: true,
    sessionVersion: 3,
  };
  repository.users.set(1, user);
  let time = new Date("2026-11-07T00:00:00.000Z");
  const sent: SecurityEmailInput[] = [];
  const sendEmail = vi.fn(async (input: SecurityEmailInput) => {
    sent.push(input);
  });
  const hashPassword = vi.fn(
    async (password: string) => `bcrypt-test:${password}`
  );
  const isConfigured = vi.fn(() => true);
  const service = createEmailSecurityService({
    repository,
    sendEmail,
    hashPassword,
    isConfigured,
    now: () => new Date(time),
    bucketSecret: () => "test-only-bucket-secret",
  });
  return {
    repository,
    service,
    sent,
    sendEmail,
    hashPassword,
    isConfigured,
    advance: (ms: number) => {
      time = new Date(time.getTime() + ms);
    },
    clock: () => new Date(time),
  };
}
function raw(email: SecurityEmailInput): string {
  if (email.purpose === "password_changed")
    throw new Error("notice does not contain a token");
  return email.token;
}
function context(user: SecurityUser | null): TrpcContext {
  return {
    user: user as TrpcContext["user"],
    req: {
      socket: { remoteAddress: "192.0.2.10" },
      protocol: "https",
      headers: {
        origin: "https://evil.example",
        "x-forwarded-for": "203.0.113.9",
      },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}
afterEach(() => vi.restoreAllMocks());

describe("shared email security rules", () => {
  it("preserves legacy access but requires verification only for explicitly opted-in accounts", () => {
    expect(requiresEmailVerification(null)).toBe(false);
    expect(requiresEmailVerification({ emailVerifiedAt: null })).toBe(false);
    expect(
      requiresEmailVerification({
        emailVerificationRequired: false,
        emailVerifiedAt: null,
      })
    ).toBe(false);
    expect(
      requiresEmailVerification({
        emailVerificationRequired: true,
        emailVerifiedAt: null,
      })
    ).toBe(true);
    expect(
      requiresEmailVerification({
        emailVerificationRequired: true,
        emailVerifiedAt: new Date(),
      })
    ).toBe(false);
    expect(normalizeEmail("  MEMBER@Example.COM  ")).toBe("member@example.com");
    expect(VERIFY_EMAIL_TOKEN_TTL_MS).toBe(86_400_000);
    expect(PASSWORD_RESET_TOKEN_TTL_MS).toBe(1_800_000);
  });
  it("enforces eight characters and bcrypt's byte limit without silent truncation", () => {
    expect(isValidPassword("1234567")).toBe(false);
    expect(isValidPassword("12345678")).toBe(true);
    expect(isValidPassword("a".repeat(72))).toBe(true);
    expect(isValidPassword("a".repeat(73))).toBe(false);
    expect(isValidPassword("é".repeat(36))).toBe(true);
    expect(getPasswordValidationError("é".repeat(37))).toContain(
      "72 UTF-8 bytes"
    );
    expect(isValidPassword("😀".repeat(7))).toBe(false);
    expect(isValidPassword("😀".repeat(18))).toBe(true);
    expect(isValidPassword("😀".repeat(19))).toBe(false);
  });
});

describe("transactional verification and recovery", () => {
  it("persists only a random 32-byte token hash and redeems without identity replacement", async () => {
    const f = fixture();
    const response = await f.service.issueVerificationEmail(1);
    expect(response).toEqual({ success: true });
    const token = raw(f.sent[0]!);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(f.repository.tokens[0]).toMatchObject({
      tokenHash: hashSecurityToken(token),
      purpose: "verify_email",
      email: "member@example.com",
    });
    expect(JSON.stringify(f.repository.tokens)).not.toContain(token);
    expect(
      f.repository.tokens[0]!.expiresAt.getTime() -
        f.repository.tokens[0]!.createdAt.getTime()
    ).toBe(VERIFY_EMAIL_TOKEN_TTL_MS);
    expect(await f.service.verifyEmail(token)).toEqual({ success: true });
    expect(f.repository.users.get(1)).toMatchObject({
      email: "member@example.com",
      passwordHash: "old-bcrypt-hash",
      sessionVersion: 3,
      emailVerificationRequired: true,
    });
    expect(f.repository.users.get(1)!.emailVerifiedAt).toEqual(f.clock());
    await expect(f.service.verifyEmail(token)).rejects.toMatchObject({
      kind: "bad_link",
      message: BAD_SECURITY_LINK_MESSAGE,
    });
  });

  it("rejects another signed-in identity without consuming a signed-out-compatible token", async () => {
    const f = fixture();
    await f.service.issueVerificationEmail(1);
    const token = raw(f.sent[0]!);
    await expect(f.service.verifyEmail(token, 2)).rejects.toMatchObject({
      kind: "bad_link",
    });
    expect(f.repository.tokens[0]!.consumedAt).toBeNull();
    await expect(f.service.verifyEmail(token)).resolves.toEqual({
      success: true,
    });
  });

  it("rejects expired, wrong-purpose, email-snapshot drift, and malformed links generically", async () => {
    const f = fixture();
    await f.service.issueVerificationEmail(1);
    const token = raw(f.sent[0]!);
    await expect(
      f.service.resetPassword(token, "newpassword", "newpassword")
    ).rejects.toMatchObject({ kind: "bad_link" });
    f.repository.users.get(1)!.email = "other@example.com";
    await expect(f.service.verifyEmail(token)).rejects.toMatchObject({
      message: BAD_SECURITY_LINK_MESSAGE,
    });
    expect(f.repository.users.get(1)!.emailVerifiedAt).toBeNull();
    f.repository.users.get(1)!.email = "member@example.com";
    f.advance(VERIFY_EMAIL_TOKEN_TTL_MS);
    await expect(f.service.verifyEmail(token)).rejects.toMatchObject({
      message: BAD_SECURITY_LINK_MESSAGE,
    });
    await expect(f.service.verifyEmail("x".repeat(43))).rejects.toMatchObject({
      message: BAD_SECURITY_LINK_MESSAGE,
    });
    await expect(
      f.service.verifyEmail("<script>".repeat(5))
    ).rejects.toMatchObject({ message: BAD_SECURITY_LINK_MESSAGE });
  });

  it("accepts only the latest token and serializes parallel replay attempts", async () => {
    const f = fixture();
    await f.service.issueVerificationEmail(1);
    f.advance(60_000);
    await f.service.issueVerificationEmail(1);
    const first = raw(f.sent[0]!);
    const latest = raw(f.sent[1]!);
    expect(first).not.toBe(latest);
    await expect(f.service.verifyEmail(first)).rejects.toMatchObject({
      kind: "bad_link",
    });
    const results = await Promise.allSettled([
      f.service.verifyEmail(latest),
      f.service.verifyEmail(latest),
      f.service.verifyEmail(latest),
    ]);
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(
      2
    );
  });

  it("resets existing passwords, increments sessionVersion once, revokes every sibling, and sends notice", async () => {
    const f = fixture();
    await f.service.issueVerificationEmail(1);
    const verify = raw(f.sent[0]!);
    f.advance(60_000);
    await f.service.requestPasswordReset(" MEMBER@Example.COM ", "192.0.2.1");
    const reset = raw(f.sent[1]!);
    expect(
      f.repository.tokens[1]!.expiresAt.getTime() -
        f.repository.tokens[1]!.createdAt.getTime()
    ).toBe(PASSWORD_RESET_TOKEN_TTL_MS);
    const results = await Promise.allSettled([
      f.service.resetPassword(reset, "newpassword", "newpassword"),
      f.service.resetPassword(reset, "newpassword", "newpassword"),
    ]);
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(f.repository.users.get(1)).toMatchObject({
      passwordHash: "bcrypt-test:newpassword",
      sessionVersion: 4,
      emailVerifiedAt: null,
    });
    expect(f.repository.tokens.every(token => Boolean(token.consumedAt))).toBe(
      true
    );
    await expect(f.service.verifyEmail(verify)).rejects.toMatchObject({
      kind: "bad_link",
    });
    expect(
      f.sent.filter(email => email.purpose === "password_changed")
    ).toEqual([
      {
        purpose: "password_changed",
        to: "member@example.com",
        tokenHash: hashSecurityToken(reset),
      },
    ]);
  });

  it("rolls token consumption back if a conditional identity update fails", async () => {
    const f = fixture();
    await f.service.issueVerificationEmail(1);
    f.repository.failUserUpdate = true;
    await expect(f.service.verifyEmail(raw(f.sent[0]!))).rejects.toMatchObject({
      kind: "bad_link",
    });
    expect(f.repository.tokens[0]!.consumedAt).toBeNull();
    expect(f.repository.users.get(1)!.emailVerifiedAt).toBeNull();
    f.repository.failUserUpdate = false;
    await expect(f.service.verifyEmail(raw(f.sent[0]!))).resolves.toEqual({
      success: true,
    });
  });

  it("never converts a social account to password auth, even if eligibility changes after issuance", async () => {
    const f = fixture();
    await f.service.requestPasswordReset("member@example.com");
    const reset = raw(f.sent[0]!);
    f.repository.users.get(1)!.passwordHash = null;
    await expect(
      f.service.resetPassword(reset, "newpassword", "newpassword")
    ).rejects.toMatchObject({ kind: "bad_link" });
    expect(f.repository.users.get(1)!.passwordHash).toBeNull();
    expect(f.repository.users.get(1)!.sessionVersion).toBe(3);
  });

  it("password-change notice failure cannot undo a successful reset", async () => {
    const f = fixture();
    await f.service.requestPasswordReset("member@example.com");
    const reset = raw(f.sent[0]!);
    f.sendEmail.mockRejectedValue(
      new Error("provider body with sensitive data")
    );
    await expect(
      f.service.resetPassword(reset, "newpassword", "newpassword")
    ).resolves.toEqual({ success: true });
    expect(f.repository.users.get(1)!.sessionVersion).toBe(4);
  });

  it("validates password matching and byte bounds before hashing or mutation", async () => {
    const f = fixture();
    await f.service.requestPasswordReset("member@example.com");
    const reset = raw(f.sent[0]!);
    await expect(
      f.service.resetPassword(reset, "newpassword", "differentpassword")
    ).rejects.toMatchObject({ kind: "invalid_password" });
    await expect(
      f.service.resetPassword(reset, "é".repeat(37), "é".repeat(37))
    ).rejects.toMatchObject({ kind: "invalid_password" });
    expect(f.hashPassword).not.toHaveBeenCalled();
    expect(f.repository.tokens[0]!.consumedAt).toBeNull();
  });

  it("rejects expired and replayed reset links before doing expensive bcrypt work", async () => {
    const f = fixture();
    await f.service.requestPasswordReset("member@example.com");
    const expired = raw(f.sent[0]!);
    f.advance(PASSWORD_RESET_TOKEN_TTL_MS);
    await expect(
      f.service.resetPassword(expired, "newpassword", "newpassword")
    ).rejects.toMatchObject({ kind: "bad_link" });
    expect(f.hashPassword).not.toHaveBeenCalled();
    await f.service.requestPasswordReset("member@example.com");
    const latest = raw(f.sent[1]!);
    await f.service.resetPassword(latest, "newpassword", "newpassword");
    f.hashPassword.mockClear();
    await expect(
      f.service.resetPassword(latest, "newpassword", "newpassword")
    ).rejects.toMatchObject({ kind: "bad_link" });
    expect(f.hashPassword).not.toHaveBeenCalled();
  });

  it("email delivery failure leaves no usable token and returns a retryable authenticated error", async () => {
    const f = fixture();
    let failedRaw = "";
    f.sendEmail.mockImplementation(async input => {
      failedRaw = raw(input);
      throw new Error(`provider echo ${failedRaw} member@example.com`);
    });
    await expect(f.service.issueVerificationEmail(1)).rejects.toMatchObject({
      kind: "unavailable",
      message:
        "Security email is temporarily unavailable. Please try again later.",
    });
    expect(f.repository.tokens[0]!.deliveredAt).toBeNull();
    expect(f.repository.tokens[0]!.consumedAt).not.toBeNull();
    await expect(f.service.verifyEmail(failedRaw)).rejects.toMatchObject({
      kind: "bad_link",
    });
  });

  it("failed delivery stays inert even if revocation cleanup also fails", async () => {
    const f = fixture();
    let failedRaw = "";
    f.sendEmail.mockImplementation(async input => {
      failedRaw = raw(input);
      f.repository.failTransactions = true;
      throw new Error("provider failed");
    });
    await expect(f.service.issueVerificationEmail(1)).rejects.toMatchObject({
      kind: "unavailable",
    });
    f.repository.failTransactions = false;
    expect(f.repository.tokens[0]!.consumedAt).toBeNull();
    expect(f.repository.tokens[0]!.deliveredAt).toBeNull();
    await expect(f.service.verifyEmail(failedRaw)).rejects.toMatchObject({
      kind: "bad_link",
    });
  });

  it("out-of-order provider completion cannot reactivate an older token", async () => {
    const f = fixture();
    let completeFirst!: () => void;
    let announceFirst!: () => void;
    const firstSent = new Promise<void>(resolve => {
      announceFirst = resolve;
    });
    f.sendEmail.mockImplementationOnce(async input => {
      f.sent.push(input);
      announceFirst();
      await new Promise<void>(resolve => {
        completeFirst = resolve;
      });
    });
    const firstIssue = f.service.issueVerificationEmail(1);
    const firstRejected = expect(firstIssue).rejects.toMatchObject({
      kind: "unavailable",
    });
    await firstSent;
    f.advance(60_000);
    await f.service.issueVerificationEmail(1);
    completeFirst();
    await firstRejected;
    await expect(f.service.verifyEmail(raw(f.sent[0]!))).rejects.toMatchObject({
      kind: "bad_link",
    });
    await expect(f.service.verifyEmail(raw(f.sent[1]!))).resolves.toEqual({
      success: true,
    });
  });
});

describe("persistent limits and enumeration protection", () => {
  it("returns exactly the same public response for missing, social, unavailable, failure, and throttled recipients", async () => {
    const generic = { success: true, message: PASSWORD_RESET_REQUEST_MESSAGE };
    const f = fixture();
    expect(await f.service.requestPasswordReset("missing@example.com")).toEqual(
      generic
    );
    f.repository.users.get(1)!.passwordHash = null;
    expect(await f.service.requestPasswordReset("member@example.com")).toEqual(
      generic
    );
    f.repository.users.get(1)!.passwordHash = "old-hash";
    f.advance(60_000);
    f.sendEmail.mockRejectedValue(
      new Error("provider user@example.com token=raw")
    );
    expect(await f.service.requestPasswordReset("member@example.com")).toEqual(
      generic
    );
    expect(await f.service.requestPasswordReset("member@example.com")).toEqual(
      generic
    );
    f.isConfigured.mockReturnValue(false);
    expect(await f.service.requestPasswordReset("member@example.com")).toEqual(
      generic
    );
    expect(await f.service.requestPasswordReset("missing@example.com")).toEqual(
      generic
    );
    expect(f.repository.tokens.every(token => !token.deliveredAt)).toBe(true);
  });

  it("atomically limits recipients to 60-second cooldown and five per hour across processes", async () => {
    const f = fixture();
    await Promise.all(
      Array.from({ length: 8 }, () =>
        f.service.issueVerificationEmail(1).catch(error => error)
      )
    );
    expect(f.sent).toHaveLength(1);
    f.advance(59_999);
    await expect(f.service.issueVerificationEmail(1)).rejects.toMatchObject({
      kind: "throttled",
    });
    f.advance(1);
    await f.service.issueVerificationEmail(1);
    for (let i = 0; i < 3; i++) {
      f.advance(60_000);
      await f.service.issueVerificationEmail(1);
    }
    expect(f.sent).toHaveLength(5);
    f.advance(60_000);
    await expect(f.service.issueVerificationEmail(1)).rejects.toMatchObject({
      kind: "throttled",
    });
    // A separately constructed service uses the same persistent limiter rows.
    const other = createEmailSecurityService({
      repository: f.repository,
      isConfigured: () => true,
      sendEmail: f.sendEmail,
      now: f.clock,
      bucketSecret: () => "test-only-bucket-secret",
    });
    await expect(other.issueVerificationEmail(1)).rejects.toMatchObject({
      kind: "throttled",
    });
    f.advance(60 * 60 * 1000);
    await expect(other.issueVerificationEmail(1)).resolves.toEqual({
      success: true,
    });
    expect(f.sent).toHaveLength(6);
    expect(
      [...f.repository.buckets.keys()].every(key => /^[a-f0-9]{64}$/.test(key))
    ).toBe(true);
    expect(JSON.stringify([...f.repository.buckets])).not.toContain(
      "member@example.com"
    );
  });

  it("limits the socket-origin globally to 20/hour including missing accounts", async () => {
    const f = fixture();
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        f.service.requestPasswordReset(
          `missing${index}@example.com`,
          "192.0.2.1"
        )
      )
    );
    expect(
      await f.service.requestPasswordReset("member@example.com", "192.0.2.1")
    ).toEqual({ success: true, message: PASSWORD_RESET_REQUEST_MESSAGE });
    expect(f.sent).toHaveLength(0);
    await f.service.requestPasswordReset("member@example.com", "192.0.2.2");
    expect(f.sent).toHaveLength(1);
    expect(JSON.stringify([...f.repository.buckets])).not.toContain("192.0.2");
  });

  it("shares recipient limits between verification and password reset, including normalized email", async () => {
    const f = fixture();
    await f.service.issueVerificationEmail(1, "192.0.2.1");
    await f.service.requestPasswordReset("  MEMBER@EXAMPLE.COM ", "192.0.2.2");
    expect(f.sent).toHaveLength(1);
    f.advance(60_000);
    await f.service.requestPasswordReset("  MEMBER@EXAMPLE.COM ", "192.0.2.2");
    expect(f.sent).toHaveLength(2);
  });

  it("exports a generic hashed persistent registration/login limiter with atomic limits and fail-closed storage", async () => {
    const f = fixture();
    const limit = createAuthRateLimiter(
      f.repository,
      () => "test-secret",
      f.clock
    );
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        limit("email-login", "192.0.2.10", 5, 60_000)
      )
    );
    expect(responses.filter(Boolean)).toHaveLength(5);
    expect(await limit("registration", "192.0.2.10", 5, 60_000)).toBe(true);
    expect(JSON.stringify([...f.repository.buckets])).not.toContain(
      "192.0.2.10"
    );
    f.advance(60_000);
    expect(await limit("email-login", "192.0.2.10", 5, 60_000)).toBe(true);
    f.repository.failTransactions = true;
    await expect(
      limit("email-login", "192.0.2.10", 5, 60_000)
    ).rejects.toBeInstanceOf(EmailSecurityError);
  });
});

describe("email-security tRPC integration", () => {
  it("status exposes only auth, email, actual verification, requirement, and email service configuration", async () => {
    const f = fixture();
    const previous = {
      key: ENV.resendApiKey,
      from: ENV.resendFromEmail,
      url: ENV.publicAppUrl,
    };
    ENV.resendApiKey = "";
    try {
      const api = createEmailSecurityRouter(f.service);
      const anonymous = await api.createCaller(context(null)).status();
      expect(anonymous).toEqual({
        authenticated: false,
        email: null,
        needsVerification: false,
        verified: false,
        emailAvailable: false,
      });
      const status = await api
        .createCaller(context(f.repository.users.get(1)!))
        .status();
      expect(status).toEqual({
        authenticated: true,
        email: "member@example.com",
        needsVerification: true,
        verified: false,
        emailAvailable: false,
      });
      expect(status).not.toHaveProperty("id");
      f.repository.users.get(1)!.emailVerificationRequired = false;
      expect(
        (await api.createCaller(context(f.repository.users.get(1)!)).status())
          .needsVerification
      ).toBe(false);
    } finally {
      ENV.resendApiKey = previous.key;
      ENV.resendFromEmail = previous.from;
      ENV.publicAppUrl = previous.url;
    }
  });

  it("allows narrow unverified resend but rejects unauthenticated calls and ignores forwarded IP headers", async () => {
    const f = fixture();
    const resetSpy = vi.spyOn(f.service, "requestPasswordReset");
    const resendSpy = vi.spyOn(f.service, "issueVerificationEmail");
    const api = createEmailSecurityRouter(f.service);
    await expect(
      api.createCaller(context(null)).resendVerification()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      api.createCaller(context(f.repository.users.get(1)!)).resendVerification()
    ).resolves.toEqual({ success: true });
    expect(resendSpy).toHaveBeenCalledWith(1, "192.0.2.10");
    await api
      .createCaller(context(null))
      .requestPasswordReset({ email: " MEMBER@Example.COM " });
    expect(resetSpy).toHaveBeenCalledWith("member@example.com", "192.0.2.10");
  });

  it("verification cannot switch signed-in identity and never sets a session cookie", async () => {
    const f = fixture();
    await f.service.issueVerificationEmail(1);
    const token = raw(f.sent[0]!);
    const api = createEmailSecurityRouter(f.service);
    const different = context({ ...f.repository.users.get(1)!, id: 2 });
    await expect(
      api.createCaller(different).verifyEmail({ token })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: BAD_SECURITY_LINK_MESSAGE,
    });
    const anonymous = context(null);
    expect(await api.createCaller(anonymous).verifyEmail({ token })).toEqual({
      success: true,
    });
    expect(anonymous.res.cookie).not.toHaveBeenCalled();
    expect(different.res.cookie).not.toHaveBeenCalled();
  });

  it("reset rejects mismatches/byte overflow then clears session cookie without auto-login", async () => {
    const f = fixture();
    await f.service.requestPasswordReset("member@example.com");
    const token = raw(f.sent[0]!);
    const ctx = context(f.repository.users.get(1)!);
    const caller = createEmailSecurityRouter(f.service).createCaller(ctx);
    await expect(
      caller.resetPassword({
        token,
        password: "newpassword",
        confirmPassword: "differentpassword",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.resetPassword({
        token,
        password: "é".repeat(37),
        confirmPassword: "é".repeat(37),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(ctx.res.clearCookie).not.toHaveBeenCalled();
    expect(
      await caller.resetPassword({
        token,
        password: "newpassword",
        confirmPassword: "newpassword",
      })
    ).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalledWith(COOKIE_NAME, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: -1,
    });
    expect(ctx.res.cookie).not.toHaveBeenCalled();
    await expect(
      caller.resetPassword({
        token,
        password: "newpassword",
        confirmPassword: "newpassword",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: BAD_SECURITY_LINK_MESSAGE,
    });
  });

  it("constrains token/email length and sanitizes unexpected repository errors without causes", async () => {
    const f = fixture();
    const api = createEmailSecurityRouter(f.service);
    const caller = api.createCaller(context(null));
    await expect(caller.verifyEmail({ token: "short" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller.verifyEmail({ token: "a".repeat(257) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.requestPasswordReset({ email: `${"a".repeat(320)}@example.com` })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    f.repository.failTransactions = true;
    await expect(
      api.createCaller(context(f.repository.users.get(1)!)).resendVerification()
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message:
        "Account security is temporarily unavailable. Please try again later.",
      cause: undefined,
    });
  });
});
