import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ChevronLeft, CreditCard, Check, Sparkles, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function daysLeft(trialEndsAt: number | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const diff = trialEndsAt - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function SettingsSubscription() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: sub, isLoading } = trpc.settings.getSubscriptionStatus.useQuery(undefined, {
    enabled: user?.userType === "nail_tech",
  });

  const initSub = trpc.settings.initSubscription.useMutation({
    onSuccess: () => toast.success("Subscription initialized! Billing will be enabled when Stripe is connected."),
    onError: (e) => toast.error(e.message),
  });

  if (user?.userType !== "nail_tech") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold flex-1">Subscription</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <Sparkles size={48} className="text-primary mb-4 opacity-60" />
          <p className="text-lg font-semibold text-foreground mb-2">Free for Clients</p>
          <p className="text-sm text-muted-foreground">Valisse is completely free for clients. Subscriptions are only for nail techs.</p>
        </div>
      </div>
    );
  }

  const days = daysLeft((sub as any)?.trialEndsAt);
  const isTrialing = (sub as any)?.status === "trialing";
  const isActive = (sub as any)?.status === "active";
  const isExpired = (sub as any)?.status === "expired" || ((sub as any)?.status === "trialing" && days === 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold flex-1">Subscription</h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Status card */}
        {!isLoading && sub && (
          <div className={cn(
            "rounded-2xl border p-5",
            isActive ? "bg-primary/5 border-primary/30" :
            isTrialing ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" :
            "bg-destructive/5 border-destructive/30"
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                isActive ? "bg-primary/20 text-primary" :
                isTrialing ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                "bg-destructive/20 text-destructive"
              )}>
                {isExpired ? <AlertCircle size={20} /> : isTrialing ? <Clock size={20} /> : <Check size={20} />}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {isActive ? "Active Subscription" : isTrialing ? "Free Trial" : "Trial Ended"}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isActive
                    ? "Your subscription is active. Billing will be charged monthly."
                    : isTrialing && days !== null && days > 0
                    ? `${days} day${days !== 1 ? "s" : ""} remaining in your free trial`
                    : isTrialing && days === 0
                    ? "Your trial ends today"
                    : "Your 2-month free trial has ended"}
                </p>
                {(sub as any)?.trialEndsAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Trial ends: {new Date((sub as any).trialEndsAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plan details */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valisse Pro — Nail Tech Plan</p>
          </div>
          <div className="p-4">
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-foreground">$1.99</span>
              <span className="text-sm text-muted-foreground">/month</span>
              <span className="ml-2 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">2 months free</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                "Post unlimited nail designs to your portfolio",
                "Accept bookings from clients",
                "Appear in Discover and search results",
                "Analytics: views, saves, booking rate",
                "Cancellation policy enforcement",
                "Messaging with clients",
              ].map((feature) => (
                <div key={feature} className="flex items-start gap-2.5">
                  <Check size={14} className="text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        {!isActive && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={16} className="text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Payment Method</p>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Stripe billing will be enabled in a future update. Your trial continues uninterrupted until then.
            </p>
            <Button
              className="w-full"
              onClick={() => initSub.mutate()}
              disabled={initSub.isPending || isActive}
            >
              {initSub.isPending ? "Setting up…" : isExpired ? "Reactivate Subscription" : "Activate Subscription"}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              No charge until Stripe is connected
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
