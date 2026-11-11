import { useState } from "react";
import { useLocation } from "wouter";
import { Activity, AlertTriangle, ArrowLeft, ArrowUpRight, Clock3, CreditCard, Eye, Landmark, Loader2, MessageSquare, RefreshCw, Settings, ShieldAlert } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout, { type DashboardMenuItem } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatUsdCents } from "@shared/money";
import { operationsHealth, operationsIssuePath, OPERATION_QUEUE_LABELS, type OperationQueueKey } from "@shared/operationsPresentation";

type Snapshot = inferRouterOutputs<AppRouter>["operations"]["snapshot"];
type QueueItem = Snapshot["queues"]["overduePayouts"][number];
const adminMenu: DashboardMenuItem[] = [
  { icon: Activity, label: "Operations", path: "/admin/operations" },
  { icon: ShieldAlert, label: "Reports & disputes", path: "/admin/reports" },
  { icon: Settings, label: "Back to app Settings", path: "/settings" },
];
const toneClasses = {
  warning: "border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200",
  danger: "border-red-300/60 bg-red-50 text-red-900 dark:bg-red-950/20 dark:text-red-200",
  neutral: "border-sky-300/60 bg-sky-50 text-sky-900 dark:bg-sky-950/20 dark:text-sky-200",
  success: "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200",
};
function dateTime(value: Date | null | undefined) {
  return value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not recorded";
}
function human(value: string) { return value.replaceAll("_", " "); }

