import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY is unavailable to the sandbox smoke test.");

const stripe = new Stripe(key);
const account = await stripe.accounts.retrieve();
if (account.livemode) throw new Error("Refusing to create a smoke-test transaction in live mode.");

const customer = await stripe.customers.create({
  email: `sandbox-check+${Date.now()}@valisseco.com`,
  metadata: { purpose: "valisse_sandbox_charge_refund_smoke_test" },
});

const intent = await stripe.paymentIntents.create({
  amount: 50,
  currency: "usd",
  customer: customer.id,
  payment_method: "pm_card_visa",
  payment_method_types: ["card"],
  confirm: true,
  metadata: { purpose: "valisse_sandbox_charge_refund_smoke_test" },
});

if (intent.status !== "succeeded") throw new Error(`Expected a succeeded test charge, received ${intent.status}.`);

const refund = await stripe.refunds.create({ payment_intent: intent.id, reason: "requested_by_customer" });
if (refund.status !== "succeeded" && refund.status !== "pending") throw new Error(`Expected a successful test refund, received ${refund.status}.`);

console.log(JSON.stringify({ ok: true, paymentIntentStatus: intent.status, refundStatus: refund.status }, null, 2));
