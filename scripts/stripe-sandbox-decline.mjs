import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY is unavailable to the sandbox decline test.");

const stripe = new Stripe(key);
const account = await stripe.accounts.retrieve();
if (account.livemode) throw new Error("Refusing to run a decline test in live mode.");

try {
  await stripe.paymentIntents.create({
    amount: 50,
    currency: "usd",
    payment_method: "pm_card_chargeDeclined",
    payment_method_types: ["card"],
    confirm: true,
    metadata: { purpose: "valisse_sandbox_decline_smoke_test" },
  });
  throw new Error("Expected the Stripe decline test card to fail, but it succeeded.");
} catch (error) {
  if (error instanceof Error && error.message.includes("Expected the Stripe decline")) throw error;
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code !== "card_declined") throw error;
  console.log(JSON.stringify({ ok: true, expectedFailure: "card_declined" }, null, 2));
}
