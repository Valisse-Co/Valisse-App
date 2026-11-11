export type PayoutHistoryStage =
  | "on_hold"
  | "active_issue_window"
  | "awaiting_transfer"
  | "transferred"
  | "awaiting_payment"
  | "needs_attention"
  | "needs_verification";

export type PayoutHistoryPresentation = {
  stage: PayoutHistoryStage;
  label: string;
  detail: string;
  clientPaymentDetail: string;
};

/** Display only: timestamps and local transfer evidence never confirm bank receipt
 * or schedule a retry. The caller supplies the clock so expiry is deterministic. */
export function getPayoutHistoryStage(params: {
  payoutStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  payoutEligibleAt: Date | string | null | undefined;
  hasRecordedTransfer: boolean;
  issueReportedAt?: Date | string | null;
  issueResolvedAt?: Date | string | null;
  now: Date | number;
}): PayoutHistoryPresentation {
  const clientPaymentDetail = params.paymentStatus === "paid"
    ? "Client payment captured by Valisse."
    : params.paymentStatus === "refunded"
      ? "Client payment refunded."
      : params.paymentStatus === "failed"
        ? "Client payment failed; capture is not confirmed."
        : params.paymentStatus === "unpaid" || params.paymentStatus === "payment_due"
          ? "Awaiting client payment capture by Valisse."
          : "Client payment capture needs verification.";
  const present = (stage: PayoutHistoryStage, label: string, detail: string): PayoutHistoryPresentation => ({
    stage, label, detail, clientPaymentDetail,
  });

  // A reported issue remains unresolved until a resolution timestamp is recorded.
  // Holds take precedence even over inconsistent released/transfer evidence.
  if (params.payoutStatus === "on_hold" || (params.issueReportedAt != null && !params.issueResolvedAt)) {
    return present("on_hold", "On hold", "A client issue is under review. The end of the issue window does not clear this hold.");
  }

  if (params.payoutStatus === "released") {
    return params.hasRecordedTransfer === true && params.paymentStatus === "paid"
      ? present("transferred", "Transferred to Stripe", "A transfer to your connected Stripe account is recorded. Bank payout is separate; bank receipt is not confirmed here.")
      : present("needs_verification", "Needs verification", "This booking is marked released, but its payment or transfer evidence is inconsistent. Contact Valisse for verification.");
  }
  if (params.hasRecordedTransfer === true) {
    return present("needs_verification", "Needs verification", "Transfer evidence does not match this booking’s payout status. Contact Valisse for verification.");
  }
  if (params.payoutStatus === "failed") {
    return present("needs_attention", "Payout needs attention", "The Stripe transfer was not recorded as successful. Contact Valisse for assistance.");
  }
  if (params.payoutStatus !== "pending_dispute_window" && params.payoutStatus !== "not_ready") {
    return present("needs_attention", "Payout needs attention", "The payout status is unknown. Contact Valisse for verification.");
  }
  if (params.paymentStatus === "unpaid" || params.paymentStatus === "payment_due") {
    return present("awaiting_payment", "Awaiting client payment", "A Stripe transfer cannot be confirmed before the client payment is captured.");
  }
  if (params.paymentStatus !== "paid") {
    return present("needs_attention", "Payout needs attention", "Client payment capture is not confirmed. Contact Valisse for verification.");
  }
  if (params.payoutStatus === "not_ready") {
    return present("needs_attention", "Payout needs attention", "Client payment is captured, but payout eligibility is not recorded. Contact Valisse for assistance.");
  }

  const eligibleAt = params.payoutEligibleAt instanceof Date
    ? params.payoutEligibleAt.getTime()
    : typeof params.payoutEligibleAt === "string" && params.payoutEligibleAt.trim()
      ? new Date(params.payoutEligibleAt).getTime()
      : NaN;
  const now = params.now instanceof Date ? params.now.getTime() : params.now;
  if (!Number.isFinite(eligibleAt) || !Number.isFinite(now)) {
    return present("needs_attention", "Payout needs attention", "The issue-window end time is missing or invalid. Contact Valisse for verification.");
  }
  return now < eligibleAt
    ? present("active_issue_window", "24-hour issue window", "The 24-hour client issue window is still active. No Stripe transfer is recorded yet.")
    : present("awaiting_transfer", "Awaiting Stripe transfer", "The 24-hour issue window has ended. No Stripe transfer is recorded; contact Valisse if you need help with this payout.");
}

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
  // Match appointmentLifecycle's existing 500-basis-point policy and rounding.
  // Do not import that Node crypto module into the browser presentation bundle.
  const platformFeeInCents = Math.round((netServiceInCents * 500) / 10_000);
  const techPayoutInCents = netServiceInCents - platformFeeInCents;
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
