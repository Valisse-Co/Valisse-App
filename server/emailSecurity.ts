import { createHash, createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  emailAuthRateLimits,
  emailAuthTokens,
  users,
  type EmailAuthToken,
} from "../drizzle/schema";
import {
  getPasswordValidationError,
  normalizeEmail,
  PASSWORD_RESET_TOKEN_TTL_MS,
  VERIFY_EMAIL_TOKEN_TTL_MS,
} from "../shared/emailSecurity";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import {
  isResendConfigured,
  sendSecurityEmail,
  type SecurityEmailInput,
} from "./resend";

export const PASSWORD_RESET_REQUEST_MESSAGE =
  "If an eligible account exists, we’ve sent password reset instructions.";
export const BAD_SECURITY_LINK_MESSAGE =
  "This link is invalid or has expired. Please request a new link.";
const HOUR_MS = 60 * 60 * 1000;
const RECIPIENT_COOLDOWN_MS = 60 * 1000;
type TokenPurpose = EmailAuthToken["purpose"];
export type SecurityUser = {
  id: number;
  email: string | null;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  emailVerificationRequired: boolean;
  sessionVersion: number;
};
export type RateBucket = {
  bucketHash: string;
  windowStartedAt: Date;
  requestCount: number;
  lastRequestedAt: Date | null;
};
export type NewSecurityToken = Omit<EmailAuthToken, "id">;

// Explicit transaction contracts enable deterministic concurrency/replay tests.
// Implementations MUST hold user locks before token locks, and bucket locks until
// commit. Conditional update failure MUST roll back the entire transaction.
export interface SecurityTransaction {
  lockUser(id: number): Promise<SecurityUser | undefined>;
  findUserByEmail(email: string): Promise<SecurityUser | undefined>;
  lockToken(hash: string): Promise<EmailAuthToken | undefined>;
  latestToken(
    userId: number,
    purpose: TokenPurpose
  ): Promise<EmailAuthToken | undefined>;
  insertToken(token: NewSecurityToken): Promise<void>;
  revokeTokens(
    userId: number,
    now: Date,
    purpose?: TokenPurpose
  ): Promise<void>;
  markDelivered(hash: string, now: Date): Promise<boolean>;
  consumeToken(hash: string, email: string, now: Date): Promise<boolean>;
  markVerified(user: SecurityUser, now: Date): Promise<boolean>;
  changePassword(user: SecurityUser, passwordHash: string): Promise<boolean>;
  lockBucket(hash: string, now: Date): Promise<RateBucket>;
  saveBucket(bucket: RateBucket, now: Date): Promise<void>;
}
export interface SecurityRepository {
  transaction<T>(work: (tx: SecurityTransaction) => Promise<T>): Promise<T>;
  tokenOwner(hash: string): Promise<number | undefined>;
}

export class EmailSecurityError extends Error {
  constructor(
    public readonly kind:
      | "bad_link"
      | "unavailable"
      | "throttled"
      | "no_email"
      | "invalid_password",
    message: string
  ) {
    super(message);
    this.name = "EmailSecurityError";
  }
}
function badLink(): never {
  throw new EmailSecurityError("bad_link", BAD_SECURITY_LINK_MESSAGE);
}
function unavailable(): never {
  throw new EmailSecurityError(
    "unavailable",
    "Security email is temporarily unavailable. Please try again later."
  );
}
export function hashSecurityToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
export function hashSecurityBucket(
  kind: "origin" | "recipient",
  value: string,
  key: string
): string {
  if (!key) unavailable();
  return createHmac("sha256", key)
    .update(`valisse-email-security/${kind}\0${value}`)
    .digest("hex");
}

function changedRows(result: unknown): boolean {
  return (
    Number((result as [{ affectedRows?: number }])[0]?.affectedRows ?? 0) === 1
  );
}
async function database() {
  const db = await getDb();
  if (!db) unavailable();
  return db;
}

