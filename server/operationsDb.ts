import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { bookingFeeEvents, bookingServiceLines, bookings, operationsJobs, operationsRuns, users, type OperationsJob } from "../drizzle/schema";
import {
  OPERATIONS_JOB_KEY, OPERATIONS_LEASE_MS, OPERATIONS_PAGE_SIZE,
  assertOperationsDate, assertOperationsEnvironment, canFinishOperationsRun, hasActiveOperationsLease,
  emptyOperationsSteps, operationsStatusFromSteps,
  toOperationsQueueEntry, toOperationsSafeJob, toOperationsSafeRun, validateOperationsSteps,
  type OperationsEnvironment, type OperationsFinalStatus, type OperationsQueueEntry,
  type OperationsQueueKey, type OperationsSnapshot, type OperationsSteps,
} from "../shared/operations";
import { getDb } from "./db";

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new Error("OPERATIONS_DATABASE_UNAVAILABLE");
  return db;
}

/** Insert-only defaults: repeated calls do not modify inspected metadata or mode. */
export async function ensureOperationsJob(environment: OperationsEnvironment): Promise<OperationsJob> {
  assertOperationsEnvironment(environment);
  const db = await requireDatabase();
  await db.insert(operationsJobs).values({ jobKey: OPERATIONS_JOB_KEY, environment })
    .onDuplicateKeyUpdate({ set: { jobId: sql`${operationsJobs.jobId}` } });
  const [job] = await db.select().from(operationsJobs)
    .where(and(eq(operationsJobs.jobKey, OPERATIONS_JOB_KEY), eq(operationsJobs.environment, environment))).limit(1);
  if (!job) throw new Error("OPERATIONS_JOB_UNAVAILABLE");
  return job;
}

export async function getOperationsJobByTaskUid(taskUid: string, environment: OperationsEnvironment): Promise<OperationsJob | null> {
  assertOperationsEnvironment(environment);
  if (!taskUid || taskUid.length > 65) return null;
  const db = await requireDatabase();
  const [job] = await db.select().from(operationsJobs).where(and(
    eq(operationsJobs.scheduleCronTaskUid, taskUid), eq(operationsJobs.environment, environment),
    eq(operationsJobs.jobKey, OPERATIONS_JOB_KEY),
  )).limit(1);
  return job ?? null;
}

export type BindOperationsScheduleInput = {
  environment: OperationsEnvironment;
  taskUid: string;
  cronExpression: string;
  scheduleEnabled: boolean;
  providerLastExecutedAt: Date | null;
  providerNextExecutionAt: Date | null;
};
/** Store owner-inspected provider metadata only. Never invokes a scheduling API. */
export async function bindOperationsSchedule(input: BindOperationsScheduleInput): Promise<OperationsJob> {
  assertOperationsEnvironment(input.environment);
  if (!input.taskUid || input.taskUid.length > 65 || /[\r\n\u0000]/.test(input.taskUid) ||
    !input.cronExpression.trim() || input.cronExpression.length > 128 || /[\r\n\u0000]/.test(input.cronExpression) ||
    typeof input.scheduleEnabled !== "boolean") throw new Error("INVALID_OPERATIONS_SCHEDULE");
  if (input.providerLastExecutedAt) assertOperationsDate(input.providerLastExecutedAt);
  if (input.providerNextExecutionAt) assertOperationsDate(input.providerNextExecutionAt);
  const db = await requireDatabase();
  return db.transaction(async tx => {
    await tx.insert(operationsJobs).values({ jobKey: OPERATIONS_JOB_KEY, environment: input.environment })
      .onDuplicateKeyUpdate({ set: { jobId: sql`${operationsJobs.jobId}` } });
    const [job] = await tx.select().from(operationsJobs).where(and(
      eq(operationsJobs.jobKey, OPERATIONS_JOB_KEY), eq(operationsJobs.environment, input.environment),
    )).limit(1).for("update");
    if (!job) throw new Error("OPERATIONS_JOB_UNAVAILABLE");
    const now = new Date();
    const metadata = {
      scheduleCronTaskUid: input.taskUid, cronExpression: input.cronExpression,
      scheduleEnabled: input.scheduleEnabled, providerLastExecutedAt: input.providerLastExecutedAt,
      providerNextExecutionAt: input.providerNextExecutionAt, schedulerVerifiedAt: now, updatedAt: now,
    };
    await tx.update(operationsJobs).set(metadata).where(eq(operationsJobs.jobId, job.jobId));
    return { ...job, ...metadata };
  });
}

