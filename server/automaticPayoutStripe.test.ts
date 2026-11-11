import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STRIPE_ACCOUNTS_V2_API_VERSION } from "../shared/stripeConnectV2";
import { calculatePlatformPayout } from "../shared/appointmentLifecycle";

// Mock BOTH the factory module and SDK: no real Stripe client can be constructed,
// no matter what live credentials happen to be present in the test environment.
const mocks = vi.hoisted(() => ({
  getStripe: vi.fn(),
  currentAccount: vi.fn(),
  balanceSettings: vi.fn(),
  paymentIntent: vi.fn(),
  recipient: vi.fn(),
  balance: vi.fn(),
  listTransfers: vi.fn(),
  createTransfer: vi.fn(),
  sdkConstructor: vi.fn(() => {
    throw new Error("Actual Stripe is forbidden in unit tests");
  }),
}));
vi.mock("./stripe", () => ({ getStripe: mocks.getStripe }));
vi.mock("stripe", () => ({ default: mocks.sdkConstructor }));

import {
  AutomaticPayoutPreflightError,
  createAutomaticPayoutTransfer,
  lookupAutomaticPayoutTransfer,
  verifyAutomaticPayoutFunding,
  type AutomaticPayoutFundingInput,
  type AutomaticTransferLeg,
  type AutomaticPayoutPreflightCode,
} from "./automaticPayoutStripe";

const NOW = new Date("2026-11-12T12:00:00Z");
const CUTOFF = new Date("2026-11-10T12:00:00Z");
const CAPTURED_AT = new Date("2026-11-10T13:00:00Z");
const SETTLED_AT = new Date("2026-11-11T12:00:00Z");
const seconds = (date: Date) => date.getTime() / 1_000;
const options = { timeout: 5_000, maxNetworkRetries: 0 };

const input: AutomaticPayoutFundingInput = {
  bookingId: 101,
  kind: "service",
  techId: 202,
  customerId: "cus_MOCKCUSTOMER",
  accountId: "acct_MOCKRECIPIENT",
  paymentIntentId: "pi_MOCKPAYMENT",
  grossInCents: 200,
  amountInCents: 190,
  cutoff: CUTOFF,
  now: NOW,
};

const leg: AutomaticTransferLeg = {
  id: "mock-leg-101-service",
  bookingId: input.bookingId,
  kind: input.kind,
  customerId: input.customerId,
  techId: input.techId,
  destinationAccountId: input.accountId,
  paymentIntentId: input.paymentIntentId,
  chargeId: "ch_MOCKCHARGE",
  grossInCents: input.grossInCents,
  amountInCents: input.amountInCents,
  mode: "live",
  firstAttemptAt: new Date(NOW.getTime() - 1_000),
};

let payment: any;
let recipient: any;
let platform: any;
let settings: any;
let balance: any;
let groups: Record<string, any>;

function paymentFixture(funding: AutomaticPayoutFundingInput = input): any {
  return {
    id: funding.paymentIntentId,
    object: "payment_intent",
    livemode: true,
    status: "succeeded",
    currency: "usd",
    customer: funding.customerId,
    amount: funding.grossInCents,
    amount_received: funding.grossInCents,
    // Intentionally older: a pre-existing PI may legitimately be captured in the future.
    created: seconds(new Date("2026-10-01T12:00:00Z")),
    metadata: {
      booking_id: String(funding.bookingId),
      kind: funding.kind === "service" ? "service_completion" : funding.kind,
      ...(funding.feeEventId != null
        ? { fee_event_id: String(funding.feeEventId) }
        : {}),
    },
    latest_charge: {
      id: leg.chargeId,
      object: "charge",
      payment_intent: funding.paymentIntentId,
      customer: funding.customerId,
      captured: true,
      paid: true,
      livemode: true,
      currency: "usd",
      amount: funding.grossInCents,
      amount_captured: funding.grossInCents,
      refunded: false,
      amount_refunded: 0,
      disputed: false,
      // Charge creation can also predate actual capture.
      created: seconds(new Date("2026-10-01T12:00:00Z")),
      balance_transaction: {
        object: "balance_transaction",
        id: "txn_MOCKBALANCE",
        source: leg.chargeId,
        currency: "usd",
        amount: funding.grossInCents,
        fee: 36,
        net: 164,
        created: seconds(CAPTURED_AT),
        available_on: seconds(SETTLED_AT),
        status: "available",
      },
    },
  };
}

