import { getBookingServiceTotalInCents, getPayoutEligibleBookings, markBookingPayoutResult, updateUserStripeReferences } from "./db";
import { getConnectedAccountReadiness, getStripeIntegrationStatus, releaseBookingPayout } from "./stripe";
import { isStripeObjectInConfiguredEnvironment } from "../shared/stripeMode";

export async function releaseEligiblePayouts(now = new Date()) {
  const candidates = await getPayoutEligibleBookings(now);
  const stripeMode = getStripeIntegrationStatus().mode;
  if (stripeMode !== "test" && stripeMode !== "live") {
    return { released: 0, deferred: candidates.length, failed: 0, checked: candidates.length };
  }
  let released = 0;
  let deferred = 0;
  let failed = 0;

  for (const { booking, tech } of candidates) {
    if (
      !booking.stripePaymentIntentId ||
      !tech?.stripeConnectedAccountId ||
      !tech.stripeConnectedAccountReady ||
      !isStripeObjectInConfiguredEnvironment(tech.stripeConnectedAccountMode, stripeMode)
    ) {
      deferred += 1;
      continue;
    }
    try {
      const accountReadiness = await getConnectedAccountReadiness(tech.stripeConnectedAccountId);
      await updateUserStripeReferences(tech.id, {
        stripeConnectedAccountReady: accountReadiness.ready,
        stripeConnectedAccountMode: stripeMode,
      });
      if (!accountReadiness.ready) {
        deferred += 1;
        continue;
      }
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
