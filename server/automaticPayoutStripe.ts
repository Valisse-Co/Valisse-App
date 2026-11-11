import type Stripe from "stripe";
import { calculatePlatformPayout } from "../shared/appointmentLifecycle";
import { STRIPE_ACCOUNTS_V2_API_VERSION } from "../shared/stripeConnectV2";
import { getStripe } from "./stripe";

export type AutomaticPayoutFundingInput = {
  bookingId: number;
  feeEventId?: number;
  kind: "service" | "tip" | "appointment_fee";
  techId: number;
  customerId: string;
  accountId: string;
  paymentIntentId: string;
  grossInCents: number;
  amountInCents: number;
  cutoff: Date;
  now: Date;
};

export type AutomaticTransferLeg = {
  id: string;
  bookingId: number;
  feeEventId?: number | null;
  kind: AutomaticPayoutFundingInput["kind"];
  customerId: string;
  techId: number;
  destinationAccountId: string;
  paymentIntentId: string;
  chargeId: string;
  amountInCents: number;
  grossInCents: number;
  mode: "live";
  firstAttemptAt: Date | null;
};

export type AutomaticPayoutPreflightCode =
  | "invalid_input"
  | "platform_mismatch"
  | "platform_payouts_automatic"
  | "payment_mismatch"
  | "recipient_mismatch"
  | "recipient_not_ready"
  | "refunded_or_disputed"
  | "historical_payment"
  | "not_settled"
  | "insufficient_balance"
  | "provider_unavailable"
  | "reconciliation_required";

const ERROR_POLICY: Record<
  AutomaticPayoutPreflightCode,
  { retryAllowed: boolean; message: string }
> = {
  invalid_input: {
    retryAllowed: false,
    message: "Automatic payout input is invalid.",
  },
  platform_mismatch: {
    retryAllowed: false,
    message: "The authenticated Stripe platform could not be verified.",
  },
  platform_payouts_automatic: {
    retryAllowed: false,
    message: "Platform payout settings must be verified as manual.",
  },
  payment_mismatch: {
    retryAllowed: false,
    message: "The live captured payment does not match this payout.",
  },
  recipient_mismatch: {
    retryAllowed: false,
    message: "The live recipient does not match this technician.",
  },
  recipient_not_ready: {
    retryAllowed: true,
    message: "The recipient cannot currently receive Stripe transfers.",
  },
  refunded_or_disputed: {
    retryAllowed: false,
    message: "An unrefunded, undisputed charge could not be verified.",
  },
  historical_payment: {
    retryAllowed: false,
    message: "The charge was captured before automatic payout eligibility.",
  },
  not_settled: {
    retryAllowed: true,
    message: "The captured charge is not yet available for transfer.",
  },
  insufficient_balance: {
    retryAllowed: true,
    message: "The available USD platform balance cannot fund this transfer.",
  },
  provider_unavailable: {
    retryAllowed: true,
    message: "Stripe verification is temporarily unavailable.",
  },
  reconciliation_required: {
    retryAllowed: false,
    message: "Transfer reconciliation is required before any further dispatch.",
  },
};

/** Safe, closed error vocabulary: never attach/log a provider response or error payload. */
export class AutomaticPayoutPreflightError extends Error {
  readonly retryAllowed: boolean;
  readonly reconciliationRequired: boolean;

  constructor(readonly code: AutomaticPayoutPreflightCode) {
    super(ERROR_POLICY[code].message);
    this.name = "AutomaticPayoutPreflightError";
    this.retryAllowed = ERROR_POLICY[code].retryAllowed;
    this.reconciliationRequired = code === "reconciliation_required";
  }
}

export type AutomaticPayoutFundingResult = {
  chargeId: string;
  /** Actual capture evidence: the charge balance transaction's creation, NOT PI creation. */
  chargeCapturedAt: Date;
  settledAt: Date;
  balanceTransactionId: string;
  netFundingInCents: number;
  availableUsdInCents: number;
  platformAccountId: string;
};

const REQUEST_OPTIONS = Object.freeze({ timeout: 5_000, maxNetworkRetries: 0 });
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1_000;

