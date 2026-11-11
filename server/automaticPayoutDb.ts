import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { getDb } from "./db";
import {
  automaticPayoutLegs,
  bookings,
  bookingFeeEvents,
  bookingServiceLines,
  users,
  type AutomaticPayoutLeg,
  type Booking,
  type BookingFeeEvent,
} from "../drizzle/schema";
import {
  AUTOMATIC_PAYOUT_LEASE_MS,
  AUTOMATIC_PAYOUT_MAX_CANDIDATES,
  AUTOMATIC_PAYOUT_WINDOW_MS,
  assertAutomaticPayoutClocks,
  assertAutomaticPayoutReason,
  assertAutomaticPayoutSpec,
  assertPayoutDate,
  assertPayoutUUID,
  assertPositiveSafeInteger,
  assertStripePayoutId,
  automaticServicePayoutInCents,
  type AutomaticPayoutReason,
  type AutomaticPayoutSpec,
} from "../shared/automaticPayout";

export type {
  AutomaticPayoutSpec,
  AutomaticPayoutReason,
} from "../shared/automaticPayout";
export type { AutomaticPayoutLeg } from "../drizzle/schema";

// Server-private projection: deliberately excludes tokens, passwords, notes and PII.
const bookingColumns = {
  id: bookings.id,
  clientId: bookings.clientId,
  techId: bookings.techId,
  status: bookings.status,
  completedAt: bookings.completedAt,
  paymentStatus: bookings.paymentStatus,
  paymentCapturedAt: bookings.paymentCapturedAt,
  payoutStatus: bookings.payoutStatus,
  payoutEligibleAt: bookings.payoutEligibleAt,
  stripePaymentIntentId: bookings.stripePaymentIntentId,
  stripeTipPaymentIntentId: bookings.stripeTipPaymentIntentId,
  stripeTransferId: bookings.stripeTransferId,
  stripeRefundId: bookings.stripeRefundId,
  stripeTipRefundId: bookings.stripeTipRefundId,
  tipStatus: bookings.tipStatus,
  tipAmountInCents: bookings.tipAmountInCents,
  refundAmountInCents: bookings.refundAmountInCents,
  issueReportedAt: bookings.issueReportedAt,
  issueResolvedAt: bookings.issueResolvedAt,
  issueResolution: bookings.issueResolution,
  isQaTest: bookings.isQaTest,
  needsReview: bookings.needsReview,
  revisionStatus: bookings.revisionStatus,
};
const feeColumns = {
  id: bookingFeeEvents.id,
  bookingId: bookingFeeEvents.bookingId,
  clientId: bookingFeeEvents.clientId,
  techId: bookingFeeEvents.techId,
  feeType: bookingFeeEvents.feeType,
  status: bookingFeeEvents.status,
  amountInCents: bookingFeeEvents.amountInCents,
  chargedAt: bookingFeeEvents.chargedAt,
  eligibleAt: bookingFeeEvents.eligibleAt,
  payoutEligibleAt: bookingFeeEvents.payoutEligibleAt,
  stripePaymentIntentId: bookingFeeEvents.stripePaymentIntentId,
  stripeTransferId: bookingFeeEvents.stripeTransferId,
  stripeRefundId: bookingFeeEvents.stripeRefundId,
  payoutStatus: bookingFeeEvents.payoutStatus,
  clientDisputedAt: bookingFeeEvents.clientDisputedAt,
  adminResolvedAt: bookingFeeEvents.adminResolvedAt,
};
export type AutomaticPayoutBooking = Pick<Booking, keyof typeof bookingColumns>;
export type AutomaticPayoutFeeEvent = Pick<
  BookingFeeEvent,
  keyof typeof feeColumns
