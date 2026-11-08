import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import {
  getPasswordValidationError,
  normalizeEmail,
  requiresEmailVerification,
  SECURITY_TOKEN_MAX_LENGTH,
  SECURITY_TOKEN_MIN_LENGTH,
} from "../shared/emailSecurity";
import { getSessionCookieOptions } from "./_core/cookies";
import { authenticatedProcedure, publicProcedure, router } from "./_core/trpc";
import { emailSecurityService, EmailSecurityError } from "./emailSecurity";
import { isResendConfigured } from "./resend";

const tokenInput = z
  .string()
  .min(SECURITY_TOKEN_MIN_LENGTH)
  .max(SECURITY_TOKEN_MAX_LENGTH);
const passwordInput = z
  .string()
  .max(72)
  .superRefine((value, context) => {
    const error = getPasswordValidationError(value);
    if (error) context.addIssue({ code: "custom", message: error });
  });

async function safely<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof EmailSecurityError) {
      throw new TRPCError({
        code:
          error.kind === "bad_link" || error.kind === "invalid_password"
            ? "BAD_REQUEST"
            : error.kind === "throttled"
              ? "TOO_MANY_REQUESTS"
              : error.kind === "no_email"
                ? "BAD_REQUEST"
                : "SERVICE_UNAVAILABLE",
        message: error.message,
      });
    }
    // Do not attach causes: provider/database errors may contain PII or links.
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "Account security is temporarily unavailable. Please try again later.",
    });
  }
}

export function createEmailSecurityRouter(service = emailSecurityService) {
  return router({
    status: publicProcedure.query(({ ctx }) => ({
      authenticated: Boolean(ctx.user),
      email: ctx.user?.email ?? null,
      needsVerification: requiresEmailVerification(ctx.user),
      verified: Boolean(ctx.user?.emailVerifiedAt),
      emailAvailable: isResendConfigured(),
    })),
    resendVerification: authenticatedProcedure.mutation(({ ctx }) =>
      safely(() =>
        // Socket origin only; forwarded headers and req.ip are attacker-controlled.
        service.issueVerificationEmail(
          ctx.user.id,
          ctx.req.socket?.remoteAddress ?? "unknown-socket"
        )
      )
    ),
    verifyEmail: publicProcedure
      .input(z.object({ token: tokenInput }).strict())
      .mutation(({ ctx, input }) =>
        safely(() => service.verifyEmail(input.token, ctx.user?.id))
      ),
    requestPasswordReset: publicProcedure
      .input(
        z
          .object({
            email: z
              .string()
              .max(320)
              .transform(normalizeEmail)
              .pipe(z.string().email().max(320)),
          })
          .strict()
      )
      .mutation(({ ctx, input }) =>
        service.requestPasswordReset(
          input.email,
          ctx.req.socket?.remoteAddress ?? "unknown-socket"
        )
      ),
    resetPassword: publicProcedure
      .input(
        z
          .object({
            token: tokenInput,
            password: passwordInput,
            confirmPassword: passwordInput,
          })
          .strict()
          .refine(input => input.password === input.confirmPassword, {
            message: "Passwords do not match.",
            path: ["confirmPassword"],
          })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await safely(() =>
          service.resetPassword(
            input.token,
            input.password,
            input.confirmPassword
          )
        );
        ctx.res.clearCookie(COOKIE_NAME, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: -1,
        });
        // Consumption never authenticates either the token owner or current session.
        return result;
      }),
  });
}

export const emailSecurityRouter = createEmailSecurityRouter();
