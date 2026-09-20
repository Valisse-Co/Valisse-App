import { calculatePlatformPayout } from "./appointmentLifecycle";

export type PayoutHistoryAmounts = {
  serviceTotalInCents: number;
  refundAmountInCents: number;
  netServiceInCents: number;
  platformFeeInCents: number;
  tipInCents: number;
  payoutTotalInCents: number;
};

/**
 * Calculates exactly what the technician is due from a booking. Service refunds
 * reduce both the released service base and the five-percent platform fee; a
 * refunded tip never appears in the technician's payout.
 */
export function calculatePayoutHistoryAmounts(params: {
  serviceTotalInCents: number;
  refundAmountInCents?: number | null;
  tipAmountInCents?: number | null;
  tipStatus?: string | null;
}): PayoutHistoryAmounts {
  const serviceTotalInCents = Math.max(0, Math.round(params.serviceTotalInCents || 0));
  const refundAmountInCents = Math.min(serviceTotalInCents, Math.max(0, Math.round(params.refundAmountInCents || 0)));
  const netServiceInCents = serviceTotalInCents - refundAmountInCents;
  const { platformFeeInCents, techPayoutInCents } = calculatePlatformPayout(netServiceInCents);
  const tipInCents = params.tipStatus === "paid" ? Math.max(0, Math.round(params.tipAmountInCents || 0)) : 0;
  return {
    serviceTotalInCents,
    refundAmountInCents,
    netServiceInCents,
    platformFeeInCents,
    tipInCents,
    payoutTotalInCents: techPayoutInCents + tipInCents,
  };
}