function fail(code: AutomaticPayoutPreflightCode): never {
  throw new AutomaticPayoutPreflightError(code);
}

async function readProvider<T>(operation: () => PromiseLike<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    // A failed read is not evidence of zero balance, no transfers, or successful billing.
    return fail("provider_unavailable");
  }
}

function liveStripe(): Stripe {
  try {
    return getStripe("live");
  } catch {
    return fail("provider_unavailable");
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validDate(value: unknown): value is Date {
  return (
    value instanceof Date &&
    Number.isFinite(value.getTime()) &&
    value.getTime() > 0
  );
}

function validId(value: unknown, prefix: string): value is string {
  return (
    typeof value === "string" &&
    new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value)
  );
}

function objectId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  )
    return value.id;
  return undefined;
}

function validateAmounts(input: {
  bookingId: number;
  techId: number;
  feeEventId?: number | null;
  kind: AutomaticPayoutFundingInput["kind"];
  grossInCents: number;
  amountInCents: number;
}) {
  if (
    !isPositiveInteger(input.bookingId) ||
    !isPositiveInteger(input.techId) ||
    !isPositiveInteger(input.grossInCents) ||
    !isPositiveInteger(input.amountInCents) ||
    !["service", "tip", "appointment_fee"].includes(input.kind) ||
    (input.feeEventId != null && !isPositiveInteger(input.feeEventId)) ||
    (input.kind === "appointment_fee"
      ? !isPositiveInteger(input.feeEventId)
      : input.feeEventId != null)
  )
    fail("invalid_input");
  const expectedAmount =
    input.kind === "service"
      ? calculatePlatformPayout(input.grossInCents).techPayoutInCents
      : input.grossInCents;
  if (input.amountInCents !== expectedAmount) fail("invalid_input");
}

function validateLeg(leg: AutomaticTransferLeg) {
  validateAmounts(leg);
  if (
    typeof leg.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(leg.id) ||
    leg.mode !== "live" ||
    !validId(leg.customerId, "cus") ||
    !validId(leg.destinationAccountId, "acct") ||
    !validId(leg.paymentIntentId, "pi") ||
    !validId(leg.chargeId, "ch") ||
    (leg.firstAttemptAt !== null &&
      (!validDate(leg.firstAttemptAt) ||
        leg.firstAttemptAt.getTime() > Date.now()))
  )
    fail("invalid_input");
}

async function verifyPlatform(
  stripe: Stripe,
  recipientAccountId: string
): Promise<string> {
  // No stripeAccount/stripeContext override: both reads target the platform authenticated
  // by getStripe('live'). This derives its identity from configuration, never an app user ID.
  const [platform, settings] = await Promise.all([
    readProvider(() => stripe.accounts.retrieveCurrent({}, REQUEST_OPTIONS)),
    readProvider(() => stripe.balanceSettings.retrieve({}, REQUEST_OPTIONS)),
  ]);
  if (
    platform?.object !== "account" ||
    !validId(platform.id, "acct") ||
    platform.id === recipientAccountId
  ) {
    fail("platform_mismatch");
  }
  if (
    settings?.object !== "balance_settings" ||
    settings.payments?.payouts?.schedule?.interval !== "manual"
  ) {
    fail("platform_payouts_automatic");
  }
  return platform.id;
}

async function availableUsdBalance(
  stripe: Stripe,
  amountInCents: number
): Promise<number> {
  const balance = await readProvider(() =>
    stripe.balance.retrieve({}, REQUEST_OPTIONS)
  );
  if (
    balance?.object !== "balance" ||
    balance.livemode !== true ||
    !Array.isArray(balance.available)
  ) {
    fail("payment_mismatch");
  }
  let available = 0;
  for (const item of balance.available) {
    if (
      !item ||
      typeof item.currency !== "string" ||
      !Number.isSafeInteger(item.amount)
    )
      fail("payment_mismatch");
    if (item.currency === "usd") available += item.amount;
  }
  if (!Number.isSafeInteger(available)) fail("payment_mismatch");
  if (available < amountInCents) fail("insufficient_balance");
  return available;
}

