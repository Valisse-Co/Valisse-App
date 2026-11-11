# Valisse operations launch handoff

## Implemented

Settings → Administrator → Operations opens a private monitoring workspace. Production queues exclude QA appointments; QA Preview shows only QA-marked appointments. Counts cover the full matching queue, while each list shows at most 20 items. Service and appointment-fee payouts are both represented. Administrator access is enforced on the server, and the page has no charge, transfer, retry, or Run Now mutation.

The scheduled endpoint remains `POST /api/scheduled/release-payouts`. It now requires an authenticated platform cron identity with a matching app/project, registered task UID, environment, enabled registry row, and callback path. Request bodies cannot choose identity, environment, execution policy, or financial mode. Runs have durable, three-minute transaction leases and sanitized result history. Expired or superseded completions cannot claim success.

The safe default is `observe_only`. This records eligible counts and job telemetry without calling Stripe, Telnyx or Resend, creating fee cases, sending notifications, or changing bookings. Database/schema inspection, mocked-worker tests, and one disposable real-database concurrency test do not constitute production heartbeat verification.

## Current evidence

On November 7, 2026, the project-owner Heartbeat listing returned zero jobs. This is evidence about the owner's native jobs, not proof that every possible end-user task was examined. The dashboard showed one non-QA overdue payout and one unresolved dispute; neither was acted on. Telnyx's read-only profile health test still returned HTTP 401. Resend configuration and delivery are deferred to the owner.

On November 10, after the owner published checkpoint `0ed66445`, the observation-only native job was registered and verified:

- Task UID: `PDkkXRNtZ8AFAAJDaPMX7G`; name `valisse-appointments-observe`; enabled cadence `0 */5 * * * *` (every five minutes).
- Automatic (not manually triggered) production delivery returned HTTP 200, status success, one attempt, completed at `2026-11-11T01:42:54.304Z` (November 10, 6:42:54 PM MST).
- Application run ID `be3ebec6-4419-40a0-9e23-3fb5950e092a` matched the native response body; native run UID `ZrWTyZ2DHWcbAMLTQqLTuL`.
- Production mode was `observe_only`: payout and appointment-code steps were `observed`; attendance-fee processing was `skipped`. Counts: one overdue payout, zero failed transfers, zero payments due, one unresolved dispute, and one appointment-code SMS awaiting delivery.
- No charges, transfers, SMS/email, booking changes, or fee creation ran. The production execution approval flag remained disabled. This verifies observation delivery only, not financial execution or bank payout readiness.

The existing job is now enabled. Future work must inspect/update this exact UID rather than creating a duplicate. The first delivery arrived later than the initial advertised cron time; this is not a real-time delivery guarantee.

## Production verification sequence

1. The owner publishes the final operations checkpoint through the website's Publish control. Do not create a cron before this: Heartbeat targets the deployed website, not the development preview.
2. Recheck the production endpoint with an unauthenticated POST. The updated endpoint should reject it with HTTP 403 and `{ "ok": false, "error": "cron-only" }`. Confirm the deployed admin Operations page exists and reports no verified production callback yet. Do not use a fake admin login or an ordinary user's cookie to trigger a worker.
3. Re-list project-owned Heartbeat jobs. If an existing relevant job appears, inspect it by its actual task UID rather than creating a duplicate. Check that the production operations registry is observation-only. Do not replace an existing task or policy silently.
4. If no job exists, create the intended native HTTP job after deployment:

   ```bash
   manus-heartbeat create \
     --name valisse-appointments-observe \
     --cron "0 */5 * * * *" \
     --path /api/scheduled/release-payouts \
     --description "Valisse launch verification: read-only observations, no financial or messaging actions"
   ```

   Creation enables the provider job; no pause-by-default option is assumed. Immediately bind the returned authenticated task UID to the production business registry using `bindOperationsSchedule` in `server/operationsDb.ts`, preserving `executionMode=observe_only`. Persist inspected enabled/cron/provider timestamp metadata. Unbound deliveries are rejected, not executed. Keep the actual UID for future inspection, update, and pause; never identify business work from payload fields or job names.
5. Inspect the actual native job's logs after its first scheduled delivery. Verify a matching durable production run in Operations, `executionMode=observe_only`, completed status, count-only results, and no business-provider or booking mutations. Provider scheduling metadata alone is not success evidence. A recent observation should show **Observation verified**, never **Execution verified**.
6. Keep financial and messaging execution disabled unless the owner separately approves it. Enabling would require both a trusted `executionMode=execute` registry policy and `VALISSE_OPERATIONS_EXECUTION_APPROVED=true` in the production environment. Neither was enabled during this task. Do not resume or run financial jobs merely to make a dashboard look healthy.

## Remaining checks before execution activation

Bounded worker batches and transaction leases are in place, but provider and database await chains still need an end-to-end deadline review before money/SMS processing is enabled. The existing Stripe/Telnyx request chains can exceed the platform's two-minute callback limit; an outer Promise timeout would not safely cancel money movement and is not used. Implement provider-level timeout/retry budgets and test slow responses before approving automated financial execution.

Automatic workers exclude QA data and retain retryable payouts instead of marking them permanently failed after transient provider errors. Stable Stripe idempotency keys remain unchanged. Transfer success followed by a local bookkeeping failure is reported as reconciliation-needed/deferred, not as proof that no transfer happened. Technician confirmation is still required for eligible late/no-show fee charges.

Review unresolved disputes with both parties through Reports & disputes. The existing report resolution workflow—not this monitoring page—controls refunds and payout release. Perform any real payment-to-bank validation only with explicit approval, a small agreed amount, and clear refund expectations. Resend and Telnyx delivery tests remain separate launch milestones.
