import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, CircleDollarSign, Clock3, Landmark, ReceiptText, RefreshCw, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatUsdCents } from "@shared/money";

const PAYOUT_STATUS: Record<string, { label: string; detail: string; className: string }> = {
  released: { label: "Paid out", detail: "Transfer recorded with Stripe", className: "bg-primary/10 text-primary" },
  pending_dispute_window: { label: "Pending review window", detail: "Available 24 hours after completion", className: "bg-amber-100 text-amber-800" },
  on_hold: { label: "On hold", detail: "A client issue is under review", className: "bg-destructive/10 text-destructive" },
  failed: { label: "Payout needs attention", detail: "Valisse will retry or contact you", className: "bg-amber-100 text-amber-800" },
};

export default function SettingsPayouts() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const isTech = user?.userType === "nail_tech" || (user as any)?.activeMode === "nail_tech";
  const connection = trpc.appointment.refreshTechConnection.useQuery(undefined, { enabled: isTech, refetchOnWindowFocus: true });
  const payoutHistory = trpc.appointment.payoutHistory.useQuery(undefined, { enabled: isTech });
  const connect = trpc.appointment.connectTech.useMutation({
    onSuccess: ({ onboardingUrl }) => { window.location.assign(onboardingUrl); },
    onError: (error) => toast.error(error.message || "Could not begin Stripe payout setup."),
  });

  useEffect(() => {
    if (location.includes("return=1")) {
      void connection.refetch();
    }
  }, [location]);

  const history = payoutHistory.data ?? [];
  const summary = useMemo(() => history.reduce((totals: { released: number; inProgress: number }, record: any) => {
    if (record.booking.payoutStatus === "released") totals.released += record.amounts.payoutTotalInCents;
    else totals.inProgress += record.amounts.payoutTotalInCents;
    return totals;
  }, { released: 0, inProgress: 0 }), [history]);

  if (!isTech) {
    return <div className="min-h-screen p-6"><Button variant="ghost" onClick={() => navigate("/settings")}><ArrowLeft className="mr-2 h-4 w-4" />Settings</Button><p className="mt-8 text-sm text-muted-foreground">Payout settings are available to nail-tech accounts.</p></div>;
  }

  const ready = connection.data?.ready;
  return <div className="min-h-screen bg-background px-4 pb-10 pt-8">
    <div className="mx-auto max-w-lg">
      <Button variant="ghost" className="mb-4 -ml-3" onClick={() => navigate("/settings")}><ArrowLeft className="mr-2 h-4 w-4" />Settings</Button>
      <h1 className="font-serif text-3xl font-semibold text-foreground">Payouts</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Connect Stripe to receive your payout after a completed appointment’s 24-hour issue window. Valisse retains a 5% fee on services; tips go entirely to you.</p>

      <Card className="mt-6 rounded-2xl border-border p-5">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Landmark className="h-5 w-5" /></div><div className="flex-1"><p className="font-semibold text-foreground">Stripe connected account</p><p className="mt-1 text-sm text-muted-foreground">{connection.isLoading ? "Checking your Stripe payout account…" : ready ? "Your payout account is verified and ready to receive payouts." : connection.data?.connected ? "Stripe needs a few more details before Valisse can send payouts." : "Set up your secure Stripe Express account for bank payouts."}</p></div>{ready && <CheckCircle2 className="h-5 w-5 text-primary" />}</div>
        <div className="mt-5 grid grid-cols-5 gap-2"><Button className="col-span-4" disabled={connect.isPending || ready} onClick={() => connect.mutate({ origin: window.location.origin })}>{ready ? "Payouts ready" : connect.isPending ? "Opening Stripe…" : connection.data?.connected ? "Continue secure Stripe setup" : "Set up payouts with Stripe"}</Button><Button variant="outline" size="icon" aria-label="Refresh Stripe account status" disabled={connection.isFetching} onClick={() => connection.refetch()}><RefreshCw className={connection.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div>
      </Card>

      <div className="mt-4 flex gap-3 rounded-2xl bg-muted/60 p-4 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><span>Enter bank and identity details directly with Stripe. Valisse never collects or stores them. Return here after Stripe onboarding; this page refreshes your payout readiness.</span></div>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3"><div><h2 className="font-serif text-xl font-semibold text-foreground">Payout history</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Appointment earnings, tips, and any payout holds. Amounts reflect the 5% Valisse service fee; tips are paid in full.</p></div><Button variant="outline" size="sm" disabled={payoutHistory.isFetching} onClick={() => payoutHistory.refetch()}><RefreshCw className={payoutHistory.isFetching ? "mr-1.5 h-3.5 w-3.5 animate-spin" : "mr-1.5 h-3.5 w-3.5"} />Refresh</Button></div>

        <div className="mt-4 grid grid-cols-2 gap-3"><Card className="rounded-2xl border-border p-4"><div className="flex items-center gap-2 text-primary"><CircleDollarSign className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wide">Paid out</span></div><p className="mt-2 text-lg font-semibold text-foreground">{formatUsdCents(summary.released)}</p></Card><Card className="rounded-2xl border-border p-4"><div className="flex items-center gap-2 text-amber-700"><Clock3 className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-wide">In progress</span></div><p className="mt-2 text-lg font-semibold text-foreground">{formatUsdCents(summary.inProgress)}</p></Card></div>

        {payoutHistory.isLoading ? <div className="mt-4 space-y-3"><Card className="h-28 animate-pulse rounded-2xl bg-muted/60" /><Card className="h-28 animate-pulse rounded-2xl bg-muted/60" /></div> : history.length === 0 ? <Card className="mt-4 rounded-2xl border-dashed border-border p-6 text-center"><ReceiptText className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium text-foreground">No payouts yet</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Completed appointments will appear here after their payment has been captured.</p></Card> : <div className="mt-4 space-y-3">{history.map((record: any) => {
          const status = PAYOUT_STATUS[record.booking.payoutStatus] ?? PAYOUT_STATUS.pending_dispute_window;
          const completedAt = record.booking.completedAt ?? record.booking.scheduledAt;
          return <Card key={record.booking.id} className="rounded-2xl border-border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{record.clientName ?? "Client appointment"}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p></div><div className="text-right"><p className="text-sm font-semibold text-foreground">{formatUsdCents(record.amounts.payoutTotalInCents)}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.label}</span></div></div><div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground"><span>Service after fee</span><span className="text-right text-foreground">{formatUsdCents(record.amounts.payoutTotalInCents - record.amounts.tipInCents)}</span>{record.amounts.tipInCents > 0 && <><span>Tip</span><span className="text-right text-foreground">{formatUsdCents(record.amounts.tipInCents)}</span></>}{record.amounts.refundAmountInCents > 0 && <><span>Client refund</span><span className="text-right text-destructive">−{formatUsdCents(record.amounts.refundAmountInCents)}</span></>}</div><p className="mt-3 text-[11px] text-muted-foreground">{status.detail}</p></Card>;
        })}</div>}
      </section>
    </div>
  </div>;
}
