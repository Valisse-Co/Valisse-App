import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Booking } from "../drizzle/schema";
import { formatDollarsInputFromCents, formatUsdCents, formatUsdDollars } from "../shared/money";
import { calculatePayoutHistoryAmounts, getPayoutHistoryStage } from "../shared/payoutHistory";
import { calculatePlatformPayout } from "../shared/appointmentLifecycle";

// Read-only fake adapter: these tests cannot connect to MySQL or Stripe even if
// the environment contains live credentials. Surplus fields test the projection.
const mock = vi.hoisted(() => ({
  bookings: [] as any[],
  serviceLines: [] as any[],
  queryError: null as Error | null,
}));
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    select: () => {
      let table = "";
      const chain: any = {
        from: (value: any) => { table = getTableName(value); return chain; },
        leftJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          if (mock.queryError) return Promise.reject(mock.queryError).then(resolve, reject);
          const rows = table === "bookings" ? mock.bookings : table === "booking_service_lines" ? mock.serviceLines : [];
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return chain;
    },
  }),
}));
import { getTechPayoutHistory } from "./db";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mock-only-no-network");
  mock.bookings = [];
  mock.serviceLines = [];
  mock.queryError = null;
});
afterEach(() => vi.unstubAllEnvs());

const windowEnds = new Date("2026-10-14T12:00:00Z");
const pending = {
  payoutStatus: "pending_dispute_window",
  paymentStatus: "paid",
  payoutEligibleAt: windowEnds,
  hasRecordedTransfer: false,
  now: new Date("2026-11-10T12:00:00Z"),
};

function bookingWithTransfer(stripeTransferId: unknown) {
  return {
    id: 1_920_002,
    clientId: 10,
    techId: 20,
    paymentStatus: "paid",
    payoutStatus: "released",
    payoutEligibleAt: windowEnds,
    completedAt: new Date("2026-10-13T12:00:00Z"),
    issueReportedAt: null,
    issueResolvedAt: null,
    refundAmountInCents: 0,
    tipAmountInCents: 0,
    tipStatus: "none",
    stripeTransferId,
    stripePaymentIntentId: "pi_PRIVATEPAYMENT",
    stripeRefundId: "re_PRIVATEREFUND",
    feePolicySnapshot: { nested: { stripeTransferId: "tr_PRIVATENESTED", graceMinutes: 15 } },
  } as unknown as Booking;
}

function source(path: string) {
  return readFileSync(resolve(__dirname, "..", path), "utf8");
}

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

