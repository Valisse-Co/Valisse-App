type Job = { scheduleCronTaskUid: string | null; scheduleEnabled: boolean; executionMode: string };
type Run = { status: string; executionMode: string; startedAt: Date; completedAt: Date | null };
export function operationsHealth(job: Job | null, runs: Run[], now = new Date()) {
  if (!job?.scheduleCronTaskUid) return { label: "Not scheduled", tone: "warning" as const, detail: "No registered production callback has been verified. The worker existing in code does not mean it is running." };
  if (!job.scheduleEnabled) return { label: "Schedule paused", tone: "warning" as const, detail: "The registered schedule is disabled. No automated processing should be expected." };
  const latest = runs[0];
  if (!latest) return { label: "Awaiting first delivery", tone: "warning" as const, detail: "A schedule is registered, but this application has not recorded a callback yet." };
  if (latest.status === "running") return now.getTime() - latest.startedAt.getTime() > 180_000
    ? { label: "Run stalled", tone: "danger" as const, detail: "A run did not finish within its lease. Investigate before treating the job as healthy." }
    : { label: "Run in progress", tone: "neutral" as const, detail: "The application is currently handling a registered heartbeat." };
  if (now.getTime() - (latest.completedAt ?? latest.startedAt).getTime() > 15 * 60_000) return { label: "Heartbeat overdue", tone: "danger" as const, detail: "No recent completed callback was recorded. Check the deployed schedule and its execution logs." };
  if (["failed", "abandoned"].includes(latest.status)) return { label: "Last run failed", tone: "danger" as const, detail: "The last callback failed or timed out. Review its step results; eligible work may remain pending." };
  if (latest.status !== "succeeded") return { label: "Needs attention", tone: "warning" as const, detail: "One or more steps failed or deferred work. This is not a fully successful execution." };
  if (latest.executionMode !== job.executionMode) return { label: "Policy change not verified", tone: "warning" as const, detail: "No successful callback under the current execution policy has been recorded." };
  if (job.executionMode === "observe_only") return { label: "Observation verified", tone: "neutral" as const, detail: "Read-only heartbeat delivery is working. Charges, transfers, messages, and fee changes remain disabled for this job." };
  if (job.executionMode === "payouts_only") return { label: "Automatic payouts verified", tone: "success" as const, detail: "The payout-only callback completed successfully. It checks future captured payments after their review window and settlement; historical payments, new charges, SMS and attendance changes are not enabled." };
  return { label: "Execution verified", tone: "success" as const, detail: "The last registered processing callback completed successfully. Check each step and remaining queue counts below." };
}
export const OPERATION_QUEUE_LABELS = {
  overduePayouts: "Overdue payouts",
  failedTransfers: "Failed transfers",
  paymentsDue: "Payments due",
  unresolvedDisputes: "Unresolved disputes",
} as const;
export type OperationQueueKey = keyof typeof OPERATION_QUEUE_LABELS;
export function operationsIssuePath(row: { kind: string; id: number; bookingId: number }) {
  const params = new URLSearchParams({ bookingId: String(row.bookingId) });
  if (row.kind === "fee") params.set("feeEventId", String(row.id));
  return `/admin/reports?${params}`;
}
