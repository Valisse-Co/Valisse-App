import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Landmark, RefreshCw, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function SettingsPayouts() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const isTech = user?.userType === "nail_tech" || (user as any)?.activeMode === "nail_tech";
  const connection = trpc.appointment.refreshTechConnection.useQuery(undefined, { enabled: isTech, refetchOnWindowFocus: true });
  const connect = trpc.appointment.connectTech.useMutation({
    onSuccess: ({ onboardingUrl }) => { window.location.assign(onboardingUrl); },
    onError: (error) => toast.error(error.message || "Could not begin Stripe payout setup."),
  });

  useEffect(() => {
    if (location.includes("return=1")) {
      void connection.refetch();
    }
  }, [location]);

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
    </div>
  </div>;
}
