import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";

describe("Stripe live-mode configuration", () => {
  it("uses matching live API keys and both webhook signing secrets", () => {
    const publishableKey = process.env.VITE_VALISSE_STRIPE_LIVE_PUBLISHABLE_KEY ?? "";

    expect(ENV.stripeSecretKey, "VALISSE_STRIPE_LIVE_SECRET_KEY must be a live Stripe secret key").toMatch(/^sk_live_/);
    expect(publishableKey, "VITE_VALISSE_STRIPE_LIVE_PUBLISHABLE_KEY must be a live Stripe publishable key").toMatch(/^pk_live_/);
    expect(ENV.stripeWebhookSecret, "VALISSE_STRIPE_LIVE_WEBHOOK_SECRET must be configured").toMatch(/^whsec_/);
    expect(ENV.stripeConnectWebhookSecret, "STRIPE_CONNECT_WEBHOOK_SECRET must be configured").toMatch(/^whsec_/);
  });

  it.runIf(process.env.RUN_STRIPE_LIVE_CONFIG_TEST === "true")("validates the configured live Stripe account without creating money movement", async () => {
    const stripe = new Stripe(ENV.stripeSecretKey);
    const account = await stripe.accounts.retrieve();
    expect(account.object).toBe("account");
    expect(account.id).toMatch(/^acct_/);
  });
});
