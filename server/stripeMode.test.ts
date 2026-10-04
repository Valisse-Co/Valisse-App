import { describe, expect, it } from "vitest";
import {
  getStripeEnvironmentMode,
  isStripeObjectInConfiguredEnvironment,
  shouldProcessStripeEvent,
  stripeModeLabel,
} from "../shared/stripeMode";

describe("Stripe environment safeguards", () => {
  it("recognizes test and live secret key modes without exposing key values", () => {
    expect(getStripeEnvironmentMode("sk_test_example")).toBe("test");
    expect(getStripeEnvironmentMode("sk_live_example")).toBe("live");
    expect(getStripeEnvironmentMode("")).toBe("unconfigured");
    expect(getStripeEnvironmentMode("not-a-stripe-key")).toBe("unknown");
  });

  it("accepts webhook events only from the configured Stripe environment", () => {
    expect(shouldProcessStripeEvent("test", false)).toBe(true);
    expect(shouldProcessStripeEvent("test", true)).toBe(false);
    expect(shouldProcessStripeEvent("live", true)).toBe(true);
    expect(shouldProcessStripeEvent("live", false)).toBe(false);
    expect(shouldProcessStripeEvent("unconfigured", false)).toBe(false);
  });

  it("provides a safe status label for the payout interface", () => {
    expect(stripeModeLabel("test")).toBe("Test mode");
    expect(stripeModeLabel("live")).toBe("Live mode");
  });

  it("never reuses saved customers or recipient accounts across modes", () => {
    expect(isStripeObjectInConfiguredEnvironment("test", "test")).toBe(true);
    expect(isStripeObjectInConfiguredEnvironment("test", "live")).toBe(false);
    expect(isStripeObjectInConfiguredEnvironment("live", "test")).toBe(false);
    expect(isStripeObjectInConfiguredEnvironment(null, "live")).toBe(false);
  });
});