>;
export interface AutomaticPayoutTech {
  id: number;
  stripeConnectedAccountId: string | null;
  stripeConnectedAccountMode: string | null;
  stripeConnectedAccountReady: boolean;
  deactivatedAt: Date | null;
}
export interface AutomaticPayoutClient {
  id: number;
  stripeCustomerId: string | null;
  stripeCustomerMode: string | null;
  deactivatedAt: Date | null;
}
export interface AutomaticPayoutCandidate {
  booking: AutomaticPayoutBooking;
  tech: AutomaticPayoutTech;
  client: AutomaticPayoutClient;
  serviceTotalInCents: number;
  event?: AutomaticPayoutFeeEvent;
  /** Existing source records are evidence, not permission to create another transfer. */
  legs: AutomaticPayoutLeg[];
}
export type AutomaticPayoutClaim =
  | {
      status: "acquired";
      leg: AutomaticPayoutLeg;
      leaseToken: string;
      reconciliationRequired: boolean;
    }
  | {
      status: "already_transferred";
      leg: AutomaticPayoutLeg;
      transferId: string;
    }
  | { status: "busy" | "blocked"; leg: AutomaticPayoutLeg };

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const techUser = alias(users, "automatic_payout_tech");
const clientUser = alias(users, "automatic_payout_client");
const techColumns = {
  id: techUser.id,
  stripeConnectedAccountId: techUser.stripeConnectedAccountId,
  stripeConnectedAccountMode: techUser.stripeConnectedAccountMode,
  stripeConnectedAccountReady: techUser.stripeConnectedAccountReady,
  deactivatedAt: techUser.deactivatedAt,
};
const clientColumns = {
  id: clientUser.id,
  stripeCustomerId: clientUser.stripeCustomerId,
  stripeCustomerMode: clientUser.stripeCustomerMode,
  deactivatedAt: clientUser.deactivatedAt,
};

