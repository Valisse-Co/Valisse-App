import { describe, expect, it } from "vitest";
import {
  createRecipientAccountRequest,
  createRecipientOnboardingLinkRequest,
  isRecipientPayoutReady,
  STRIPE_ACCOUNTS_V2_API_VERSION,
} from "../shared/stripeConnectV2";

describe("Stripe Accounts v2 recipient onboarding", () => {
  it("creates an Express-dashboard recipient configured for separate transfers", () => {
    expect(createRecipientAccountRequest({ techId: 42, email: "tech@example.test", displayName: "Nails by Jane" })).toEqual({
      contact_email: "tech@example.test",
      display_name: "Nails by Jane",
      dashboard: "express",
      identity: { country: "US" },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      defaults: { currency: "usd", responsibilities: { fees_collector: "application", losses_collector: "application" } },
      metadata: { valisse_tech_id: "42" },
      include: ["configuration.recipient", "requirements"],
    });
  });

  it("creates a hosted recipient onboarding link that collects all known requirements", () => {
    expect(createRecipientOnboardingLinkRequest({ accountId: "acct_test_123", refreshUrl: "https://valisse.test/refresh", returnUrl: "https://valisse.test/return" })).toEqual({
      account: "acct_test_123",
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          collection_options: { fields: "eventually_due", future_requirements: "include" },
          refresh_url: "https://valisse.test/refresh",
          return_url: "https://valisse.test/return",
        },
      },
    });
  });

  it("marks the account ready only after Stripe activates its transfer capability", () => {
    expect(isRecipientPayoutReady("active")).toBe(true);
    expect(isRecipientPayoutReady("pending")).toBe(false);
    expect(isRecipientPayoutReady("restricted")).toBe(false);
    expect(isRecipientPayoutReady(undefined)).toBe(false);
  });

  it("pins Accounts v2 calls to Stripe's documented preview version", () => {
    expect(STRIPE_ACCOUNTS_V2_API_VERSION).toBe("2026-08-26.preview");
  });
});
