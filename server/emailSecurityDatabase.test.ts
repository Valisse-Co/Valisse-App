import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users, emailAuthTokens, emailAuthRateLimits } from "../drizzle/schema";
import { getDb } from "./db";
import { createDrizzleSecurityRepository, createEmailSecurityService, hashSecurityToken, type SecurityRepository } from "./emailSecurity";
import type { SecurityEmailInput } from "./resend";

// Explicit opt-in only: creates one disposable synthetic identity, sends NO
// email, touches no existing accounts, and deletes its rows in finally.
describe.skipIf(process.env.RUN_EMAIL_DB_INTEGRATION !== "true")("email security real database adapter", () => {
  it("stores only hashes, consumes verification once, and atomically allows only one password reset", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const identity = randomUUID();
    const openId = `email_security_test_${identity}`;
    const email = `${identity}@example.invalid`;
    const buckets = new Set<string>();
    const base = createDrizzleSecurityRepository();
    const repository: SecurityRepository = { tokenOwner: base.tokenOwner, transaction: work => base.transaction(tx => work({ ...tx, lockBucket: async (hash, now) => { buckets.add(hash); return tx.lockBucket(hash, now); } })) };
    let userId: number | undefined;
    try {
      await db.insert(users).values({ openId, name: "Disposable email security test", email, passwordHash: "synthetic-initial-hash", emailVerificationRequired: true, onboardingCompleted: false });
      const [created] = await db.select().from(users).where(eq(users.openId, openId));
      if (!created) throw new Error("Disposable identity not created");
      userId = created.id;
      let instant = new Date();
      const sent: SecurityEmailInput[] = [];
      const service = createEmailSecurityService({ repository, sendEmail: async input => { sent.push(input); }, isConfigured: () => true, now: () => instant, bucketSecret: () => identity, hashPassword: async () => "synthetic-new-hash" });
      await service.issueVerificationEmail(userId, "synthetic-origin");
      const verify = sent.find(input => input.purpose === "verify_email");
      if (!verify || verify.purpose === "password_changed") throw new Error("Verification not prepared");
      const [stored] = await db.select().from(emailAuthTokens).where(eq(emailAuthTokens.userId, userId));
      expect(stored?.tokenHash).toBe(hashSecurityToken(verify.token));
      expect(JSON.stringify(stored)).not.toContain(verify.token);
      await service.verifyEmail(verify.token, userId);
      await expect(service.verifyEmail(verify.token, userId)).rejects.toMatchObject({ kind: "bad_link" });
      const [verified] = await db.select().from(users).where(eq(users.id, userId));
      expect(verified.emailVerifiedAt).toBeInstanceOf(Date);
      instant = new Date(instant.getTime() + 61_000);
      await service.requestPasswordReset(email, "synthetic-origin");
      const reset = sent.find(input => input.purpose === "reset_password");
      if (!reset || reset.purpose === "password_changed") throw new Error("Reset not prepared");
      const outcomes = await Promise.allSettled([service.resetPassword(reset.token, "ValidNew123!", "ValidNew123!"), service.resetPassword(reset.token, "ValidNew123!", "ValidNew123!")]);
      expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter(result => result.status === "rejected")).toHaveLength(1);
      const [changed] = await db.select().from(users).where(eq(users.id, userId));
      expect(changed.sessionVersion).toBe(1);
      expect(changed.passwordHash).toBe("synthetic-new-hash");
    } finally {
      if (userId !== undefined) await db.delete(emailAuthTokens).where(eq(emailAuthTokens.userId, userId));
      if (buckets.size) await db.delete(emailAuthRateLimits).where(inArray(emailAuthRateLimits.bucketHash, Array.from(buckets)));
      await db.delete(users).where(and(eq(users.openId, openId), eq(users.email, email)));
    }
  }, 30_000);
});