describe("technician payout history amounts", () => {
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

  it("keeps a $2.00 service at $1.90 owed under the existing five-percent policy", () => {
    const amounts = calculatePayoutHistoryAmounts({ serviceTotalInCents: 200 });
    expect(amounts.platformFeeInCents).toBe(10);
    expect(amounts.payoutTotalInCents).toBe(190);
    expect(formatUsdCents(amounts.payoutTotalInCents)).toBe("$1.90");
  });

  it("matches the existing service payout policy and rounding without a browser crypto dependency", () => {
    for (const serviceTotalInCents of [0, 1, 9, 10, 11, 199, 200, 201, 2500, 9999, 10000]) {
      const history = calculatePayoutHistoryAmounts({ serviceTotalInCents });
      const policy = calculatePlatformPayout(serviceTotalInCents);
      expect(history.platformFeeInCents).toBe(policy.platformFeeInCents);
      expect(history.payoutTotalInCents).toBe(policy.techPayoutInCents);
    }
    expect(source("shared/payoutHistory.ts")).not.toMatch(/import.*appointmentLifecycle/);
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

describe("evidence-aware technician payout stage", () => {
  it("shows the active 24-hour issue window strictly before eligibility", () => {
    const before = getPayoutHistoryStage({ ...pending, now: windowEnds.getTime() - 1 });
    expect(before.stage).toBe("active_issue_window");
    expect(before.label).toBe("24-hour issue window");
    expect(before.clientPaymentDetail).toBe("Client payment captured by Valisse.");
  });

  it.each([0, 1, 30 * 24 * 60 * 60 * 1000])("awaits a transfer at and after eligibility (offset %s ms)", (offset) => {
    const stage = getPayoutHistoryStage({ ...pending, now: windowEnds.getTime() + offset });
    expect(stage.stage).toBe("awaiting_transfer");
    expect(stage.label).toBe("Awaiting Stripe transfer");
    expect(stage.detail).toContain("window has ended");
    expect(stage.detail).toContain("No Stripe transfer is recorded");
    expect(stage.detail).not.toMatch(/automati|retry|paid out/i);
  });

  it("accepts a valid serialized eligibility timestamp", () => {
    expect(getPayoutHistoryStage({ ...pending, payoutEligibleAt: windowEnds.toISOString() }).stage).toBe("awaiting_transfer");
  });

  it.each([null, undefined, "", " ", "invalid-date", new Date(NaN)])("requires attention for missing or invalid eligibility (%s)", (payoutEligibleAt) => {
    expect(getPayoutHistoryStage({ ...pending, payoutEligibleAt }).stage).toBe("needs_attention");
  });

  it("requires attention rather than inventing a window with an invalid clock", () => {
    expect(getPayoutHistoryStage({ ...pending, now: new Date(NaN) }).stage).toBe("needs_attention");
  });

  it.each([null, undefined, "unknown", "future_status"])("does not default unknown payout status %s to an active window", (payoutStatus) => {
    expect(getPayoutHistoryStage({ ...pending, payoutStatus }).stage).toBe("needs_attention");
  });

  it.each(["pending_dispute_window", "failed", "released"])("keeps an unresolved client issue ahead of %s and transfer evidence", (payoutStatus) => {
    const status = getPayoutHistoryStage({
      ...pending, payoutStatus, hasRecordedTransfer: true,
      issueReportedAt: new Date("2026-10-13T13:00:00Z"), issueResolvedAt: null,
    });
    expect(status.stage).toBe("on_hold");
  });

  it("keeps an explicit payout hold after expiry even when an issue resolution or transfer exists", () => {
    expect(getPayoutHistoryStage({
      ...pending, payoutStatus: "on_hold", hasRecordedTransfer: true,
      issueReportedAt: new Date("2026-10-13T13:00:00Z"), issueResolvedAt: windowEnds,
    }).stage).toBe("on_hold");
  });

  it("does not preserve an unresolved-issue hold once resolution is recorded and state is pending", () => {
    expect(getPayoutHistoryStage({
      ...pending, issueReportedAt: new Date("2026-10-13T13:00:00Z"), issueResolvedAt: windowEnds,
    }).stage).toBe("awaiting_transfer");
  });

  it("requires transfer evidence for released status", () => {
    expect(getPayoutHistoryStage({ ...pending, payoutStatus: "released" }).stage).toBe("needs_verification");
  });

  it("requires consistent payment capture as well as released transfer evidence", () => {
    expect(getPayoutHistoryStage({ ...pending, payoutStatus: "released", paymentStatus: "unpaid", hasRecordedTransfer: true }).stage).toBe("needs_verification");
    expect(getPayoutHistoryStage({ ...pending, hasRecordedTransfer: true }).stage).toBe("needs_verification");
  });

  it("labels a consistent released transfer without inferring bank payment", () => {
    const status = getPayoutHistoryStage({ ...pending, payoutStatus: "released", hasRecordedTransfer: true });
    expect(status.stage).toBe("transferred");
    expect(status.label).toBe("Transferred to Stripe");
    expect(status.detail).toContain("Bank payout is separate");
    expect(status.detail).toContain("bank receipt is not confirmed");
    expect(status.label).not.toMatch(/paid out/i);
  });

  it("does not infer transfer or bank receipt from the platform bank sweep, zero balance, or account readiness", () => {
    const platformBankSweep = {
      ...pending,
      platformBankPayoutAt: new Date("2026-10-30T12:00:00Z"),
      platformBankPayoutAmountInCents: 164,
      stripeFeeInCents: 36,
      platformBalanceInCents: 0,
      techConnectedAccountReady: true,
    };
    expect(getPayoutHistoryStage(platformBankSweep).stage).toBe("awaiting_transfer");
    const freshWindowWithoutFunds = { ...platformBankSweep, now: windowEnds.getTime() - 1 };
    expect(getPayoutHistoryStage(freshWindowWithoutFunds).stage).toBe("active_issue_window");
  });

  it.each(["unpaid", "payment_due"])("distinguishes client payment %s from capture", (paymentStatus) => {
    const status = getPayoutHistoryStage({ ...pending, paymentStatus });
    expect(status.stage).toBe("awaiting_payment");
    expect(status.clientPaymentDetail).toBe("Awaiting client payment capture by Valisse.");
  });

  it.each(["failed", "refunded", "unknown", null])("does not claim captured payment for %s", (paymentStatus) => {
    const status = getPayoutHistoryStage({ ...pending, paymentStatus });
    expect(status.stage).toBe("needs_attention");
    expect(status.clientPaymentDetail).not.toBe("Client payment captured by Valisse.");
  });

  it("shows failed transfers as needing attention without promising retry", () => {
    const status = getPayoutHistoryStage({ ...pending, payoutStatus: "failed" });
    expect(status.stage).toBe("needs_attention");
    expect(status.detail).not.toMatch(/retry|automati/i);
  });
});

describe("payout-history database projection (mocked only)", () => {
  it.each([
    { transferId: "tr_VALID123", hasRecordedTransfer: true },
    { transferId: null, hasRecordedTransfer: false },
    { transferId: undefined, hasRecordedTransfer: false },
    { transferId: "", hasRecordedTransfer: false },
    { transferId: " ", hasRecordedTransfer: false },
    { transferId: "tr_", hasRecordedTransfer: false },
    { transferId: "pi_NOTATRANSFER", hasRecordedTransfer: false },
    { transferId: "po_PLATFORMBANK", hasRecordedTransfer: false },
    { transferId: "tr_bad value", hasRecordedTransfer: false },
    { transferId: " tr_VALID123 ", hasRecordedTransfer: false },
    { transferId: "tr_VALID123\n", hasRecordedTransfer: false },
  ])("derives safe evidence before stripping transfer ID $transferId", async ({ transferId, hasRecordedTransfer }) => {
    const rawBooking = bookingWithTransfer(transferId);
    mock.bookings = [{ booking: rawBooking, clientName: "Client", stripeAccountId: "acct_PRIVATEACCOUNT" }];
    mock.serviceLines = [{ priceInCents: 200 }];
    const [record] = await getTechPayoutHistory(20);
    expect(record.hasRecordedTransfer).toBe(hasRecordedTransfer);
    expect(record.amounts.payoutTotalInCents).toBe(190);
    expect(Object.keys(record).sort()).toEqual(["amounts", "booking", "clientName", "hasRecordedTransfer"].sort());
    expect(record.booking).not.toHaveProperty("stripeTransferId");
    expect(record.booking).not.toHaveProperty("stripePaymentIntentId");
    expect(JSON.stringify(record)).not.toMatch(/tr_VALID123|pi_PRIVATEPAYMENT|re_PRIVATEREFUND|tr_PRIVATENESTED|acct_PRIVATEACCOUNT|stripe/i);
    expect(record.booking.feePolicySnapshot).toEqual({ nested: { graceMinutes: 15 } });
    expect(rawBooking.stripeTransferId).toBe(transferId);
    expect(getPayoutHistoryStage({ ...record.booking, hasRecordedTransfer: record.hasRecordedTransfer, now: pending.now }).stage)
      .toBe(hasRecordedTransfer ? "transferred" : "needs_verification");
  });

  it("shows booking 1920002 as $1.90 awaiting transfer after October 14, not bank-paid", async () => {
    const booking = { ...bookingWithTransfer(null), payoutStatus: "pending_dispute_window" };
    mock.bookings = [{ booking, clientName: "Client" }];
    mock.serviceLines = [{ priceInCents: 200 }];
    const [record] = await getTechPayoutHistory(20);
    expect(record.booking.id).toBe(1_920_002);
    expect(record.amounts.payoutTotalInCents).toBe(190);
    expect(record.hasRecordedTransfer).toBe(false);
    expect(getPayoutHistoryStage({ ...record.booking, hasRecordedTransfer: record.hasRecordedTransfer, now: pending.now }))
      .toMatchObject({ stage: "awaiting_transfer", clientPaymentDetail: "Client payment captured by Valisse." });
  });

  it("propagates query failure instead of returning an empty history", async () => {
    mock.queryError = new Error("mock history query failed");
    await expect(getTechPayoutHistory(20)).rejects.toThrow("mock history query failed");
  });
});

describe("technician payout history presentation wiring", () => {
  it("uses the same evidence-aware stage for summary totals and individual records", () => {
    const page = source("client/src/pages/SettingsPayouts.tsx");
    expect(page).toContain("presentation: getPayoutHistoryStage({");
    expect(page).toContain("hasRecordedTransfer: record.hasRecordedTransfer");
    expect(page).toContain('record.presentation.stage === "transferred"');
    expect(page).toContain("const status = record.presentation");
    expect(page).toContain("status.clientPaymentDetail");
    expect(page).not.toMatch(/Paid out|Valisse will retry/);
    expect(page).toContain("Bank receipt is not confirmed here");
  });

  it("refreshes enabled history and the display clock every 30 seconds, with visible timestamps", () => {
    const page = source("client/src/pages/SettingsPayouts.tsx");
    expect(page).toContain("refetchInterval: isTech ? 30_000 : false");
    expect(page).toContain("window.setInterval(() => setNow(Date.now()), 30_000)");
    expect(page).toContain("payoutHistory.dataUpdatedAt");
    expect(page).toContain('status.stage === "active_issue_window" ? "ends" : "ended"');
  });

  it("shows errors without treating failed loads as empty history or confirmed zero earnings", () => {
    const page = source("client/src/pages/SettingsPayouts.tsx");
    expect(page).toContain('payoutHistory.isError && <Card role="alert"');
    expect(page).toContain("history.length === 0 ? !payoutHistory.isError");
    expect(page).toContain("payoutHistory.data !== undefined && <div");
    expect(page).toContain("Showing the last loaded history");
  });
});