/** Read-only preflight. The caller owns the dispute window, dispatch ledger, and cutoff configuration. */
export async function verifyAutomaticPayoutFunding(
  input: AutomaticPayoutFundingInput
): Promise<AutomaticPayoutFundingResult> {
  validateAmounts(input);
  if (
    !validId(input.customerId, "cus") ||
    !validId(input.accountId, "acct") ||
    !validId(input.paymentIntentId, "pi") ||
    !validDate(input.cutoff) ||
    !validDate(input.now) ||
    input.cutoff.getTime() > input.now.getTime()
  )
    fail("invalid_input");
  const stripe = liveStripe();
  const platformAccountId = await verifyPlatform(stripe, input.accountId);
  const [intent, recipient] = await Promise.all([
    readProvider(() =>
      stripe.paymentIntents.retrieve(
        input.paymentIntentId,
        {
          expand: ["latest_charge.balance_transaction"],
        },
        REQUEST_OPTIONS
      )
    ),
    readProvider(() =>
      stripe.v2.core.accounts.retrieve(
        input.accountId,
        {
          include: ["configuration.recipient"],
        },
        { ...REQUEST_OPTIONS, apiVersion: STRIPE_ACCOUNTS_V2_API_VERSION }
      )
    ),
  ]);
  const expectedKind =
    input.kind === "service" ? "service_completion" : input.kind;
  if (
    intent?.object !== "payment_intent" ||
    intent.id !== input.paymentIntentId ||
    intent.livemode !== true ||
    intent.status !== "succeeded" ||
    intent.currency !== "usd" ||
    objectId(intent.customer) !== input.customerId ||
    intent.amount !== input.grossInCents ||
    intent.amount_received !== input.grossInCents ||
    intent.metadata?.booking_id !== String(input.bookingId) ||
    intent.metadata?.kind !== expectedKind ||
    (input.feeEventId != null
      ? intent.metadata?.fee_event_id !== String(input.feeEventId)
      : intent.metadata?.fee_event_id !== undefined)
  )
    fail("payment_mismatch");

  const charge = intent.latest_charge;
  if (
    !charge ||
    typeof charge === "string" ||
    charge.object !== "charge" ||
    !validId(charge.id, "ch") ||
    objectId(charge.payment_intent) !== input.paymentIntentId ||
    objectId(charge.customer) !== input.customerId ||
    charge.captured !== true ||
    charge.paid !== true ||
    charge.livemode !== true ||
    charge.currency !== "usd" ||
    charge.amount !== input.grossInCents ||
    charge.amount_captured !== input.grossInCents
  )
    fail("payment_mismatch");
  if (
    charge.refunded !== false ||
    charge.amount_refunded !== 0 ||
    charge.disputed !== false
  )
    fail("refunded_or_disputed");

  const transaction = charge.balance_transaction;
  if (
    !transaction ||
    typeof transaction === "string" ||
    transaction.object !== "balance_transaction" ||
    !validId(transaction.id, "txn") ||
    objectId(transaction.source) !== charge.id ||
    transaction.currency !== "usd" ||
    transaction.amount !== input.grossInCents ||
    !isPositiveInteger(transaction.net) ||
    !isPositiveInteger(transaction.created) ||
    !isPositiveInteger(transaction.available_on)
  )
    fail("payment_mismatch");
  const chargeCapturedAt = new Date(transaction.created * 1_000);
  const settledAt = new Date(transaction.available_on * 1_000);
  if (
    !validDate(chargeCapturedAt) ||
    !validDate(settledAt) ||
    chargeCapturedAt > input.now
  )
    fail("payment_mismatch");
  if (chargeCapturedAt < input.cutoff) fail("historical_payment");
  if (settledAt < chargeCapturedAt) fail("payment_mismatch");
  if (
    transaction.status === "pending" ||
    (transaction.status === "available" && settledAt > input.now)
  )
    fail("not_settled");
  if (transaction.status !== "available") fail("payment_mismatch");

  if (
    recipient?.object !== "v2.core.account" ||
    recipient.id !== input.accountId ||
    recipient.livemode !== true ||
    recipient.closed === true ||
    recipient.id === platformAccountId ||
    recipient.metadata?.valisse_tech_id !== String(input.techId)
  )
    fail("recipient_mismatch");
  const transferStatus =
    recipient.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status;
  if (typeof transferStatus !== "string") fail("recipient_mismatch");
  if (transferStatus !== "active") fail("recipient_not_ready");

  // Stripe's actual net is evidence of funding, not the amount owed to the tech.
  // Do not deduct processing fees or require this one charge's net to cover the leg.
  const availableUsdInCents = await availableUsdBalance(
    stripe,
    input.amountInCents
  );
  return {
    chargeId: charge.id,
    chargeCapturedAt,
    settledAt,
    balanceTransactionId: transaction.id,
    netFundingInCents: transaction.net,
    availableUsdInCents,
    platformAccountId,
  };
}

