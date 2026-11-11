import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDollarSign, Clock3, Landmark, ReceiptText, RefreshCw, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatUsdCents } from "@shared/money";
import { getPayoutHistoryStage, type PayoutHistoryStage } from "@shared/payoutHistory";

const PAYOUT_STAGE_CLASS: Record<PayoutHistoryStage, string> = {
  transferred: "bg-primary/10 text-primary",
  active_issue_window: "bg-amber-100 text-amber-800",
  awaiting_transfer: "bg-amber-100 text-amber-800",
  awaiting_payment: "bg-amber-100 text-amber-800",
  on_hold: "bg-destructive/10 text-destructive",
  needs_attention: "bg-destructive/10 text-destructive",
  needs_verification: "bg-destructive/10 text-destructive",
};

function formatTimestamp(value: Date | string | number | null | undefined): string | null {
  if (value == null) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
}

export default function SettingsPayouts() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const isTech = user?.userType === "nail_tech" || user?.activeMode === "nail_tech";
  const [now, setNow] = useState(() => Date.now());
  const connection = trpc.appointment.refreshTechConnection.useQuery(undefined, { enabled: isTech, refetchOnWindowFocus: true });
  const payoutHistory = trpc.appointment.payoutHistory.useQuery(undefined, {
    enabled: isTech,
    refetchInterval: isTech ? 30_000 : false,
    refetchOnWindowFocus: true,
  });
  const connect = trpc.appointment.connectTech.useMutation({
    onSuccess: ({ onboardingUrl }) => { window.location.assign(onboardingUrl); },
    onError: (error) => toast.error(error.message || "Could not begin Stripe payout setup."),
  });

  useEffect(() => {
    if (isTech && location.includes("return=1")) void connection.refetch();
  }, [isTech, location, connection.refetch]);

  // Advance eligibility even if a background history refresh fails or is paused.
  useEffect(() => {
    if (!isTech) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [isTech]);

  const history = useMemo(() => (payoutHistory.data ?? []).map(record => ({
    ...record,
    presentation: getPayoutHistoryStage({
      payoutStatus: record.booking.payoutStatus,
      paymentStatus: record.booking.paymentStatus,
      payoutEligibleAt: record.booking.payoutEligibleAt,
      issueReportedAt: record.booking.issueReportedAt,
      issueResolvedAt: record.booking.issueResolvedAt,
      hasRecordedTransfer: record.hasRecordedTransfer,
      now,
    }),
  })), [payoutHistory.data, now]);
  const summary = useMemo(() => history.reduce((totals, record) => {
    if (record.presentation.stage === "transferred") totals.transferred += record.amounts.payoutTotalInCents;
    else totals.notTransferred += record.amounts.payoutTotalInCents;
    return totals;
  }, { transferred: 0, notTransferred: 0 }), [history]);

  if (!isTech) {
    return <div className="min-h-screen p-6"><Button variant="ghost" onClick={() => navigate("/settings")}><ArrowLeft className="mr-2 h-4 w-4" />Settings</Button><p className="mt-8 text-sm text-muted-foreground">Payout settings are available to nail-tech accounts.</p></div>;
  }

  const ready = connection.data?.ready;
  const isTestMode = connection.data?.mode === "test";
  const isLiveMode = connection.data?.mode === "live";
  return <div className="min-h-screen bg-background px-4 pb-10 pt-8">
    <div className="mx-auto max-w-lg">
      <Button variant="ghost" className="mb-4 -ml-3" onClick={() => navigate("/settings")}><ArrowLeft className="mr-2 h-4 w-4" />Settings</Button>
      <h1 className="font-serif text-3xl font-semibold text-foreground">Payouts</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Connect Stripe to receive appointment earnings. A completed appointment’s 24-hour issue window must end before a transfer is eligible; eligibility does not mean a transfer has been sent. Valisse retains a 5% fee on services; tips go entirely to you.</p>

      <Card className="mt-6 rounded-2xl border-border p-5">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Landmark className="h-5 w-5" /></div><div className="flex-1"><p className="font-semibold text-foreground">Stripe connected account</p><p className="mt-1 text-sm text-muted-foreground">{connection.isLoading ? "Checking your Stripe payout account…" : connection.isError ? "Could not refresh Stripe account readiness. Try refreshing again." : ready ? isTestMode ? "Your Stripe test account is verified for sandbox transfer testing." : "Your connected Stripe account is ready to receive transfers. This does not confirm that any earnings have been sent." : connection.data?.connected ? "Stripe needs a few more details before Valisse can send transfers." : "Set up your secure Stripe Express account for transfers and bank payouts."}</p></div>{ready && !connection.isError && <CheckCircle2 className="h-5 w-5 text-primary" />}</div>
        <div className="mt-5 grid grid-cols-5 gap-2"><Button className="col-span-4" disabled={connect.isPending || ready} onClick={() => connect.mutate({ origin: window.location.origin })}>{ready ? isTestMode ? "Test account ready" : "Stripe account ready" : connect.isPending ? "Opening Stripe…" : connection.data?.connected ? "Continue secure Stripe setup" : "Set up payouts with Stripe"}</Button><Button variant="outline" size="icon" aria-label="Refresh Stripe account status" disabled={connection.isFetching} onClick={() => connection.refetch()}><RefreshCw className={connection.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div>
      </Card>

      {isTestMode && <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" /><span><strong>Stripe test mode:</strong> this account can validate onboarding and transfers safely, but no real payouts can be sent. Live payouts require a separately onboarded live Stripe account.</span></div>}
      {isLiveMode && <div className="mt-4 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><span><strong>Stripe live mode:</strong> account readiness is checked against your live connected account. The history below uses Valisse’s recorded payment and transfer status, not bank-payment confirmation.</span></div>}
      {isLiveMode && !connection.isError && !connection.data?.connectWebhookConfigured && <div className="mt-3 flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs leading-relaxed text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" /><span><strong>Launch checklist item:</strong> automatic live connected-account status updates are not configured yet. An administrator can still refresh this screen, but do not launch payouts until the Stripe Connect webhook is added.</span></div>}

      <div className="mt-4 flex gap-3 rounded-2xl bg-muted/60 p-4 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><span>Enter bank and identity details directly with Stripe. Valisse never collects or stores them. Return here after Stripe onboarding; this page refreshes your account readiness.</span></div>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3"><div><h2 className="font-serif text-xl font-semibold text-foreground">Payout history</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Appointment earnings, tips, and any payout holds. Amounts reflect the 5% Valisse service fee; tips are paid in full.</p></div><Button variant="outline" size="sm" disabled={payoutHistory.isFetching} onClick={() => payoutHistory.refetch()}><RefreshCw className={payoutHistory.isFetching ? "mr-1.5 h-3.5 w-3.5 animate-spin" : "mr-1.5 h-3.5 w-3.5"} />Refresh</Button></div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">A transfer to your connected Stripe account and a bank payout are separate steps. Bank receipt is not confirmed here. A payout to Valisse’s own bank account is not a transfer to you.</p>
        {payoutHistory.dataUpdatedAt > 0 && <p className="mt-2 text-[11px] text-muted-foreground">History last refreshed: {formatTimestamp(payoutHistory.dataUpdatedAt)}. Refreshes every 30 seconds while this page is active.</p>}

        {payoutHistory.data !== undefined && <div className="mt-4 grid grid-cols-2 gap-3"><Card className="rounded-2xl border-border p-4"><div className="flex items-center gap-2 text-primary"><CircleDollarSign className="h-4 w-4 shrink-0" /><span className="text-[11px] font-semibold uppercase tracking-wide">Transferred to Stripe</span></div><p className="mt-2 text-lg font-semibold text-foreground">{formatUsdCents(summary.transferred)}</p></Card><Card className="rounded-2xl border-border p-4"><div className="flex items-center gap-2 text-amber-700"><Clock3 className="h-4 w-4 shrink-0" /><span className="text-[11px] font-semibold uppercase tracking-wide">Not confirmed transferred</span></div><p className="mt-2 text-lg font-semibold text-foreground">{formatUsdCents(summary.notTransferred)}</p></Card></div>}

        {payoutHistory.isError && <Card role="alert" className="mt-4 rounded-2xl border-destructive/30 p-4"><p className="text-sm font-medium text-destructive">Could not refresh payout history.</p><p className="mt-1 text-xs text-muted-foreground">{payoutHistory.data !== undefined ? "Showing the last loaded history; transfer status may be out of date. " : "Your payout history could not be loaded. "}Use Refresh to try again.</p></Card>}
        {payoutHistory.isLoading ? <div className="mt-4 space-y-3"><Card className="h-28 animate-pulse rounded-2xl bg-muted/60" /><Card className="h-28 animate-pulse rounded-2xl bg-muted/60" /></div> : history.length === 0 ? !payoutHistory.isError && <Card className="mt-4 rounded-2xl border-dashed border-border p-6 text-center"><ReceiptText className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium text-foreground">No payout history yet</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Completed appointments will appear here after their payment has been captured.</p></Card> : <div className="mt-4 space-y-3">{history.map(record => {
          const status = record.presentation;
          const completedAt = formatTimestamp(record.booking.completedAt ?? record.booking.scheduledAt);
          const eligibleAt = formatTimestamp(record.booking.payoutEligibleAt);
          return <Card key={record.booking.id} className="rounded-2xl border-border p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{record.clientName ?? "Client appointment"}</p><p className="mt-0.5 text-xs text-muted-foreground">Booking #{record.booking.id}</p><p className="mt-0.5 text-xs text-muted-foreground">{completedAt ?? "Appointment date unavailable"}</p></div><div className="text-right"><p className="text-sm font-semibold text-foreground">{formatUsdCents(record.amounts.payoutTotalInCents)}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${PAYOUT_STAGE_CLASS[status.stage]}`}>{status.label}</span></div></div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground"><span>Service after fee</span><span className="text-right text-foreground">{formatUsdCents(record.amounts.payoutTotalInCents - record.amounts.tipInCents)}</span>{record.amounts.tipInCents > 0 && <><span>Tip</span><span className="text-right text-foreground">{formatUsdCents(record.amounts.tipInCents)}</span></>}{record.amounts.refundAmountInCents > 0 && <><span>Client refund</span><span className="text-right text-destructive">−{formatUsdCents(record.amounts.refundAmountInCents)}</span></>}</div>
            <p className="mt-3 text-[11px] text-muted-foreground">{status.clientPaymentDetail}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{status.detail}</p>
            {eligibleAt && (status.stage === "active_issue_window" || status.stage === "awaiting_transfer") && <p className="mt-1 text-[11px] text-muted-foreground">Issue window {status.stage === "active_issue_window" ? "ends" : "ended"}: {eligibleAt}.</p>}
          </Card>;
        })}</div>}
      </section>
    </div>
  </div>;
}
