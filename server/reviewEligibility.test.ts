import { describe, expect, it } from "vitest";
import { getReviewEligibility } from "../shared/reviewEligibility";

const completedBooking = {
  id: 42,
  clientId: 10,
  techId: 20,
  status: "completed",
  paymentStatus: "paid",
  completedAt: new Date(),
  paymentCapturedAt: new Date(),
};

describe("post-appointment review eligibility", () => {
  it("allows the booked client to review a completed paid appointment once", () => {
    expect(getReviewEligibility({ booking: completedBooking, reviewerId: 10, techId: 20, alreadyReviewed: false }))
      .toEqual({ eligible: true });
  });

  it("rejects the wrong client or technician", () => {
    expect(getReviewEligibility({ booking: completedBooking, reviewerId: 11, techId: 20, alreadyReviewed: false }).eligible).toBe(false);
    expect(getReviewEligibility({ booking: completedBooking, reviewerId: 10, techId: 21, alreadyReviewed: false }).eligible).toBe(false);
  });

  it("rejects unpaid, incomplete, and duplicate reviews", () => {
    expect(getReviewEligibility({ booking: { ...completedBooking, paymentStatus: "unpaid" }, reviewerId: 10, techId: 20, alreadyReviewed: false }).eligible).toBe(false);
    expect(getReviewEligibility({ booking: { ...completedBooking, status: "confirmed", completedAt: null }, reviewerId: 10, techId: 20, alreadyReviewed: false }).eligible).toBe(false);
    expect(getReviewEligibility({ booking: completedBooking, reviewerId: 10, techId: 20, alreadyReviewed: true }).eligible).toBe(false);
  });
});
