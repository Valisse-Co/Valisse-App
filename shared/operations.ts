export const OPERATIONS_JOB_KEY = "appointment_operations" as const;
export const OPERATIONS_CALLBACK_PATH = "/api/scheduled/release-payouts" as const;
export const OPERATIONS_CRON_EXPRESSION = "0 */5 * * * *" as const;
export const OPERATIONS_LEASE_MS = 3 * 60_000;
export const OPERATIONS_STALE_MS = 15 * 60_000;
export const OPERATIONS_PAGE_SIZE = 20;

export type OperationsEnvironment = "production" | "development";
export type OperationsExecutionMode = "observe_only" | "execute";
export type OperationsRunStatus = "running" | "succeeded" | "partial_failure" | "failed" | "abandoned";
export type OperationsFinalStatus = Exclude<OperationsRunStatus, "running">;
export const OPERATIONS_STEP_KEYS = ["payouts", "appointment_codes", "attendance_fees"] as const;
export type OperationsStepKey = typeof OPERATIONS_STEP_KEYS[number];
export type OperationsStepStatus = "observed" | "succeeded" | "deferred" | "failed" | "skipped";
export const OPERATIONS_COUNT_KEYS = [
  "checked", "released", "deferred", "failed", "found", "sent", "skipped", "created",
  "overduePayouts", "failedTransfers", "paymentsDue", "unresolvedDisputes", "appointmentCodesDue",
] as const;
// Closed vocabulary: arbitrary strings can contain provider errors, secrets or IDs.
export const OPERATIONS_ERROR_CODES = ["STEP_FAILED", "DATABASE_UNAVAILABLE", "LEASE_EXPIRED", "INTERNAL_ERROR", "STEP_DEFERRED", "OBSERVATION_FAILED"] as const;
export type OperationsErrorCode = typeof OPERATIONS_ERROR_CODES[number];
export type OperationsStepSummary = {
  status: OperationsStepStatus;
  counts: Record<string, number>;
  errorCode?: OperationsErrorCode;
};
export type OperationsSteps = Record<OperationsStepKey, OperationsStepSummary>;

export type OperationsSafeJob = {
  jobId: number;
  jobKey: string;
  environment: OperationsEnvironment;
  scheduleCronTaskUid: string | null;
  callbackPath: string;
  cronExpression: string;
  scheduleEnabled: boolean;
  executionMode: OperationsExecutionMode;
  schedulerVerifiedAt: Date | null;
  providerLastExecutedAt: Date | null;
  providerNextExecutionAt: Date | null;
  leaseUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type OperationsSafeRun = {
  id: string;
  jobId: number;
  environment: OperationsEnvironment;
  executionMode: OperationsExecutionMode;
  status: OperationsRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  steps: OperationsSteps;
  source: "heartbeat";
  createdAt: Date;
};
export type OperationsQueueEntry = {
  kind: "booking" | "fee";
  id: number;
  bookingId: number;
  clientName: string | null;
  techName: string | null;
  serviceName: string | null;
  scheduledAt: Date | null;
  dueAt: Date | null;
  status: string;
  amountInCents: number | null;
  // Admin-only customer-reported issue, capped at 2,000 characters; never provider failure text.
  issueReason: string | null;
};
export type OperationsQueueKey = "overduePayouts" | "failedTransfers" | "paymentsDue" | "unresolvedDisputes";
export type OperationsSnapshot = {
  environment: OperationsEnvironment;
  generatedAt: Date;
  job: OperationsSafeJob | null;
  recentRuns: OperationsSafeRun[];
  counts: Record<OperationsQueueKey | "appointmentCodesDue", number>;
  queues: Record<OperationsQueueKey, OperationsQueueEntry[]>;
};

export function assertOperationsEnvironment(value: unknown): asserts value is OperationsEnvironment {
  if (value !== "production" && value !== "development") throw new Error("INVALID_OPERATIONS_ENVIRONMENT");
}
export function assertOperationsDate(value: Date): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error("INVALID_OPERATIONS_DATE");
}
export function hasActiveOperationsLease(job: { leaseToken: string | null; leaseUntil: Date | null }, now: Date): boolean {
  return Boolean(job.leaseToken && job.leaseUntil && job.leaseUntil.getTime() > now.getTime());
}
export function canFinishOperationsRun(
  job: { leaseToken: string | null; leaseUntil: Date | null },
  run: { id: string; status: OperationsRunStatus },
  now: Date,
): boolean {
  return run.status === "running" && job.leaseToken === run.id && hasActiveOperationsLease(job, now);
}
export function emptyOperationsSteps(): OperationsSteps {
  return {
    payouts: { status: "skipped", counts: {} },
    appointment_codes: { status: "skipped", counts: {} },
    attendance_fees: { status: "skipped", counts: {} },
  };
}