export function createDrizzleSecurityRepository(): SecurityRepository {
  return {
    async tokenOwner(hash) {
      const db = await database();
      const [row] = await db
        .select({ userId: emailAuthTokens.userId })
        .from(emailAuthTokens)
        .where(eq(emailAuthTokens.tokenHash, hash))
        .limit(1);
      return row?.userId;
    },
    async transaction(work) {
      const db = await database();
      return db.transaction(async tx =>
        work({
          async lockUser(id) {
            const [row] = await tx
              .select()
              .from(users)
              .where(eq(users.id, id))
              .limit(1)
              .for("update");
            return row;
          },
          async findUserByEmail(email) {
            // Discovery only. Call lockUser and recheck email before issuing.
            const [row] = await tx
              .select()
              .from(users)
              .where(sql`LOWER(TRIM(${users.email})) = ${email}`)
              .limit(1);
            return row;
          },
          async lockToken(hash) {
            const [row] = await tx
              .select()
              .from(emailAuthTokens)
              .where(eq(emailAuthTokens.tokenHash, hash))
              .limit(1)
              .for("update");
            return row;
          },
          async latestToken(userId, purpose) {
            const [row] = await tx
              .select()
              .from(emailAuthTokens)
              .where(
                and(
                  eq(emailAuthTokens.userId, userId),
                  eq(emailAuthTokens.purpose, purpose)
                )
              )
              .orderBy(desc(emailAuthTokens.id))
              .limit(1)
              .for("update");
            return row;
          },
          async insertToken(token) {
            await tx.insert(emailAuthTokens).values(token);
          },
          async revokeTokens(userId, now, purpose) {
            await tx
              .update(emailAuthTokens)
              .set({ consumedAt: now })
              .where(
                and(
                  eq(emailAuthTokens.userId, userId),
                  isNull(emailAuthTokens.consumedAt),
                  purpose ? eq(emailAuthTokens.purpose, purpose) : undefined
                )
              );
          },
          async markDelivered(hash, now) {
            return changedRows(
              await tx
                .update(emailAuthTokens)
                .set({ deliveredAt: now })
                .where(
                  and(
                    eq(emailAuthTokens.tokenHash, hash),
                    isNull(emailAuthTokens.consumedAt),
                    isNull(emailAuthTokens.deliveredAt),
                    gt(emailAuthTokens.expiresAt, now)
                  )
                )
            );
          },
          async consumeToken(hash, email, now) {
            return changedRows(
              await tx
                .update(emailAuthTokens)
                .set({ consumedAt: now })
                .where(
                  and(
                    eq(emailAuthTokens.tokenHash, hash),
                    eq(emailAuthTokens.email, email),
                    isNull(emailAuthTokens.consumedAt),
                    sql`${emailAuthTokens.deliveredAt} IS NOT NULL`,
                    gt(emailAuthTokens.expiresAt, now)
                  )
                )
            );
          },
          async markVerified(user, now) {
            return changedRows(
              await tx
                .update(users)
                .set({ emailVerifiedAt: now })
                .where(
                  and(
                    eq(users.id, user.id),
                    eq(users.email, user.email!),
                    isNull(users.emailVerifiedAt)
                  )
                )
            );
          },
          async changePassword(user, passwordHash) {
            return changedRows(
              await tx
                .update(users)
                .set({
                  passwordHash,
                  sessionVersion: sql`${users.sessionVersion} + 1`,
                })
                .where(
                  and(
                    eq(users.id, user.id),
                    eq(users.email, user.email!),
                    eq(users.passwordHash, user.passwordHash!)
                  )
                )
            );
          },
          async lockBucket(hash, now) {
            // Upsert obtains an exclusive lock even on first concurrent creation.
            await tx
              .insert(emailAuthRateLimits)
              .values({
                bucketHash: hash,
                windowStartedAt: now,
                requestCount: 0,
                lastRequestedAt: null,
                updatedAt: now,
              })
              .onDuplicateKeyUpdate({ set: { bucketHash: hash } });
            const [row] = await tx
              .select()
              .from(emailAuthRateLimits)
              .where(eq(emailAuthRateLimits.bucketHash, hash))
              .limit(1)
              .for("update");
            if (!row) unavailable();
            return row;
          },
          async saveBucket(bucket, now) {
            await tx
              .update(emailAuthRateLimits)
              .set({ ...bucket, updatedAt: now })
              .where(eq(emailAuthRateLimits.bucketHash, bucket.bucketHash));
          },
        })
      );
    },
  };
}

