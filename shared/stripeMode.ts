export type StripeEnvironmentMode = "test" | "live" | "unconfigured" | "unknown";
export type StripePaymentMode = "test" | "live";

export function getStripeEnvironmentMode(secretKey: string | null | undefined): StripeEnvironmentMode {
  if (!secretKey) return "unconfigured";
  if (secretKey.startsWith("sk_test_")) return "test";
  if (secretKey.startsWith("sk_live_")) return "live";
  return "unknown";
}

/**
 * Production webhook destinations can receive events from both Stripe
 * environments. Only act on events from the environment of the configured API
 * key, so test traffic can never mutate live Valisse appointment records.
 */
export function shouldProcessStripeEvent(
  configuredMode: StripeEnvironmentMode,
  eventLivemode: boolean | null | undefined,
): boolean {
  if (configuredMode === "test") return eventLivemode === false;
  if (configuredMode === "live") return eventLivemode === true;
  return false;
}

export function isStripeObjectInConfiguredEnvironment(
  storedMode: string | null | undefined,
  configuredMode: StripeEnvironmentMode,
): storedMode is StripePaymentMode {
  return (storedMode === "test" || storedMode === "live") && storedMode === configuredMode;
}

/**
 * Normal bookings always use the app's configured Stripe environment. A
 * preview-only QA booking is the deliberate exception: it stays fully inside
 * Stripe's sandbox even when the rest of the preview is validating Live mode.
 */
export function resolveStripeModeForBooking(params: {
  isQaTest: boolean;
  configuredMode: StripeEnvironmentMode;
  testSecretKey: string | null | undefined;
  isProduction: boolean;
}): StripePaymentMode {
  if (params.isQaTest) {
    if (params.isProduction || getStripeEnvironmentMode(params.testSecretKey) !== "test") {
      throw new Error("The QA appointment requires Stripe test-mode credentials in preview.");
    }
    return "test";
  }
  if (params.configuredMode === "test" || params.configuredMode === "live") {
    return params.configuredMode;
  }
  throw new Error("Stripe is not configured with a valid test or live secret key.");
}

export function stripeModeLabel(mode: StripeEnvironmentMode): string {
  switch (mode) {
    case "live":
      return "Live mode";
    case "test":
      return "Test mode";
    case "unconfigured":
      return "Not configured";
    default:
      return "Unknown mode";
  }
}
