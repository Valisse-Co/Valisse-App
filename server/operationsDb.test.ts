import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, type SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { operationsJobs, operationsRuns, type OperationsJob, type OperationsRun } from "../drizzle/schema";
import {
  OPERATIONS_LEASE_MS, OPERATIONS_STALE_MS, canFinishOperationsRun, emptyOperationsSteps,
  evaluateOperationsHealth, hasActiveOperationsLease, operationsStatusFromSteps,
  toOperationsQueueEntry, toOperationsSafeJob, toOperationsSafeRun, validateOperationsSteps,
  type OperationsQueueEntry, type OperationsSteps,
} from "../shared/operations";

const mock = vi.hoisted(() => ({ db: null as any }));
vi.mock("./db", () => ({ getDb: vi.fn(async () => mock.db) }));
import { beginOperationsRun, bindOperationsSchedule, ensureOperationsJob, finishOperationsRun, getOperationsJobByTaskUid, getOperationsSnapshot } from "./operationsDb";

const now = new Date("2026-11-08T04:00:00.123Z");
function makeJob(overrides: Partial<OperationsJob> = {}): OperationsJob {
  return {
    jobId: 1, jobKey: "appointment_operations", environment: "production",
    scheduleCronTaskUid: "inspected-task", callbackPath: "/api/scheduled/release-payouts",
    cronExpression: "0 */5 * * * *", scheduleEnabled: true, executionMode: "observe_only",
    schedulerVerifiedAt: now, providerLastExecutedAt: null, providerNextExecutionAt: null,
    leaseToken: null, leaseUntil: null, createdAt: now, updatedAt: now, ...overrides,
  };
}
function makeRun(overrides: Partial<OperationsRun> = {}): OperationsRun {
  return {
    id: "prior-run", jobId: 1, environment: "production", executionMode: "observe_only",
    status: "succeeded", startedAt: now, completedAt: now, steps: emptyOperationsSteps(),
    source: "heartbeat", createdAt: now, ...overrides,
  };
}
const dialect = new MySqlDialect();
function matches(row: Record<string, any>, where?: SQL): boolean {
  if (!where) return true;
  const query = dialect.sqlToQuery(where);
  let index = 0;
  const comparisons = [...query.sql.matchAll(/`[^`]+`\.`([^`]+)`\s*(=|>)\s*\?/g)];
  return comparisons.every(([, column, op]) => {
    const expected = query.params[index++];
    const value = row[column];
    return op === "=" ? value === expected : value instanceof Date && value > new Date(expected as any);
  });
}
/** In-memory transaction adapter, with a mutex to model serial FOR UPDATE job locks. */
function memoryDb(job = makeJob(), runs: OperationsRun[] = []) {
  const state = { jobs: [job], runs, mutations: 0, locks: [] as string[] };
  let tail = Promise.resolve();
  const rows = (table: any) => getTableName(table) === "operations_jobs" ? state.jobs : state.runs;
  const db: any = {
    select(selection?: any) {
      let table: any, where: SQL | undefined;
      const chain: any = {
        from(t: any) { table = t; return chain; },
        where(w: SQL) { where = w; return chain; },
        limit() { return chain; },
        orderBy() { return chain; },
        for() { state.locks.push(getTableName(table)); return chain; },
        then(resolve: any, reject: any) {
          const found = rows(table).filter(row => matches(row, where)).map(row => selection?.jobId ? { jobId: row.jobId } : { ...row });
          return Promise.resolve(found).then(resolve, reject);
        },
      };
      return chain;
    },
    update(table: any) {
      return { set(data: any) { return { async where(where: SQL) {
        state.mutations++;
        rows(table).filter(row => matches(row, where)).forEach(row => Object.assign(row, data));
        return [{ affectedRows: 1 }];
      } }; } };
    },
    insert(table: any) {
      return { values(value: any) {
        const chain: any = {
          async onDuplicateKeyUpdate() {
            if (!state.jobs.some(row => row.environment === value.environment && row.jobKey === value.jobKey)) {
              state.jobs.push(makeJob({ ...value, jobId: state.jobs.length + 1, scheduleEnabled: false, scheduleCronTaskUid: null }));
            }
          },
          then(resolve: any, reject: any) {
            state.mutations++;
            rows(table).push({ ...value });
            return Promise.resolve([{ affectedRows: 1 }]).then(resolve, reject);
          },
        };
        return chain;
      } };
    },
    async transaction(work: any) {
      const prior = tail;
      let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; });
      await prior;
      try { return await work(db); } finally { release(); }
    },
  };
  return { db, state };
}

beforeEach(() => { mock.db = null; });