function validDate(value: Date | null): value is Date {
  return (
    value instanceof Date &&
    Number.isFinite(value.getTime()) &&
    value.getTime() > 0
  );
}
function unresolvedIssue(booking: AutomaticPayoutBooking): boolean {
  return (
    booking.status === "disputed" ||
    booking.payoutStatus === "on_hold" ||
    (booking.issueReportedAt !== null && !validDate(booking.issueResolvedAt))
  );
}
function serviceEligible(
  booking: AutomaticPayoutBooking,
  cutoff: Date,
  now: Date
): boolean {
  return (
    !booking.isQaTest &&
    booking.status === "completed" &&
    booking.paymentStatus === "paid" &&
    validDate(booking.paymentCapturedAt) &&
    booking.paymentCapturedAt >= cutoff &&
    booking.paymentCapturedAt <= now &&
    validDate(booking.completedAt) &&
    validDate(booking.payoutEligibleAt) &&
    Math.max(
      booking.completedAt.getTime() + AUTOMATIC_PAYOUT_WINDOW_MS,
      booking.payoutEligibleAt.getTime()
    ) <= now.getTime() &&
    !unresolvedIssue(booking) &&
    booking.refundAmountInCents === 0 &&
    !booking.stripeRefundId &&
    (booking.issueResolution === "none" ||
      booking.issueResolution === "payout_released") &&
    (booking.payoutStatus === "pending_dispute_window" ||
      booking.payoutStatus === "released")
  );
}
function feeEligible(
  booking: AutomaticPayoutBooking,
  event: AutomaticPayoutFeeEvent,
  cutoff: Date,
  now: Date
): boolean {
  return (
    !booking.isQaTest &&
    !unresolvedIssue(booking) &&
    !event.stripeRefundId &&
    (event.status === "charged" || event.status === "upheld") &&
    (!event.clientDisputedAt || validDate(event.adminResolvedAt)) &&
    validDate(event.chargedAt) &&
    event.chargedAt >= cutoff &&
    event.chargedAt <= now &&
    validDate(event.payoutEligibleAt) &&
    Math.max(
      event.chargedAt.getTime() + AUTOMATIC_PAYOUT_WINDOW_MS,
      event.payoutEligibleAt.getTime()
    ) <= now.getTime() &&
    (event.payoutStatus === "pending_dispute_window" ||
      event.payoutStatus === "released")
  );
}
function ownership(candidate: AutomaticPayoutCandidate): boolean {
  const { booking, tech, client } = candidate;
  return (
    booking.techId === tech.id &&
    booking.clientId === client.id &&
    !tech.deactivatedAt &&
    !client.deactivatedAt &&
    tech.stripeConnectedAccountMode === "live" &&
    client.stripeCustomerMode === "live" &&
    tech.stripeConnectedAccountReady &&
    /^acct_[A-Za-z0-9]+$/.test(tech.stripeConnectedAccountId ?? "") &&
    /^cus_[A-Za-z0-9]+$/.test(client.stripeCustomerId ?? "")
  );
}
function sameImmutable(
  leg: AutomaticPayoutLeg,
  spec: AutomaticPayoutSpec
): boolean {
  const fields = [
    "mode",
    "kind",
    "bookingId",
    "feeEventId",
    "techId",
    "clientId",
    "customerId",
    "destination",
    "paymentIntentId",
    "chargeId",
    "amountInCents",
    "originalGrossInCents",
    "currency",
  ] as const;
  return (
    fields.every(key => leg[key] === spec[key]) &&
    leg.cutoff.getTime() === spec.cutoff.getTime()
  );
}
function assertLedgerClock(leg: AutomaticPayoutLeg, now: Date): void {
  for (const value of [
    leg.createdAt,
    leg.updatedAt,
    leg.firstAttemptAt,
    leg.attemptedAt,
  ]) {
    if (value !== null && (!validDate(value) || value > now))
      throw new Error("Automatic payout ledger clock moved backwards");
  }
  if (leg.firstAttemptAt !== null && leg.attemptedAt === null)
    throw new Error("Automatic payout attempt evidence incomplete");
}
function serviceAmount(total: unknown): number {
  const parsed =
    typeof total === "string" && /^\d+$/.test(total) ? Number(total) : total;
  assertPositiveSafeInteger(parsed, "service total");
  return parsed;
}
async function loadServiceTotal(
  tx: Transaction,
  bookingId: number
): Promise<number> {
  const [row] = await tx
    .select({
      total: sql<string>`COALESCE(SUM(${bookingServiceLines.priceInCents}), 0)`,
      minimum: sql<number>`MIN(${bookingServiceLines.priceInCents})`,
    })
    .from(bookingServiceLines)
    .where(eq(bookingServiceLines.bookingId, bookingId));
  if (row?.minimum == null || Number(row.minimum) < 0)
    throw new Error("Invalid automatic payout service lines");
  return serviceAmount(row.total);
}
async function loadParties(tx: Transaction, booking: AutomaticPayoutBooking) {
  const [tech] = await tx
    .select(techColumns)
    .from(techUser)
    .where(eq(techUser.id, booking.techId))
    .limit(1);
  const [client] = await tx
    .select(clientColumns)
    .from(clientUser)
    .where(eq(clientUser.id, booking.clientId))
    .limit(1);
  if (!tech || !client) throw new Error("Automatic payout ownership missing");
  return { tech, client };
}
async function ledgerForBooking(
  tx: Transaction,
  bookingId: number
): Promise<AutomaticPayoutLeg[]> {
  const legs = await tx
    .select()
    .from(automaticPayoutLegs)
    .where(
      and(
        eq(automaticPayoutLegs.bookingId, bookingId),
        eq(automaticPayoutLegs.mode, "live")
      )
    )
    .orderBy(automaticPayoutLegs.id)
    .limit(16);
  if (legs.length >= 16)
    throw new Error("Automatic payout ledger exceeds bounded booking limit");
  return legs;
}
function legNeedsWork(leg: AutomaticPayoutLeg | undefined): boolean {
  return !leg || (leg.state !== "transferred" && leg.state !== "blocked");
}
function serviceGroupNeedsWork(candidate: AutomaticPayoutCandidate): boolean {
  const { booking, legs } = candidate;
  const service = legs.find(
    leg =>
      leg.kind === "service" &&
      leg.paymentIntentId === booking.stripePaymentIntentId
  );
  const tip = legs.find(
    leg =>
      leg.kind === "tip" &&
      leg.paymentIntentId === booking.stripeTipPaymentIntentId
  );
  // An unowned legacy transfer is not a missing ledger leg. Do not reconstruct it.
  if (
    booking.stripeTransferId &&
    service?.transferId !== booking.stripeTransferId
  )
    return false;
  const pendingService =
    booking.payoutStatus === "pending_dispute_window" &&
    !booking.stripeTransferId &&
    legNeedsWork(service);
  const pendingTip =
    booking.tipStatus === "paid" &&
    booking.tipAmountInCents > 0 &&
    !booking.stripeTipRefundId &&
    /^pi_[A-Za-z0-9]+$/.test(booking.stripeTipPaymentIntentId ?? "") &&
    legNeedsWork(tip) &&
    (booking.payoutStatus === "pending_dispute_window" ||
      service?.state === "transferred");
  return Boolean(pendingService || pendingTip);
}
function assertCurrent(
  candidate: AutomaticPayoutCandidate,
  spec: AutomaticPayoutSpec,
  now: Date,
  leg?: AutomaticPayoutLeg
): void {
  const { booking, event } = candidate;
  // A changed payment identifier must not mint a second leg with a new unique key.
  const sameSourceLegs = candidate.legs.filter(
    item => item.kind === spec.kind && item.feeEventId === spec.feeEventId
  );
  if (
    sameSourceLegs.length > 1 ||
    sameSourceLegs.some(item => !sameImmutable(item, spec))
  ) {
    throw new Error("Automatic payout immutable booking leg changed");
  }
  for (const other of candidate.legs) {
    if (
      other.bookingId !== booking.id ||
      other.techId !== booking.techId ||
      other.clientId !== booking.clientId ||
      other.destination !== candidate.tech.stripeConnectedAccountId ||
      other.customerId !== candidate.client.stripeCustomerId ||
      (other.kind === "service" &&
        (other.paymentIntentId !== booking.stripePaymentIntentId ||
          (spec.kind !== "appointment_fee" &&
            other.originalGrossInCents !== candidate.serviceTotalInCents))) ||
      (other.kind === "tip" &&
        (other.paymentIntentId !== booking.stripeTipPaymentIntentId ||
          other.originalGrossInCents !== booking.tipAmountInCents))
    ) {
      throw new Error("Automatic payout immutable associated leg changed");
    }
  }
  if (
    spec.mode !== "live" ||
    !ownership(candidate) ||
    booking.id !== spec.bookingId ||
    booking.techId !== spec.techId ||
    booking.clientId !== spec.clientId ||
    candidate.tech.stripeConnectedAccountId !== spec.destination ||
    candidate.client.stripeCustomerId !== spec.customerId
  ) {
    throw new Error("Automatic payout immutable ownership changed");
  }
  if (leg && !sameImmutable(leg, spec))
    throw new Error("Automatic payout immutable source changed");
  const transferred = leg?.state === "transferred" && Boolean(leg.transferId);
  if (spec.kind === "appointment_fee") {
    if (
      !event ||
      event.id !== spec.feeEventId ||
      event.bookingId !== booking.id ||
      event.techId !== spec.techId ||
      event.clientId !== spec.clientId ||
      event.stripePaymentIntentId !== spec.paymentIntentId ||
      event.amountInCents !== spec.originalGrossInCents ||
      spec.amountInCents !== event.amountInCents ||
      !feeEligible(booking, event, spec.cutoff, now) ||
      (event.stripeTransferId && event.stripeTransferId !== leg?.transferId)
    ) {
      throw new Error("Automatic payout fee source changed or held");
    }
    if (
      event.payoutStatus === "released" &&
      !transferred &&
      event.stripeTransferId !== leg?.transferId
    )
      throw new Error("Automatic payout fee already released");
  } else {
    if (
      !serviceEligible(booking, spec.cutoff, now) ||
      booking.needsReview ||
      booking.revisionStatus === "pending"
    )
      throw new Error("Automatic payout service changed or held");
    if (
      booking.stripeTransferId &&
      !candidate.legs.some(
        other =>
          other.kind === "service" &&
          other.paymentIntentId === booking.stripePaymentIntentId &&
          other.transferId === booking.stripeTransferId &&
          other.state === "transferred"
      )
    ) {
      throw new Error("Automatic payout unowned legacy transfer");
    }
    if (spec.kind === "service") {
      if (
        booking.stripePaymentIntentId !== spec.paymentIntentId ||
        candidate.serviceTotalInCents !== spec.originalGrossInCents ||
        automaticServicePayoutInCents(candidate.serviceTotalInCents) !==
          spec.amountInCents ||
        (booking.stripeTransferId &&
          booking.stripeTransferId !== leg?.transferId) ||
        (booking.payoutStatus === "released" && !transferred)
      ) {
        throw new Error(
          "Automatic payout service immutable amount or payment changed"
        );
      }
    } else if (
      booking.tipStatus !== "paid" ||
      booking.stripeTipRefundId ||
      booking.stripeTipPaymentIntentId !== spec.paymentIntentId ||
      booking.tipAmountInCents !== spec.originalGrossInCents ||
      spec.amountInCents !== booking.tipAmountInCents ||
      (booking.payoutStatus === "released" && !booking.stripeTransferId)
    ) {
      throw new Error("Automatic payout tip source changed");
    }
  }
}

