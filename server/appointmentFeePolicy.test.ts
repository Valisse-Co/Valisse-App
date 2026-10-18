import { describe, expect, it } from "vitest";
import {
  buildAppointmentFeePolicySnapshot,
  getAppointmentFeePolicyVersion,
  isCancellationFeeEligible,
  resolveAppointmentFeeAmountInCents,
  resolveAttendanceThresholdMinutes,
  type AppointmentFeeRuleInput,
} from "../shared/appointmentFeePolicy";

const baseRule: AppointmentFeeRuleInput = {
  ruleType: "late_arrival",
  enabled: true,
  noticeHours: 24,
  gracePeriodMinutes: 60,
  thresholdMode: "fixed_minutes",
  thresholdValue: 15,
  feeType: "flat",
  flatFeeInCents: 2_500,
  feePercentBasisPoints: 0,
  updatedAt: new Date("2026-10-17T00:00:00.000Z"),
};

describe("appointment fee policy", () => {
  it("keeps every newly configured rule disabled until the technician turns it on", () => {
    expect(resolveAttendanceThresholdMinutes({ ...baseRule, enabled: false }, 90)).toBeNull();
    expect(resolveAppointmentFeeAmountInCents({ ...baseRule, enabled: false }, 10_000)).toBe(0);
  });

  it("supports fixed-minute and rounded percentage-of-duration attendance thresholds", () => {
    expect(resolveAttendanceThresholdMinutes(baseRule, 75)).toBe(15);
    expect(resolveAttendanceThresholdMinutes({ ...baseRule, thresholdMode: "percent_of_final_duration", thresholdValue: 33 }, 75)).toBe(25);
    expect(resolveAttendanceThresholdMinutes({ ...baseRule, ruleType: "no_show", thresholdMode: "percent_of_final_duration", thresholdValue: 10 }, 83)).toBe(10);
  });

  it("calculates all fee amounts in integer cents and never exceeds the final service total", () => {
    expect(resolveAppointmentFeeAmountInCents(baseRule, 10_000)).toBe(2_500);
    expect(resolveAppointmentFeeAmountInCents({ ...baseRule, feeType: "percent_service_total", flatFeeInCents: 0, feePercentBasisPoints: 1_250 }, 10_001)).toBe(1_250);
    expect(resolveAppointmentFeeAmountInCents({ ...baseRule, flatFeeInCents: 50_000 }, 7_500)).toBe(7_500);
  });

  it("uses the booked grace period and cancellation notice boundary server-side", () => {
    const rule: AppointmentFeeRuleInput = { ...baseRule, ruleType: "cancellation", noticeHours: 24, gracePeriodMinutes: 60 };
    const scheduledAt = new Date("2026-10-20T18:00:00.000Z");
    const bookedAt = new Date("2026-10-10T18:00:00.000Z");
    expect(isCancellationFeeEligible({ rule, scheduledAt, bookedAt, now: new Date("2026-10-18T18:00:00.000Z") })).toBe(false);
    expect(isCancellationFeeEligible({ rule, scheduledAt, bookedAt, now: new Date("2026-10-19T18:00:01.000Z") })).toBe(true);
    expect(isCancellationFeeEligible({ rule, scheduledAt, bookedAt: new Date("2026-10-19T17:30:00.000Z"), now: new Date("2026-10-19T18:00:01.000Z") })).toBe(false);
  });

  it("creates an order-stable policy acknowledgement version", () => {
    const cancellation = { ...baseRule, ruleType: "cancellation" as const };
    const noShow = { ...baseRule, ruleType: "no_show" as const, thresholdValue: 30 };
    expect(getAppointmentFeePolicyVersion([noShow, cancellation])).toBe(getAppointmentFeePolicyVersion([cancellation, noShow]));
    expect(buildAppointmentFeePolicySnapshot([cancellation, noShow]).version).toBe(getAppointmentFeePolicyVersion([cancellation, noShow]));
  });
});
