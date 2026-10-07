export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // The platform-provisioned Stripe variables remain test-mode defaults in
  // preview. Explicit Valisse live overrides are kept separately so moving to
  // production never mutates or reuses sandbox credentials.
  stripeSecretKey: process.env.VALISSE_STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.VALISSE_STRIPE_LIVE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "",
  stripeConnectWebhookSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? "",
  telnyxApiKey: process.env.TELNYX_API_KEY ?? "",
  telnyxMessagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID ?? "",
  telnyxSenderNumber: process.env.TELNYX_SENDER_NUMBER ?? "",
  telnyxPublicKey: process.env.TELNYX_PUBLIC_KEY ?? "",
};
