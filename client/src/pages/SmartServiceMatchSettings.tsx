import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, DollarSign, ShieldCheck, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function SmartServiceMatchSettings() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.smartService.getSettings.useQuery(undefined, { enabled: user?.userType === "nail_tech" });
  const [threshold, setThreshold] = useState("");

  useEffect(() => {
    if (settings) setThreshold((settings.priceReviewThresholdCents / 100).toFixed(0));
  }, [settings]);

  const update = trpc.smartService.updateSettings.useMutation({
    onSuccess: () => { utils.smartService.getSettings.invalidate(); toast.success("Smart Service Match settings saved."); },
    onError: (error) => toast.error(error.message || "Could not save Smart Service Match settings."),
  });

  if (user && user.userType !== "nail_tech") {
    return <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center"><div><p className="text-lg font-semibold text-foreground">Nail tech settings only</p><p className="text-sm text-muted-foreground mt-1">Switch to Nail Tech mode to manage Smart Service Match.</p><button className="btn-valisse px-5 py-2.5 mt-4" onClick={() => navigate("/settings")}>Back to Settings</button></div></div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE] pb-24">
      <header className="sticky top-0 z-20 bg-[#F7F4EE]/95 backdrop-blur border-b border-primary/10 px-4 pt-11 pb-3 flex items-center gap-3">
        <button onClick={() => navigate("/settings")} className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center"><ArrowLeft size={18} /></button>
        <div><h1 className="text-lg font-semibold text-foreground">Smart Service Match</h1><p className="text-xs text-muted-foreground">System-guided service matching</p></div>
      </header>

      {isLoading ? <div className="px-4 pt-5 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div> : (
        <main className="px-4 pt-5 space-y-4 max-w-lg mx-auto">
          <section className="rounded-3xl bg-gradient-to-br from-primary to-[#317E73] p-5 text-white shadow-lg shadow-primary/15">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center mb-3"><Sparkles size={20} /></div>
            <h2 className="text-xl font-display font-light">Help clients book with confidence</h2>
            <p className="text-sm text-white/80 mt-1.5 leading-relaxed">Valisse asks service-specific questions, suggests offered services when appropriate, and keeps uncertain requests pending for your review.</p>
          </section>

          <section className="rounded-2xl bg-white border border-border overflow-hidden">
            <div className="px-4 py-4 flex items-center justify-between gap-4">
              <div><p className="text-sm font-semibold text-foreground">Enable Smart Service Match</p><p className="text-xs text-muted-foreground mt-0.5">Use system questionnaires for your enabled services.</p></div>
              <button onClick={() => update.mutate({ globalEnabled: !settings?.globalEnabled })} disabled={update.isPending} className={cn("relative w-11 h-6 rounded-full transition-colors", settings?.globalEnabled ? "bg-primary" : "bg-muted")}><span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform", settings?.globalEnabled ? "translate-x-6" : "translate-x-1")} /></button>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-border p-4 space-y-3">
            <div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><DollarSign size={17} /></div><div><p className="text-sm font-semibold text-foreground">Price review threshold</p><p className="text-xs text-muted-foreground mt-0.5">When recommended additions reach this amount, clients see the full quote before confirming.</p></div></div>
            <div className="flex gap-2"><div className="relative flex-1"><DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={threshold} onChange={(event) => setThreshold(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="w-full h-10 rounded-xl border border-input bg-background pl-8 pr-3 text-sm" aria-label="Price review threshold" /></div><button onClick={() => update.mutate({ priceReviewThresholdCents: Math.max(0, Number(threshold || 0) * 100) })} disabled={update.isPending} className="px-4 rounded-xl bg-muted text-sm font-semibold text-foreground">Save</button></div>
          </section>

          <section className="rounded-2xl bg-white border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border"><p className="text-sm font-semibold text-foreground">Your service questionnaires</p><p className="text-xs text-muted-foreground mt-0.5">Turn system matching on or off per service. Questions and safety rules stay consistent for clients.</p></div>
            {(settings?.services ?? []).map((service: any, index: number) => <div key={service.id} className={cn("px-4 py-3.5 flex items-center gap-3", index > 0 && "border-t border-border")}>
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><ShieldCheck size={17} /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{service.customName || service.category}</p><p className="text-xs text-muted-foreground">${(service.priceInCents / 100).toFixed(2)} · {service.durationMinutes} min</p></div>
              <button onClick={() => update.mutate({ serviceId: service.id, serviceEnabled: !service.smartMatchEnabled })} disabled={update.isPending || !settings?.globalEnabled} className={cn("relative w-10 h-5 rounded-full transition-colors", service.smartMatchEnabled && settings?.globalEnabled ? "bg-primary" : "bg-muted")}><span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", service.smartMatchEnabled && settings?.globalEnabled ? "translate-x-5" : "translate-x-0.5")} /></button>
            </div>)}
            {(settings?.services?.length ?? 0) === 0 && <div className="px-4 py-8 text-center"><p className="text-sm text-muted-foreground">Add services first to enable Smart Service Match for them.</p><button onClick={() => navigate("/settings/profile")} className="mt-3 text-sm font-semibold text-primary">Manage services <ChevronRight size={14} className="inline" /></button></div>}
          </section>

          <p className="px-2 text-[11px] leading-relaxed text-muted-foreground">Smart Service Match may suggest a different service, optional add-ons, or technician review. Any revision you send stays pending until the client accepts the exact updated quote.</p>
        </main>
      )}
    </div>
  );
}