function transferFixture(
  payoutLeg: AutomaticTransferLeg = leg,
  legacy = false
): any {
  return {
    id: "tr_MOCKTRANSFER",
    object: "transfer",
    amount: payoutLeg.amountInCents,
    currency: "usd",
    destination: payoutLeg.destinationAccountId,
    source_transaction: payoutLeg.chargeId,
    livemode: true,
    reversed: false,
    amount_reversed: 0,
    transfer_group: legacy
      ? payoutLeg.kind === "appointment_fee"
        ? `valisse_fee_event_${payoutLeg.feeEventId}`
        : `valisse_booking_${payoutLeg.bookingId}`
      : `valisse_auto_${payoutLeg.id}`,
    metadata: {
      booking_id: String(payoutLeg.bookingId),
      ...(payoutLeg.feeEventId != null
        ? { fee_event_id: String(payoutLeg.feeEventId) }
        : {}),
      kind: `${payoutLeg.kind}_payout`,
      ...(!legacy
        ? {
            payout_leg_id: payoutLeg.id,
            payment_intent_id: payoutLeg.paymentIntentId,
          }
        : {}),
    },
  };
}

function putGroup(transfer: any) {
  groups[transfer.transfer_group] = { data: [transfer], has_more: false };
}

async function expectCode(
  promise: Promise<unknown>,
  code: AutomaticPayoutPreflightCode,
  retryAllowed = false
) {
  await expect(promise).rejects.toBeInstanceOf(AutomaticPayoutPreflightError);
  await expect(promise).rejects.toMatchObject({
    code,
    retryAllowed,
    reconciliationRequired: code === "reconciliation_required",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  groups = {};
  payment = paymentFixture();
  recipient = {
    id: input.accountId,
    object: "v2.core.account",
    livemode: true,
    metadata: { valisse_tech_id: String(input.techId) },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: { stripe_transfers: { status: "active" } },
        },
      },
    },
  };
  platform = { object: "account", id: "acct_MOCKPLATFORM" };
  settings = {
    object: "balance_settings",
    payments: { payouts: { schedule: { interval: "manual" } } },
  };
  balance = {
    object: "balance",
    livemode: true,
    available: [{ currency: "usd", amount: 190 }],
  };
  mocks.getStripe.mockReturnValue({
    accounts: { retrieveCurrent: mocks.currentAccount },
    balanceSettings: { retrieve: mocks.balanceSettings },
    paymentIntents: { retrieve: mocks.paymentIntent },
    v2: { core: { accounts: { retrieve: mocks.recipient } } },
    balance: { retrieve: mocks.balance },
    transfers: { list: mocks.listTransfers, create: mocks.createTransfer },
  });
  mocks.currentAccount.mockImplementation(async () => platform);
  mocks.balanceSettings.mockImplementation(async () => settings);
  mocks.paymentIntent.mockImplementation(async () => payment);
  mocks.recipient.mockImplementation(async () => recipient);
  mocks.balance.mockImplementation(async () => balance);
  mocks.listTransfers.mockImplementation(
    async (params: any) =>
      groups[params.transfer_group] ?? { data: [], has_more: false }
  );
  mocks.createTransfer.mockImplementation(async () => transferFixture());
});

afterEach(() => {
  // This assertion runs for every case, including provider failures and dispatch tests.
  expect(mocks.sdkConstructor).not.toHaveBeenCalled();
  for (const call of mocks.getStripe.mock.calls) expect(call).toEqual(["live"]);
  vi.useRealTimers();
});

