import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  availabilityAudienceLabel,
  buildAvailabilityOfferFallbackPath,
  buildAvailabilityOfferPath,
  groupAvailableStartsIntoWindows,
} from "../shared/availabilityOffer";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("availability-offer window presentation", () => {
  it("groups only contiguous available starts while preserving audience boundaries", () => {
    expect(groupAvailableStartsIntoWindows("2026-11-02", [
      { time: "09:00", available: true, audience: "open" },
      { time: "09:15", available: true, audience: "open" },
      { time: "09:30", available: false, reason: "booked", audience: "open" },
      { time: "09:45", available: true, audience: "returning_only" },
      { time: "10:00", available: true, audience: "returning_only" },
    ])).toEqual([
      { localDate: "2026-11-02", startTime: "09:00", endTime: "09:30", audience: "open" },
      { localDate: "2026-11-02", startTime: "09:45", endTime: "10:15", audience: "returning_only" },
    ]);
  });

  it("uses recipient-safe paths and readable access labels", () => {
    expect(buildAvailabilityOfferPath("12.signature")).toBe("/book-availability/12.signature");
    expect(buildAvailabilityOfferFallbackPath(44)).toBe("/book/44?from=availability-message");
    expect(availabilityAudienceLabel("open")).toBe("Open to everyone");
    expect(availabilityAudienceLabel("returning_only")).toBe("Returning clients only");
  });
});

describe("availability-offer authorization and stale-link contracts", () => {
  it("keeps sending server-side, technician-only, and free of SMS", () => {
    const router = source("server/routers.ts");
    expect(router).toContain("sendAvailabilityOffer: protectedProcedure");
    expect(router).toContain('conversation.techId !== ctx.user.id');
    expect(router).toContain('conversation.techRole !== "nail_tech"');
    expect(router).toContain('conversation.clientRole !== "client"');
    expect(router).toContain("getNextShareableAvailabilityWindows");
    const offerSection = router.slice(router.indexOf("sendAvailabilityOffer:"), router.indexOf("send: protectedProcedure"));
    expect(offerSection).not.toContain("sendValisseTransactionalSms");
  });

  it("uses a protected resolver and an explicit unavailable fallback", () => {
    const redirect = source("client/src/pages/AvailabilityOfferBookingRedirect.tsx");
    const router = source("server/routers.ts");
    expect(router).toContain("resolveAvailabilityOfferWindow: protectedProcedure");
    expect(redirect).toContain("This time is no longer available");
    expect(redirect).toContain("View all availability");
    expect(redirect).toContain("preferredDate");
    expect(redirect).toContain("preferredStart");
  });

  it("offers a tech composer control and client-only booking actions", () => {
    const chat = source("client/src/pages/Chat.tsx");
    expect(chat).toContain("const canShareAvailability");
    expect(chat).toContain("Share availability");
    expect(chat).toContain("Send next 3 openings");
    expect(chat).toContain("isClient && window.href");
    expect(chat).toContain("View all availability");
  });
});