export async function beginOperationsRun(jobId: number, now = new Date()): Promise<{ runId: string; job: OperationsJob } | null> {
  assertOperationsDate(now);
  if (!Number.isSafeInteger(jobId) || jobId < 1) throw new Error("INVALID_OPERATIONS_JOB_ID");
  const db = await requireDatabase();
  return db.transaction(async tx => {
    // All begin/finish transactions take the job lock first, preventing deadlocks.
    const [job] = await tx.select().from(operationsJobs).where(eq(operationsJobs.jobId, jobId)).limit(1).for("update");
    if (!job || job.jobKey !== OPERATIONS_JOB_KEY || hasActiveOperationsLease(job, now)) return null;
    // An expired lease is not renewed. Preserve prior history and fence its completion.
    await tx.update(operationsRuns).set({ status: "abandoned", completedAt: now }).where(and(
      eq(operationsRuns.jobId, jobId), eq(operationsRuns.status, "running"),
    ));
    const runId = randomUUID();
    const leaseUntil = new Date(now.getTime() + OPERATIONS_LEASE_MS);
    await tx.update(operationsJobs).set({ leaseToken: runId, leaseUntil, updatedAt: now })
      .where(eq(operationsJobs.jobId, jobId));
    await tx.insert(operationsRuns).values({
      id: runId, jobId, environment: job.environment, executionMode: job.executionMode,
      status: "running", startedAt: now, completedAt: null, steps: emptyOperationsSteps(), source: "heartbeat", createdAt: now,
    });
    return { runId, job: { ...job, leaseToken: runId, leaseUntil, updatedAt: now } };
  });
}

/** False means the lease expired, was superseded, or this run already finished. */
export async function finishOperationsRun(
  runId: string, status: OperationsFinalStatus, steps: OperationsSteps, now = new Date(),
): Promise<boolean> {
  assertOperationsDate(now);
  if (!["succeeded", "partial_failure", "failed", "abandoned"].includes(status)) throw new Error("INVALID_OPERATIONS_RUN_STATUS");
  const safeSteps = validateOperationsSteps(steps);
  const finalStatus = status === "succeeded" ? operationsStatusFromSteps(safeSteps) : status;
  const db = await requireDatabase();
  return db.transaction(async tx => {
    // This first read only locates the job; it acquires no run lock ahead of the job lock.
    const [locator] = await tx.select({ jobId: operationsRuns.jobId }).from(operationsRuns)
      .where(eq(operationsRuns.id, runId)).limit(1);
    if (!locator) return false;
    const [job] = await tx.select().from(operationsJobs).where(eq(operationsJobs.jobId, locator.jobId)).limit(1).for("update");
    const [run] = await tx.select().from(operationsRuns).where(eq(operationsRuns.id, runId)).limit(1).for("update");
    if (!job || !run || !canFinishOperationsRun(job, run, now)) return false;
    await tx.update(operationsRuns).set({ status: finalStatus, steps: safeSteps, completedAt: now }).where(and(
      eq(operationsRuns.id, runId), eq(operationsRuns.status, "running"),
    ));
    await tx.update(operationsJobs).set({ leaseToken: null, leaseUntil: null, updatedAt: now }).where(and(
      eq(operationsJobs.jobId, job.jobId), eq(operationsJobs.leaseToken, runId), gt(operationsJobs.leaseUntil, now),
    ));
    return true;
  });
}

