import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { describe, expect, it } from "vitest";
import {
  automaticPayoutLegs,
  bookingServiceLines,
  bookings,
  users,
} from "../drizzle/schema";
import {
  AUTOMATIC_PAYOUT_LEASE_MS,
  type AutomaticPayoutSpec,
} from "../shared/automaticPayout";
import { createAutomaticPayoutStore } from "./automaticPayoutDb";

/**
 * NEVER uses DATABASE_URL or calls Stripe. Requires three deliberate test-only
 * flags and a separate pre-provisioned disposable database. No migration/DDL is
 * performed here. All fixtures have a UUID ownership tag and are cleaned by IDs
 * captured from this test. Fake live-mode references are local strings only.
 *
 * RUN_AUTOMATIC_PAYOUT_DB_INTEGRATION=true
 * AUTOMATIC_PAYOUT_ALLOW_DISPOSABLE_FIXTURES=true
 * AUTOMATIC_PAYOUT_TEST_DATABASE_URL=mysql://.../valisse_payout_test
 */
const enabled = process.env.RUN_AUTOMATIC_PAYOUT_DB_INTEGRATION === "true";
describe.skipIf(!enabled)(
  "automatic payout disposable database transactions",
  () => {
    it("serializes claims, preserves service evidence through tip failure, and fences expired leases", async () => {
      const testUrl = process.env.AUTOMATIC_PAYOUT_TEST_DATABASE_URL;
      if (
        !testUrl ||
        process.env.AUTOMATIC_PAYOUT_ALLOW_DISPOSABLE_FIXTURES !== "true"
      ) {
        throw new Error(
          "A dedicated disposable payout test database and fixture approval are required"
        );
      }
      const url = new URL(testUrl);
      const productionUrl = process.env.DATABASE_URL;
      if (
        testUrl === productionUrl ||
        !/(?:test|disposable)/i.test(url.pathname)
      ) {
        throw new Error("Refusing a non-disposable or production database");
      }
      if (productionUrl) {
        const production = new URL(productionUrl);
        if (
          production.hostname === url.hostname &&
          production.port === url.port &&
          production.pathname === url.pathname
        ) {
          throw new Error(
            "Refusing the production database even with alternate credentials"
          );
        }
      }
      const pool = mysql.createPool(testUrl);
      const db = drizzle(pool);
      const store = createAutomaticPayoutStore(async () => db);
      const ownershipTag = randomUUID().replaceAll("-", "");
      const fakeCustomer = `cus_Disposable${ownershipTag}`;
      const fakeAccount = `acct_Disposable${ownershipTag}`;
      const servicePayment = `pi_DisposableService${ownershipTag}`;
      const tipPayment = `pi_DisposableTip${ownershipTag}`;
      const serviceTransfer = `tr_DisposableService${ownershipTag}`;
      const tipTransfer = `tr_DisposableTip${ownershipTag}`;
      const now = new Date();
      const capturedAt = new Date(now.getTime() - 3 * 86_400_000);
      const cutoff = new Date(capturedAt.getTime() - 1000);
      const eligibleAt = new Date(capturedAt.getTime() + 86_400_000);
      const userIds: number[] = [];
      let bookingId: number | undefined;
      try {
        // The caller must have provisioned the existing ledger schema beforehand.
        // A missing table fails without applying any migration.
        await db
          .select({ id: automaticPayoutLegs.id })
          .from(automaticPayoutLegs)
          .limit(0);
        const [clientInsert] = await db
          .insert(users)
          .values({
            openId: `payout_disposable_client_${ownershipTag}`,
            userType: "client",
            stripeCustomerId: fakeCustomer,
            stripeCustomerMode: "live",
          });
        const clientId = Number(clientInsert.insertId);
        userIds.push(clientId);
        const [techInsert] = await db
          .insert(users)
          .values({
            openId: `payout_disposable_tech_${ownershipTag}`,
            userType: "nail_tech",
            stripeConnectedAccountId: fakeAccount,
            stripeConnectedAccountMode: "live",
            stripeConnectedAccountReady: true,
          });
        const techId = Number(techInsert.insertId);
        userIds.push(techId);
        const [bookingInsert] = await db
          .insert(bookings)
          .values({
            clientId,
            techId,
            scheduledAt: capturedAt,
            status: "completed",
            completedAt: capturedAt,
            paymentCapturedAt: capturedAt,
            payoutEligibleAt: eligibleAt,
            paymentStatus: "paid",
            payoutStatus: "pending_dispute_window",
            stripePaymentIntentId: servicePayment,
            tipStatus: "paid",
            stripeTipPaymentIntentId: tipPayment,
            tipAmountInCents: 200,
            isQaTest: false,
          });
        bookingId = Number(bookingInsert.insertId);
        await db
          .insert(bookingServiceLines)
          .values({
            bookingId,
            serviceName: `Disposable ${ownershipTag}`,
            priceInCents: 1000,
          });
        const serviceSpec: AutomaticPayoutSpec = {
          mode: "live",
          kind: "service",
          bookingId,
          feeEventId: null,
          techId,
          clientId,
          customerId: fakeCustomer,
          destination: fakeAccount,
          paymentIntentId: servicePayment,
          chargeId: `ch_DisposableService${ownershipTag}`,
          amountInCents: 950,
          originalGrossInCents: 1000,
          currency: "usd",
          cutoff,
        };
        const results = await Promise.all(
          Array.from({ length: 4 }, () =>
            store.claimAutomaticPayout(serviceSpec, now)
          )
        );
        expect(
          results.filter(result => result.status === "acquired")
        ).toHaveLength(1);
        expect(results.filter(result => result.status === "busy")).toHaveLength(
          3
        );
        const first = results.find(result => result.status === "acquired")!;
        if (first.status !== "acquired") throw new Error("Missing first lease");
        const [stored] = await db
          .select()
          .from(automaticPayoutLegs)
          .where(
            and(
              eq(automaticPayoutLegs.bookingId, bookingId),
              eq(automaticPayoutLegs.paymentIntentId, servicePayment)
            )
          );
        expect(stored.firstAttemptAt).toBeNull();
        expect(stored.createdAt.getTime() % 1000).toBe(now.getTime() % 1000);
        expect(
          await store.markAutomaticPayoutDispatching(
            first.leg.id,
            first.leaseToken,
            now
          )
        ).toBe(true);
        const later = new Date(now.getTime() + AUTOMATIC_PAYOUT_LEASE_MS + 1);
        const second = await store.claimAutomaticPayout(serviceSpec, later);
        if (second.status !== "acquired")
          throw new Error("Missing replacement lease");
        expect(second.reconciliationRequired).toBe(true);
        expect(second.leg.firstAttemptAt).toEqual(now);
        expect(
          await store.markAutomaticPayoutDispatching(
            second.leg.id,
            second.leaseToken,
            later
          )
        ).toBe(false);
        expect(
          await store.markAutomaticPayoutTransferred(
            first.leg.id,
            first.leaseToken,
            serviceTransfer,
            later
          )
        ).toBe(false);
        // This transfer ID is deliberately fake local evidence; no provider call exists.
        expect(
          await store.markAutomaticPayoutTransferred(
            second.leg.id,
            second.leaseToken,
            serviceTransfer,
            later
          )
        ).toBe(true);
        const [bookingAfterService] = await db
          .select()
          .from(bookings)
          .where(eq(bookings.id, bookingId));
        expect(bookingAfterService.stripeTransferId).toBe(serviceTransfer);
        expect(bookingAfterService.payoutStatus).toBe("pending_dispute_window");
        const tipSpec = {
          ...serviceSpec,
          kind: "tip" as const,
          paymentIntentId: tipPayment,
          chargeId: `ch_DisposableTip${ownershipTag}`,
          amountInCents: 200,
          originalGrossInCents: 200,
        };
        const tip = await store.claimAutomaticPayout(tipSpec, later);
        if (tip.status !== "acquired") throw new Error("Missing tip lease");
        await store.markAutomaticPayoutDispatching(
          tip.leg.id,
          tip.leaseToken,
          later
        );
        await store.markAutomaticPayoutUncertain(
          tip.leg.id,
          tip.leaseToken,
          "provider_uncertain",
          later
        );
        const retry = await store.claimAutomaticPayout(tipSpec, later);
        if (retry.status !== "acquired")
          throw new Error("Missing reconciliation lease");
        expect(retry.reconciliationRequired).toBe(true);
        await store.markAutomaticPayoutTransferred(
          retry.leg.id,
          retry.leaseToken,
          tipTransfer,
          later
        );
        const [completed] = await db
          .select()
          .from(bookings)
          .where(eq(bookings.id, bookingId));
        expect(completed).toMatchObject({
          stripeTransferId: serviceTransfer,
          payoutStatus: "released",
        });
        expect(
          await store.claimAutomaticPayout(serviceSpec, later)
        ).toMatchObject({
          status: "already_transferred",
          transferId: serviceTransfer,
        });
        const ownedLegs = await db
          .select()
          .from(automaticPayoutLegs)
          .where(eq(automaticPayoutLegs.bookingId, bookingId));
        expect(ownedLegs).toHaveLength(2);
        expect(new Set(ownedLegs.map(leg => leg.transferId)).size).toBe(2);
      } finally {
        // Cleanup only rows created by this invocation, dependent rows first.
        try {
          if (bookingId !== undefined) {
            await db
              .delete(automaticPayoutLegs)
              .where(
                and(
                  eq(automaticPayoutLegs.bookingId, bookingId),
                  eq(automaticPayoutLegs.customerId, fakeCustomer)
                )
              );
            await db
              .delete(bookingServiceLines)
              .where(eq(bookingServiceLines.bookingId, bookingId));
            await db
              .delete(bookings)
              .where(
                and(
                  eq(bookings.id, bookingId),
                  eq(bookings.stripePaymentIntentId, servicePayment)
                )
              );
          }
          if (userIds.length)
            await db
              .delete(users)
              .where(
                and(inArray(users.id, userIds), sqlFixtureOpenIds(ownershipTag))
              );
        } finally {
          await pool.end();
        }
      }
    }, 30_000);
  }
);
function sqlFixtureOpenIds(tag: string) {
  return inArray(users.openId, [
    `payout_disposable_client_${tag}`,
    `payout_disposable_tech_${tag}`,
  ]);
}