describe("operations lease transactions (offline fake adapter)", () => {
  it("idempotent registration preserves inspected schedule and execution mode", async () => {
    const original = makeJob({ executionMode: "execute" });
    const { db, state } = memoryDb(original);
    mock.db = db;
    const a = await ensureOperationsJob("production");
    const b = await ensureOperationsJob("production");
    expect(a).toEqual(b);
    expect(a.executionMode).toBe("execute");
    expect(a.scheduleCronTaskUid).toBe("inspected-task");
    expect(state.jobs).toHaveLength(1);
  });
  it("task UID lookup requires matching environment", async () => {
    mock.db = memoryDb().db;
    expect(await getOperationsJobByTaskUid("inspected-task", "production")).not.toBeNull();
    expect(await getOperationsJobByTaskUid("inspected-task", "development")).toBeNull();
    expect(await getOperationsJobByTaskUid("", "production")).toBeNull();
  });
  it("metadata binding preserves mode and lease", async () => {
    const original = makeJob({ executionMode: "execute", leaseToken: "active", leaseUntil: new Date(now.getTime() + 60_000) });
    const { db, state } = memoryDb(original);
    mock.db = db;
    const bound = await bindOperationsSchedule({ environment: "production", taskUid: "owner-inspected-task", cronExpression: "0 */5 * * * *", scheduleEnabled: false, providerLastExecutedAt: now, providerNextExecutionAt: null });
    expect(bound).toMatchObject({ executionMode: "execute", leaseToken: "active", scheduleEnabled: false, scheduleCronTaskUid: "owner-inspected-task" });
    expect(state.jobs).toHaveLength(1);
  });
  it("concurrent starts grant exactly one three-minute lease and one run", async () => {
    const { db, state } = memoryDb();
    mock.db = db;
    const result = await Promise.all([beginOperationsRun(1, now), beginOperationsRun(1, now)]);
    expect(result.filter(Boolean)).toHaveLength(1);
    expect(state.runs).toHaveLength(1);
    expect(state.jobs[0].leaseToken).toBe(state.runs[0].id);
    expect(state.jobs[0].leaseUntil?.getTime()).toBe(now.getTime() + OPERATIONS_LEASE_MS);
    expect(state.locks).toEqual(["operations_jobs", "operations_jobs"]);
  });
  it("stale run becomes abandoned; old completion cannot release replacement lease", async () => {
    const prior = makeRun({ status: "running", completedAt: null });
    const { db, state } = memoryDb(makeJob({ leaseToken: prior.id, leaseUntil: now }), [prior]);
    mock.db = db;
    const fresh = await beginOperationsRun(1, now);
    expect(prior.status).toBe("abandoned");
    expect(await finishOperationsRun(prior.id, "succeeded", emptyOperationsSteps(), now)).toBe(false);
    expect(state.jobs[0].leaseToken).toBe(fresh?.runId);
    expect(await finishOperationsRun(fresh!.runId, "succeeded", emptyOperationsSteps(), new Date(now.getTime() + 1))).toBe(true);
    expect(state.jobs[0].leaseToken).toBeNull();
    expect(await finishOperationsRun(fresh!.runId, "failed", emptyOperationsSteps(), new Date(now.getTime() + 2))).toBe(false);
    expect(state.runs[1].status).toBe("succeeded");
  });
  it("expired completion does not overwrite a running record or release its lease", async () => {
    const { db, state } = memoryDb();
    mock.db = db;
    const started = await beginOperationsRun(1, now);
    expect(await finishOperationsRun(started!.runId, "succeeded", emptyOperationsSteps(), new Date(now.getTime() + OPERATIONS_LEASE_MS))).toBe(false);
    expect(state.runs[0].status).toBe("running");
    expect(state.jobs[0].leaseToken).toBe(started!.runId);
  });
  it("failed/deferred counts cannot be stored as a succeeded run", async () => {
    const { db, state } = memoryDb();
    mock.db = db;
    const started = await beginOperationsRun(1, now);
    const steps = emptyOperationsSteps();
    steps.payouts = { status: "deferred", counts: { deferred: 1 }, errorCode: "STEP_DEFERRED" };
    await finishOperationsRun(started!.runId, "succeeded", steps, now);
    expect(state.runs[0].status).toBe("partial_failure");
  });
  it("invalid dates and environments fail before touching the database", async () => {
    await expect(ensureOperationsJob("staging" as any)).rejects.toThrow("INVALID_OPERATIONS_ENVIRONMENT");
    await expect(beginOperationsRun(1, new Date(NaN))).rejects.toThrow("INVALID_OPERATIONS_DATE");
  });
});

