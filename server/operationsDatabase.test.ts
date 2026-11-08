import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { operationsJobs, operationsRuns } from "../drizzle/schema";
import { getDb } from "./db";
import { beginOperationsRun, finishOperationsRun } from "./operationsDb";
import { emptyOperationsSteps, OPERATIONS_JOB_KEY, OPERATIONS_LEASE_MS } from "../shared/operations";

// Opt-in only: no booking/account/provider changes and no scheduled task exists.
// The test refuses to overwrite an existing development registry, and cleans only
// its own job/runs. Fake task UID is disabled and never registered with Heartbeat.
describe.skipIf(process.env.RUN_OPERATIONS_DB_INTEGRATION !== "true")("operations real database lease adapter", () => {
  it("persists a single concurrent lease, fences expired completions, and cleans its disposable records", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const [existing] = await db.select().from(operationsJobs).where(and(eq(operationsJobs.jobKey, OPERATIONS_JOB_KEY), eq(operationsJobs.environment, "development"))).limit(1);
    if (existing) throw new Error("Development registry already exists; do not replace it for a test");
    const taskUid = `test_${randomUUID()}`;
    let jobId: number | undefined;
    try {
      await db.insert(operationsJobs).values({ jobKey: OPERATIONS_JOB_KEY, environment: "development", scheduleCronTaskUid: taskUid, scheduleEnabled: false, executionMode: "observe_only" });
      const [created] = await db.select().from(operationsJobs).where(eq(operationsJobs.scheduleCronTaskUid, taskUid)).limit(1);
      if (!created) throw new Error("Disposable operations job was not created");
      jobId = created.jobId;
      const now = new Date();
      const results = await Promise.all([beginOperationsRun(jobId, now), beginOperationsRun(jobId, now), beginOperationsRun(jobId, now)]);
      const granted = results.filter(result => result !== null);
      expect(granted).toHaveLength(1);
      const first = granted[0]!;
      const [stored] = await db.select().from(operationsRuns).where(eq(operationsRuns.id, first.runId));
      expect(stored.status).toBe("running");
      expect(stored.executionMode).toBe("observe_only");
      expect(await finishOperationsRun(first.runId, "succeeded", emptyOperationsSteps(), new Date(now.getTime() + 1000))).toBe(true);
      expect(await finishOperationsRun(first.runId, "succeeded", emptyOperationsSteps(), new Date(now.getTime() + 2000))).toBe(false);
      const second = await beginOperationsRun(jobId, new Date(now.getTime() + 2000));
      expect(second).not.toBeNull();
      const afterExpiry = new Date(now.getTime() + 2000 + OPERATIONS_LEASE_MS + 1000);
      const third = await beginOperationsRun(jobId, afterExpiry);
      expect(third).not.toBeNull();
      expect(await finishOperationsRun(second!.runId, "succeeded", emptyOperationsSteps(), afterExpiry)).toBe(false);
      const [abandoned] = await db.select().from(operationsRuns).where(eq(operationsRuns.id, second!.runId));
      expect(abandoned.status).toBe("abandoned");
      expect(await finishOperationsRun(third!.runId, "succeeded", emptyOperationsSteps(), new Date(afterExpiry.getTime() + 1000))).toBe(true);
    } finally {
      if (jobId !== undefined) await db.delete(operationsRuns).where(eq(operationsRuns.jobId, jobId));
      await db.delete(operationsJobs).where(and(eq(operationsJobs.scheduleCronTaskUid, taskUid), eq(operationsJobs.environment, "development")));
    }
  }, 30_000);
});