export default function AdminOperations() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [environment, setEnvironment] = useState<"production" | "development">("production");
  const [queue, setQueue] = useState<OperationQueueKey>("overduePayouts");
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const query = trpc.operations.snapshot.useQuery({ environment }, {
    enabled: user?.role === "admin", retry: false, refetchInterval: 30_000, refetchOnWindowFocus: true,
  });
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" aria-label="Loading account" /></div>;
  if (user?.role !== "admin") return <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 text-center"><ShieldAlert className="mx-auto text-destructive" /><h1 className="text-xl font-semibold">Administrator access required</h1><p className="text-sm text-muted-foreground">Operations and payment monitoring are private to Valisse administrators.</p><Button variant="outline" onClick={() => navigate(user ? "/settings" : "/login")}>Back to {user ? "Settings" : "sign in"}</Button></div>;
  const data = query.data;
  const health = data ? operationsHealth(data.job, data.recentRuns) : null;
  const metrics = [
    { key: "overduePayouts" as const, icon: Clock3, detail: "Past the hold window and awaiting release" },
    { key: "failedTransfers" as const, icon: Landmark, detail: "Require reconciliation or follow-up" },
    { key: "paymentsDue" as const, icon: CreditCard, detail: "Client payment has not been resolved" },
    { key: "unresolvedDisputes" as const, icon: ShieldAlert, detail: "Cases requiring administrator review" },
  ];
  return <DashboardLayout items={adminMenu} title="Valisse administration">
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4 pt-2">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Private administrator workspace</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Operations</h1><p className="mt-1 max-w-xl text-sm text-muted-foreground">Heartbeat evidence, processing results, and appointments that need attention.</p></div>
        <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} />Refresh</Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Operations environment" className="inline-flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          <Button size="sm" variant={environment === "production" ? "default" : "ghost"} onClick={() => { setEnvironment("production"); setSelected(null); }}>Production</Button>
          <Button size="sm" variant={environment === "development" ? "default" : "ghost"} onClick={() => { setEnvironment("development"); setSelected(null); }}>QA preview</Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Eye size={14} />Read-only monitoring · refreshes every 30 seconds</p>
      </div>
      {query.error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"><p className="font-semibold text-destructive">Operations data could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">{query.error.message}</p><p className="mt-1 text-xs text-muted-foreground">Unavailable data is not an empty or healthy queue. Refresh after checking the database.</p></div>}
      {query.isLoading && <Card className="flex items-center gap-3 p-6"><Loader2 size={18} className="animate-spin text-primary" /><p className="text-sm text-muted-foreground">Loading job evidence and attention queues…</p></Card>}
      {data && health && <>
        {data.runtimeEnvironment !== environment && <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">This page is running in {data.runtimeEnvironment}, while the selected data scope is {environment}. Preview runs never verify production execution.</p>}
        <section className={`rounded-2xl border p-5 ${toneClasses[health.tone]}`} aria-label="Scheduler health">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide">{environment === "production" ? "Production" : "QA preview"} heartbeat</p><h2 className="mt-1 text-lg font-semibold">{health.label}</h2></div><span className="rounded-full border border-current/20 px-3 py-1 text-xs font-medium">{data.job?.executionMode === "execute" ? "Processing enabled" : "Observation only · no money or messages"}</span></div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed">{health.detail}</p>
          <div className="mt-4 grid gap-3 border-t border-current/10 pt-4 text-xs sm:grid-cols-3"><div><p className="opacity-70">Last recorded completion</p><p className="mt-1 font-medium">{dateTime(data.recentRuns[0]?.completedAt)}</p></div><div><p className="opacity-70">Provider's next scheduled delivery</p><p className="mt-1 font-medium">{dateTime(data.job?.providerNextExecutionAt)}</p></div><div><p className="opacity-70">Cadence</p><p className="mt-1 font-medium">{data.job?.cronExpression ?? "Not configured"}</p></div></div>
          {!data.job?.scheduleCronTaskUid && <p className="mt-3 text-xs">Deployment and registration of an observation-only heartbeat are required before delivery can be verified. This dashboard cannot start financial work.</p>}
        </section>
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label="Platform funds and bank payout risk">
          <div className="flex items-center gap-2"><Landmark size={18} className="text-primary" /><h2 className="font-semibold text-foreground">Platform funds and bank payouts</h2></div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Client charges first enter Valisse's Stripe balance. A separate transfer pays the technician's Stripe account; its bank payout happens separately.</p>
          {data.platformFunds.status === "available" ? <>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"><div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Available USD · {data.platformFunds.mode}</p><p className="mt-1 font-semibold text-foreground">{formatUsdCents(data.platformFunds.availableUsdInCents)}</p></div><div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Pending USD</p><p className="mt-1 font-semibold text-foreground">{formatUsdCents(data.platformFunds.pendingUsdInCents)}</p></div><div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Valisse bank payout schedule</p><p className="mt-1 font-semibold capitalize text-foreground">{data.platformFunds.payoutSchedule}</p></div></div>
            {data.platformFunds.automaticBankPayouts && <p role="alert" className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">Automatic payouts to Valisse's bank can consume funds still owed to technicians. A paid client charge is not a completed technician transfer. Review the platform's payout schedule and fund outstanding transfers before withdrawing platform earnings.</p>}
            {data.counts.overduePayouts > 0 && data.platformFunds.availableUsdInCents <= 0 && <p role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive">There are overdue technician transfers and no available USD platform balance. Reconcile the original charges and any platform bank payouts before funding the balance. Do not charge clients again to correct a payout problem.</p>}
            <p className="mt-3 text-[11px] text-muted-foreground">Read from Stripe {dateTime(data.platformFunds.observedAt)}. This monitor does not fund accounts, change payout settings, or release money.</p>
          </> : <p className="mt-3 text-xs text-muted-foreground">{data.platformFunds.status === "scope_mismatch" ? "The configured Stripe key does not match the selected environment. No cross-environment balance was queried." : data.platformFunds.status === "unconfigured" ? "Stripe is not configured for this server." : "Stripe balance could not be read. Funds are unknown—not zero—and the application queues remain available."}</p>}
        </section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(metric => <button key={metric.key} onClick={() => setQueue(metric.key)} className={`rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/50 ${queue === metric.key ? "border-primary/60" : "border-border"}`}><metric.icon size={18} className="text-primary" /><p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{data.counts[metric.key]}</p><p className="mt-1 text-xs font-semibold text-foreground">{OPERATION_QUEUE_LABELS[metric.key]}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{metric.detail}</p></button>)}
        </div>
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-foreground">{OPERATION_QUEUE_LABELS[queue]}</h2><span className="text-xs text-muted-foreground">{data.queues[queue].length} shown · {data.counts[queue]} total</span></div>
          <p className="mt-1 text-xs text-muted-foreground">Production excludes QA appointments. Queue rows are limited to 20; totals cover the full matching queue.</p>
          <p className="mt-1 text-xs text-muted-foreground">Service rows show the client's gross service amount, not the technician's net payout. Overdue payout rows have already passed their review window and await a recorded transfer.</p>
          {data.queues[queue].length === 0 ? <div className="py-8 text-center"><p className="text-sm text-foreground">No matching items in this queue.</p><p className="mt-1 text-xs text-muted-foreground">This does not by itself prove that automation is running.</p></div> : <div className="mt-4 divide-y divide-border">
            {data.queues[queue].map(row => <button key={`${row.kind}-${row.id}`} className="flex w-full items-center justify-between gap-3 py-3 text-left" onClick={() => setSelected(row)}><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{row.clientName || "Client"} · {row.techName || "Nail tech"}</p><p className="mt-1 text-xs text-muted-foreground">Booking #{row.bookingId} · {row.serviceName || (row.kind === "fee" ? "Appointment fee" : "Appointment")}</p>{row.issueReason && <p className="mt-1 line-clamp-2 text-xs text-foreground">{row.issueReason}</p>}</div><div className="shrink-0 text-right"><p className="text-xs font-semibold text-foreground">{row.amountInCents === null ? "Amount not available" : formatUsdCents(row.amountInCents)}</p><p className="mt-1 text-[10px] text-muted-foreground">{queue === "overduePayouts" ? "Review ended · awaiting transfer" : human(row.status)}</p></div></button>)}
          </div>}
        </section>
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2"><Activity size={18} className="text-primary" /><h2 className="font-semibold text-foreground">Recent job runs</h2></div><p className="mt-1 text-xs text-muted-foreground">Recorded by authenticated callbacks—not inferred from configuration. Observation and actual processing are shown separately.</p>
          {data.recentRuns.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No application-recorded runs yet.</p> : <div className="mt-4 space-y-3">{data.recentRuns.map(run => <div key={run.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-semibold text-foreground">{human(run.status)} · {run.executionMode === "observe_only" ? "Read-only observation" : "Processing"}</p><p className="text-[11px] text-muted-foreground">{dateTime(run.startedAt)}</p></div><div className="mt-2 grid gap-2 sm:grid-cols-3">{Object.entries(run.steps ?? {}).map(([step, raw]) => { const result = raw as { status?: string; counts?: Record<string, number>; errorCode?: string }; return <div key={step} className="rounded-lg bg-muted/40 p-2 text-[11px]"><p className="font-semibold text-foreground">{human(step)}</p><p className="mt-1 text-muted-foreground">{human(result.status ?? "unknown")}</p>{Object.entries(result.counts ?? {}).map(([key, value]) => <p key={key} className="text-muted-foreground">{human(key)}: {value}</p>)}{result.errorCode && <p className="mt-1 text-destructive">{result.errorCode}</p>}</div>; })}</div></div>)}</div>}
        </section>
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><h2 className="font-semibold text-foreground">Provider configuration</h2><p className="mt-1 text-xs text-muted-foreground">Flags below reflect this server's configuration. They are not a delivery test, webhook verification, or confirmation of a bank payout.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-muted/40 p-3 text-xs"><p className="font-semibold text-foreground">Stripe · {data.providers.stripe.mode}</p><p className="mt-1 text-muted-foreground">Payments webhook: {data.providers.stripe.webhookConfigured ? "configured" : "missing"}</p><p className="text-muted-foreground">Connect webhook: {data.providers.stripe.connectWebhookConfigured ? "configured" : "missing"}</p></div><div className="rounded-xl bg-muted/40 p-3 text-xs"><p className="font-semibold text-foreground">Telnyx · {data.providers.telnyx.configured ? "configured" : "not ready"}</p><p className="mt-1 text-muted-foreground">{data.counts.appointmentCodesDue} consent-eligible appointment codes awaiting delivery</p></div><div className="rounded-xl bg-muted/40 p-3 text-xs"><p className="font-semibold text-foreground">Resend · {data.providers.resend.configured ? "configured" : "not ready"}</p><p className="mt-1 text-muted-foreground">Verification and password-recovery delivery must be validated separately.</p></div></div></section>
        <p className="text-[11px] text-muted-foreground">Data refreshed {dateTime(data.generatedAt)}. Disputes are reviewed in Reports; no action on this page releases funds or retries a card charge.</p>
      </>}
      <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}><ArrowLeft size={14} />Back to Settings</Button>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85vh] max-w-md overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>Booking #{selected?.bookingId} · operations detail</DialogTitle></DialogHeader>{selected && <div className="space-y-4 text-sm"><div><p className="font-semibold text-foreground">{selected.serviceName || "Appointment"}</p><p className="mt-1 text-muted-foreground">Client: {selected.clientName || "Not recorded"}</p><p className="text-muted-foreground">Nail tech: {selected.techName || "Not recorded"}</p></div><div className="rounded-xl bg-muted/40 p-3"><p>Status: {queue === "overduePayouts" ? "Review ended · awaiting transfer" : human(selected.status)}</p><p className="mt-1">{selected.kind === "booking" ? "Client service amount (gross)" : "Fee amount"}: {selected.amountInCents === null ? "Not available" : formatUsdCents(selected.amountInCents)}</p><p className="mt-1 text-xs text-muted-foreground">Appointment: {dateTime(selected.scheduledAt)}</p><p className="mt-1 text-xs text-muted-foreground">Eligible/due: {dateTime(selected.dueAt)}</p></div>{selected.issueReason && <div><p className="font-semibold">Reported issue</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.issueReason}</p></div>}<p className="flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle size={14} className="shrink-0" />Review and reconcile with the parties before deciding to release a hold or refund. Monitoring does not move money.</p>{queue === "unresolvedDisputes" && <Button className="w-full" onClick={() => navigate(operationsIssuePath(selected))}>Open Reports & disputes<ArrowUpRight size={14} /></Button>}</div>}</DialogContent></Dialog>
  </DashboardLayout>;
}
