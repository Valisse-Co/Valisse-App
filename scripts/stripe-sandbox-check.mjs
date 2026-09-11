import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  throw new Error("STRIPE_SECRET_KEY is unavailable to the sandbox check.");
}

const stripe = new Stripe(key);
const account = await stripe.accounts.retrieve();

if (account.livemode) {
  throw new Error("Refusing to run sandbox validation against a live Stripe account.");
}

console.log(JSON.stringify({
  ok: true,
  livemode: account.livemode,
  accountId: account.id,
  payoutsEnabled: account.payouts_enabled,
}, null, 2));
