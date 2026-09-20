import { describe, expect, it } from "vitest";
import {
  QA_RUN_TTL_HOURS,
  createQaRunExpiry,
  createQaScheduledAt,
  isQaAppointmentLabEnabled,
  isQaRunExpired,
} from "../shared/qaAppointment";
import { appointmentStartAvailableAt } from "../shared/appointmentLifecycle";

describe("QA Appointment Lab safeguards", () => {
  it("is available only outside production with a Stripe test-mode secret", () => {
    expect(isQaAppointmentLabEnabled({ isProduction: false, stripeSecretKey: "sk_test_example" })).toBe(true);
    expect(isQaAppointmentLabEnabled({ isProduction: true, stripeSecretKey: "sk_test_example" })).toBe(false);
    expect(isQaAppointmentLabEnabled({ isProduction: false, stripeSecretKey: "sk_live_example" })).toBe(false);
    expect(isQaAppointmentLabEnabled({ isProduction: false, stripeSecretKey: "" })).toBe(false);
  });

  it("creates an appointment already eligible for real code verification", () => {
    const now = new Date("2026-09-20T10:00:22.000Z");
    const scheduledAt = createQaScheduledAt(now);
    expect(scheduledAt.toISOString()).toBe("2026-09-20T10:25:00.000Z");
    expect(appointmentStartAvailableAt(scheduledAt).getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it("expires an isolated run after the defined cleanup window", () => {
    const now = new Date("2026-09-20T10:00:00.000Z");
    const expiry = createQaRunExpiry(now);
    expect(expiry.getTime() - now.getTime()).toBe(QA_RUN_TTL_HOURS * 60 * 60 * 1000);
    expect(isQaRunExpired(expiry, new Date("2026-09-21T09:59:59.999Z"))).toBe(false);
    expect(isQaRunExpired(expiry, new Date("2026-09-21T10:00:00.000Z"))).toBe(true);
  });
});
