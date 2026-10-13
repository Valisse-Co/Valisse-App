export const QA_APPOINTMENT_LABEL = "QA test appointment";
export const QA_APPOINTMENT_DURATION_MINUTES = 30;
export const QA_RUN_TTL_HOURS = 24;

/**
 * The lab is restricted to preview/development infrastructure. It deliberately
 * uses the separately configured Stripe test credential even if normal preview
 * booking traffic is validating Valisse's Live Stripe account.
 */
export function isQaAppointmentLabEnabled(params: {
  isProduction: boolean;
  stripeTestSecretKey: string;
}): boolean {
  return !params.isProduction && params.stripeTestSecretKey.startsWith("sk_test_");
}

/**
 * Choose a start time inside the real 30-minute check-in window while leaving
 * enough room to complete the full manual flow without the booking becoming past.
 */
export function createQaScheduledAt(now = new Date()): Date {
  const scheduledAt = new Date(now.getTime() + 25 * 60 * 1000);
  scheduledAt.setSeconds(0, 0);
  return scheduledAt;
}

export function createQaRunExpiry(now = new Date()): Date {
  return new Date(now.getTime() + QA_RUN_TTL_HOURS * 60 * 60 * 1000);
}

export function isQaRunExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