function automaticGroup(leg: AutomaticTransferLeg): string {
  return `valisse_auto_${leg.id}`;
}

function legacyGroup(leg: AutomaticTransferLeg): string {
  return leg.kind === "appointment_fee"
    ? `valisse_fee_event_${leg.feeEventId}`
    : `valisse_booking_${leg.bookingId}`;
}

async function listCompleteGroup(
  stripe: Stripe,
  group: string
): Promise<Stripe.Transfer[]> {
  const transfers: Stripe.Transfer[] = [];
  const seen = new Set<string>();
  let startingAfter: string | undefined;
  // At most two explicitly bounded pages per group. Never assume a truncated list is empty.
  for (let pageNumber = 0; pageNumber < 2; pageNumber++) {
    const page = await readProvider(() =>
      stripe.transfers.list(
        {
          transfer_group: group,
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        },
        REQUEST_OPTIONS
      )
    );
    if (
      !page ||
      !Array.isArray(page.data) ||
      page.data.length > 100 ||
      typeof page.has_more !== "boolean"
    ) {
      fail("reconciliation_required");
    }
    for (const transfer of page.data) {
      if (
        !transfer ||
        !validId(transfer.id, "tr") ||
        seen.has(transfer.id) ||
        transfer.transfer_group !== group
      ) {
        fail("reconciliation_required");
      }
      seen.add(transfer.id);
      transfers.push(transfer);
    }
    if (!page.has_more) return transfers;
    if (!page.data.length) fail("reconciliation_required");
    startingAfter = page.data[page.data.length - 1].id;
  }
  return fail("reconciliation_required");
}

function matchesTransfer(
  transfer: Stripe.Transfer,
  leg: AutomaticTransferLeg,
  automatic: boolean
): boolean {
  const metadata = transfer.metadata;
  return (
    transfer.object === "transfer" &&
    validId(transfer.id, "tr") &&
    transfer.transfer_group ===
      (automatic ? automaticGroup(leg) : legacyGroup(leg)) &&
    objectId(transfer.destination) === leg.destinationAccountId &&
    objectId(transfer.source_transaction) === leg.chargeId &&
    transfer.amount === leg.amountInCents &&
    transfer.currency === "usd" &&
    transfer.livemode === true &&
    transfer.reversed === false &&
    transfer.amount_reversed === 0 &&
    metadata?.booking_id === String(leg.bookingId) &&
    metadata?.kind === `${leg.kind}_payout` &&
    (leg.feeEventId != null
      ? metadata?.fee_event_id === String(leg.feeEventId)
      : metadata?.fee_event_id === undefined) &&
    (automatic
      ? metadata?.payout_leg_id === leg.id &&
        metadata?.payment_intent_id === leg.paymentIntentId
      : (metadata?.payout_leg_id === undefined ||
          metadata.payout_leg_id === leg.id) &&
        (metadata?.payment_intent_id === undefined ||
          metadata.payment_intent_id === leg.paymentIntentId))
  );
}

function assertAttemptNotExpired(leg: AutomaticTransferLeg) {
  if (
    leg.firstAttemptAt &&
    Date.now() - leg.firstAttemptAt.getTime() >= IDEMPOTENCY_WINDOW_MS
  ) {
    fail("reconciliation_required");
  }
}