/** Factory is injectable for tests; production functions below always use getDb. No retry of an ambiguous commit. */
export function createAutomaticPayoutStore(
  databaseProvider: () => Promise<Database | null> = getDb
) {
  async function database() {
    const db = await databaseProvider();
    if (!db) throw new Error("Automatic payout database unavailable");
    return db;
  }
  async function getAutomaticPayoutCandidates(input: {
    cutoff: Date;
    now: Date;
    limit: number;
  }): Promise<AutomaticPayoutCandidate[]> {
    assertAutomaticPayoutClocks(input.cutoff, input.now);
    assertPositiveSafeInteger(input.limit, "candidate limit");
    const limit = Math.min(input.limit, AUTOMATIC_PAYOUT_MAX_CANDIDATES);
    const db = await database();
    return db.transaction(
      async tx => {
        const candidates: AutomaticPayoutCandidate[] = [];
        const common = and(
          eq(bookings.isQaTest, false),
          eq(techUser.stripeConnectedAccountMode, "live"),
          eq(clientUser.stripeCustomerMode, "live"),
          eq(techUser.stripeConnectedAccountReady, true),
          isNull(techUser.deactivatedAt),
          isNull(clientUser.deactivatedAt),
          or(
            isNull(bookings.issueReportedAt),
            sql`${bookings.issueResolvedAt} IS NOT NULL`
          ),
          sql`${bookings.status} <> 'disputed'`,
          sql`${bookings.payoutStatus} <> 'on_hold'`
        );
        const rows = await tx
          .select({
            booking: bookingColumns,
            tech: techColumns,
            client: clientColumns,
          })
          .from(bookings)
          .innerJoin(techUser, eq(techUser.id, bookings.techId))
          .innerJoin(clientUser, eq(clientUser.id, bookings.clientId))
          .where(
            and(
              common,
              eq(bookings.status, "completed"),
              eq(bookings.paymentStatus, "paid"),
              gte(bookings.paymentCapturedAt, input.cutoff),
              lte(bookings.paymentCapturedAt, input.now),
              sql`${bookings.completedAt} <= DATE_SUB(${input.now}, INTERVAL 24 HOUR)`,
              lte(bookings.payoutEligibleAt, input.now),
              inArray(bookings.payoutStatus, [
                "pending_dispute_window",
                "released",
              ]),
              eq(bookings.refundAmountInCents, 0),
              isNull(bookings.stripeRefundId),
              sql`((${bookings.stripeTransferId} IS NULL AND ${bookings.payoutStatus} = 'pending_dispute_window' AND NOT EXISTS (SELECT 1 FROM automatic_payout_legs asl WHERE asl.mode = 'live' AND asl.paymentIntentId = ${bookings.stripePaymentIntentId} AND asl.state IN ('transferred', 'blocked'))) OR (${bookings.tipStatus} = 'paid' AND ${bookings.stripeTipRefundId} IS NULL AND NOT EXISTS (SELECT 1 FROM automatic_payout_legs atl WHERE atl.mode = 'live' AND atl.paymentIntentId = ${bookings.stripeTipPaymentIntentId} AND atl.state IN ('transferred', 'blocked'))))`
            )
          )
          .orderBy(bookings.payoutEligibleAt, bookings.id)
          .limit(limit);
        for (const row of rows) {
          const candidate = {
            ...row,
            serviceTotalInCents: await loadServiceTotal(tx, row.booking.id),
            legs: await ledgerForBooking(tx, row.booking.id),
          };
          if (
            ownership(candidate) &&
            serviceEligible(row.booking, input.cutoff, input.now) &&
            serviceGroupNeedsWork(candidate)
          )
            candidates.push(candidate);
        }
        if (candidates.length < limit) {
          const fees = await tx
            .select({
              booking: bookingColumns,
              tech: techColumns,
              client: clientColumns,
              event: feeColumns,
            })
            .from(bookingFeeEvents)
            .innerJoin(bookings, eq(bookings.id, bookingFeeEvents.bookingId))
            .innerJoin(techUser, eq(techUser.id, bookings.techId))
            .innerJoin(clientUser, eq(clientUser.id, bookings.clientId))
            .where(
              and(
                common,
                inArray(bookingFeeEvents.status, ["charged", "upheld"]),
                gte(bookingFeeEvents.chargedAt, input.cutoff),
                sql`${bookingFeeEvents.chargedAt} <= DATE_SUB(${input.now}, INTERVAL 24 HOUR)`,
                lte(bookingFeeEvents.payoutEligibleAt, input.now),
                inArray(bookingFeeEvents.payoutStatus, [
                  "pending_dispute_window",
                  "released",
                ]),
                isNull(bookingFeeEvents.stripeRefundId),
                or(
                  isNull(bookingFeeEvents.clientDisputedAt),
                  sql`${bookingFeeEvents.adminResolvedAt} IS NOT NULL`
                ),
                sql`NOT EXISTS (SELECT 1 FROM automatic_payout_legs atl WHERE atl.mode = 'live' AND atl.paymentIntentId = ${bookingFeeEvents.stripePaymentIntentId} AND atl.state IN ('transferred', 'blocked'))`
              )
            )
            .orderBy(bookingFeeEvents.payoutEligibleAt, bookingFeeEvents.id)
            .limit(limit - candidates.length);
          for (const row of fees) {
            const legs = await ledgerForBooking(tx, row.booking.id);
            const leg = legs.find(
              item =>
                item.kind === "appointment_fee" &&
                item.feeEventId === row.event.id
            );
            const candidate = { ...row, serviceTotalInCents: 0, legs };
            if (
              ownership(candidate) &&
              feeEligible(row.booking, row.event, input.cutoff, input.now) &&
              legNeedsWork(leg) &&
              (!row.event.stripeTransferId ||
                row.event.stripeTransferId === leg?.transferId) &&
              row.event.payoutStatus !== "released"
            )
              candidates.push(candidate);
          }
        }
        return candidates;
      },
      { isolationLevel: "repeatable read" }
    );
  }

  async function lockSource(
    tx: Transaction,
    spec: AutomaticPayoutSpec
  ): Promise<AutomaticPayoutCandidate> {
    // Every mutation takes the same lock order: booking -> fee (if present) -> ledger.
    const [booking] = await tx
      .select(bookingColumns)
      .from(bookings)
      .where(eq(bookings.id, spec.bookingId))
      .limit(1)
      .for("update");
    if (!booking) throw new Error("Automatic payout booking missing");
    let event: AutomaticPayoutFeeEvent | undefined;
    if (spec.feeEventId !== null) {
      [event] = await tx
        .select(feeColumns)
        .from(bookingFeeEvents)
        .where(eq(bookingFeeEvents.id, spec.feeEventId))
        .limit(1)
        .for("update");
      if (!event) throw new Error("Automatic payout fee missing");
    }
    const parties = await loadParties(tx, booking);
    return {
      booking,
      ...parties,
      ...(event ? { event } : {}),
      serviceTotalInCents:
        spec.kind === "appointment_fee"
          ? 0
          : await loadServiceTotal(tx, booking.id),
      legs: await ledgerForBooking(tx, booking.id),
    };
  }
  async function claimAutomaticPayout(
    spec: AutomaticPayoutSpec,
    now: Date
  ): Promise<AutomaticPayoutClaim> {
    assertAutomaticPayoutSpec(spec, now);
    const db = await database();
    return db.transaction(async tx => {
      const candidate = await lockSource(tx, spec);
      let [leg] = await tx
        .select()
        .from(automaticPayoutLegs)
        .where(
          and(
            eq(automaticPayoutLegs.mode, spec.mode),
            eq(automaticPayoutLegs.paymentIntentId, spec.paymentIntentId)
          )
        )
        .limit(1)
        .for("update");
      assertCurrent(candidate, spec, now, leg);
      if (leg) assertLedgerClock(leg, now);
      if (!leg) {
        const id = randomUUID();
        await tx
          .insert(automaticPayoutLegs)
          .values({ ...spec, id, createdAt: now, updatedAt: now });
        [leg] = await tx
          .select()
          .from(automaticPayoutLegs)
          .where(eq(automaticPayoutLegs.id, id))
          .limit(1)
          .for("update");
        if (!leg) throw new Error("Automatic payout ledger insert missing");
      }
      if (leg.state === "transferred") {
        if (!leg.transferId)
          throw new Error("Transferred ledger lacks transfer evidence");
        return {
          status: "already_transferred",
          leg,
          transferId: leg.transferId,
        };
      }
      if (leg.transferId)
        throw new Error("Unexpected transfer evidence on untransferred ledger");
      if (leg.state === "blocked") return { status: "blocked", leg };
      if (validDate(leg.leaseUntil) && leg.leaseUntil > now)
        return { status: "busy", leg };
      const reconciliationRequired =
        leg.state === "needs_reconciliation" ||
        leg.state === "dispatching" ||
        leg.firstAttemptAt !== null;
      const leaseToken = randomUUID();
      const updated = {
        leaseToken,
        leaseUntil: new Date(now.getTime() + AUTOMATIC_PAYOUT_LEASE_MS),
        updatedAt: now,
        state: reconciliationRequired
          ? ("needs_reconciliation" as const)
          : ("ready" as const),
      };
      await tx
        .update(automaticPayoutLegs)
        .set(updated)
        .where(eq(automaticPayoutLegs.id, leg.id));
      return {
        status: "acquired",
        leg: { ...leg, ...updated },
        leaseToken,
        reconciliationRequired,
      };
    });
  }
  async function transition<T>(
    id: string,
    token: string,
    now: Date,
    work: (
      tx: Transaction,
      leg: AutomaticPayoutLeg,
      source: AutomaticPayoutCandidate
    ) => Promise<T>,
    lost: T
  ): Promise<T> {
    assertPayoutUUID(id);
    assertPayoutUUID(token);
    assertPayoutDate(now, "now");
    const db = await database();
    // Unlocked locator read only discovers immutable booking ID; re-read under ordered locks.
    const [locator] = await db
      .select()
      .from(automaticPayoutLegs)
      .where(eq(automaticPayoutLegs.id, id))
      .limit(1);
    if (!locator) return lost;
    return db.transaction(async tx => {
      const source = await lockSource(tx, locator);
      const [leg] = await tx
        .select()
        .from(automaticPayoutLegs)
        .where(eq(automaticPayoutLegs.id, id))
        .limit(1)
        .for("update");
      if (
        !leg ||
        leg.leaseToken !== token ||
        !validDate(leg.leaseUntil) ||
        leg.leaseUntil <= now ||
        leg.state === "transferred" ||
        leg.state === "blocked"
      )
        return lost;
      if (!sameImmutable(leg, locator))
        throw new Error("Automatic payout locator changed");
      assertLedgerClock(leg, now);
      assertAutomaticPayoutSpec(leg, now);
      return work(tx, leg, source);
    });
  }
  async function markAutomaticPayoutDispatching(
    id: string,
    token: string,
    now: Date
  ): Promise<boolean> {
    return transition(
      id,
      token,
      now,
      async (tx, leg, source) => {
        assertCurrent(source, leg, now, leg);
        // Never re-authorize a create after any ambiguous/previous attempt, including after 24h.
        if (
          leg.state !== "ready" ||
          leg.firstAttemptAt !== null ||
          leg.attemptedAt !== null
        )
          return false;
        await tx
          .update(automaticPayoutLegs)
          .set({
            state: "dispatching",
            firstAttemptAt: now,
            attemptedAt: now,
            reason: null,
            reasonAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(automaticPayoutLegs.id, id),
              eq(automaticPayoutLegs.leaseToken, token),
              eq(automaticPayoutLegs.state, "ready"),
              isNull(automaticPayoutLegs.firstAttemptAt)
            )
          );
        return true;
      },
      false
    );
  }
  async function markAutomaticPayoutTransferred(
    id: string,
    token: string,
    transferId: string,
    now: Date
  ): Promise<boolean> {
    assertStripePayoutId(transferId, "tr");
    return transition(
      id,
      token,
      now,
      async (tx, leg, source) => {
        assertCurrent(source, leg, now, leg);
        // The worker may discover verified legacy/automatic evidence before any create.
        // This method records evidence only; it never authorizes or performs money movement.
        if (
          leg.state !== "ready" &&
          leg.state !== "dispatching" &&
          leg.state !== "needs_reconciliation"
        )
          return false;
        if (leg.transferId && leg.transferId !== transferId)
          throw new Error("Automatic payout transfer evidence conflict");
        await tx
          .update(automaticPayoutLegs)
          .set({
            state: "transferred",
            transferId,
            transferredAt: now,
            leaseToken: null,
            leaseUntil: null,
            reason: null,
            reasonAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(automaticPayoutLegs.id, id),
              eq(automaticPayoutLegs.leaseToken, token)
            )
          );
        if (leg.kind === "appointment_fee") {
          await tx
            .update(bookingFeeEvents)
            .set({ stripeTransferId: transferId, payoutStatus: "released" })
            .where(eq(bookingFeeEvents.id, leg.feeEventId!));
        } else {
          // Store the service transfer immediately; a failed tip must never erase it.
          if (leg.kind === "service")
            await tx
              .update(bookings)
              .set({ stripeTransferId: transferId })
              .where(eq(bookings.id, leg.bookingId));
          const legs = await ledgerForBooking(tx, leg.bookingId);
          const service = legs.find(
            item =>
              item.kind === "service" &&
              item.paymentIntentId === source.booking.stripePaymentIntentId &&
              item.state === "transferred" &&
              item.transferId
          );
          const tipDone =
            source.booking.tipStatus !== "paid" ||
            legs.some(
              item =>
                item.kind === "tip" &&
                item.paymentIntentId ===
                  source.booking.stripeTipPaymentIntentId &&
                item.state === "transferred" &&
                item.transferId
            );
          if (service && tipDone)
            await tx
              .update(bookings)
              .set({ payoutStatus: "released" })
              .where(eq(bookings.id, leg.bookingId));
        }
        return true;
      },
      false
    );
  }
  async function markAutomaticPayoutUncertain(
    id: string,
    token: string,
    reason: AutomaticPayoutReason,
    now: Date
  ): Promise<boolean> {
    assertAutomaticPayoutReason(reason);
    return transition(
      id,
      token,
      now,
      async (tx, leg) => {
        // Uncertainty is safe even when the source changed: retain evidence, never dispatch.
        await tx
          .update(automaticPayoutLegs)
          .set({
            state: "needs_reconciliation",
            reason,
            reasonAt: now,
            leaseToken: null,
            leaseUntil: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(automaticPayoutLegs.id, id),
              eq(automaticPayoutLegs.leaseToken, token)
            )
          );
        return true;
      },
      false
    );
  }
  async function markAutomaticPayoutPending(
    id: string,
    token: string,
    now: Date
  ): Promise<boolean> {
    return transition(
      id,
      token,
      now,
      async (tx, leg, source) => {
        assertCurrent(source, leg, now, leg);
        if (
          leg.state !== "ready" ||
          leg.firstAttemptAt !== null ||
          leg.attemptedAt !== null
        )
          return false;
        await tx
          .update(automaticPayoutLegs)
          .set({
            state: "ready",
            reason: "preflight_deferred",
            reasonAt: now,
            leaseToken: null,
            leaseUntil: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(automaticPayoutLegs.id, id),
              eq(automaticPayoutLegs.leaseToken, token)
            )
          );
        return true;
      },
      false
    );
  }
  return {
    getAutomaticPayoutCandidates,
    claimAutomaticPayout,
    markAutomaticPayoutDispatching,
    markAutomaticPayoutTransferred,
    markAutomaticPayoutUncertain,
    markAutomaticPayoutPending,
  };
}
const productionStore = createAutomaticPayoutStore();
export const {
  getAutomaticPayoutCandidates,
  claimAutomaticPayout,
  markAutomaticPayoutDispatching,
  markAutomaticPayoutTransferred,
  markAutomaticPayoutUncertain,
  markAutomaticPayoutPending,
} = productionStore;
