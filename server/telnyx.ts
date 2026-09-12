import { createPublicKey, verify } from "crypto";
import { ENV } from "./_core/env";
import { getUserById } from "./db";

const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const HELP_KEYWORDS = new Set(["help", "info"]);

export function normalizeSmsPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function phoneLookupCandidates(phone: string): string[] {
  const normalized = normalizeSmsPhone(phone);
  if (!normalized) return [];
  const digits = normalized.slice(1);
  const usNational = normalized.startsWith("+1") ? normalized.slice(2) : null;
  return Array.from(new Set([phone, normalized, digits, usNational].filter((value): value is string => Boolean(value))));
}

export function isStopKeyword(text: string | undefined): boolean {
  return STOP_KEYWORDS.has((text ?? "").trim().toLowerCase());
}

export function isHelpKeyword(text: string | undefined): boolean {
  return HELP_KEYWORDS.has((text ?? "").trim().toLowerCase());
}

export function isTelnyxConfigured(): boolean {
  return Boolean(
    ENV.telnyxApiKey &&
    ENV.telnyxMessagingProfileId &&
    normalizeSmsPhone(ENV.telnyxSenderNumber) &&
    ENV.telnyxPublicKey
  );
}

function redactTelnyxError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Telnyx rejected the SMS request.";
  const errors = (payload as { errors?: Array<{ title?: string; detail?: string }> }).errors;
  const first = errors?.[0];
  return first?.title || first?.detail || "Telnyx rejected the SMS request.";
}

export async function sendValisseTransactionalSms(input: { userId: number; text: string; category: string }) {
  const user = await getUserById(input.userId);
  const destination = normalizeSmsPhone(user?.phone);
  if (!user?.smsConsent) return { sent: false, reason: "no_sms_consent" as const };
  if (!destination) return { sent: false, reason: "invalid_phone" as const };
  if (!isTelnyxConfigured()) return { sent: false, reason: "not_configured" as const };

  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.telnyxApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: normalizeSmsPhone(ENV.telnyxSenderNumber),
      to: destination,
      text: input.text.slice(0, 1500),
      messaging_profile_id: ENV.telnyxMessagingProfileId,
      use_profile_webhooks: true,
      tags: ["valisse", input.category.slice(0, 50)],
    }),
  });
  const payload = await response.json().catch(() => null) as { data?: { id?: string } } | { errors?: unknown } | null;
  if (!response.ok) throw new Error(redactTelnyxError(payload));
  return { sent: true, messageId: (payload as { data?: { id?: string } }).data?.id ?? null };
}

function telnyxVerificationKey() {
  const source = ENV.telnyxPublicKey.trim();
  if (source.includes("BEGIN PUBLIC KEY")) return createPublicKey(source);
  const raw = Buffer.from(source, "base64");
  if (raw.length !== 32) throw new Error("Telnyx public key has an unexpected format.");
  const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  return createPublicKey({ key: Buffer.concat([ed25519SpkiPrefix, raw]), format: "der", type: "spki" });
}

export function verifyTelnyxWebhook(rawBody: Buffer, signature: string | undefined, timestamp: string | undefined): boolean {
  if (!signature || !timestamp || !ENV.telnyxPublicKey) return false;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;
  try {
    return verify(null, Buffer.from(`${timestamp}|${rawBody.toString("utf8")}`), telnyxVerificationKey(), Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
