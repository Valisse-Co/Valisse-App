import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Landmark, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function SettingsPayouts() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const connection = trpc.appointment.refreshTechConnection.useQuery(undefined, { enabled: user?.userType === "nail_tech" });
  const connect = trpc.appointment.connectTech.useMutation({
    onSuccess: ({ onboardingUrl }) => { window.location.assign(onboardingUrl); },
    onError: (error) => toast.error(error.message || "Could not begin Stripe payout setup."),
  });

  if (user?.userType !== "nail_tech") {
    return <div className="min-h-screen p-6"><Button variant="ghost" onClick={() => navigate("/settings")}><ArrowLeft className="mr-2 h-4 w-4" />Settings</Button><p className="mt-8 text-sm text-muted-foreground">Payout settings are available to nail-tech accounts.</p></div>;
  }

  const ready = connection.data?.ready;
  return <div className="min-h-screen bg-background px-4 pb-10 pt-8">
    <div className="mx-auto max-w-lg">
      <Button variant="ghost" className="mb-4 -ml-3" onClick={() => navigate("/settings")}><ArrowLeft className="mr-2 h-4 w-4" />Settings</Button>
      <h1 className="font-serif text-3xl font-semibold text-foreground">Payouts</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Connect Stripe to receive payout after a completed appointment’s 24-hour issue window. Valisse retains a 5% fee on services; tips go entirely to you.</p>
      <Card className="mt-6 rounded-2xl border-border p-5">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Landmark className="h-5 w-5" /></div><div className="flex-1"><p className="font-semibold text-foreground">Stripe connected account</p><p className="mt-1 text-sm text-muted-foreground">{ready ? "Your payout account is ready." : connection.data?.connected ? "Finish the requested Stripe details to receive payouts." : "Set up a secure Stripe account for payouts."}</p></div>{ready && <CheckCircle2 className="h-5 w-5 text-primary" />}</div>
        <Button className="mt-5 w-full" disabled={connect.isPending || ready} onClick={() => connect.mutate({ origin: window.location.origin })}>{ready ? "Payouts ready" : connect.isPending ? "Opening Stripe…" : connection.data?.connected ? "Continue Stripe setup" : "Set up payouts with Stripe"}</Button>
      </Card>
      <div className="mt-4 flex gap-3 rounded-2xl bg-muted/60 p-4 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" />Valisse never collects or stores your bank account details. Stripe verifies your payout account directly.</div>
    </div>
  </div>;
}
