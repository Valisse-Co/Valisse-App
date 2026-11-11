import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { getStripeIntegrationStatus, getStripePlatformFundsStatus } from "./stripe";
import { isTelnyxConfigured } from "./telnyx";
import { isResendConfigured } from "./resend";
import { safeErrorDetails } from "./securityLogging";

/** Monitoring never creates a schedule, sends a message, or moves money. */
export const operationsRouter = router({
  snapshot: adminProcedure
    .input(z.object({ environment: z.enum(["production", "development"]).default("production") }).default({ environment: "production" }))
    .query(async ({ input }) => {
      const { getOperationsSnapshot } = await import("./operationsDb");
      const stripeStatus = getStripeIntegrationStatus();
      const desiredMode = input.environment === "production" ? "live" as const : "test" as const;
      const funds = async () => {
        if (!stripeStatus.configured) return { status: "unconfigured" as const };
        if (stripeStatus.mode !== desiredMode) return { status: "scope_mismatch" as const };
        try {
          return await getStripePlatformFundsStatus(desiredMode);
        } catch (error) {
          console.warn("[Operations] Platform funds unavailable", safeErrorDetails(error));
          return { status: "unavailable" as const };
        }
      };
      const [snapshot, platformFunds] = await Promise.all([getOperationsSnapshot(input.environment), funds()]);
      return {
        ...snapshot,
        platformFunds,
        runtimeEnvironment: process.env.NODE_ENV === "production" ? "production" as const : "development" as const,
        providers: {
          stripe: stripeStatus,
          telnyx: { configured: isTelnyxConfigured() },
          resend: { configured: isResendConfigured() },
        },
      };
    }),
});
