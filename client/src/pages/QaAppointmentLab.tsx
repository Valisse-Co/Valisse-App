import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ClipboardCheck, CreditCard, FlaskConical, RotateCcw, ShieldAlert, Sparkles, WalletCards } from "lucide-react";

const statusLabel: Record<string, string> = {
  pending: "Waiting for card setup",
  confirmed: "Confirmed — ready for check-in",
  in_progress: "Appointment in progress",
  completed: "Completed and paid",
  payment_due: "Payment retry needed",
  disputed: "Issue reported — payout paused",
};

function Step({ number, title, detail, active, complete, children }: {
  number: number;
  title: string;
  detail: string;
  active: boolean;
  complete: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${active ? "border-primary bg-primary/5" : complete ? "border-emerald-200 bg-emerald-50/60" : "border-border bg-card"}`}>
      <div className="flex gap-3">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${complete ? "bg-emerald-600 text-white" : active ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
          {complete ? <CheckCircle2 size={16} /> : number}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export default function QaAppointmentLab() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const availability = trpc.qaAppointment.availability.useQuery(undefined, { enabled: isAuthenticated });
  const current = trpc.qaAppointment.current.useQuery(undefined, { enabled: isAuthenticated && Boolean(availability.data?.enabled), refetchInterval: 4_000 });

  const start = trpc.qaAppointment.start.useMutation({
    onSuccess: (result) => {
      toast.success(result.reused ? "Reopened your active QA appointment." : "QA appointment created. Begin with the client card-save step.");
      utils.qaAppointment.current.invalidate();
    },
    onError: (error) => toast.error(error.message || "Could not create the QA appointment."),
  });
  const enterClient = trpc.qaAppointment.enterClient.useMutation({
    onSuccess: ({ destination }) => window.location.assign(destination),
    onError: (error) => toast.error(error.message || "Could not open the QA client view."),
  });
  const releasePayout = trpc.qaAppointment.releasePayoutNow.useMutation({
    onSuccess: () => { toast.success("Stripe test payout released."); utils.qaAppointment.current.invalidate(); },
    onError: (error) => toast.error(error.message || "Could not release the test payout."),
  });
  const cleanup = trpc.qaAppointment.cleanup.useMutation({
    onSuccess: () => { toast.success("Temporary Valisse QA records were removed. Stripe test-mode audit objects remain in Stripe."); utils.qaAppointment.current.invalidate(); },
    onError: (error) => toast.error(error.message || "Could not clean up the QA run."),
  });

  const run = current.data?.run;
  const booking = current.data?.booking as any;
  const paymentMethodSaved = booking?.paymentMethodStatus === "saved";
  const paymentCaptured = booking?.paymentStatus === "paid";
  const completed = booking?.status === "completed" && paymentCaptured;
  const issueReported = booking?.status === "disputed";
  const payoutReleased = booking?.payoutStatus === "released";
  const lifecycleLabel = booking?.status === "pending" && paymentMethodSaved
    ? "Ready for technician confirmation"
    : statusLabel[booking?.status] ?? booking?.status;
  const expiry = useMemo(() => run?.expiresAt ? new Date(run.expiresAt).toLocaleString() : null, [run?.expiresAt]);

  if (!isAuthenticated) {
    return <div className="min-h-screen bg-background flex items-center justify-center p-8 text-center"><p className="text-sm text-muted-foreground">Sign in as an administrator to use the QA Appointment Lab.</p></div>;
  }
  if (user?.role !== "admin") {
    return <div className="min-h-screen bg-background flex items-center justify-center p-8 text-center"><div className="space-y-3"><ShieldAlert className="mx-auto text-amber-500" size={32} /><p className="font-semibold text-foreground">Administrator access required</p><p className="text-sm text-muted-foreground">The QA Appointment Lab is available only to Valisse administrators.</p><Button variant="outline" onClick={() => navigate("/settings")}>Back to settings</Button></div></div>;
  }
  if (availability.isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }
  if (!availability.data?.enabled) {
    return <div className="min-h-screen bg-background flex items-center justify-center p-8 text-center"><div className="max-w-sm space-y-3"><FlaskConical className="mx-auto text-muted-foreground" size={32} /><p className="font-semibold text-foreground">QA Appointment Lab unavailable</p><p className="text-sm text-muted-foreground">This tool is deliberately enabled only in the preview environment while Valisse is configured with a Stripe test-mode secret.</p><Button variant="outline" onClick={() => navigate("/settings")}>Back to settings</Button></div></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button aria-label="Back to settings" onClick={() => navigate("/settings")} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"><ArrowLeft size={18} /></button>
          <div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Preview only</p><h1 className="text-lg font-semibold text-foreground">QA Appointment Lab</h1></div>
          <Badge className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-50">Stripe test mode</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-5">
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><FlaskConical size={18} /></div><div><p className="text-sm font-semibold text-foreground">A real sandbox lifecycle, without a second person</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">This creates a disposable QA client and a test appointment with your administrator nail-tech account. You use the normal Stripe Payment Element, check-in code, completion charge, tip, issue, and payout paths. No customer SMS or notifications are sent.</p></div></div>
        </section>

        {!run || !booking ? (
          <section className="rounded-2xl border border-border bg-card p-5 text-center"><Sparkles className="mx-auto mb-3 text-primary" size={28} /><h2 className="font-semibold text-foreground">Start a fresh test run</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Valisse will use your first active technician service and schedule the appointment 25 minutes from now. The real check-in code and technician start action are available immediately, while leaving time to finish the test.</p><Button className="mt-5 w-full" onClick={() => start.mutate()} disabled={start.isPending}>{start.isPending ? "Creating test appointment…" : "Create QA appointment"}</Button><p className="mt-3 text-[11px] text-muted-foreground">Use Stripe test cards only. For a successful run, use 4242 4242 4242 4242 with any future date, CVC, and ZIP.</p></section>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Active test appointment</p><p className="mt-1 text-sm font-semibold text-foreground">Booking #{booking.id} · {lifecycleLabel}</p><p className="mt-1 text-xs text-muted-foreground">Expires {expiry}. It is separated from customer records and test-marked in Stripe.</p></div><Badge variant="outline" className="border-primary/30 text-primary">QA</Badge></div></section>

            <div className="space-y-3">
              <Step number={1} title="Save the QA client’s card" detail="Open the isolated client view and use the ordinary secure card-save screen. This only saves a Stripe test card; it does not charge it." active={!paymentMethodSaved} complete={paymentMethodSaved}>
                <Button size="sm" className="w-full" onClick={() => enterClient.mutate({ runId: run.id, view: "payment" })} disabled={enterClient.isPending || paymentMethodSaved}>{enterClient.isPending ? "Opening client view…" : paymentMethodSaved ? "Card saved" : "Open client card-save"}</Button>
              </Step>

              <Step number={2} title="Confirm as the nail tech" detail="Return to your technician booking card and confirm the saved-card booking. This uses the normal technician authorization and approval rule." active={paymentMethodSaved && booking.status === "pending"} complete={["confirmed", "in_progress", "completed", "payment_due", "disputed"].includes(booking.status)}>
                <Button size="sm" variant="outline" className="w-full" onClick={() => navigate(`/tech-bookings?qaRun=${run.id}`)} disabled={!paymentMethodSaved}>Open technician booking card</Button>
              </Step>

              <Step number={3} title="Verify the code and start" detail="As the client, view the real six-digit check-in code. Then return to the technician card, enter the code, and start the appointment. Its start time is already inside the normal 30-minute window." active={booking.status === "confirmed"} complete={["in_progress", "completed", "payment_due", "disputed"].includes(booking.status)}>
                <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => enterClient.mutate({ runId: run.id, view: "bookings" })} disabled={booking.status !== "confirmed" || enterClient.isPending}>View client code</Button><Button size="sm" variant="outline" onClick={() => navigate(`/tech-bookings?qaRun=${run.id}`)} disabled={booking.status !== "confirmed"}>Enter code as tech</Button></div>
              </Step>

              <Step number={4} title="Complete and charge" detail="From the technician booking card, complete the in-progress appointment. Valisse will perform the real off-session Stripe test charge for the booked total." active={booking.status === "in_progress"} complete={completed || issueReported}>
                <Button size="sm" variant="outline" className="w-full" onClick={() => navigate(`/tech-bookings?qaRun=${run.id}`)} disabled={booking.status !== "in_progress"}>Open completion control</Button>
              </Step>

              <Step number={5} title="Test the client aftercare branch" detail="After a successful test charge, use the client appointment card to add a test tip or report an issue. An issue pauses payout, so use a separate QA run to test the payout branch afterward." active={completed} complete={issueReported || Boolean(booking.stripeTipPaymentIntentId)}>
                <Button size="sm" variant="outline" className="w-full" onClick={() => enterClient.mutate({ runId: run.id, view: "bookings" })} disabled={!completed || enterClient.isPending}>{booking.stripeTipPaymentIntentId ? "Tip recorded — open client card" : "Open tip / issue controls"}</Button>
              </Step>

              <Step number={6} title="Release the Stripe test payout" detail="This skips only the 24-hour wait for this QA-marked booking. It keeps the actual Stripe test transfer and platform-fee calculation. Your Stripe test connected account must be fully onboarded." active={completed && !issueReported && !payoutReleased} complete={payoutReleased}>
                <Button size="sm" className="w-full" onClick={() => releasePayout.mutate({ runId: run.id })} disabled={!completed || issueReported || payoutReleased || releasePayout.isPending}>{payoutReleased ? "Test payout released" : releasePayout.isPending ? "Releasing test payout…" : "Release test payout now"}</Button>
              </Step>
            </div>

            <section className="rounded-2xl border border-border bg-muted/35 p-4"><div className="flex gap-3"><WalletCards className="mt-0.5 shrink-0 text-muted-foreground" size={18} /><div><p className="text-sm font-semibold text-foreground">Testing card scenarios</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground"><strong>Success:</strong> 4242 4242 4242 4242. <strong>Declined payment:</strong> 4000 0000 0000 9995. Use any future expiry, CVC, and ZIP. The second card is useful for testing the payment-due recovery branch.</p></div></div></section>

            <Button variant="outline" className="w-full gap-2 text-muted-foreground" onClick={() => cleanup.mutate({ runId: run.id })} disabled={cleanup.isPending}><RotateCcw size={15} />{cleanup.isPending ? "Cleaning up…" : "Clean up this QA run"}</Button>
            <p className="px-2 text-center text-[11px] text-muted-foreground">Cleanup removes only the disposable Valisse client, its appointment, and local QA record. Stripe test-mode objects remain in Stripe for sandbox audit visibility.</p>
          </>
        )}
      </main>
    </div>
  );
}