/** Returns a verified existing transfer or null. Any uncertainty forbids a new dispatch. */
export async function lookupAutomaticPayoutTransfer(
  leg: AutomaticTransferLeg
): Promise<Stripe.Transfer | null> {
  validateLeg(leg);
  const stripe = liveStripe();
  const automatic = await listCompleteGroup(stripe, automaticGroup(leg));
  const legacy = await listCompleteGroup(stripe, legacyGroup(leg));
  if (automatic.some(transfer => !matchesTransfer(transfer, leg, true)))
    fail("reconciliation_required");
  const relevantLegacy = legacy.filter(transfer => {
    // Same source with wrong/missing kind, or same kind with wrong source, is unsafe.
    // Other well-identified legs (e.g. the service beside a tip) are unrelated.
    if (
      typeof transfer.metadata?.kind !== "string" ||
      !validId(objectId(transfer.source_transaction), "ch")
    ) {
      fail("reconciliation_required");
    }
    return (
      objectId(transfer.source_transaction) === leg.chargeId ||
      transfer.metadata.kind === `${leg.kind}_payout`
    );
  });
  if (relevantLegacy.some(transfer => !matchesTransfer(transfer, leg, false)))
    fail("reconciliation_required");
  const candidates = [...automatic, ...relevantLegacy];
  if (candidates.length > 1) fail("reconciliation_required");
  if (candidates.length === 1) return candidates[0];
  // Stripe may forget idempotency keys after 24h. An empty list is NOT permission
  // to re-dispatch an older ambiguous ledger attempt, even with the original key.
  assertAttemptNotExpired(leg);
  return null;
}

/**
 * Caller MUST persist this one leg's dispatch/firstAttemptAt in its ledger before
 * calling, and must successfully run verifyAutomaticPayoutFunding for its cutoff
 * and current eligibility. The caller persists the returned transfer per leg.
 * This helper never updates a booking, a ledger, an account, or a bank payout.
 */
export async function createAutomaticPayoutTransfer(
  leg: AutomaticTransferLeg,
  dispatchDeadlineAt = Date.now() + 25_000
): Promise<Stripe.Transfer> {
  const checkDispatchDeadline = () => {
    if (!Number.isFinite(dispatchDeadlineAt) || Date.now() >= dispatchDeadlineAt) fail("provider_unavailable");
  };
  validateLeg(leg);
  if (leg.firstAttemptAt === null) fail("invalid_input");
  checkDispatchDeadline();
  const existing = await lookupAutomaticPayoutTransfer(leg);
  if (existing) return existing;
  checkDispatchDeadline();
  assertAttemptNotExpired(leg);
  const stripe = liveStripe();
  // Fresh available funds for THIS leg, not the total of all future queued legs.
  await verifyPlatform(stripe, leg.destinationAccountId);
  checkDispatchDeadline();
  await availableUsdBalance(stripe, leg.amountInCents);
  checkDispatchDeadline();
  assertAttemptNotExpired(leg);
  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe.transfers.create(
      {
        amount: leg.amountInCents,
        currency: "usd",
        destination: leg.destinationAccountId,
        source_transaction: leg.chargeId,
        transfer_group: automaticGroup(leg),
        metadata: {
          booking_id: String(leg.bookingId),
          ...(leg.feeEventId != null
            ? { fee_event_id: String(leg.feeEventId) }
            : {}),
          kind: `${leg.kind}_payout`,
          payout_leg_id: leg.id,
          payment_intent_id: leg.paymentIntentId,
        },
      },
      { ...REQUEST_OPTIONS, idempotencyKey: automaticGroup(leg) }
    );
  } catch {
    // Timeout/network/provider failure after dispatch may still have created money
    // movement. Reconcile through the ledger; do not turn it into a blind retry.
    return fail("reconciliation_required");
  }
  if (!transfer || !matchesTransfer(transfer, leg, true))
    fail("reconciliation_required");
  return transfer;
}
