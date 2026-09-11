import { createHash, createHmac } from "crypto";

export const APPOINTMENT_CODE_VISIBLE_HOURS = 24;
export const PAYOUT_DISPUTE_WINDOW_HOURS = 24;
export const VALISSE_PLATFORM_FEE_BASIS_POINTS = 500;

export function deriveAppointmentCode(bookingId: number, scheduledAt: Date, secret: string): string {
  const digest = createHmac("sha256", secret)
    .update(`${bookingId}:${scheduledAt.toISOString()}:valisse-appointment-code`)
    .digest("hex");
  return (100000 + (parseInt(digest.slice(0, 8), 16) % 900000)).toString();
}

export function hashAppointmentCode(bookingId: number, code: string, secret: string): string {
  return createHash("sha256").update(`${bookingId}:${code}:${secret}`).digest("hex");
}

export function appointmentCodeVisibleAt(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() - APPOINTMENT_CODE_VISIBLE_HOURS * 60 * 60 * 1000);
}

export function payoutEligibleAt(completedAt: Date): Date {
  return new Date(completedAt.getTime() + PAYOUT_DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);
}

export function calculatePlatformPayout(totalInCents: number): {
  platformFeeInCents: number;
  techPayoutInCents: number;
} {
  const platformFeeInCents = Math.round((totalInCents * VALISSE_PLATFORM_FEE_BASIS_POINTS) / 10_000);
  return { platformFeeInCents, techPayoutInCents: totalInCents - platformFeeInCents };
}

export function isValidAppointmentCodeInput(value: string): boolean {
  return /^\d{6}$/.test(value);
}
