export type ReviewableBooking = {
  id: number;
  clientId: number;
  techId: number;
  status: string;
  paymentStatus: string;
  completedAt?: Date | null;
  paymentCapturedAt?: Date | null;
};

export type ReviewEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

export function getReviewEligibility(params: {
  booking: ReviewableBooking | null;
  reviewerId: number;
  techId: number;
  alreadyReviewed: boolean;
}): ReviewEligibility {
  const { booking, reviewerId, techId, alreadyReviewed } = params;
  if (!booking) return { eligible: false, reason: "Appointment not found." };
  if (booking.clientId !== reviewerId) {
    return { eligible: false, reason: "Only the client on this appointment can leave a review." };
  }
  if (booking.techId !== techId) {
    return { eligible: false, reason: "This appointment is not associated with that nail tech." };
  }
  if (alreadyReviewed) return { eligible: false, reason: "You already reviewed this appointment." };
  if (booking.status !== "completed" || !booking.completedAt) {
    return { eligible: false, reason: "Reviews are available after the appointment is completed." };
  }
  if (booking.paymentStatus !== "paid" || !booking.paymentCapturedAt) {
    return { eligible: false, reason: "Reviews are available after payment is confirmed." };
  }
  return { eligible: true };
}
