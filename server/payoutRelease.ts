import { getBookingServiceTotalInCents, getPayoutEligibleBookings, markBookingPayoutResult } from "./db";
import { releaseBookingPayout } from "./stripe";

export async function releaseEligiblePayouts(now = new Date()) {
  const candidates = await getPayoutEligibleBookings(now);
  let released = 0;
  let deferred = 0;
  let failed = 0;

  for (const { booking, tech } of candidates) {
    if (!booking.stripePaymentIntentId || !tech?.stripeConnectedAccountId || !tech.stripeConnectedAccountReady) {
      deferred += 1;
      continue;
    }
    try {
      const totalInCents = await getBookingServiceTotalInCents(booking.id);
      const transfer = await releaseBookingPayout({
        bookingId: booking.id,
        techAccountId: tech.stripeConnectedAccountId,
        servicePaymentIntentId: booking.stripePaymentIntentId,
        serviceTotalInCents: totalInCents,
        tipPaymentIntentId: booking.stripeTipPaymentIntentId,
      });
      await markBookingPayoutResult(booking.id, "released", transfer.id);
      released += 1;
    } catch (error) {
      console.error("[Payout release] Failed", booking.id, error);
      await markBookingPayoutResult(booking.id, "failed");
      failed += 1;
    }
  }

  return { released, deferred, failed, checked: candidates.length };
}