export function createEmailSecurityService(deps: {
  repository: SecurityRepository;
  sendEmail?: (input: SecurityEmailInput) => Promise<unknown>;
  isConfigured?: () => boolean;
  now?: () => Date;
  bucketSecret?: () => string;
  hashPassword?: (password: string) => Promise<string>;
}) {
  const repository = deps.repository;
  const send = deps.sendEmail ?? sendSecurityEmail;
  const configured = deps.isConfigured ?? isResendConfigured;
  const now = deps.now ?? (() => new Date());
  const key = deps.bucketSecret ?? (() => ENV.cookieSecret || ENV.resendApiKey);
  const hashPassword =
    deps.hashPassword ?? (password => bcrypt.hash(password, 12));

  async function takeLimits(
    email: string | null,
    remoteAddress?: string
  ): Promise<boolean> {
    const requests: Array<{ hash: string; max: number; cooldown: boolean }> =
      [];
    if (remoteAddress !== undefined)
      requests.push({
        hash: hashSecurityBucket(
          "origin",
          remoteAddress || "unknown-socket",
          key()
        ),
        max: 20,
        cooldown: false,
      });
    if (email !== null)
      requests.push({
        hash: hashSecurityBucket("recipient", email, key()),
        max: 5,
        cooldown: true,
      });
    // One lock order across all processes; never branch lock order on request type.
    requests.sort((a, b) => a.hash.localeCompare(b.hash));
    return repository.transaction(async tx => {
      const checked: Array<{ bucket: RateBucket; allowed: boolean }> = [];
      const instant = now();
      for (const request of requests) {
        const bucket = await tx.lockBucket(request.hash, instant);
        if (instant.getTime() - bucket.windowStartedAt.getTime() >= HOUR_MS) {
          bucket.windowStartedAt = instant;
          bucket.requestCount = 0;
        }
        const allowed =
          bucket.requestCount < request.max &&
          (!request.cooldown ||
            !bucket.lastRequestedAt ||
            instant.getTime() - bucket.lastRequestedAt.getTime() >=
              RECIPIENT_COOLDOWN_MS);
        checked.push({ bucket, allowed });
      }
      // Origins count every request, including missing/social/throttled recipients.
      // Recipients count permitted attempts only, so cooldown cannot be extended
      // forever by a stream of denied requests.
      const allAllowed = checked.every(item => item.allowed);
      for (let i = 0; i < checked.length; i++) {
        const { bucket, allowed } = checked[i]!;
        if (allowed && (!requests[i]!.cooldown || allAllowed)) {
          bucket.requestCount += 1;
          bucket.lastRequestedAt = instant;
          await tx.saveBucket(bucket, instant);
        }
      }
      return allAllowed;
    });
  }

  async function issue(
    userId: number,
    purpose: TokenPurpose,
    expectedEmail?: string
  ): Promise<void> {
    if (!configured()) unavailable();
    const raw = randomBytes(32).toString("base64url");
    const tokenHash = hashSecurityToken(raw);
    const token = await repository.transaction(async tx => {
      const user = await tx.lockUser(userId);
      if (!user?.email)
        throw new EmailSecurityError(
          "no_email",
          "Your account has no email address available for verification."
        );
      const email = normalizeEmail(user.email);
      if (expectedEmail && expectedEmail !== email) return null;
      if (
        (purpose === "verify_email" && user.emailVerifiedAt) ||
        (purpose === "reset_password" && !user.passwordHash)
      )
        return null;
      const instant = now();
      // Invalidate older links at issuance, even if the latest send later fails.
      await tx.revokeTokens(user.id, instant, purpose);
      const next: NewSecurityToken = {
        tokenHash,
        userId: user.id,
        email,
        purpose,
        createdAt: instant,
        expiresAt: new Date(
          instant.getTime() +
            (purpose === "verify_email"
              ? VERIFY_EMAIL_TOKEN_TTL_MS
              : PASSWORD_RESET_TOKEN_TTL_MS)
        ),
        consumedAt: null,
        deliveredAt: null,
      };
      await tx.insertToken(next);
      return next;
    });
    if (!token) return;
    try {
      await send({
        purpose,
        to: token.email,
        token: raw,
        tokenHash,
        expiresAt: token.expiresAt,
      });
      const activated = await repository.transaction(async tx => {
        const user = await tx.lockUser(userId);
        const current = await tx.lockToken(tokenHash);
        const latest = await tx.latestToken(userId, purpose);
        if (
          !user?.email ||
          normalizeEmail(user.email) !== token.email ||
          current?.consumedAt ||
          latest?.tokenHash !== tokenHash ||
          (purpose === "reset_password" && !user.passwordHash)
        )
          return false;
        return tx.markDelivered(tokenHash, now());
      });
      if (!activated) unavailable();
    } catch {
      // A pending token can NEVER redeem, even if DB cleanup is unavailable.
      try {
        await repository.transaction(async tx => {
          await tx.lockUser(userId);
          const current = await tx.lockToken(tokenHash);
          if (current && !current.consumedAt)
            await tx.consumeToken(tokenHash, token.email, now());
          // Pending token consume is deliberately conditional and may be a no-op.
          // Revoke only when still latest, never poison a concurrent newer send.
          const latest = await tx.latestToken(userId, purpose);
          if (latest?.tokenHash === tokenHash)
            await tx.revokeTokens(userId, now(), purpose);
        });
      } catch {
        /* No sensitive provider/DB error is logged or surfaced. */
      }
      unavailable();
    }
  }

  async function redeem(
    raw: string,
    purpose: TokenPurpose,
    loggedInUserId?: number,
    passwordHash?: string
  ): Promise<{ email: string; tokenHash: string }> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) badLink();
    const hash = hashSecurityToken(raw);
    const owner = await repository.tokenOwner(hash);
    if (
      owner === undefined ||
      (loggedInUserId !== undefined && loggedInUserId !== owner)
    )
      badLink();
    return repository.transaction(async tx => {
      const user = await tx.lockUser(owner);
      const token = await tx.lockToken(hash);
      const instant = now();
      if (
        !user?.email ||
        !token ||
        token.userId !== owner ||
        token.purpose !== purpose ||
        token.consumedAt ||
        !token.deliveredAt ||
        token.expiresAt.getTime() <= instant.getTime() ||
        token.email !== normalizeEmail(user.email)
      )
        badLink();
      const latest = await tx.latestToken(owner, purpose);
      if (latest?.tokenHash !== hash) badLink();
      if (
        (purpose === "reset_password" &&
          (!user.passwordHash || !passwordHash)) ||
        (purpose === "verify_email" && user.emailVerifiedAt)
      )
        badLink();
      if (!(await tx.consumeToken(hash, token.email, instant))) badLink();
      const updated =
        purpose === "verify_email"
          ? await tx.markVerified(user, instant)
          : await tx.changePassword(user, passwordHash!);
      if (!updated) badLink();
      // Success revokes every sibling purpose, including pending deliveries.
      await tx.revokeTokens(owner, instant);
      return { email: token.email, tokenHash: hash };
    });
  }

  return {
    async issueVerificationEmail(userId: number, remoteAddress?: string) {
      if (!configured()) unavailable();
      const user = await repository.transaction(tx => tx.lockUser(userId));
      if (!user?.email)
        throw new EmailSecurityError(
          "no_email",
          "Your account has no email address available for verification."
        );
      if (user.emailVerifiedAt) return { success: true } as const;
      if (!(await takeLimits(normalizeEmail(user.email), remoteAddress)))
        throw new EmailSecurityError(
          "throttled",
          "Please wait at least 60 seconds before requesting another email. Email requests are limited to 5 per hour."
        );
      await issue(user.id, "verify_email", normalizeEmail(user.email));
      return { success: true } as const;
    },
    async verifyEmail(raw: string, loggedInUserId?: number) {
      await redeem(raw, "verify_email", loggedInUserId);
      return { success: true } as const;
    },
    async requestPasswordReset(
      emailInput: string,
      remoteAddress = "unknown-socket"
    ) {
      try {
        if (!configured()) unavailable();
        const email = normalizeEmail(emailInput);
        if (await takeLimits(email, remoteAddress)) {
          const user = await repository.transaction(tx =>
            tx.findUserByEmail(email)
          );
          if (user?.passwordHash) await issue(user.id, "reset_password", email);
        }
      } catch {
        /* Account existence, throttling, and delivery are indistinguishable. */
      }
      return {
        success: true,
        message: PASSWORD_RESET_REQUEST_MESSAGE,
      } as const;
    },
    async resetPassword(
      raw: string,
      password: string,
      confirmPassword: string
    ) {
      const validation = getPasswordValidationError(password);
      if (validation || password !== confirmPassword)
        throw new EmailSecurityError(
          "invalid_password",
          validation ?? "Passwords do not match."
        );
      // Bound bcrypt work to real, eligible links; validate again under user/token
      // locks after hashing so concurrent resets/email changes cannot race.
      if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) badLink();
      const hash = hashSecurityToken(raw);
      const owner = await repository.tokenOwner(hash);
      if (owner === undefined) badLink();
      await repository.transaction(async tx => {
        const user = await tx.lockUser(owner);
        const token = await tx.lockToken(hash);
        const latest = await tx.latestToken(owner, "reset_password");
        if (
          !user?.email ||
          !user.passwordHash ||
          !token ||
          token.userId !== owner ||
          token.purpose !== "reset_password" ||
          token.consumedAt ||
          !token.deliveredAt ||
          token.expiresAt.getTime() <= now().getTime() ||
          token.email !== normalizeEmail(user.email) ||
          latest?.tokenHash !== hash
        )
          badLink();
      });
      const result = await redeem(
        raw,
        "reset_password",
        undefined,
        await hashPassword(password)
      );
      try {
        await send({
          purpose: "password_changed",
          to: result.email,
          tokenHash: result.tokenHash,
        });
      } catch {
        /* Best effort; never undo the password change. */
      }
      return { success: true } as const;
    },
  };
}

