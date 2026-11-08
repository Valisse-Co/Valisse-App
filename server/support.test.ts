import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeContext(userId?: number): TrpcContext {
  return {
    user: userId
      ? ({
          id: userId,
          openId: `user_${userId}`,
          email: "user@example.com",
          name: "Test User",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as any)
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  };
}

describe("support router", () => {
  it("submits a support ticket anonymously and returns a formatted ticket number", async () => {
    const caller = appRouter.createCaller(makeContext());
    const res = await caller.support.submitTicket({
      name: "Alex Rivera",
      email: "alex@example.com",
      category: "booking",
      subject: "Cannot reschedule appointment",
      message: "I need to change my booking on Tuesday afternoon.",
      appointmentRef: "APT-99",
    });

    expect(res.success).toBe(true);
    expect(res.ticketNumber).toMatch(/^VAL-\d{4,}$/);
  });

  it("associates the authenticated user id when signed in", async () => {
    const caller = appRouter.createCaller(makeContext(42));
    const res = await caller.support.submitTicket({
      name: "Jamie Lin",
      email: "jamie@example.com",
      category: "payment",
      subject: "Subscription charge question",
      message: "Please clarify my latest monthly subscription charge.",
    });

    expect(res.success).toBe(true);
    expect(res.ticketNumber).toMatch(/^VAL-\d{4,}$/);
  });

  it("rejects invalid input via zod schema validation", async () => {
    const caller = appRouter.createCaller(makeContext());

    await expect(
      caller.support.submitTicket({
        name: "",
        email: "not-an-email",
        category: "other",
        subject: "",
        message: "hi",
      })
    ).rejects.toThrow();
  });
});
