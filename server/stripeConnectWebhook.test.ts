import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { handleStripeConnectWebhook } from "./stripeWebhook";
import { getStripeEnvironmentMode } from "../shared/stripeMode";

describe("Stripe Connect webhook configuration", () => {
  it("accepts a correctly signed connected-account webhook using the configured signing secret", async () => {
    expect(ENV.stripeConnectWebhookSecret, "STRIPE_CONNECT_WEBHOOK_SECRET must be configured").toMatch(/^whsec_/);

    const mode = getStripeEnvironmentMode(ENV.stripeSecretKey);
    expect(["test", "live"]).toContain(mode);
    const payload = JSON.stringify({
      id: "evt_valisse_connect_webhook_signature_check",
      object: "event",
      type: "ping",
      livemode: mode === "live",
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: ENV.stripeConnectWebhookSecret,
    });
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    await handleStripeConnectWebhook(
      { body: Buffer.from(payload), headers: { "stripe-signature": signature } } as any,
      { json, status } as any,
    );

    expect(status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ received: true });
  });
});
