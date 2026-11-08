import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { getStripeIntegrationStatus } from "./stripe";
import { isTelnyxConfigured } from "./telnyx";
import { isResendConfigured } from "./resend";

/** Monitoring never creates a schedule, sends a message, or moves money. */
export const operationsRouter = router({
  snapshot: adminProcedure
    .input(z.object({ environment: z.enum(["production", "development"]).default("production") }).default({ environment: "production" }))
    .query(async ({ input }) => {
      const { getOperationsSnapshot } = await import("./operationsDb");
      return {
        ...await getOperationsSnapshot(input.environment),
        runtimeEnvironment: process.env.NODE_ENV === "production" ? "production" as const : "development" as const,
        providers: {
          stripe: getStripeIntegrationStatus(),
          telnyx: { configured: isTelnyxConfigured() },
          resend: { configured: isResendConfigured() },
        },
      };
    }),
});
