import { ENV } from "./_core/env";

export type SecurityEmailInput = {
  to: string;
  tokenHash: string;
} & (
  | {
      purpose: "verify_email" | "reset_password";
      token: string;
      expiresAt: Date;
    }
  | { purpose: "password_changed" }
);

function canonicalAppOrigin(): string | null {
  try {
    const url = new URL(ENV.publicAppUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isResendConfigured(): boolean {
  return Boolean(
    ENV.resendApiKey.trim() &&
      /^[^\r\n]*[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(
        ENV.resendFromEmail.trim()
      ) &&
      canonicalAppOrigin()
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!
  );
}

export async function sendSecurityEmail(
  input: SecurityEmailInput
): Promise<{ sent: true }> {
  if (!isResendConfigured())
    throw new Error("Security email service is unavailable.");
  if (
    !/^[a-f0-9]{64}$/.test(input.tokenHash) ||
    input.to.length > 320 ||
    !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(input.to)
  ) {
    throw new Error("Invalid security email request.");
  }
  const origin = canonicalAppOrigin()!;
  const changed = input.purpose === "password_changed";
  const verify = input.purpose === "verify_email";
  const subject = changed
    ? "Your Valisse password was changed"
    : verify
      ? "Verify your Valisse email"
      : "Reset your Valisse password";
  let link: string | null = null;
  let instructions: string;
  if (input.purpose === "password_changed") {
    instructions =
      "Your Valisse password has been changed. Existing sessions have been revoked. If you did not make this change, reset your password immediately and contact Valisse support.";
    link = `${origin}/reset-password`;
  } else {
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(input.token) ||
      !Number.isFinite(input.expiresAt.getTime())
    )
      throw new Error("Invalid security email request.");
    const url = new URL(verify ? "/verify-email" : "/reset-password", origin);
    // Fragments are not sent to web servers, access logs, or Referer headers.
    url.hash = new URLSearchParams({ token: input.token }).toString();
    link = url.toString();
    instructions = verify
      ? "Confirm this email address to finish securing your Valisse account."
      : "Use this link to choose a new Valisse password. You will need to sign in afterward.";
    instructions += ` This one-time link expires in ${verify ? "24 hours" : "30 minutes"} (by ${input.expiresAt.toISOString()}). Only the most recently requested link works.`;
  }
  const ignore = changed
    ? "If you made this change, no further action is required. Valisse will never ask you to reply with your password."
    : "If you did not request this email, you can safely ignore it. Do not share this link. Valisse will never ask you to reply with your password.";
  const action = changed
    ? "Secure your account"
    : verify
      ? "Verify email"
      : "Reset password";
  const text = `Valisse\n\n${subject}\n\n${instructions}\n\n${action}: ${link}\n\n${ignore}`;
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f9f5f2;font-family:Arial,sans-serif;color:#31292c"><main style="max-width:520px;margin:32px auto;padding:32px;background:white;border-radius:16px"><p style="font-size:24px;letter-spacing:2px;color:#744953">VALISSE</p><h1 style="font-size:22px">${escapeHtml(subject)}</h1><p style="line-height:1.6">${escapeHtml(instructions)}</p><p style="margin:28px 0"><a style="display:inline-block;padding:14px 22px;background:#744953;color:white;border-radius:8px;text-decoration:none" href="${escapeHtml(link)}">${escapeHtml(action)}</a></p><p style="font-size:13px;line-height:1.6;color:#655b5e">${escapeHtml(ignore)}</p></main></body></html>`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${ENV.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `valisse/${input.purpose}/${input.tokenHash}`,
      },
      body: JSON.stringify({
        from: ENV.resendFromEmail,
        to: [input.to],
        subject,
        html,
        text,
      }),
    });
    // Never parse, log, or expose the provider response body (which can echo PII).
    void response.body?.cancel().catch(() => {});
    if (!response.ok)
      throw new Error("Security email delivery failed. Please try again.");
    return { sent: true };
  } catch {
    throw new Error("Security email delivery failed. Please try again.");
  } finally {
    clearTimeout(timeout);
  }
}
