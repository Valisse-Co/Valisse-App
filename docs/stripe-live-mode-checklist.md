# Valisse Stripe Live-Mode & Connected Payout Checklist

> **Current status — October 3, 2026:** Valisse is deliberately running on **Stripe test mode**. The current technician connected account is verified for sandbox transfers only. No live Stripe keys, live connected account, live webhook secret, or live Connect webhook secret has been configured in Valisse yet.

## Guardrails already in place

- Booking card setup uses a Stripe SetupIntent, so saving a card does **not** charge or place a hold on the client.
- Service charges occur only after the code-verified appointment is completed.
- Valisse retains 5% of the service amount; tips transfer in full after the 24-hour issue window.
- Payouts require a connected account whose **recipient transfer capability** is active, and the scheduled release process re-checks that capability immediately before creating a transfer.
- Test and live Stripe customers/connected accounts are now tagged separately. Switching to live mode cannot reuse a test card customer or test connected account.
- Stripe webhooks process events only from the Stripe environment matching the configured secret key.

## Part A — Activate the Valisse Stripe account in Live mode

Complete these in the Stripe Dashboard using your own browser. Do not send keys, account numbers, or identity information in chat.

1. Sign in to the **Valisse** Stripe Dashboard and toggle **Test mode off**.
2. Complete Stripe’s platform activation requirements: legal business identity, support contact, bank account, and any tax details Stripe requests.
3. In **Settings → Connect**, confirm that Valisse is configured as a marketplace/platform that can create **Express recipient accounts** and make separate charges and transfers.
4. Confirm the platform is approved to use the U.S. connected-account and payout capabilities needed for your launch geography.

**Pass condition:** The Stripe Dashboard has no activation banner preventing live payments or transfers.

## Part B — Configure production Valisse keys

In Stripe Dashboard → **Developers → API keys** while in Live mode, collect the following keys. Keep secret values private.

| Valisse setting | Stripe source | Required purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Live secret key beginning `sk_live_` | Server-side customers, SetupIntents, charges, refunds, transfers, and Connect account creation |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Live publishable key beginning `pk_live_` | Browser Stripe Elements for saving cards and tips |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the platform-payment webhook below | Verifies platform payment events |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Signing secret for the dedicated Connect webhook below | Verifies connected-account status events |

> The secret key and publishable key must come from the **same Live mode Stripe account**. Never mix `sk_test_` with `pk_live_`, or vice versa.

After you have the keys, add them in the project’s secure environment settings—not source code—and restart/redeploy Valisse. The app will then label Payouts as **Live mode**.

## Part C — Create two live webhook destinations

Use HTTPS public domains, not the temporary preview URL. For production, use `https://www.valisseco.com`.

### 1. Platform payment events

Create a webhook destination at:

```text
https://www.valisseco.com/api/stripe/webhook
```

Select **Events from: Your account** and subscribe to:

- `setup_intent.succeeded`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Copy its unique signing secret into `STRIPE_WEBHOOK_SECRET`.

### 2. Connected-account events

Create a second webhook destination at:

```text
https://www.valisseco.com/api/stripe/connect-webhook
```

Select **Events from: Connected accounts** and subscribe to:

- `account.updated`
- `account.external_account.updated`
- `payout.failed`

Copy this destination’s unique signing secret into `STRIPE_CONNECT_WEBHOOK_SECRET`.

**Pass condition:** Both endpoints show a successful Stripe test delivery after deployment. Do not reuse a signing secret between endpoints or environments.

## Part D — Onboard one real technician in Live mode

1. Sign in to Valisse as a technician after live keys are deployed.
2. Open **Settings → Payouts**. The page must say **Stripe live mode**.
3. Select **Set up payouts with Stripe**. Valisse creates a new **live** Express recipient account; it does not reuse the existing test account.
4. Complete Stripe-hosted onboarding with the technician’s real identity and bank information.
5. Return to Valisse and refresh Payouts.

**Pass condition:** The page says the connected account is **verified and ready to receive payouts**. In Stripe, the recipient transfer capability is active and there are no currently due requirements.

## Part E — Controlled live verification

Do this only after the platform and technician are fully approved. Use a real technician who has explicitly agreed to be the launch test recipient.

1. Create one low-value appointment booking using a real customer card owned by an authorized tester.
2. Verify the card is saved at booking without a charge or authorization hold.
3. Confirm the appointment, reveal the client code during the permitted window, start it with the code, and complete it.
4. Confirm exactly one service PaymentIntent is created for the approved final total.
5. Add either no tip or a small approved tip, then confirm the 24-hour issue window blocks payout release.
6. After the window, confirm one transfer equals **95% of the service amount plus 100% of any tip**.
7. Verify the transfer in both Valisse Payout History and Stripe before considering the payout flow launch-ready.

> Do not use live cards, create live transfers, issue refunds, or release held payouts solely to “see what happens.” Each action must correspond to a genuine, authorized appointment and the documented business policy.

## Launch gates

| Gate | Required evidence |
|---|---|
| Stripe live platform active | Stripe Dashboard has no live-payment or transfer restrictions |
| Correct live key pair | Valisse Payouts labels the environment as Live mode |
| Platform webhook healthy | Signed live test delivery succeeds at `/api/stripe/webhook` |
| Connect webhook healthy | Signed connected-account event delivery succeeds at `/api/stripe/connect-webhook` |
| First tech ready | Valisse says payouts ready; Stripe recipient transfer capability is active |
| Deferred payment works | One authorized appointment completes and charges exactly once |
| Payout safety works | 24-hour hold, issue report, resolution, and transfer checks behave as designed |
| Operations owner assigned | Someone can respond to payment due, failed payout, cancellation, and dispute notifications |

## Current next action

1. In your own browser, sign into Stripe and verify the **Live mode** platform account is activated.
2. When that is complete, tell me whether it shows any requirements or restrictions.
3. I will then guide the secure project-key and webhook configuration, followed by live technician onboarding.
