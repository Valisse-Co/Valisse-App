# $2.00 technician payout: findings and recovery

Verified with read-only database and live Stripe requests on November 10, 2026. No transfer, refund, bank debit, payout, payout-schedule change, or provider activation was performed.

## What happened

Valisse booking **1920002**, for technician **Ashton Earl**, has a successful live **$2.00 service-completion payment**. The payment's booking metadata matches the booking, and its Stripe customer matches the booking client's stored customer reference. The client is named “Test” in Valisse; the Stripe charge has no billing-name field, so the reported “Overcome the Human” statement label was not independently verified.

The service completed on October 12 at 11:10 PM Mountain daylight time. Its 24-hour payout eligibility deadline passed on October 13 at 11:10 PM Mountain daylight time. The database still labels it `pending_dispute_window`, with no recorded transfer and no unresolved booking issue. Stripe shows no transfer in this booking's transfer group, and the charge has no transfer group or destination. There is no Stripe charge dispute or refund on this charge.

Stripe deducted an actual **$0.36 processing fee**, leaving **$1.64**. The charge's balance transaction is explicitly included in a **paid, automatic $1.64 payout to the Valisse platform's bank**, recorded by Stripe on October 30. This is not a payout to the technician's connected account.

The platform bank payout schedule is **monthly, on the 30th**. The platform's available and pending USD balances are both **$0.00**. Ashton's live recipient transfer capability is active and bank payouts are enabled; the technician's bank schedule is daily. His connected Stripe USD balance is also **$0.00**. A ready bank account does not, by itself, move platform money into that account.

## Why the technician transfer did not happen

Valisse uses separate charges and transfers: the client charge first belongs to the platform Stripe balance, then a separate transfer sends technician earnings to the correct connected account. Stripe documents this flow separately from bank payouts. [1]

The production heartbeat verified on November 10 is intentionally **observation-only**. It counts overdue payouts but does not execute transfers, SMS, or attendance changes. The production transfer worker therefore has not been activated. Connecting a technician's bank and enabling a read-only heartbeat are not completion of the live payout flow.

Because no technician transfer occurred before the platform's scheduled bank payout, the pooled charge proceeds reached the platform bank. Stripe specifically describes automatic platform payouts consuming seller funds as a risk of pooled separate-charge-and-transfer balances. [2]

## Amount owed and safe recovery

The existing agreed policy retains **5% of the service total**, excluding tips. For this appointment, **$0.10** is the Valisse service fee and **$1.90** is owed to Ashton. There is no tip or refund on this booking.

The actual $0.36 processing fee exceeds Valisse's $0.10 service fee by **$0.26**. Under the existing payout calculation, the platform covers that difference; it must not silently deduct additional processing fees from the technician or charge the client again. Returning the $1.64 deposited in the business bank plus $0.26 of business funds would restore the $1.90 technician entitlement. Current Stripe balances cannot fund that transfer without replenishment.

Before changing anything, obtain explicit owner approval to switch **only the Valisse platform bank payout schedule** from monthly automatic to Manual. This would stop automatic bank deposits of all platform funds, including Valisse's own earnings; the technician's daily bank payout schedule would remain unchanged. Manual platform payout settings are supported by Stripe but are not automatic segregation, escrow, or a completed technician-payment system. [3]

The owner then needs to replenish the platform **Payments balance**, making at least $1.90 available. Stripe requires a verified funding bank and appropriate dashboard permissions; funding can take business days and some methods or limits depend on the account. Do not enter bank details in chat, debit a bank without approval, or substitute a new client card charge. [4]

After funds are available, independently recheck booking/payment/customer identity, no dispute/refund, recipient ownership and readiness, amount, and absence of any existing transfer or unresolved transfer attempt. Obtain a separate explicit approval for a **single $1.90 live transfer** to Ashton's verified connected Stripe account. Use a stable, booking-linked idempotency boundary and reconcile its result before marking the booking transferred. A transfer does not prove bank receipt; verify the subsequent connected-account bank payout separately.

Do not enable the batch operations worker or SMS as a side effect of this one-payment recovery. Production financial execution still requires deadline, reconciliation and approval work recorded in the project tracker.

## Safe application changes in this checkpoint

Technician payout history now distinguishes an active review window from an expired window awaiting a Stripe transfer. It labels recorded transfers as “Transferred to Stripe,” not “Paid out,” and requires a safe derived transfer-evidence flag without exposing Stripe identifiers. Bank receipt is not inferred from that flag.

Administrator Operations now provides a read-only, environment-scoped view of the platform USD balance and bank payout schedule. It warns when automatic platform bank payouts can consume unpaid technician funds or when overdue transfers coexist with an empty available balance. Failed provider reads are shown as unknown, not zero; monitoring does not change payout settings or move money.

These presentation and monitoring fixes require publishing their checkpoint. They do not recover the outstanding funds on their own.

## References

[1]: https://docs.stripe.com/connect/separate-charges-and-transfers.md?platform=web&integration=custom&ui=elements&api-integration=paymentintents "Stripe separate charges and transfers with PaymentIntents"
[2]: https://stripe.dev/blog/fund-segregation-stripe-connect "Stripe pooled funds and automatic payout risk"
[3]: https://docs.stripe.com/payouts "Stripe bank payout schedules"
[4]: https://docs.stripe.com/connect/top-ups "Stripe platform Payments balance funding"

## Subsequent update — November 11, 2026 UTC

The specifically approved **platform-only** bank payout setting has been changed to **Manual** and read back from Stripe; Ashton’s connected-account bank payout schedule remains **daily**. No account funding, refund, waiver, or corrective transfer for booking #1920002 has been performed. The old $1.90 entitlement remains recorded as awaiting transfer, rather than being falsely marked paid out.

A separate [future-only automatic payout implementation](future-automatic-payouts.md) has now been built and tested. It requires publication and explicit activation, fixes a new capture cutoff at that activation, and excludes this historical payment. Processing fees and insufficient available balance can still defer otherwise eligible future transfers.
