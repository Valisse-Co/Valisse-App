export const STANDARD_TIP_PERCENTAGES = [5, 10, 15, 20, 25] as const;

export type IssueResolutionAction = "release_payout" | "refund_client";

export function getStandardTipOptions(serviceTotalInCents: number) {
  if (!Number.isInteger(serviceTotalInCents) || serviceTotalInCents < 0) {
    throw new Error("A non-negative service total is required to calculate tip options.");
  }
  return STANDARD_TIP_PERCENTAGES.map((percent) => ({
    percent,
    amountInCents: Math.round((serviceTotalInCents * percent) / 100),
  }));
}

export function isTipFinal(tipStatus: string | null | undefined): boolean {
  return tipStatus === "declined" || tipStatus === "paid" || tipStatus === "refunded";
}

export function getIssueResolutionAmounts(params: {
  serviceTotalInCents: number;
  action: IssueResolutionAction;
  refundAmountInCents?: number;
}) {
  const { serviceTotalInCents, action } = params;
  if (!Number.isInteger(serviceTotalInCents) || serviceTotalInCents <= 0) {
    throw new Error("A completed service total is required to resolve an issue.");
  }

  if (action === "release_payout") {
    return { refundAmountInCents: 0, payoutableServiceTotalInCents: serviceTotalInCents, isFullRefund: false };
  }

  const refundAmountInCents = params.refundAmountInCents;
  if (typeof refundAmountInCents !== "number" || !Number.isInteger(refundAmountInCents) || refundAmountInCents <= 0 || refundAmountInCents > serviceTotalInCents) {
    throw new Error("The refund amount must be between $0.01 and the completed service total.");
  }

  return {
    refundAmountInCents,
    payoutableServiceTotalInCents: serviceTotalInCents - refundAmountInCents,
    isFullRefund: refundAmountInCents === serviceTotalInCents,
  };
}

export function formatCents(amountInCents: number): string {
  return `$${(amountInCents / 100).toFixed(2)}`;
}
