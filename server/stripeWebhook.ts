import type { Request, Response } from "express";
import { getStripe } from "./stripe";
import { ENV } from "./_core/env";
import {
  getBookingById,
  markBookingPaymentResult,
  setBookingPaymentMethodState,
  updateUserStripeReferences,
} from "./db";

export async function handleStripeWebhook(req: Request, res: Response) {
  if (!ENV.stripeWebhookSecret) return res.status(500).json({ error: "Stripe webhook secret is not configured." });
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") return res.status(400).json({ error: "Missing Stripe signature." });

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, ENV.stripeWebhookSecret);
  } catch (error) {
    return res.status(400).json({ error: "Invalid Stripe webhook signature." });
  }

  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe webhook] Test event verified", event.id);
    return res.json({ verified: true });
  }

  try {
    if (event.type === "setup_intent.succeeded") {
      const intent = event.data.object;
      const bookingId = Number(intent.metadata?.booking_id);
      if (Number.isFinite(bookingId)) await setBookingPaymentMethodState(bookingId, { stripeSetupIntentId: intent.id, paymentMethodStatus: "saved" });
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const bookingId = Number(intent.metadata?.booking_id);
      const kind = intent.metadata?.kind;
      if (Number.isFinite(bookingId) && kind === "service_completion") {
        const booking = await getBookingById(bookingId);
        if (booking) await markBookingPaymentResult(bookingId, {
          stripePaymentIntentId: intent.id,
          paymentStatus: "paid",
          paymentCapturedAt: new Date(),
          status: booking.status === "payment_due" ? "completed" : undefined,
          payoutStatus: booking.payoutStatus === "not_ready" ? "pending_dispute_window" : undefined,
        });
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      const bookingId = Number(intent.metadata?.booking_id);
      if (Number.isFinite(bookingId) && intent.metadata?.kind === "service_completion") {
        await markBookingPaymentResult(bookingId, { paymentStatus: "payment_due", payoutStatus: "not_ready", status: "payment_due" });
      }
    }

    if (event.type === "account.updated") {
      const account = event.data.object;
      const techId = Number(account.metadata?.valisse_tech_id);
      if (Number.isFinite(techId)) {
        await updateUserStripeReferences(techId, {
          stripeConnectedAccountId: account.id,
          stripeConnectedAccountReady: Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled),
        });
      }
    }

    console.log("[Stripe webhook] Processed", event.type, event.id);
    return res.json({ received: true });
  } catch (error) {
    console.error("[Stripe webhook] Processing error", event.type, event.id, error);
    return res.status(500).json({ error: "Webhook processing failed." });
  }
}
