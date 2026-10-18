export const APPOINTMENT_FEE_TYPES = ["cancellation", "late_arrival", "no_show"] as const;
export type AppointmentFeeType = (typeof APPOINTMENT_FEE_TYPES)[number];

export type AppointmentFeeThresholdMode = "fixed_minutes" | "percent_of_final_duration";
export type AppointmentFeeAmountType = "flat" | "percent_service_total";

/** A client-safe representation of one technician fee rule. Money is always integer cents. */
export type AppointmentFeeRuleInput = {
  ruleType: AppointmentFeeType;
  enabled: boolean;
  noticeHours: number;
  gracePeriodMinutes: number;
  thresholdMode: AppointmentFeeThresholdMode;
  thresholdValue: number;
  feeType: AppointmentFeeAmountType;
  flatFeeInCents: number;
  feePercentBasisPoints: number;
  updatedAt?: Date | string | null;
};

export type AppointmentFeePolicySnapshot = {
  version: string;
  rules: AppointmentFeeRuleInput[];
};

export function roundToNearestFiveMinutes(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export function resolveAttendanceThresholdMinutes(
  rule: AppointmentFeeRuleInput,
  totalDurationMinutes: number,
): number | null {
  if (!rule.enabled || rule.ruleType === "cancellation") return null;
  if (!Number.isFinite(totalDurationMinutes) || totalDurationMinutes <= 0) return null;

  const rawMinutes = rule.thresholdMode === "percent_of_final_duration"
    ? (totalDurationMinutes * rule.thresholdValue) / 100
    : rule.thresholdValue;

  return roundToNearestFiveMinutes(rawMinutes);
}

export function resolveAppointmentFeeAmountInCents(
  rule: AppointmentFeeRuleInput,
  serviceTotalInCents: number,
): number {
  if (!rule.enabled || !Number.isFinite(serviceTotalInCents) || serviceTotalInCents <= 0) return 0;
  const rawAmount = rule.feeType === "flat"
    ? rule.flatFeeInCents
    : Math.round((serviceTotalInCents * rule.feePercentBasisPoints) / 10_000);
  return Math.max(0, Math.min(serviceTotalInCents, Math.round(rawAmount)));
}

export function isCancellationFeeEligible(params: {
  rule: AppointmentFeeRuleInput;
  scheduledAt: Date;
  bookedAt: Date;
  now?: Date;
}): boolean {
  const { rule, scheduledAt, bookedAt, now = new Date() } = params;
  if (!rule.enabled || rule.ruleType !== "cancellation") return false;
  const nowMs = now.getTime();
  const graceEndsAt = bookedAt.getTime() + rule.gracePeriodMinutes * 60_000;
  const lateWindowStartsAt = scheduledAt.getTime() - rule.noticeHours * 60 * 60_000;
  return nowMs > graceEndsAt && nowMs > lateWindowStartsAt;
}

/**
 * Stable client acknowledgement identifier. It is an attestation marker, not a
 * secret; the server still derives the active rules and money values itself.
 */
export function getAppointmentFeePolicyVersion(rules: AppointmentFeeRuleInput[]): string {
  return [...rules]
    .sort((a, b) => a.ruleType.localeCompare(b.ruleType))
    .map((rule) => [
      rule.ruleType,
      rule.enabled ? "1" : "0",
      rule.noticeHours,
      rule.gracePeriodMinutes,
      rule.thresholdMode,
      rule.thresholdValue,
      rule.feeType,
      rule.flatFeeInCents,
      rule.feePercentBasisPoints,
      rule.updatedAt ? new Date(rule.updatedAt).toISOString() : "",
    ].join(":"))
    .join("|");
}

export function buildAppointmentFeePolicySnapshot(rules: AppointmentFeeRuleInput[]): AppointmentFeePolicySnapshot {
  const normalized = rules.map((rule) => ({
    ruleType: rule.ruleType,
    enabled: Boolean(rule.enabled),
    noticeHours: rule.noticeHours,
    gracePeriodMinutes: rule.gracePeriodMinutes,
    thresholdMode: rule.thresholdMode,
    thresholdValue: rule.thresholdValue,
    feeType: rule.feeType,
    flatFeeInCents: rule.flatFeeInCents,
    feePercentBasisPoints: rule.feePercentBasisPoints,
    updatedAt: rule.updatedAt ? new Date(rule.updatedAt).toISOString() : null,
  }));
  return { version: getAppointmentFeePolicyVersion(normalized), rules: normalized };
}

export function formatRuleFee(rule: AppointmentFeeRuleInput): string {
  if (rule.feeType === "flat") return `$${(rule.flatFeeInCents / 100).toFixed(2)}`;
  return `${(rule.feePercentBasisPoints / 100).toFixed(2).replace(/\.00$/, "")}% of your service total`;
}
