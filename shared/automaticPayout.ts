/** Pure contracts only: raw candidate/customer/account records belong on the server. */
export const AUTOMATIC_PAYOUT_KINDS = [
  "service",
  "tip",
  "appointment_fee",
] as const;
export const AUTOMATIC_PAYOUT_STATES = [
  "ready",
  "dispatching",
  "transferred",
  "needs_reconciliation",
  "blocked",
] as const;
export const AUTOMATIC_PAYOUT_REASONS = [
  "provider_uncertain",
  "persistence_uncertain",
  "reconciliation_required",
  "reconciliation_not_found",
  "reconciliation_conflict",
  "source_changed",
  "issue_hold",
  "preflight_deferred",
  "provider_rejected",
] as const;
export type AutomaticPayoutKind = (typeof AUTOMATIC_PAYOUT_KINDS)[number];
export type AutomaticPayoutState = (typeof AUTOMATIC_PAYOUT_STATES)[number];
export type AutomaticPayoutReason = (typeof AUTOMATIC_PAYOUT_REASONS)[number];
export const AUTOMATIC_PAYOUT_LEASE_MS = 120_000;
export const AUTOMATIC_PAYOUT_WINDOW_MS = 86_400_000;
export const AUTOMATIC_PAYOUT_MAX_CANDIDATES = 5;

export interface AutomaticPayoutSpec {
  mode: "live" | "test";
  kind: AutomaticPayoutKind;
  bookingId: number;
  feeEventId: number | null;
  techId: number;
  clientId: number;
  customerId: string;
  destination: string;
  paymentIntentId: string;
  chargeId: string;
  amountInCents: number;
  originalGrossInCents: number;
  currency: "usd";
  /** Immutable authorization boundary, carried through every transition. */
  cutoff: Date;
}

export function assertPositiveSafeInteger(
  value: unknown,
  name: string
): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid automatic payout ${name}`);
  }
}
export function assertPayoutDate(
  value: unknown,
  name: string
): asserts value is Date {
  if (
    !(value instanceof Date) ||
    !Number.isFinite(value.getTime()) ||
    value.getTime() <= 0
  ) {
    throw new Error(`Invalid automatic payout ${name}`);
  }
}
export function assertAutomaticPayoutClocks(cutoff: Date, now: Date): void {
  assertPayoutDate(cutoff, "cutoff");
  assertPayoutDate(now, "now");
  if (cutoff.getTime() > now.getTime())
    throw new Error("Automatic payout cutoff is after now");
}
export function assertStripePayoutId(
  value: unknown,
  prefix: "pi" | "ch" | "acct" | "cus" | "tr"
): asserts value is string {
  if (
    typeof value !== "string" ||
    !new RegExp(`^${prefix}_[A-Za-z0-9]{1,240}$`).test(value)
  ) {
    throw new Error(`Invalid automatic payout ${prefix} identifier`);
  }
}
export function assertPayoutUUID(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new Error("Invalid automatic payout UUID");
  }
}
export function assertAutomaticPayoutReason(
  value: unknown
): asserts value is AutomaticPayoutReason {
  if (!AUTOMATIC_PAYOUT_REASONS.includes(value as AutomaticPayoutReason))
    throw new Error("Invalid automatic payout reason");
}
export function assertAutomaticPayoutSpec(
  spec: AutomaticPayoutSpec,
  now?: Date
): void {
  if (
    !spec ||
    (spec.mode !== "live" && spec.mode !== "test") ||
    !AUTOMATIC_PAYOUT_KINDS.includes(spec.kind)
  ) {
    throw new Error("Invalid automatic payout mode or kind");
  }
  for (const name of [
    "bookingId",
    "techId",
    "clientId",
    "amountInCents",
    "originalGrossInCents",
  ] as const) {
    assertPositiveSafeInteger(spec[name], name);
  }
  if (spec.kind === "appointment_fee")
    assertPositiveSafeInteger(spec.feeEventId, "feeEventId");
  else if (spec.feeEventId !== null)
    throw new Error("Non-fee payout must not have a fee event");
  if (spec.currency !== "usd" || spec.amountInCents > spec.originalGrossInCents)
    throw new Error("Invalid automatic payout amount or currency");
  assertStripePayoutId(spec.paymentIntentId, "pi");
  assertStripePayoutId(spec.chargeId, "ch");
  assertStripePayoutId(spec.customerId, "cus");
  assertStripePayoutId(spec.destination, "acct");
  assertPayoutDate(spec.cutoff, "cutoff");
  if (now) assertAutomaticPayoutClocks(spec.cutoff, now);
}
/** Integer-safe five-percent service commission, including half-cent rounding. */
export function automaticServicePayoutInCents(gross: number): number {
  assertPositiveSafeInteger(gross, "gross");
  const fee = (BigInt(gross) * BigInt(5) + BigInt(50)) / BigInt(100);
  return gross - Number(fee);
}
export function automaticPayoutTransferGroup(ledgerId: string): string {
  assertPayoutUUID(ledgerId);
  return `valisse_auto_${ledgerId}`;
}
export function automaticPayoutIdempotencyKey(ledgerId: string): string {
  return automaticPayoutTransferGroup(ledgerId);
}
