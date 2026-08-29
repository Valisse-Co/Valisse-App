import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronDown, ChevronRight, CircleHelp, ShieldCheck, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function SmartServiceMatchSettings() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.smartService.getSettings.useQuery(undefined, { enabled: user?.userType === "nail_tech" });
  const { data: previewConfigs = [] } = trpc.smartService.getPreviewConfigs.useQuery(undefined, { enabled: user?.userType === "nail_tech" });
  const [showServiceCustomization, setShowServiceCustomization] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const update = trpc.smartService.updateSettings.useMutation({
    onSuccess: () => { utils.smartService.getSettings.invalidate(); toast.success("Smart Service Match settings saved."); },
    onError: (error) => toast.error(error.message || "Could not save Smart Service Match settings."),
  });

  const selectedService = useMemo(
    () => (settings?.services ?? []).find((service: any) => service.id === selectedServiceId) ?? null,
    [selectedServiceId, settings?.services],
  );
  const selectedConfig = useMemo(
    () => previewConfigs.find((config: any) => config.serviceCategory === selectedService?.category) ?? null,
    [previewConfigs, selectedService?.category],
  );

  const outcomeLabel = (action: string, service?: string) => {
    if (action === "review") return "Send for your review";
    if (action === "recommend_service") return service ? `Suggest ${service}` : "Suggest another service";
    return service ? `Offer ${service} as an add-on` : "Offer an add-on";
  };

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
              <button type="button" role="switch" aria-label="Enable Smart Service Match" aria-checked={settings?.globalEnabled} onClick={() => update.mutate({ globalEnabled: !settings?.globalEnabled })} disabled={update.isPending} className={cn("relative h-7 w-12 shrink-0 rounded-full p-1 ring-1 ring-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60", settings?.globalEnabled ? "bg-primary ring-primary" : "bg-[#E4E1DA] ring-[#D8D4CA]")}><span className={cn("block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(20,47,41,0.24)] transition-transform duration-200", settings?.globalEnabled ? "translate-x-5" : "translate-x-0")} /></button>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-border overflow-hidden">
            <button type="button" onClick={() => setShowServiceCustomization((current) => !current)} className="w-full px-4 py-3.5 flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><ShieldCheck size={17} /></div>
              <div className="flex-1"><p className="text-sm font-semibold text-foreground">Customize services</p><p className="text-xs text-muted-foreground mt-0.5">Optional: turn matching on or off for individual services.</p></div>
              <ChevronDown size={17} className={cn("text-muted-foreground transition-transform", showServiceCustomization && "rotate-180")} />
            </button>
            {showServiceCustomization && <div className="border-t border-border">
              {(settings?.services ?? []).map((service: any, index: number) => {
                const hasConfig = previewConfigs.some((config: any) => config.serviceCategory === service.category);
                const isSelected = selectedServiceId === service.id;
                return <div key={service.id} className={cn("px-4 py-3.5", index > 0 && "border-t border-border")}>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => { setSelectedServiceId(service.id); setShowPreview(true); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", isSelected ? "bg-primary text-white" : "bg-primary/10 text-primary")}><ShieldCheck size={17} /></div>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground truncate">{service.customName || service.category}</p><p className="text-xs text-muted-foreground">${(service.priceInCents / 100).toFixed(2)} · {service.durationMinutes} min{hasConfig ? " · View matching logic" : " · No matching questions"}</p></div>
                    </button>
                    {hasConfig ? <button type="button" role="switch" aria-label={`Enable Smart Match for ${service.customName || service.category}`} aria-checked={service.smartMatchEnabled && settings?.globalEnabled} onClick={() => update.mutate({ serviceId: service.id, serviceEnabled: !service.smartMatchEnabled })} disabled={update.isPending || !settings?.globalEnabled} className={cn("relative h-6 w-11 shrink-0 rounded-full p-[3px] ring-1 ring-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50", service.smartMatchEnabled && settings?.globalEnabled ? "bg-primary ring-primary" : "bg-[#E4E1DA] ring-[#D8D4CA]")}><span className={cn("block h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(20,47,41,0.24)] transition-transform duration-200", service.smartMatchEnabled && settings?.globalEnabled ? "translate-x-[22px]" : "translate-x-0")} /></button> : <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">Not available</span>}
                  </div>
                </div>;
              })}
              {(settings?.services?.length ?? 0) === 0 && <div className="px-4 py-8 text-center"><p className="text-sm text-muted-foreground">Add services first to enable Smart Service Match for them.</p><button onClick={() => navigate("/settings/profile")} className="mt-3 text-sm font-semibold text-primary">Manage services <ChevronRight size={14} className="inline" /></button></div>}
            </div>}
          </section>

          {showPreview && selectedService && <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-border bg-[#FCFBF8] px-4 py-4">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Matching preview</p><h2 className="mt-1 text-lg font-semibold text-foreground">{selectedService.customName || selectedService.category}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Review exactly what clients are asked and how Valisse may guide their booking.</p></div>
              <button type="button" onClick={() => setShowPreview(false)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close matching preview">×</button>
            </div>
            {selectedConfig ? <div className="space-y-5 p-4">
              <div>
                <div className="mb-2 flex items-center gap-2"><CircleHelp size={15} className="text-primary" /><h3 className="text-sm font-semibold text-foreground">Questions clients see</h3></div>
                <div className="space-y-2.5">{selectedConfig.questions.map((question: any, questionIndex: number) => <div key={question.id} className="rounded-xl border border-border bg-[#FFFEFC] p-3"><p className="text-sm font-medium leading-snug text-foreground"><span className="mr-1.5 text-primary">{questionIndex + 1}.</span>{question.text}</p><div className="mt-2 flex flex-wrap gap-1.5">{question.options.map((option: string) => <span key={option} className="rounded-full bg-primary/[0.07] px-2.5 py-1 text-[11px] leading-tight text-[#317E73]">{option}</span>)}</div>{question.allowsPhoto && <p className="mt-2 text-[11px] font-medium text-primary">Clients can optionally attach an inspiration photo.</p>}</div>)}</div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">How answers can change the booking</h3>
                <div className="space-y-2.5">{selectedConfig.rules.slice().sort((a: any, b: any) => b.priority - a.priority).map((rule: any) => <div key={`${rule.priority}-${rule.explanation}`} className={cn("rounded-xl border p-3", rule.action === "review" ? "border-amber-200 bg-amber-50/60" : rule.action === "recommend_service" ? "border-[#C6E1D8] bg-primary/[0.05]" : "border-sky-200 bg-sky-50/60")}><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">If a client selects</p><div className="mt-1 flex flex-wrap gap-1.5">{[...(rule.whenAll ?? []), ...(rule.whenAny ?? [])].map((answer: string) => <span key={answer} className="rounded-md bg-white/80 px-2 py-1 text-[11px] text-foreground shadow-sm">“{answer}”</span>)}</div><div className="mt-2 flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", rule.action === "review" ? "bg-amber-500" : rule.action === "recommend_service" ? "bg-primary" : "bg-sky-500")} /><p className="text-sm font-semibold text-foreground">{outcomeLabel(rule.action, rule.service)}</p></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rule.explanation}</p></div>)}</div>
              </div>
              <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">For safety or uncertainty, Valisse prioritizes your review over automatic recommendations. Clients can always see the final services, price, and appointment duration before submitting.</p>
            </div> : <div className="p-5 text-center"><p className="text-sm font-medium text-foreground">No system questionnaire for this service</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">This service can still be booked normally. Smart Service Match will not ask matching questions for it.</p></div>}
          </section>}

          <p className="px-2 text-[11px] leading-relaxed text-muted-foreground">Smart Service Match may suggest a different service, optional add-ons, or technician review. Any revision you send stays pending until the client accepts the exact updated quote.</p>
        </main>
      )}
    </div>
  );
}