/** Strict write-boundary validation; returns a fresh allowlisted object. */
export function validateOperationsSteps(value: unknown): OperationsSteps {
  const invalid = () => { throw new Error("INVALID_OPERATIONS_STEPS"); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 3 || Object.keys(input).some(k => !(OPERATIONS_STEP_KEYS as readonly string[]).includes(k))) return invalid();
  const result = emptyOperationsSteps();
  for (const key of OPERATIONS_STEP_KEYS) {
    const raw = input[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid();
    const step = raw as Record<string, unknown>;
    if (Object.keys(step).some(k => !["counts", "status", "errorCode"].includes(k)) ||
      typeof step.status !== "string" || !["observed", "succeeded", "deferred", "failed", "skipped"].includes(step.status) ||
      !step.counts || typeof step.counts !== "object" || Array.isArray(step.counts) ||
      (step.errorCode !== undefined && !(OPERATIONS_ERROR_CODES as readonly unknown[]).includes(step.errorCode))) return invalid();
    const counts: Record<string, number> = {};
    for (const [name, count] of Object.entries(step.counts)) {
      if (!(OPERATIONS_COUNT_KEYS as readonly string[]).includes(name) || !Number.isSafeInteger(count) || Number(count) < 0) return invalid();
      counts[name] = Number(count);
    }
    result[key] = {
      status: step.status as OperationsStepStatus, counts,
      ...(step.errorCode === undefined ? {} : { errorCode: step.errorCode as OperationsErrorCode }),
    };
  }
  return result;
}
export function operationsStatusFromSteps(steps: OperationsSteps): "succeeded" | "partial_failure" {
  return Object.values(steps).some(step => step.status === "failed" || step.status === "deferred" ||
    (step.counts.failed ?? 0) > 0 || (step.counts.deferred ?? 0) > 0) ? "partial_failure" : "succeeded";
}

export function toOperationsSafeJob(job: OperationsSafeJob): OperationsSafeJob {
  return {
    jobId: job.jobId, jobKey: job.jobKey, environment: job.environment,
    scheduleCronTaskUid: job.scheduleCronTaskUid, callbackPath: job.callbackPath,
    cronExpression: job.cronExpression, scheduleEnabled: job.scheduleEnabled,
    executionMode: job.executionMode, schedulerVerifiedAt: job.schedulerVerifiedAt,
    providerLastExecutedAt: job.providerLastExecutedAt, providerNextExecutionAt: job.providerNextExecutionAt,
    leaseUntil: job.leaseUntil, createdAt: job.createdAt, updatedAt: job.updatedAt,
  };
}
export function toOperationsSafeRun(run: OperationsSafeRun): OperationsSafeRun {
  let steps = emptyOperationsSteps();
  try { steps = validateOperationsSteps(run.steps); } catch { /* Malformed JSON is not disclosed. */ }
  return {
    id: run.id, jobId: run.jobId, environment: run.environment, executionMode: run.executionMode,
    status: run.status, startedAt: run.startedAt, completedAt: run.completedAt,
    steps, source: "heartbeat", createdAt: run.createdAt,
  };
}
export function toOperationsQueueEntry(row: OperationsQueueEntry): OperationsQueueEntry {
  return {
    kind: row.kind, id: row.id, bookingId: row.bookingId,
    clientName: row.clientName, techName: row.techName, serviceName: row.serviceName,
    scheduledAt: row.scheduledAt, dueAt: row.dueAt, status: row.status,
    amountInCents: row.amountInCents == null ? null : Math.round(Number(row.amountInCents)),
    issueReason: typeof row.issueReason === "string" ? row.issueReason.slice(0, 2000) : null,
  };
}

export type OperationsHealthState = "unregistered" | "paused" | "never_run" | "unverified" | "running" | "stale" | "failed" | "mode_mismatch" | "healthy_observation" | "healthy_execute";
export type OperationsHealth = {
  state: OperationsHealthState;
  isHealthy: boolean;
  executionMode: OperationsExecutionMode | null;
  lastActivityAt: Date | null;
  staleAfterMs: number;
};
/** Provider last-executed metadata is not proof that our worker succeeded. */
export function evaluateOperationsHealth(
  job: OperationsSafeJob | null,
  lastRun: OperationsSafeRun | null | undefined,
  now = new Date(),
): OperationsHealth {
  assertOperationsDate(now);
  const lastActivityAt = lastRun?.completedAt ?? lastRun?.startedAt ?? null;
  const result = (state: OperationsHealthState): OperationsHealth => ({
    state, isHealthy: state === "healthy_observation" || state === "healthy_execute",
    executionMode: job?.executionMode ?? null, lastActivityAt, staleAfterMs: OPERATIONS_STALE_MS,
  });
  if (!job) return result("unregistered");
  if (!job.scheduleEnabled) return result("paused");
  if (!job.scheduleCronTaskUid || !job.schedulerVerifiedAt) return result("unverified");
  if (!lastRun) return result("never_run");
  if (lastRun.status === "running") {
    return result(job.leaseUntil && job.leaseUntil.getTime() > now.getTime() ? "running" : "stale");
  }
  if (!lastActivityAt || now.getTime() - lastActivityAt.getTime() > OPERATIONS_STALE_MS) return result("stale");
  if (lastRun.status !== "succeeded" || operationsStatusFromSteps(lastRun.steps) !== "succeeded") return result("failed");
  if (lastRun.executionMode !== job.executionMode) return result("mode_mismatch");
  return result(lastRun.executionMode === "observe_only" ? "healthy_observation" : "healthy_execute");
}