describe("strict summaries, privacy, and health (pure)", () => {
  it("validates all three steps and accepts only scalar non-negative whitelisted counts", () => {
    const valid = emptyOperationsSteps();
    valid.payouts = { status: "observed", counts: { overduePayouts: 123 } };
    expect(validateOperationsSteps(valid)).toEqual(valid);
    expect(validateOperationsSteps(valid)).not.toBe(valid);
    for (const bad of [
      {}, { ...valid, secret: "token" },
      { ...valid, payouts: { status: "failed", counts: {}, message: "SENTINEL_SECRET" } },
      { ...valid, payouts: { status: "failed", counts: {}, errorCode: "https://provider/secret" } },
      { ...valid, payouts: { status: "failed", counts: { stripeTransferId: 123 } } },
      { ...valid, payouts: { status: "failed", counts: { failed: -1 } } },
      { ...valid, payouts: { status: "failed", counts: { failed: 1.2 } } },
      { ...valid, payouts: { status: "failed", counts: { failed: Number.MAX_SAFE_INTEGER + 1 } } },
    ]) expect(() => validateOperationsSteps(bad)).toThrow("INVALID_OPERATIONS_STEPS");
  });
  it("projects explicit fields, strips secrets, and discards malformed run JSON", () => {
    expect(toOperationsSafeJob({ ...makeJob(), futureSecret: "SENTINEL_SECRET" } as any)).not.toHaveProperty("leaseToken");
    expect(toOperationsSafeJob({ ...makeJob(), futureSecret: "SENTINEL_SECRET" } as any)).not.toHaveProperty("futureSecret");
    const safeRun = toOperationsSafeRun({ ...makeRun(), steps: { secret: "SENTINEL_SECRET" }, token: "SENTINEL_SECRET" } as any);
    expect(safeRun.steps).toEqual(emptyOperationsSteps());
    expect(JSON.stringify(safeRun)).not.toContain("SENTINEL_SECRET");
    const row: OperationsQueueEntry = { kind: "booking", id: 1, bookingId: 1, clientName: "Client", techName: "Tech", serviceName: "Gel", scheduledAt: now, dueAt: now, status: "paid", amountInCents: 5001, issueReason: null };
    expect(toOperationsQueueEntry({ ...row, phone: "SENTINEL_SECRET", stripePaymentIntentId: "SENTINEL_SECRET", codeHash: "SENTINEL_SECRET" } as any)).toEqual(row);
    expect(toOperationsQueueEntry({ ...row, issueReason: "Reported service issue" }).issueReason).toBe("Reported service issue");
    expect(toOperationsQueueEntry({ ...row, issueReason: "x".repeat(3000) }).issueReason).toHaveLength(2000);
  });
  it("lease boundary is exclusive, and completions are fenced by run ID and status", () => {
    const job = makeJob({ leaseToken: "prior-run", leaseUntil: now });
    expect(hasActiveOperationsLease(job, now)).toBe(false);
    job.leaseUntil = new Date(now.getTime() + 1);
    expect(hasActiveOperationsLease(job, now)).toBe(true);
    expect(canFinishOperationsRun(job, makeRun({ status: "running" }), now)).toBe(true);
    expect(canFinishOperationsRun(job, makeRun(), now)).toBe(false);
    expect(canFinishOperationsRun(job, makeRun({ id: "another", status: "running" }), now)).toBe(false);
  });
  it("distinguishes registration, pause, verification, never-run, running, stale, failure and modes", () => {
    const job = makeJob();
    const run = makeRun();
    expect(evaluateOperationsHealth(null, null, now).state).toBe("unregistered");
    expect(evaluateOperationsHealth({ ...job, scheduleEnabled: false }, null, now).state).toBe("paused");
    expect(evaluateOperationsHealth({ ...job, schedulerVerifiedAt: null }, null, now).state).toBe("unverified");
    expect(evaluateOperationsHealth(job, null, now).state).toBe("never_run");
    expect(evaluateOperationsHealth({ ...job, leaseUntil: new Date(now.getTime() + 1) }, { ...run, status: "running", completedAt: null }, now).state).toBe("running");
    expect(evaluateOperationsHealth(job, { ...run, status: "running", completedAt: null }, now).state).toBe("stale");
    expect(evaluateOperationsHealth(job, run, new Date(now.getTime() + OPERATIONS_STALE_MS + 1)).state).toBe("stale");
    expect(evaluateOperationsHealth(job, { ...run, status: "partial_failure" }, now).state).toBe("failed");
    expect(evaluateOperationsHealth(job, run, now).state).toBe("healthy_observation");
    expect(evaluateOperationsHealth({ ...job, executionMode: "execute" }, run, now).state).toBe("mode_mismatch");
    expect(evaluateOperationsHealth({ ...job, executionMode: "execute" }, { ...run, executionMode: "execute" }, now).state).toBe("healthy_execute");
    const steps = emptyOperationsSteps();
    steps.payouts = { status: "succeeded", counts: { failed: 1 } };
    expect(operationsStatusFromSteps(steps)).toBe("partial_failure");
    expect(evaluateOperationsHealth(job, { ...run, steps }, now).state).toBe("failed");
  });
});