const client = alias(users, "ops_client");
const tech = alias(users, "ops_tech");
const noUnresolvedBookingIssue = and(
  ne(bookings.status, "disputed"),
  or(isNull(bookings.issueReportedAt), isNotNull(bookings.issueResolvedAt)),
);
const noUnresolvedFeeIssue = or(isNull(bookingFeeEvents.clientDisputedAt), isNotNull(bookingFeeEvents.adminResolvedAt));

function queueFilters(now: Date): Record<OperationsQueueKey, { booking: SQL; fee: SQL }> {
  return {
    overduePayouts: {
      booking: and(eq(bookings.paymentStatus, "paid"), eq(bookings.payoutStatus, "pending_dispute_window"),
        lte(bookings.payoutEligibleAt, now), noUnresolvedBookingIssue)!,
      fee: and(inArray(bookingFeeEvents.status, ["charged", "upheld"]),
        eq(bookingFeeEvents.payoutStatus, "pending_dispute_window"), lte(bookingFeeEvents.payoutEligibleAt, now), noUnresolvedFeeIssue)!,
    },
    failedTransfers: { booking: eq(bookings.payoutStatus, "failed"), fee: eq(bookingFeeEvents.payoutStatus, "failed") },
    paymentsDue: {
      booking: or(inArray(bookings.paymentStatus, ["payment_due", "failed"]), eq(bookings.status, "payment_due"))!,
      fee: eq(bookingFeeEvents.status, "charge_failed"),
    },
    unresolvedDisputes: {
      booking: or(eq(bookings.payoutStatus, "on_hold"), eq(bookings.status, "disputed"),
        and(isNotNull(bookings.issueReportedAt), isNull(bookings.issueResolvedAt)))!,
      fee: or(eq(bookingFeeEvents.status, "disputed"), eq(bookingFeeEvents.payoutStatus, "on_hold"),
        and(isNotNull(bookingFeeEvents.clientDisputedAt), isNull(bookingFeeEvents.adminResolvedAt)))!,
    },
  };
}

const bookingAmount = sql<number | null>`(SELECT SUM(${bookingServiceLines.priceInCents}) FROM ${bookingServiceLines} WHERE ${bookingServiceLines.bookingId} = ${bookings.id})`;
const techName = sql<string | null>`COALESCE(${tech.businessName}, ${tech.name})`;

