import { describe, expect, it } from "vitest";
import { formatDollarsInputFromCents, formatUsdCents, formatUsdDollars } from "../shared/money";
import { calculatePayoutHistoryAmounts } from "../shared/payoutHistory";

describe("currency formatting", () => {
  it("always renders dollars with two fraction digits", () => {
    expect(formatUsdCents(550)).toBe("$5.50");
    expect(formatUsdCents(5)).toBe("$0.05");
    expect(formatUsdDollars(5.5)).toBe("$5.50");
    expect(formatDollarsInputFromCents(550)).toBe("5.50");
  });

  it("keeps invalid display amounts safe and consistently formatted", () => {
    expect(formatUsdCents(undefined)).toBe("$0.00");
    expect(formatUsdDollars(null)).toBe("$0.00");
  });
});

describe("technician payout history", () => {
  it("shows the service amount after the five-percent platform fee plus the full tip", () => {
    expect(calculatePayoutHistoryAmounts({
      serviceTotalInCents: 10_000,
      refundAmountInCents: 0,
      tipAmountInCents: 1_500,
      tipStatus: "paid",
    })).toEqual({
      serviceTotalInCents: 10_000,
      refundAmountInCents: 0,
      netServiceInCents: 10_000,
      platformFeeInCents: 500,
      tipInCents: 1_500,
      payoutTotalInCents: 11_000,
    });
  });

  it("reduces service payout for a resolved client refund and omits refunded tips", () => {
    expect(calculatePayoutHistoryAmounts({
      serviceTotalInCents: 10_000,
      refundAmountInCents: 2_500,
      tipAmountInCents: 1_500,
      tipStatus: "refunded",
    })).toEqual({
      serviceTotalInCents: 10_000,
      refundAmountInCents: 2_500,
      netServiceInCents: 7_500,
      platformFeeInCents: 375,
      tipInCents: 0,
      payoutTotalInCents: 7_125,
    });
  });
});
