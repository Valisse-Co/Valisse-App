# Future-only automatic technician payouts

## What changed

Valisse’s **platform bank payout schedule is now Manual**, as explicitly approved. The setting was read back from Stripe. Ashton Earl’s connected technician account remains on its existing **daily** bank payout schedule; no technician bank details or bank schedule were changed.

Client charges still enter Valisse’s Stripe balance. The new automatic payout lane transfers the technician’s entitlement to the correct connected Stripe account. Stripe then deposits funds to the technician’s bank according to that account’s payout schedule and banking availability. A recorded connected-account transfer is not proof that a bank deposit has arrived.

## Future-only eligibility

Publication alone does not activate money movement. After the published code is verified and the owner explicitly approves activation, the registered production job will be changed from `observe_only` to `payouts_only`. Its approval timestamp and capture cutoff are fixed together at activation time and are never reset on retry.

Only live payments captured **at or after that cutoff** are eligible. Pre-cutoff bookings—including the historical $1.90 owed on booking #1920002—are not recovered, refunded, waived, marked paid out, or transferred by this lane. Existing balances and historical obligations are not erased.

Every eligible transfer must pass:

- The agreed 24-hour review window and any longer payout hold have ended.
- The original payment is successful, live, USD, captured and settled, with no refund or Stripe dispute.
- Customer, booking, payment, technician and connected-account ownership match.
- The connected account can receive transfers and is not the platform account.
- Service and tip amounts match their immutable paid snapshots; open revisions, issue holds and invalid financial transitions block dispatch.
- The platform is still on Manual bank payouts and has sufficient available USD funds.
- Durable transfer records and Stripe evidence do not show an existing, conflicting or uncertain transfer for that payment leg.

Services pay **95% of the approved service total** to the technician. Paid tips and confirmed appointment fees are transferred in full under the existing policy. Processing fees are not silently deducted from the technician’s agreed entitlement.

## Failure and duplicate protection

Each service, tip and fee payment has its own durable claim, fixed amount/destination and dispatch evidence. A successful service transfer is persisted separately, so a tip failure cannot erase it or cause it to be sent again. Overlapping callbacks use database leases and booking-first locks.

Unsettled funds, insufficient balance and temporary verification failures defer processing. An ambiguous transfer result is reconciled against Stripe rather than blindly resent—even after Stripe’s idempotency-key retention window. The callback and final dispatch gate use bounded deadlines; a slow preflight cannot start a new transfer after its dispatch deadline.

The payout-only lane does **not** create charges, refunds or fee assessments, fund an account, activate SMS/email, alter bank information or withdraw Valisse’s earnings. Existing interactive appointment notifications are unchanged; scheduled SMS and attendance evaluation remain unactivated.

## Important funding limitation

For the investigated $2.00 transaction, Stripe deducted $0.36, leaving $1.64 against a $1.90 technician entitlement. Manual platform bank payouts prevent future automatic sweeps, but do not remove processing fees or manufacture the missing funds. Similar small payments will remain pending if the available platform balance cannot cover the technician’s share. The worker does not charge the client again or reduce the technician’s share to cover that shortfall.

Valisse’s remaining platform earnings also no longer sweep automatically to its business bank. They must be withdrawn only after technician obligations and processing costs are covered, within applicable Stripe holding limits.

## Activation and verification

1. Publish the tested checkpoint using Valisse’s Publish control.
2. Confirm publication and approve **future-only automatic technician transfers**. No historical recovery or general-purpose financial worker activation is included.
3. Verify the registered production task identity and set the one-time activation cutoff using the operator-only helper. Do not backdate the cutoff.
4. Inspect the next native scheduled callback and its matching durable `payouts_only` run in **Settings → Administration → Operations**. A successful empty run verifies delivery/policy—not a real transfer or bank deposit.
5. Separately agree on a realistic, approved live payment smoke test to validate capture, settlement, transfer and bank receipt. Do not claim end-to-end bank payout verification without that evidence.

## Verification completed before activation

TypeScript and production build are checked; offline regressions cover payment ownership, stale/foreign evidence, refunds/disputes, ambiguous results, deadlines, duplicate claims, paid-snapshot immutability and tip races. A real managed-database test uses only UUID-owned disposable fixtures and fake Stripe references while the production heartbeat remains observation-only. No live transfer, refund, account funding, historical payout recovery or scheduled message is performed by these tests.

Current Telnyx readiness is a separate launch dependency; its existing configuration health check still reports HTTP 401. SMS/email provider setup was not changed.

## Stripe references

- [Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
- [Manual payouts and holding limits](https://docs.stripe.com/connect/manual-payouts)
- [Platform balance funding](https://docs.stripe.com/connect/top-ups)
