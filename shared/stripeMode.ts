export type StripeEnvironmentMode = "test" | "live" | "unconfigured" | "unknown";

export function getStripeEnvironmentMode(secretKey: string | null | undefined): StripeEnvironmentMode {
  if (!secretKey) return "unconfigured";
  if (secretKey.startsWith("sk_test_")) return "test";
  if (secretKey.startsWith("sk_live_")) return "live";
  return "unknown";
}

/**
 * Production Stripe webhook destinations can receive events from both Stripe
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
): storedMode is "test" | "live" {
  return (storedMode === "test" || storedMode === "live") && storedMode === configuredMode;
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
