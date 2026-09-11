# Stripe deferred-payment design reference

- Stripe’s saved-payment-method guidance supports a SetupIntent for saving a card for later use, including later off-session charges: https://docs.stripe.com/payments/save-and-reuse
- Stripe documents that online card authorization holds are typically limited to approximately seven days, so Valisse should save and verify a card at booking rather than hold funds for appointments booked farther ahead: https://docs.stripe.com/payments/place-a-hold-on-a-payment-method
- Valisse design decision: collect no payment or authorization at booking; charge the client-approved service total after a code-verified completed appointment, then release the connected-account payout after a 24-hour dispute window.
