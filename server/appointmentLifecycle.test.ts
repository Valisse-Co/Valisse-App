import { describe, expect, it } from "vitest";
import {
  appointmentCodeVisibleAt,
  appointmentStartAvailableAt,
  canStartVerifiedAppointment,
  calculatePlatformPayout,
  deriveAppointmentCode,
  isValidAppointmentCodeInput,
  payoutEligibleAt,
} from "../shared/appointmentLifecycle";

describe("verified appointment lifecycle", () => {
  it("creates a deterministic six-digit code and exposes it exactly 24 hours before the appointment", () => {
    const scheduledAt = new Date("2026-09-03T18:00:00.000Z");
    const code = deriveAppointmentCode(72, scheduledAt, "test-secret");
    expect(code).toMatch(/^\d{6}$/);
    expect(deriveAppointmentCode(72, scheduledAt, "test-secret")).toBe(code);
    expect(appointmentCodeVisibleAt(scheduledAt).toISOString()).toBe("2026-09-02T18:00:00.000Z");
  });

  it("holds payout for exactly 24 hours after completion and retains a five-percent service fee", () => {
    const completedAt = new Date("2026-09-03T18:00:00.000Z");
    expect(payoutEligibleAt(completedAt).toISOString()).toBe("2026-09-04T18:00:00.000Z");
    expect(calculatePlatformPayout(10_000)).toEqual({ platformFeeInCents: 500, techPayoutInCents: 9_500 });
  });

  it("accepts only a six-digit client code", () => {
    expect(isValidAppointmentCodeInput("123456")).toBe(true);
    expect(isValidAppointmentCodeInput("12345")).toBe(false);
    expect(isValidAppointmentCodeInput("12AB56")).toBe(false);
  });

  it("allows code-verified start only within 30 minutes of the scheduled service", () => {
    const scheduledAt = new Date("2026-09-03T18:00:00.000Z");
    expect(appointmentStartAvailableAt(scheduledAt).toISOString()).toBe("2026-09-03T17:30:00.000Z");
    expect(canStartVerifiedAppointment(scheduledAt, new Date("2026-09-03T17:29:59.000Z"))).toBe(false);
    expect(canStartVerifiedAppointment(scheduledAt, new Date("2026-09-03T17:30:00.000Z"))).toBe(true);
  });
});