describe("future live funding evidence", () => {
  it("pays a 200-cent service as 190 cents despite 164-cent net, with exact capture evidence", async () => {
    expect(await verifyAutomaticPayoutFunding(input)).toEqual({
      chargeId: leg.chargeId,
      chargeCapturedAt: CAPTURED_AT,
      settledAt: SETTLED_AT,
      balanceTransactionId: "txn_MOCKBALANCE",
      netFundingInCents: 164,
      availableUsdInCents: 190,
      platformAccountId: platform.id,
    });
    expect(mocks.currentAccount).toHaveBeenCalledWith({}, options);
    expect(mocks.balanceSettings).toHaveBeenCalledWith({}, options);
    expect(mocks.paymentIntent).toHaveBeenCalledWith(
      input.paymentIntentId,
      { expand: ["latest_charge.balance_transaction"] },
      options
    );
    expect(mocks.recipient).toHaveBeenCalledWith(
      input.accountId,
      { include: ["configuration.recipient"] },
      {
        ...options,
        apiVersion: STRIPE_ACCOUNTS_V2_API_VERSION,
      }
    );
    expect(mocks.balance).toHaveBeenCalledWith({}, options);
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("accepts capture exactly at cutoff even though PI and charge creation predate it", async () => {
    payment.latest_charge.balance_transaction.created = seconds(CUTOFF);
    await expect(verifyAutomaticPayoutFunding(input)).resolves.toMatchObject({
      chargeCapturedAt: CUTOFF,
    });
  });

  it("rejects historical capture even if the PI creation is newer", async () => {
    payment.created = seconds(NOW);
    payment.latest_charge.balance_transaction.created = seconds(CUTOFF) - 1;
    await expectCode(verifyAutomaticPayoutFunding(input), "historical_payment");
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it.each([1, 9, 10, 11, 199, 200, 201, 9999])(
    "keeps the existing fee-first service rounding for gross %i",
    async grossInCents => {
      const funding = {
        ...input,
        grossInCents,
        amountInCents: calculatePlatformPayout(grossInCents).techPayoutInCents,
      };
      payment = paymentFixture(funding);
      balance.available[0].amount = funding.amountInCents;
      await expect(
        verifyAutomaticPayoutFunding(funding)
      ).resolves.toHaveProperty("chargeId", leg.chargeId);
    }
  );

  it.each(["tip", "appointment_fee"] as const)(
    "transfers %s in full without deducting Stripe fees",
    async kind => {
      const funding = {
        ...input,
        kind,
        amountInCents: 200,
        ...(kind === "appointment_fee" ? { feeEventId: 303 } : {}),
      };
      payment = paymentFixture(funding);
      balance.available[0].amount = 200;
      await expect(
        verifyAutomaticPayoutFunding(funding)
      ).resolves.toMatchObject({ netFundingInCents: 164 });
      await expectCode(
        verifyAutomaticPayoutFunding({ ...funding, amountInCents: 190 }),
        "invalid_input"
      );
    }
  );

  it.each([
    [
      "wrong PI identity",
      (p: any) => {
        p.id = "pi_WRONG";
      },
    ],
    [
      "wrong customer",
      (p: any) => {
        p.customer = "cus_WRONG";
      },
    ],
    [
      "missing customer",
      (p: any) => {
        delete p.customer;
      },
    ],
    [
      "wrong booking",
      (p: any) => {
        p.metadata.booking_id = "102";
      },
    ],
    [
      "missing booking",
      (p: any) => {
        delete p.metadata.booking_id;
      },
    ],
    [
      "wrong kind",
      (p: any) => {
        p.metadata.kind = "tip";
      },
    ],
    [
      "unexpected fee event",
      (p: any) => {
        p.metadata.fee_event_id = "303";
      },
    ],
    [
      "wrong currency",
      (p: any) => {
        p.currency = "eur";
      },
    ],
    [
      "test mode",
      (p: any) => {
        p.livemode = false;
      },
    ],
    [
      "unknown mode",
      (p: any) => {
        delete p.livemode;
      },
    ],
    [
      "processing payment",
      (p: any) => {
        p.status = "processing";
      },
    ],
    [
      "missing successful billing",
      (p: any) => {
        delete p.status;
      },
    ],
    [
      "wrong gross",
      (p: any) => {
        p.amount = 201;
      },
    ],
    [
      "wrong amount received",
      (p: any) => {
        p.amount_received = 199;
      },
    ],
    [
      "unexpanded charge",
      (p: any) => {
        p.latest_charge = leg.chargeId;
      },
    ],
    [
      "no charge",
      (p: any) => {
        p.latest_charge = null;
      },
    ],
    [
      "charge belongs to another PI",
      (p: any) => {
        p.latest_charge.payment_intent = "pi_WRONG";
      },
    ],
    [
      "charge belongs to another customer",
      (p: any) => {
        p.latest_charge.customer = "cus_WRONG";
      },
    ],
    [
      "paid false",
      (p: any) => {
        p.latest_charge.paid = false;
      },
    ],
    [
      "paid missing",
      (p: any) => {
        delete p.latest_charge.paid;
      },
    ],
    [
      "not captured",
      (p: any) => {
        p.latest_charge.captured = false;
      },
    ],
    [
      "charge test mode",
      (p: any) => {
        p.latest_charge.livemode = false;
      },
    ],
    [
      "charge wrong currency",
      (p: any) => {
        p.latest_charge.currency = "cad";
      },
    ],
    [
      "charge wrong gross",
      (p: any) => {
        p.latest_charge.amount = 201;
      },
    ],
    [
      "partial capture",
      (p: any) => {
        p.latest_charge.amount_captured = 199;
      },
    ],
    [
      "source charge mismatch",
      (p: any) => {
        p.latest_charge.balance_transaction.source = "ch_WRONG";
      },
    ],
    [
      "missing balance transaction",
      (p: any) => {
        p.latest_charge.balance_transaction = null;
      },
    ],
    [
      "unexpanded balance transaction",
      (p: any) => {
        p.latest_charge.balance_transaction = "txn_MOCKBALANCE";
      },
    ],
    [
      "wrong balance currency",
      (p: any) => {
        p.latest_charge.balance_transaction.currency = "eur";
      },
    ],
    [
      "wrong balance gross",
      (p: any) => {
        p.latest_charge.balance_transaction.amount = 199;
      },
    ],
    [
      "zero net funding",
      (p: any) => {
        p.latest_charge.balance_transaction.net = 0;
      },
    ],
    [
      "missing net funding",
      (p: any) => {
        delete p.latest_charge.balance_transaction.net;
      },
    ],
    [
      "unknown settlement",
      (p: any) => {
        p.latest_charge.balance_transaction.status = "unknown";
      },
    ],
    [
      "missing settlement",
      (p: any) => {
        delete p.latest_charge.balance_transaction.status;
      },
    ],
    [
      "missing availability timestamp",
      (p: any) => {
        delete p.latest_charge.balance_transaction.available_on;
      },
    ],
    [
      "missing capture timestamp",
      (p: any) => {
        delete p.latest_charge.balance_transaction.created;
      },
    ],
    [
      "future capture",
      (p: any) => {
        p.latest_charge.balance_transaction.created = seconds(NOW) + 1;
      },
    ],
    [
      "settlement before capture",
      (p: any) => {
        p.latest_charge.balance_transaction.available_on =
          seconds(CAPTURED_AT) - 1;
      },
    ],
  ])("rejects %s", async (_label, modify) => {
    (modify as (p: any) => void)(payment);
    await expectCode(verifyAutomaticPayoutFunding(input), "payment_mismatch");
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("accepts expanded customer/PI/source identities", async () => {
    payment.customer = { id: input.customerId };
    payment.latest_charge.customer = { id: input.customerId };
    payment.latest_charge.payment_intent = { id: input.paymentIntentId };
    payment.latest_charge.balance_transaction.source = { id: leg.chargeId };
    await expect(verifyAutomaticPayoutFunding(input)).resolves.toHaveProperty(
      "chargeId",
      leg.chargeId
    );
  });

  it.each([undefined, "304"])(
    "requires the exact appointment fee event (%s)",
    async feeEventId => {
      const funding = {
        ...input,
        kind: "appointment_fee" as const,
        feeEventId: 303,
        amountInCents: 200,
      };
      payment = paymentFixture(funding);
      payment.metadata.fee_event_id = feeEventId;
      await expectCode(
        verifyAutomaticPayoutFunding(funding),
        "payment_mismatch"
      );
    }
  );

  it.each([
    (charge: any) => {
      charge.refunded = true;
    },
    (charge: any) => {
      charge.amount_refunded = 1;
    },
    (charge: any) => {
      charge.disputed = true;
    },
    (charge: any) => {
      delete charge.refunded;
    },
    (charge: any) => {
      delete charge.amount_refunded;
    },
    (charge: any) => {
      delete charge.disputed;
    },
  ])(
    "fails closed for refunded, disputed or unknown charge state",
    async modify => {
      modify(payment.latest_charge);
      await expectCode(
        verifyAutomaticPayoutFunding(input),
        "refunded_or_disputed"
      );
    }
  );

  it.each(["pending", "available_future"])(
    "defers %s settlement without assuming availability",
    async status => {
      payment.latest_charge.balance_transaction.status =
        status === "pending" ? "pending" : "available";
      payment.latest_charge.balance_transaction.available_on = seconds(NOW) + 1;
      await expectCode(
        verifyAutomaticPayoutFunding(input),
        "not_settled",
        true
      );
    }
  );

  it("accepts funds becoming available exactly now", async () => {
    payment.latest_charge.balance_transaction.available_on = seconds(NOW);
    await expect(verifyAutomaticPayoutFunding(input)).resolves.toMatchObject({
      settledAt: NOW,
    });
  });

  it.each([0, 189, -1])(
    "defers insufficient aggregate USD funds (%i)",
    async amount => {
      balance.available = [
        { currency: "usd", amount },
        { currency: "eur", amount: 100_000 },
      ];
      await expectCode(
        verifyAutomaticPayoutFunding(input),
        "insufficient_balance",
        true
      );
    }
  );

  it("sums USD available entries and does not require funds for all future legs", async () => {
    balance.available = [
      { currency: "usd", amount: 100 },
      { currency: "usd", amount: 90 },
    ];
    await expect(verifyAutomaticPayoutFunding(input)).resolves.toMatchObject({
      availableUsdInCents: 190,
    });
  });

  it.each([
    (b: any) => {
      b.livemode = false;
    },
    (b: any) => {
      delete b.available;
    },
    (b: any) => {
      b.available = [{ currency: "usd", amount: "190" }];
    },
    (b: any) => {
      b.available = [{ currency: "usd", amount: Number.NaN }];
    },
  ])("does not convert invalid balance responses to zero", async modify => {
    modify(balance);
    await expectCode(verifyAutomaticPayoutFunding(input), "payment_mismatch");
  });

  it.each(["daily", "weekly", "monthly", "unknown", undefined, null])(
    "requires verified manual platform schedule, not %s",
    async interval => {
      settings.payments.payouts.schedule.interval = interval;
      await expectCode(
        verifyAutomaticPayoutFunding(input),
        "platform_payouts_automatic"
      );
      expect(mocks.paymentIntent).not.toHaveBeenCalled();
    }
  );

  it("does not accept legacy account manual settings in place of current balance settings", async () => {
    platform.settings = { payouts: { schedule: { interval: "manual" } } };
    settings.payments.payouts = null;
    await expectCode(
      verifyAutomaticPayoutFunding(input),
      "platform_payouts_automatic"
    );
  });

  it.each(["recipient", "missing", "invalid"])(
    "verifies the authenticated current platform (%s)",
    async variant => {
      platform.id =
        variant === "recipient"
          ? input.accountId
          : variant === "missing"
            ? undefined
            : "not-an-account";
      await expectCode(
        verifyAutomaticPayoutFunding(input),
        "platform_mismatch"
      );
    }
  );

  it.each([
    (r: any) => {
      r.id = "acct_WRONG";
    },
    (r: any) => {
      r.metadata.valisse_tech_id = "203";
    },
    (r: any) => {
      delete r.metadata;
    },
    (r: any) => {
      r.livemode = false;
    },
    (r: any) => {
      delete r.livemode;
    },
    (r: any) => {
      r.closed = true;
    },
    (r: any) => {
      delete r.configuration;
    },
  ])("rejects mismatched/unknown recipient identity or mode", async modify => {
    modify(recipient);
    await expectCode(verifyAutomaticPayoutFunding(input), "recipient_mismatch");
  });

  it("defers an identified live recipient whose transfers are not active", async () => {
    recipient.configuration.recipient.capabilities.stripe_balance.stripe_transfers.status =
      "pending";
    await expectCode(
      verifyAutomaticPayoutFunding(input),
      "recipient_not_ready",
      true
    );
  });

  it.each([
    { bookingId: 0 },
    { bookingId: -1 },
    { bookingId: 1.5 },
    { techId: Number.NaN },
    { grossInCents: 0 },
    { grossInCents: Number.MAX_SAFE_INTEGER + 1 },
    { amountInCents: 190.5 },
    { amountInCents: 200 },
    { feeEventId: 0 },
    { feeEventId: 303 },
    { kind: "appointment_fee", amountInCents: 200 },
    { kind: "unknown" },
    { cutoff: new Date(NaN) },
    { now: new Date(NaN) },
    { cutoff: new Date(NOW.getTime() + 1) },
    { customerId: "cus_" },
    { accountId: "acct_BAD ID" },
    { paymentIntentId: "pi_wrong\n" },
  ])(
    "rejects invalid funding input before calling Stripe: %j",
    async override => {
      await expectCode(
        verifyAutomaticPayoutFunding({
          ...input,
          ...override,
        } as AutomaticPayoutFundingInput),
        "invalid_input"
      );
      expect(mocks.getStripe).not.toHaveBeenCalled();
    }
  );

  it.each([
    "currentAccount",
    "balanceSettings",
    "paymentIntent",
    "recipient",
    "balance",
  ] as const)(
    "sanitizes %s read failures without treating them as zero or success",
    async method => {
      mocks[method].mockRejectedValue({
        message: "secret provider payload",
        raw: { private: "sensitive" },
      });
      const error = await verifyAutomaticPayoutFunding(input).catch(
        error => error
      );
      expect(error).toMatchObject({
        code: "provider_unavailable",
        retryAllowed: true,
      });
      expect(error).not.toHaveProperty("cause");
      expect(String(error)).not.toMatch(/secret|sensitive|payload/);
      expect(mocks.createTransfer).not.toHaveBeenCalled();
    }
  );
});

describe("durable reconciliation", () => {
  it("returns null only after complete automatic and legacy group reads", async () => {
    expect(await lookupAutomaticPayoutTransfer(leg)).toBeNull();
    expect(mocks.listTransfers.mock.calls).toEqual([
      [{ transfer_group: `valisse_auto_${leg.id}`, limit: 100 }, options],
      [
        { transfer_group: `valisse_booking_${leg.bookingId}`, limit: 100 },
        options,
      ],
    ]);
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("finds an exact automatic transfer and never creates another", async () => {
    const transfer = transferFixture();
    putGroup(transfer);
    expect(await lookupAutomaticPayoutTransfer(leg)).toBe(transfer);
    expect(await createAutomaticPayoutTransfer(leg)).toBe(transfer);
    expect(mocks.createTransfer).not.toHaveBeenCalled();
    expect(mocks.balance).not.toHaveBeenCalled();
  });

  it.each([
    (t: any) => {
      t.metadata.payout_leg_id = "wrong-leg";
    },
    (t: any) => {
      delete t.metadata.payout_leg_id;
    },
    (t: any) => {
      t.metadata.payment_intent_id = "pi_WRONG";
    },
    (t: any) => {
      t.metadata.booking_id = "102";
    },
    (t: any) => {
      t.metadata.kind = "tip_payout";
    },
    (t: any) => {
      t.destination = "acct_WRONG";
    },
    (t: any) => {
      t.source_transaction = "ch_WRONG";
    },
    (t: any) => {
      t.amount = 189;
    },
    (t: any) => {
      t.currency = "eur";
    },
    (t: any) => {
      t.livemode = false;
    },
    (t: any) => {
      t.reversed = true;
    },
    (t: any) => {
      t.amount_reversed = 1;
    },
    (t: any) => {
      delete t.amount_reversed;
    },
    (t: any) => {
      t.metadata.fee_event_id = "303";
    },
  ])("blocks any mismatched or reversed automatic transfer", async modify => {
    const transfer = transferFixture();
    modify(transfer);
    putGroup(transfer);
    await expectCode(
      createAutomaticPayoutTransfer(leg),
      "reconciliation_required"
    );
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("requires exact automatic fee-event metadata", async () => {
    const feeLeg = {
      ...leg,
      kind: "appointment_fee" as const,
      feeEventId: 303,
      amountInCents: 200,
    };
    const transfer = transferFixture(feeLeg);
    transfer.metadata.fee_event_id = "304";
    putGroup(transfer);
    await expectCode(
      lookupAutomaticPayoutTransfer(feeLeg),
      "reconciliation_required"
    );
  });

  it("blocks duplicate automatic transfers with distinct provider IDs", async () => {
    groups[`valisse_auto_${leg.id}`] = {
      data: [transferFixture(), { ...transferFixture(), id: "tr_SECONDMOCK" }],
      has_more: false,
    };
    await expectCode(
      createAutomaticPayoutTransfer(leg),
      "reconciliation_required"
    );
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("accepts expanded destination and source identities", async () => {
    const transfer = transferFixture();
    transfer.destination = { id: leg.destinationAccountId };
    transfer.source_transaction = { id: leg.chargeId };
    putGroup(transfer);
    expect(await lookupAutomaticPayoutTransfer(leg)).toBe(transfer);
  });

  it.each(["service", "tip", "appointment_fee"] as const)(
    "adopts an exact existing legacy %s transfer without adding one",
    async kind => {
      const payoutLeg = {
        ...leg,
        kind,
        amountInCents: kind === "service" ? 190 : 200,
        ...(kind === "appointment_fee" ? { feeEventId: 303 } : {}),
      };
      const transfer = transferFixture(payoutLeg, true);
      putGroup(transfer);
      expect(await createAutomaticPayoutTransfer(payoutLeg)).toBe(transfer);
      expect(mocks.createTransfer).not.toHaveBeenCalled();
    }
  );

  it.each([
    (t: any) => {
      t.destination = "acct_WRONG";
    },
    (t: any) => {
      t.amount = 189;
    },
    (t: any) => {
      t.metadata.kind = "tip_payout";
    },
    (t: any) => {
      t.source_transaction = "ch_WRONG";
    },
    (t: any) => {
      t.metadata.payment_intent_id = "pi_WRONG";
    },
    (t: any) => {
      t.metadata.booking_id = "102";
    },
    (t: any) => {
      t.reversed = true;
    },
    (t: any) => {
      delete t.metadata.kind;
    },
  ])(
    "does not duplicate a relevant mismatched legacy transfer",
    async modify => {
      const transfer = transferFixture(leg, true);
      modify(transfer);
      putGroup(transfer);
      await expectCode(
        createAutomaticPayoutTransfer(leg),
        "reconciliation_required"
      );
      expect(mocks.createTransfer).not.toHaveBeenCalled();
    }
  );

  it("does not confuse an unrelated tip with the service leg", async () => {
    const tipLeg = {
      ...leg,
      kind: "tip" as const,
      chargeId: "ch_MOCKTIP",
      amountInCents: 200,
    };
    putGroup(transferFixture(tipLeg, true));
    expect(await lookupAutomaticPayoutTransfer(leg)).toBeNull();
  });

  it("blocks when both automatic and legacy groups contain the same relevant payout", async () => {
    putGroup(transferFixture());
    putGroup({ ...transferFixture(leg, true), id: "tr_LEGACYMOCK" });
    await expectCode(
      createAutomaticPayoutTransfer(leg),
      "reconciliation_required"
    );
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("reads a second page explicitly before deciding no transfer exists", async () => {
    // A legacy group may have many unrelated tips for distinct source charges.
    const unrelated = transferFixture(
      { ...leg, kind: "tip", amountInCents: 200, chargeId: "ch_MOCKTIP" },
      true
    );
    const wanted = { ...transferFixture(leg, true), id: "tr_TARGETMOCK" };
    mocks.listTransfers.mockImplementation(async (params: any) => {
      if (params.transfer_group === `valisse_auto_${leg.id}`)
        return { data: [], has_more: false };
      return params.starting_after
        ? { data: [wanted], has_more: false }
        : { data: [unrelated], has_more: true };
    });
    expect(await lookupAutomaticPayoutTransfer(leg)).toBe(wanted);
    expect(mocks.listTransfers).toHaveBeenCalledWith(
      {
        transfer_group: `valisse_booking_${leg.bookingId}`,
        limit: 100,
        starting_after: unrelated.id,
      },
      options
    );
  });

  it("blocks an incomplete group after two pages rather than relying on truncated evidence", async () => {
    mocks.listTransfers.mockImplementation(async (params: any) => ({
      data: [
        {
          ...transferFixture(),
          id: params.starting_after ? "tr_SECONDMOCK" : "tr_FIRSTMOCK",
        },
      ],
      has_more: true,
    }));
    await expectCode(
      createAutomaticPayoutTransfer(leg),
      "reconciliation_required"
    );
    expect(mocks.listTransfers).toHaveBeenCalledTimes(2);
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it.each([
    { data: [], has_more: true },
    { data: [], has_more: undefined },
    { data: undefined, has_more: false },
    {
      data: [{ ...transferFixture(), transfer_group: "wrong-group" }],
      has_more: false,
    },
    { data: [transferFixture(), transferFixture()], has_more: false },
  ])("blocks malformed or repeated list evidence", async page => {
    mocks.listTransfers.mockResolvedValue(page);
    await expectCode(
      createAutomaticPayoutTransfer(leg),
      "reconciliation_required"
    );
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it.each([24 * 60 * 60 * 1000, 24 * 60 * 60 * 1000 + 1, 72 * 60 * 60 * 1000])(
    "refuses fresh creation after %i ms of an unresolved attempt",
    async age => {
      const expired = { ...leg, firstAttemptAt: new Date(NOW.getTime() - age) };
      await expectCode(
        lookupAutomaticPayoutTransfer(expired),
        "reconciliation_required"
      );
      await expectCode(
        createAutomaticPayoutTransfer(expired),
        "reconciliation_required"
      );
      expect(mocks.createTransfer).not.toHaveBeenCalled();
    }
  );

  it("can reconcile an exact transfer even after the idempotency window expires", async () => {
    putGroup(transferFixture());
    const expired = {
      ...leg,
      firstAttemptAt: new Date(NOW.getTime() - 72 * 60 * 60 * 1000),
    };
    await expect(
      createAutomaticPayoutTransfer(expired)
    ).resolves.toHaveProperty("id", "tr_MOCKTRANSFER");
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("does not infer no prior transfer from a failed provider list", async () => {
    mocks.listTransfers.mockRejectedValue({ message: "private Stripe data" });
    await expectCode(
      createAutomaticPayoutTransfer(leg),
      "provider_unavailable",
      true
    );
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });
});

describe("one-leg bounded transfer dispatch", () => {
  it("creates with the durable leg group/key and exact funding metadata", async () => {
    await expect(createAutomaticPayoutTransfer(leg)).resolves.toHaveProperty(
      "id",
      "tr_MOCKTRANSFER"
    );
    expect(mocks.createTransfer).toHaveBeenCalledTimes(1);
    expect(mocks.createTransfer).toHaveBeenCalledWith(
      {
        amount: 190,
        currency: "usd",
        destination: leg.destinationAccountId,
        source_transaction: leg.chargeId,
        transfer_group: `valisse_auto_${leg.id}`,
        metadata: {
          booking_id: String(leg.bookingId),
          kind: "service_payout",
          payout_leg_id: leg.id,
          payment_intent_id: leg.paymentIntentId,
        },
      },
      { ...options, idempotencyKey: `valisse_auto_${leg.id}` }
    );
    expect(mocks.balance).toHaveBeenCalledWith({}, options);
    expect(mocks.currentAccount).toHaveBeenCalledWith({}, options);
    expect(mocks.balanceSettings).toHaveBeenCalledWith({}, options);
  });

  it.each(["tip", "appointment_fee"] as const)(
    "creates one %s leg for its full charge",
    async kind => {
      const payoutLeg = {
        ...leg,
        kind,
        amountInCents: 200,
        ...(kind === "appointment_fee" ? { feeEventId: 303 } : {}),
      };
      mocks.createTransfer.mockResolvedValue(transferFixture(payoutLeg));
      balance.available[0].amount = 200;
      await createAutomaticPayoutTransfer(payoutLeg);
      expect(mocks.createTransfer).toHaveBeenCalledTimes(1);
      expect(mocks.createTransfer.mock.calls[0][0]).toMatchObject({
        amount: 200,
        metadata: {
          kind: `${kind}_payout`,
          ...(kind === "appointment_fee" ? { fee_event_id: "303" } : {}),
        },
      });
    }
  );

  it("requires the caller to persist dispatch first", async () => {
    await expectCode(
      createAutomaticPayoutTransfer({ ...leg, firstAttemptAt: null }),
      "invalid_input"
    );
    expect(mocks.getStripe).not.toHaveBeenCalled();
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("rechecks current funds immediately before create rather than trusting an older balance", async () => {
    await verifyAutomaticPayoutFunding(input);
    balance.available[0].amount = 189;
    await expectCode(
      createAutomaticPayoutTransfer(leg),
      "insufficient_balance",
      true
    );
    expect(mocks.balance).toHaveBeenCalledTimes(2);
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("rechecks manual settings immediately before dispatch", async () => {
    settings.payments.payouts.schedule.interval = "daily";
    await expectCode(
      createAutomaticPayoutTransfer(leg),
      "platform_payouts_automatic"
    );
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("does not dispatch if reconciliation crosses the 24-hour safety boundary", async () => {
    const almostExpired = {
      ...leg,
      firstAttemptAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000 + 1),
    };
    mocks.balance.mockImplementation(async () => {
      vi.setSystemTime(new Date(NOW.getTime() + 1));
      return balance;
    });
    await expectCode(
      createAutomaticPayoutTransfer(almostExpired),
      "reconciliation_required"
    );
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it.each([
    (t: any) => {
      t.id = "wrong-transfer-id";
    },
    (t: any) => {
      t.metadata.payout_leg_id = "wrong-leg";
    },
    (t: any) => {
      t.source_transaction = "ch_WRONG";
    },
    (t: any) => {
      t.amount = 200;
    },
    (t: any) => {
      t.livemode = false;
    },
    (t: any) => {
      t.destination = "acct_WRONG";
    },
    (t: any) => {
      t.metadata.payment_intent_id = "pi_WRONG";
    },
    (t: any) => {
      t.reversed = true;
    },
  ])(
    "flags a mismatched create response as ambiguous, never as success",
    async modify => {
      const transfer = transferFixture();
      modify(transfer);
      mocks.createTransfer.mockResolvedValue(transfer);
      await expectCode(
        createAutomaticPayoutTransfer(leg),
        "reconciliation_required"
      );
      expect(mocks.createTransfer).toHaveBeenCalledTimes(1);
    }
  );

  it("sanitizes a create timeout as ambiguity without a new key or automatic second create", async () => {
    mocks.createTransfer.mockRejectedValue({
      message: "sensitive provider response",
      code: "ETIMEDOUT",
    });
    const error = await createAutomaticPayoutTransfer(leg).catch(
      error => error
    );
    expect(error).toMatchObject({
      code: "reconciliation_required",
      retryAllowed: false,
      reconciliationRequired: true,
    });
    expect(String(error)).not.toMatch(/sensitive|ETIMEDOUT/);
    expect(mocks.createTransfer).toHaveBeenCalledTimes(1);
    expect(mocks.createTransfer.mock.calls[0][1].idempotencyKey).toBe(
      `valisse_auto_${leg.id}`
    );
  });

  it.each([
    { mode: "test" },
    { id: "" },
    { id: "unsafe leg id" },
    { amountInCents: 0 },
    { destinationAccountId: "acct_" },
    { chargeId: "pi_WRONGTYPE" },
    { firstAttemptAt: new Date(NaN) },
    { firstAttemptAt: new Date(NOW.getTime() + 1) },
  ])("rejects invalid legs before any Stripe call: %j", async override => {
    await expectCode(
      createAutomaticPayoutTransfer({
        ...leg,
        ...override,
      } as AutomaticTransferLeg),
      "invalid_input"
    );
    expect(mocks.getStripe).not.toHaveBeenCalled();
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });
});

describe("transfer dispatch deadline fencing", () => {
  it("never initiates a transfer when its caller deadline has already elapsed", async () => {
    await expect(createAutomaticPayoutTransfer(leg, Date.now()-1)).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });
  it("does not initiate money movement after slow read-only reconciliation consumes the dispatch budget", async () => {
    const endsAt = Date.now()+1_000;
    mocks.listTransfers.mockImplementation(async () => { vi.setSystemTime(new Date(endsAt+1)); return { object: "list", data: [], has_more: false }; });
    await expect(createAutomaticPayoutTransfer(leg, endsAt)).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });
});
