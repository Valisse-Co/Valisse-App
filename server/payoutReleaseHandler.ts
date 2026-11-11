import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { releaseEligiblePayouts } from "./payoutRelease";
import { sendDueAppointmentCodeSms } from "./appointmentSms";
import { evaluateAttendanceFeeEligibility } from "./appointmentFees";
import { beginOperationsRun, finishOperationsRun, getOperationsJobByTaskUid, getOperationsSnapshot } from "./operationsDb";
import { emptyOperationsSteps, OPERATIONS_CALLBACK_PATH, OPERATIONS_JOB_KEY, operationsStatusFromSteps, type OperationsEnvironment, type OperationsStepSummary, type OperationsSteps } from "../shared/operations";
import { safeErrorDetails } from "./securityLogging";
import { assertFuturePayoutPolicy, PayoutRunBudget, releaseFutureAutomaticPayouts } from "./automaticPayout";

/** Determined by the server, never a callback body or query parameter. */
export function operationsRuntimeEnvironment(): OperationsEnvironment {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}
function workerSummary(value: Record<string, unknown>): OperationsStepSummary {
  const counts: Record<string, number> = {};
  for (const key of ["checked", "released", "deferred", "failed", "found", "sent", "skipped", "created"]) {
    if (Number.isSafeInteger(value[key]) && Number(value[key]) >= 0) counts[key] = Number(value[key]);
  }
  const failed = (counts.failed ?? 0) > 0;
  const deferred = (counts.deferred ?? 0) > 0 || (counts.skipped ?? 0) > 0;
  return { status: failed ? "failed" : deferred ? "deferred" : "succeeded", counts,
    ...(failed ? { errorCode: "STEP_FAILED" as const } : deferred ? { errorCode: "STEP_DEFERRED" as const } : {}) };
}

/** Settled steps do not hide each other's result or continue after a response. */
export async function executeOperationsSteps(now: Date): Promise<OperationsSteps> {
  const steps = emptyOperationsSteps();
  const workers = [
    ["payouts", () => releaseEligiblePayouts(now)],
    ["appointment_codes", () => sendDueAppointmentCodeSms(now)],
    ["attendance_fees", () => evaluateAttendanceFeeEligibility(now)],
  ] as const;
  const results = await Promise.allSettled(workers.map(async ([key, run]) => ({ key, result: await run() })));
  results.forEach((result, index) => {
    const key = workers[index][0];
    steps[key] = result.status === "fulfilled" ? workerSummary(result.value.result) : { status: "failed", counts: {}, errorCode: "STEP_FAILED" };
    if (result.status === "rejected") console.error("[Operations] Step failed", { step: key, ...safeErrorDetails(result.reason) });
  });
  return steps;
}

export async function handlePayoutRelease(req: Request, res: Response) {
  const enteredAt = Date.now();
  const callbackBudget = new PayoutRunBudget(enteredAt + 110_000);
  let user;
  try { user = await callbackBudget.wait(() => sdk.authenticateCronRequest(req), 8_000); }
  catch { return res.status(403).json({ ok: false, error: "cron-only" }); }
  if (!user.isCron || !user.taskUid) return res.status(403).json({ ok: false, error: "cron-only" });
  const environment = operationsRuntimeEnvironment();
  let runId: string | null = null;
  try {
    const job = await callbackBudget.wait(() => getOperationsJobByTaskUid(user.taskUid!, environment), 8_000);
    if (!job || job.jobKey !== OPERATIONS_JOB_KEY || job.callbackPath !== OPERATIONS_CALLBACK_PATH ||
      !job.scheduleEnabled || req.path !== OPERATIONS_CALLBACK_PATH) {
      return res.status(403).json({ ok: false, error: "unregistered-or-disabled-task" });
    }
    // Observation is the only policy authorized during launch verification.
    // Future execution additionally requires explicit deployment-level approval.
    if (job.executionMode === "execute" && process.env.VALISSE_OPERATIONS_EXECUTION_APPROVED !== "true") {
      return res.status(403).json({ ok: false, error: "execution-not-approved" });
    }
    if (job.executionMode === "payouts_only") {
      assertFuturePayoutPolicy({ environment, cutoff: job.payoutsFrom!, approvedAt: job.payoutsApprovedAt! });
    }
    const started = await callbackBudget.wait(() => beginOperationsRun(job.jobId), 8_000);
    if (!started) return res.status(429).json({ ok: false, error: "run-already-in-progress" });
    runId = started.runId;
    if (!started.job.scheduleEnabled || started.job.scheduleCronTaskUid !== user.taskUid ||
      started.job.environment !== environment || started.job.callbackPath !== OPERATIONS_CALLBACK_PATH) {
      await finishOperationsRun(runId, "abandoned", emptyOperationsSteps());
      return res.status(409).json({ ok: false, error: "registration-changed", runId, environment });
    }
    const now = new Date();
    let steps: OperationsSteps;
    // Use the policy captured under the lease, not any mutable request payload.
    if (started.job.executionMode === "observe_only") {
      const snapshot = await callbackBudget.wait(() => getOperationsSnapshot(environment, now), 20_000);
      steps = {
        payouts: { status: "observed", counts: { overduePayouts: snapshot.counts.overduePayouts, failedTransfers: snapshot.counts.failedTransfers, paymentsDue: snapshot.counts.paymentsDue, unresolvedDisputes: snapshot.counts.unresolvedDisputes } },
        appointment_codes: { status: "observed", counts: { appointmentCodesDue: snapshot.counts.appointmentCodesDue } },
        attendance_fees: { status: "skipped", counts: {} },
      };
    } else if (started.job.executionMode === "payouts_only") {
      const policy = { environment, cutoff: started.job.payoutsFrom!, approvedAt: started.job.payoutsApprovedAt! };
      assertFuturePayoutPolicy(policy, now);
      steps = emptyOperationsSteps();
      steps.payouts = workerSummary(await releaseFutureAutomaticPayouts(policy, now, enteredAt + 95_000));
      // Payout activation never enables appointment SMS or attendance/fee creation.
    } else {
      // A launch-verification task must never execute financial work in preview.
      if (environment !== "production" || process.env.VALISSE_OPERATIONS_EXECUTION_APPROVED !== "true") {
        throw new Error("EXECUTION_NOT_APPROVED");
      }
      steps = await executeOperationsSteps(now);
    }
    const status = operationsStatusFromSteps(steps);
    const persisted = await callbackBudget.wait(() => finishOperationsRun(runId!, status, steps), 8_000);
    if (!persisted) return res.status(409).json({ ok: false, error: "run-lease-expired", runId, environment });
    return res.json({ ok: status === "succeeded", state: status, runId, environment, mode: started.job.executionMode, steps });
  } catch (error) {
    console.error("[Operations] Callback failed", safeErrorDetails(error));
    if (runId) {
      try {
        const steps = emptyOperationsSteps();
        steps.payouts = { status: "failed", counts: {}, errorCode: "INTERNAL_ERROR" };
        await callbackBudget.wait(() => finishOperationsRun(runId!, "failed", steps), 5_000);
      } catch (persistError) { console.error("[Operations] Run outcome could not be persisted", safeErrorDetails(persistError)); }
    }
    return res.status(500).json({ ok: false, error: "operations-callback-failed", environment, timestamp: new Date().toISOString() });
  }
}
