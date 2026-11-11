import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ account: vi.fn(), balance: vi.fn(), transfer: vi.fn(), payout: vi.fn(), update: vi.fn() }));
vi.mock("./_core/env", () => ({ ENV: { stripeSecretKey: "sk_test_fixture", stripeTestSecretKey: "sk_test_fixture" } }));
vi.mock("stripe", () => ({ default: vi.fn(() => ({ accounts: { retrieveCurrent: mocks.account, update: mocks.update }, balance: { retrieve: mocks.balance }, transfers: { create: mocks.transfer }, payouts: { create: mocks.payout } })) }));
import { getStripePlatformFundsStatus } from "./stripe";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.account.mockResolvedValue({ id: "acct_private", email: "private@example.test", external_accounts: { data: [{ account_number: "private-bank-detail" }] }, settings: { payouts: { schedule: { interval: "monthly" } } } });
  mocks.balance.mockResolvedValue({ available: [{ currency: "usd", amount: 0 }, { currency: "eur", amount: 200 }], pending: [{ currency: "usd", amount: 164 }] });
});
describe("read-only platform treasury diagnostics", () => {
  it("shows the platform balance and payout schedule, not bank details or technician bank delivery", async () => {
    const status = await getStripePlatformFundsStatus("test");
    expect(status).toMatchObject({ status: "available", mode: "test", availableUsdInCents: 0, pendingUsdInCents: 164, payoutSchedule: "monthly", automaticBankPayouts: true });
    expect(mocks.account).toHaveBeenCalledWith({}, { timeout: 8000, maxNetworkRetries: 0 });
    expect(mocks.balance).toHaveBeenCalledWith({}, { timeout: 8000, maxNetworkRetries: 0 });
    const json = JSON.stringify(status);
    expect(json).not.toContain("acct_private");
    expect(json).not.toContain("private@example.test");
    expect(json).not.toContain("private-bank-detail");
    expect(status).not.toHaveProperty("bankPayoutPaid");
    expect(mocks.transfer).not.toHaveBeenCalled();
    expect(mocks.payout).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not flag manual platform payouts as automatic", async () => {
    mocks.account.mockResolvedValue({ settings: { payouts: { schedule: { interval: "manual" } } } });
    expect(await getStripePlatformFundsStatus("test")).toMatchObject({ payoutSchedule: "manual", automaticBankPayouts: false });
  });
  it("does not infer a safe payout schedule when Stripe supplies no schedule", async () => {
    mocks.account.mockResolvedValue({});
    expect(await getStripePlatformFundsStatus("test")).toMatchObject({ payoutSchedule: "unknown", automaticBankPayouts: null });
  });
  it("propagates a failed balance read instead of manufacturing a zero balance", async () => {
    mocks.balance.mockRejectedValue(new Error("Stripe unavailable"));
    await expect(getStripePlatformFundsStatus("test")).rejects.toThrow("Stripe unavailable");
  });
});