export const emailSecurityService = createEmailSecurityService({
  repository: createDrizzleSecurityRepository(),
});
export const issueVerificationEmail = (userId: number) =>
  emailSecurityService.issueVerificationEmail(userId);

/** Shared registration/login limiter. key is a raw socket IP or normalized email;
 * only a namespaced keyed hash is persisted. Storage failures fail closed. */
export function createAuthRateLimiter(
  repository: SecurityRepository,
  secret: () => string = () => ENV.cookieSecret || ENV.resendApiKey,
  clock: () => Date = () => new Date()
) {
  return async (
    scope: string,
    key: string,
    max: number,
    windowMs: number
  ): Promise<boolean> => {
    if (
      !scope ||
      scope.length > 100 ||
      !Number.isSafeInteger(max) ||
      max < 1 ||
      !Number.isSafeInteger(windowMs) ||
      windowMs < 1
    )
      throw new EmailSecurityError(
        "unavailable",
        "Invalid authentication rate limit configuration."
      );
    const bucketHash = hashSecurityBucket(
      "origin",
      `auth/${scope}\0${key}`,
      secret()
    );
    try {
      return await repository.transaction(async tx => {
        const instant = clock();
        const bucket = await tx.lockBucket(bucketHash, instant);
        if (instant.getTime() - bucket.windowStartedAt.getTime() >= windowMs) {
          bucket.windowStartedAt = instant;
          bucket.requestCount = 0;
        }
        if (bucket.requestCount >= max) return false;
        bucket.requestCount += 1;
        bucket.lastRequestedAt = instant;
        await tx.saveBucket(bucket, instant);
        return true;
      });
    } catch {
      unavailable();
    }
  };
}

export const checkAuthRateLimit = createAuthRateLimiter(
  createDrizzleSecurityRepository()
);
