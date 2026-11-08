import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { requiresEmailVerification } from "../../shared/emailSecurity";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (error.code === "INTERNAL_SERVER_ERROR") {
      return { ...shape, message: "An unexpected error occurred. Please try again.", data: { ...shape.data, stack: undefined } };
    }
    return { ...shape, data: { ...shape.data, stack: undefined } };
  },
});
export const router = t.router;
export const publicProcedure = t.procedure;
const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
// Narrowly used for verification itself, not marketplace operations.
export const authenticatedProcedure = t.procedure.use(requireUser);
export const accountRecoveryProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (requiresEmailVerification(ctx.user)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Verify your email address before continuing." });
  }
  return next({ ctx });
});
export const protectedProcedure = accountRecoveryProcedure.use(({ ctx, next }) => {
  if (ctx.user.deactivatedAt != null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Reactivate your account before using Valisse." });
  }
  return next({ ctx });
});
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  return next({ ctx });
});