describe("SELECT-only snapshots (offline query spy)", () => {
  it("missing DB throws rather than fabricating healthy empty data", async () => {
    await expect(getOperationsSnapshot("production", now)).rejects.toThrow("OPERATIONS_DATABASE_UNAVAILABLE");
  });
  it.each(["production", "development"] as const)("uses full counts, caps combined queues, excludes private columns, and scopes %s", async environment => {
    const reads: Array<{ table: string; selection: any; where: SQL; limit?: number }> = [];
    const db: any = {
      select(selection?: any) {
        const read: any = { selection };
        const chain: any = {
          from(table: any) { read.table = getTableName(table); return chain; },
          where(where: SQL) { read.where = where; return chain; },
          limit(limit: number) { read.limit = limit; return chain; },
          orderBy() { return chain; }, innerJoin() { return chain; }, leftJoin() { return chain; },
          then(resolve: any, reject: any) {
            reads.push(read);
            let result: any[] = [];
            if (read.selection?.count) result = [{ count: read.table === "booking_fee_events" ? 12 : 30 }];
            else if (read.selection?.clientName) result = Array.from({ length: 20 }, (_, index) => ({
              id: index + 1, bookingId: index + 1, clientName: "Client", techName: "Tech", serviceName: "Gel",
              scheduledAt: now, dueAt: now, status: "pending_dispute_window", amountInCents: "5000",
              issueReason: "Customer-reported issue",
              passwordHash: "SENTINEL_SECRET",
            }));
            return Promise.resolve(result).then(resolve, reject);
          },
        };
        return chain;
      },
    };
    mock.db = db;
    const snapshot = await getOperationsSnapshot(environment, now);
    expect(snapshot.job).toBeNull();
    expect(snapshot.recentRuns).toEqual([]);
    for (const key of ["overduePayouts", "failedTransfers", "paymentsDue", "unresolvedDisputes"] as const) {
      expect(snapshot.counts[key]).toBe(42);
      expect(snapshot.queues[key]).toHaveLength(20);
      expect(snapshot.queues[key][0].issueReason).toBe("Customer-reported issue");
    }
    expect(snapshot.counts.appointmentCodesDue).toBe(30);
    expect(JSON.stringify(snapshot)).not.toContain("SENTINEL_SECRET");
    for (const read of reads.filter(r => r.table === "bookings" || r.table === "booking_fee_events")) {
      const query = dialect.sqlToQuery(read.where);
      expect(query.sql).toContain("`bookings`.`isQaTest` = ?");
      expect(query.params[0]).toBe(environment === "development");
      if (read.selection?.count) expect(read.limit).toBeUndefined();
      if (read.selection?.clientName) {
        expect(Object.keys(read.selection).sort()).toEqual(["amountInCents", "bookingId", "clientName", "dueAt", "id", "issueReason", "scheduledAt", "serviceName", "status", "techName"].sort());
        expect(read.limit).toBe(20);
      }
    }
    const payoutReads = reads.filter(r => r.table === "bookings" && dialect.sqlToQuery(r.where).params.includes("paid"));
    expect(payoutReads).toHaveLength(2);
    for (const read of payoutReads) {
      const query = dialect.sqlToQuery(read.where);
      expect(query.params).toContain("pending_dispute_window");
      expect(query.params).not.toContain("on_hold");
      expect(query.sql).toContain("`bookings`.`payoutEligibleAt` <= ?");
      expect(query.sql).toContain("`bookings`.`issueResolvedAt` is not null");
    }
    const feePayoutReads = reads.filter(r => r.table === "booking_fee_events" && dialect.sqlToQuery(r.where).params.includes("charged"));
    expect(feePayoutReads).toHaveLength(2);
    for (const read of feePayoutReads) {
      const query = dialect.sqlToQuery(read.where);
      expect(query.params).toContain("upheld");
      expect(query.params).not.toContain("on_hold");
      expect(query.sql).toContain("`booking_fee_events`.`adminResolvedAt` is not null");
    }
    const smsRead = reads.at(-1)!;
    const smsSql = dialect.sqlToQuery(smsRead.where).sql;
    expect(smsSql).toContain("`users`.`smsConsent` = ?");
    expect(smsSql).toContain("`users`.`phone` is not null");
    expect(smsSql).toContain("TRIM(`users`.`phone`) <> ''");
    expect(Object.keys(smsRead.selection)).toEqual(["count"]);
  });
});