/** All SQL in this function is SELECT-only. Missing registration stays missing. */
export async function getOperationsSnapshot(environment: OperationsEnvironment, now = new Date()): Promise<OperationsSnapshot> {
  assertOperationsEnvironment(environment);
  assertOperationsDate(now);
  const db = await requireDatabase();
  const environmentFilter = eq(bookings.isQaTest, environment === "development");
  const [job] = await db.select().from(operationsJobs).where(and(
    eq(operationsJobs.jobKey, OPERATIONS_JOB_KEY), eq(operationsJobs.environment, environment),
  )).limit(1);
  const recentRuns = job ? await db.select().from(operationsRuns).where(and(
    eq(operationsRuns.jobId, job.jobId), eq(operationsRuns.environment, environment),
  )).orderBy(desc(operationsRuns.startedAt), desc(operationsRuns.id)).limit(OPERATIONS_PAGE_SIZE) : [];
  const queues = {} as OperationsSnapshot["queues"];
  const counts = {} as OperationsSnapshot["counts"];
  const filters = queueFilters(now);
  await Promise.all((Object.keys(filters) as OperationsQueueKey[]).map(async key => {
    const filter = filters[key];
    const bookingDueAt = key === "overduePayouts" || key === "failedTransfers" ? bookings.payoutEligibleAt
      : key === "unresolvedDisputes" ? bookings.issueReportedAt : bookings.completedAt;
    const feeDueAt = key === "overduePayouts" || key === "failedTransfers" ? bookingFeeEvents.payoutEligibleAt
      : key === "unresolvedDisputes" ? bookingFeeEvents.clientDisputedAt : bookingFeeEvents.eligibleAt;
    const [bookingCount, feeCount, bookingRows, feeRows] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(bookings).where(and(environmentFilter, filter.booking)),
      db.select({ count: sql<number>`COUNT(*)` }).from(bookingFeeEvents)
        .innerJoin(bookings, eq(bookings.id, bookingFeeEvents.bookingId)).where(and(environmentFilter, filter.fee)),
      db.select({
        id: bookings.id, bookingId: bookings.id, clientName: client.name, techName, serviceName: bookings.serviceType,
        scheduledAt: bookings.scheduledAt, dueAt: bookingDueAt,
        status: key === "overduePayouts" || key === "failedTransfers" || key === "unresolvedDisputes" ? bookings.payoutStatus : bookings.paymentStatus,
        amountInCents: bookingAmount,
        issueReason: sql<string | null>`LEFT(${bookings.issueReason}, 2000)`,
      }).from(bookings).leftJoin(client, eq(client.id, bookings.clientId)).leftJoin(tech, eq(tech.id, bookings.techId))
        .where(and(environmentFilter, filter.booking)).orderBy(asc(bookingDueAt), asc(bookings.id)).limit(OPERATIONS_PAGE_SIZE),
      db.select({
        id: bookingFeeEvents.id, bookingId: bookingFeeEvents.bookingId, clientName: client.name, techName,
        serviceName: bookings.serviceType, scheduledAt: bookings.scheduledAt, dueAt: feeDueAt,
        status: key === "overduePayouts" || key === "failedTransfers" ? bookingFeeEvents.payoutStatus : bookingFeeEvents.status,
        amountInCents: bookingFeeEvents.amountInCents,
        issueReason: sql<string | null>`LEFT(${bookingFeeEvents.clientDisputeReason}, 2000)`,
      }).from(bookingFeeEvents).innerJoin(bookings, eq(bookings.id, bookingFeeEvents.bookingId))
        .leftJoin(client, eq(client.id, bookingFeeEvents.clientId)).leftJoin(tech, eq(tech.id, bookingFeeEvents.techId))
        .where(and(environmentFilter, filter.fee)).orderBy(asc(feeDueAt), asc(bookingFeeEvents.id)).limit(OPERATIONS_PAGE_SIZE),
    ]);
    counts[key] = Number(bookingCount[0]?.count ?? 0) + Number(feeCount[0]?.count ?? 0);
    const combined: OperationsQueueEntry[] = [
      ...bookingRows.map(row => toOperationsQueueEntry({ ...row, kind: "booking" })),
      ...feeRows.map(row => toOperationsQueueEntry({ ...row, kind: "fee" })),
    ];
    // Match MySQL ASC null ordering, with deterministic identifiers for ties.
    combined.sort((a, b) => (a.dueAt?.getTime() ?? -Infinity) - (b.dueAt?.getTime() ?? -Infinity) || a.id - b.id || a.kind.localeCompare(b.kind));
    queues[key] = combined.slice(0, OPERATIONS_PAGE_SIZE);
  }));
  const [appointmentCodes] = await db.select({ count: sql<number>`COUNT(*)` }).from(bookings)
    .innerJoin(users, eq(users.id, bookings.clientId)).where(and(
      environmentFilter, eq(bookings.status, "confirmed"), lte(bookings.appointmentCodeVisibleAt, now),
      isNull(bookings.appointmentCodeSmsSentAt), eq(users.smsConsent, true), isNotNull(users.phone),
      sql`TRIM(${users.phone}) <> ''`, isNull(users.deactivatedAt),
    ));
  counts.appointmentCodesDue = Number(appointmentCodes?.count ?? 0);
  return { environment, generatedAt: now, job: job ? toOperationsSafeJob(job) : null,
    recentRuns: recentRuns.map(toOperationsSafeRun), counts, queues };
}
