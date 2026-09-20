import { describe, expect, it } from "vitest";
import {
  getIssueResolutionAmounts,
  getStandardTipOptions,
  isTipFinal,
} from "../shared/paymentResolution";

describe("appointment tips and issue resolution", () => {
  it("offers standard nail-service tip percentages rounded to cents", () => {
    expect(getStandardTipOptions(5_555)).toEqual([
      { percent: 5, amountInCents: 278 },
      { percent: 10, amountInCents: 556 },
      { percent: 15, amountInCents: 833 },
      { percent: 20, amountInCents: 1111 },
      { percent: 25, amountInCents: 1389 },
    ]);
  });

  it("allows only one final tip choice per booking", () => {
    expect(isTipFinal("none")).toBe(false);
    expect(isTipFinal("declined")).toBe(true);
    expect(isTipFinal("paid")).toBe(true);
    expect(isTipFinal("refunded")).toBe(true);
  });

  it("distinguishes payout release, partial refund, and full refund amounts", () => {
    expect(getIssueResolutionAmounts({ serviceTotalInCents: 10_000, action: "release_payout" })).toEqual({
      refundAmountInCents: 0,
      payoutableServiceTotalInCents: 10_000,
      isFullRefund: false,
    });
    expect(getIssueResolutionAmounts({ serviceTotalInCents: 10_000, action: "refund_client", refundAmountInCents: 2_500 })).toEqual({
      refundAmountInCents: 2_500,
      payoutableServiceTotalInCents: 7_500,
      isFullRefund: false,
    });
    expect(getIssueResolutionAmounts({ serviceTotalInCents: 10_000, action: "refund_client", refundAmountInCents: 10_000 })).toEqual({
      refundAmountInCents: 10_000,
      payoutableServiceTotalInCents: 0,
      isFullRefund: true,
    });
  });

  it("rejects zero, over-limit, or missing service-refund amounts", () => {
    expect(() => getIssueResolutionAmounts({ serviceTotalInCents: 10_000, action: "refund_client", refundAmountInCents: 0 })).toThrow("between $0.01");
    expect(() => getIssueResolutionAmounts({ serviceTotalInCents: 10_000, action: "refund_client", refundAmountInCents: 10_001 })).toThrow("between $0.01");
    expect(() => getIssueResolutionAmounts({ serviceTotalInCents: 10_000, action: "refund_client" })).toThrow("between $0.01");
  });
});
