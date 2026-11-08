import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { isResendConfigured, sendSecurityEmail } from "./resend";
import { hashSecurityToken } from "./emailSecurity";

// Explicitly opt in after configuring secrets. This sends exactly one email
// to Resend's official simulated recipient, never a real customer. It consumes
// one message of provider quota and does not create any redeemable DB token.
describe.skipIf(process.env.RUN_RESEND_CONFIG_TEST !== "true")("Resend configured sender", () => {
  it("accepts a security email with the configured API key and owned sender domain", async () => {
    expect(isResendConfigured(), "Configure RESEND_API_KEY and RESEND_FROM_EMAIL using a verified owned domain.").toBe(true);
    expect(ENV.resendFromEmail.toLowerCase(), "Use a verified Valisse-owned domain, not the shared Resend development sender.").not.toMatch(/@resend\.dev>?$/);
    const raw = randomBytes(32).toString("base64url");
    const result = await sendSecurityEmail({ purpose: "verify_email", to: "delivered@resend.dev", token: raw, tokenHash: hashSecurityToken(raw), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    expect(result).toEqual({ sent: true });
  }, 15_000);
});
