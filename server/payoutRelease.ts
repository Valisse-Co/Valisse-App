import { getBookingById, getBookingServiceTotalInCents, getFeeEventsReadyForPayout, getPayoutEligibleBookings, markBookingPayoutResult, updateBookingFeeEvent, updateUserStripeReferences } from "./db";
import { getConnectedAccountReadiness, getStripeIntegrationStatus, releaseAppointmentFeePayout, releaseBookingPayout } from "./stripe";
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

  const feePayouts = await releaseEligibleAppointmentFeePayouts(now);
  return { released: released + feePayouts.released, deferred: deferred + feePayouts.deferred, failed: failed + feePayouts.failed, checked: candidates.length + feePayouts.checked, appointmentFeePayouts: feePayouts };
}

/** Releases the exact fee amount after its separate 24-hour issue window. */
export async function releaseEligibleAppointmentFeePayouts(now = new Date()) {
  const candidates = await getFeeEventsReadyForPayout(now);
  let released = 0;
  let deferred = 0;
  let failed = 0;
  for (const { event, tech } of candidates) {
    const booking = await getBookingById(event.bookingId);
    const mode = booking?.isQaTest ? "test" : getStripeIntegrationStatus().mode;
    const accountId = booking?.isQaTest ? tech?.stripeTestConnectedAccountId : tech?.stripeConnectedAccountId;
    const accountReady = booking?.isQaTest ? tech?.stripeTestConnectedAccountReady : tech?.stripeConnectedAccountReady;
    if (!booking || (mode !== "test" && mode !== "live") || !event.stripePaymentIntentId || !tech || !accountId || !accountReady || (!booking.isQaTest && !isStripeObjectInConfiguredEnvironment(tech.stripeConnectedAccountMode, mode))) {
      deferred += 1;
      continue;
    }
    try {
      const readiness = await getConnectedAccountReadiness(accountId, mode);
      if (!readiness.ready) {
        deferred += 1;
        continue;
      }
      const transfer = await releaseAppointmentFeePayout({
        feeEventId: event.id,
        bookingId: booking.id,
        techAccountId: accountId,
        paymentIntentId: event.stripePaymentIntentId,
        amountInCents: event.amountInCents,
        mode,
      });
      await updateBookingFeeEvent(event.id, { payoutStatus: "released", stripeTransferId: transfer.id });
      released += 1;
    } catch (error) {
      console.error("[Appointment fee payout] Failed", event.id, error);
      await updateBookingFeeEvent(event.id, { payoutStatus: "failed" });
      failed += 1;
    }
  }
  return { released, deferred, failed, checked: candidates.length };
}
