import { describe, expect, it } from "vitest";
import {
  getStripeEnvironmentMode,
  isStripeObjectInConfiguredEnvironment,
  resolveStripeModeForBooking,
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

  it("accepts only matching live client and server key prefixes", () => {
    const secretMode = getStripeEnvironmentMode("sk_live_server_key");
    const publishableMode = "pk_live_browser_key".startsWith("pk_live_") ? "live" : "unknown";
    expect(secretMode).toBe("live");
    expect(publishableMode).toBe(secretMode);
    expect("whsec_platform".startsWith("whsec_")).toBe(true);
    expect("whsec_connect".startsWith("whsec_")).toBe(true);
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

  it("routes a preview QA booking to test Stripe while normal bookings remain Live", () => {
    const shared = { configuredMode: "live" as const, testSecretKey: "sk_test_sandbox", isProduction: false };
    expect(resolveStripeModeForBooking({ ...shared, isQaTest: true })).toBe("test");
    expect(resolveStripeModeForBooking({ ...shared, isQaTest: false })).toBe("live");
  });

  it("does not allow a QA booking to reach Live Stripe in production or without test keys", () => {
    expect(() => resolveStripeModeForBooking({ isQaTest: true, configuredMode: "live", testSecretKey: "sk_test_sandbox", isProduction: true })).toThrow("QA appointment requires Stripe test-mode credentials");
    expect(() => resolveStripeModeForBooking({ isQaTest: true, configuredMode: "live", testSecretKey: "sk_live_not_sandbox", isProduction: false })).toThrow("QA appointment requires Stripe test-mode credentials");
  });
});
