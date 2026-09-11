import Stripe from "stripe";
import { ENV } from "./_core/env";
import { calculatePlatformPayout } from "../shared/appointmentLifecycle";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!ENV.stripeSecretKey) throw new Error("Stripe is not configured. Open Settings → Payment to finish Stripe setup.");
  if (!stripeClient) stripeClient = new Stripe(ENV.stripeSecretKey);
  return stripeClient;
}

export async function createStripeCustomer(params: { userId: number; name?: string | null; email?: string | null }) {
  const stripe = getStripe();
  return stripe.customers.create({
    name: params.name ?? undefined,
    email: params.email ?? undefined,
    metadata: { valisse_user_id: String(params.userId) },
  });
}

export async function createBookingSetupIntent(params: { bookingId: number; customerId: string }) {
  const stripe = getStripe();
  return stripe.setupIntents.create({
    customer: params.customerId,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { booking_id: String(params.bookingId), kind: "booking_payment_method" },
  });
}

export async function verifyBookingSetupIntent(params: { setupIntentId: string; customerId: string; bookingId: number }) {
  const stripe = getStripe();
  const setupIntent = await stripe.setupIntents.retrieve(params.setupIntentId);
  const customerId = typeof setupIntent.customer === "string" ? setupIntent.customer : setupIntent.customer?.id;
  const metadata = setupIntent.metadata ?? {};
  if (
    setupIntent.status !== "succeeded" ||
    customerId !== params.customerId ||
    metadata.booking_id !== String(params.bookingId) ||
    metadata.kind !== "booking_payment_method"
  ) {
    throw new Error("The payment method setup has not been completed for this booking.");
  }
  return setupIntent;
}

async function getSavedCardPaymentMethod(customerId: string) {
  const stripe = getStripe();
  const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
  if (!methods.data[0]) throw new Error("No saved card is available for this booking.");
  return methods.data[0].id;
}

export async function chargeSavedCard(params: {
  bookingId: number;
  customerId: string;
  amountInCents: number;
  kind: "service_completion" | "cancellation_fee";
}) {
  const stripe = getStripe();
  const paymentMethod = await getSavedCardPaymentMethod(params.customerId);
  return stripe.paymentIntents.create({
    amount: params.amountInCents,
    currency: "usd",
    customer: params.customerId,
    payment_method: paymentMethod,
    payment_method_types: ["card"],
    off_session: true,
    confirm: true,
    metadata: { booking_id: String(params.bookingId), kind: params.kind },
  }, { idempotencyKey: `valisse_booking_${params.bookingId}_${params.kind}` });
}

export async function createTipPaymentIntent(params: { bookingId: number; customerId: string; amountInCents: number }) {
  const stripe = getStripe();
  return stripe.paymentIntents.create({
    amount: params.amountInCents,
    currency: "usd",
    customer: params.customerId,
    payment_method_types: ["card"],
    metadata: { booking_id: String(params.bookingId), kind: "tip" },
  });
}

export async function createExpressConnectedAccount(params: { techId: number; email?: string | null }) {
  const stripe = getStripe();
  return stripe.accounts.create({
    type: "express",
    country: "US",
    email: params.email ?? undefined,
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    metadata: { valisse_tech_id: String(params.techId) },
  });
}

export async function createConnectedAccountLink(params: { accountId: string; refreshUrl: string; returnUrl: string }) {
  const stripe = getStripe();
  return stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });
}

export async function getConnectedAccountReadiness(accountId: string) {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  return {
    ready: Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled),
    account,
  };
}

export async function releaseBookingPayout(params: {
  bookingId: number;
  techAccountId: string;
  servicePaymentIntentId: string;
  serviceTotalInCents: number;
  tipPaymentIntentId?: string | null;
}) {
  const stripe = getStripe();
  const servicePayment = await stripe.paymentIntents.retrieve(params.servicePaymentIntentId);
  const serviceChargeId = typeof servicePayment.latest_charge === "string"
    ? servicePayment.latest_charge
    : servicePayment.latest_charge?.id;
  if (!serviceChargeId) throw new Error("The completed service payment has no transferable charge.");

  const { techPayoutInCents } = calculatePlatformPayout(params.serviceTotalInCents);
  const transfer = await stripe.transfers.create({
    amount: techPayoutInCents,
    currency: "usd",
    destination: params.techAccountId,
    source_transaction: serviceChargeId,
    transfer_group: `valisse_booking_${params.bookingId}`,
    metadata: { booking_id: String(params.bookingId), kind: "service_payout" },
  }, { idempotencyKey: `valisse_booking_${params.bookingId}_service_payout` });

  if (params.tipPaymentIntentId) {
    const tipPayment = await stripe.paymentIntents.retrieve(params.tipPaymentIntentId);
    const tipChargeId = typeof tipPayment.latest_charge === "string" ? tipPayment.latest_charge : tipPayment.latest_charge?.id;
    if (tipChargeId && tipPayment.status === "succeeded") {
      await stripe.transfers.create({
        amount: tipPayment.amount,
        currency: tipPayment.currency,
        destination: params.techAccountId,
        source_transaction: tipChargeId,
        transfer_group: `valisse_booking_${params.bookingId}`,
        metadata: { booking_id: String(params.bookingId), kind: "tip_payout" },
      }, { idempotencyKey: `valisse_booking_${params.bookingId}_tip_${params.tipPaymentIntentId}` });
    }
  }

  return transfer;
}
