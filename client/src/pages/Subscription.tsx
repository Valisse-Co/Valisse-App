import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, Check, Zap, Star, Crown } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    period: "forever",
    icon: <Star size={20} />,
    color: "border-border",
    features: [
      "Up to 10 posts",
      "Basic profile",
      "Client bookings",
      "Standard listing",
    ],
    cta: "Current Plan",
    disabled: true,
  },
  {
    id: "monthly" as const,
    name: "Pro",
    price: "$29",
    period: "per month",
    icon: <Zap size={20} />,
    color: "border-primary",
    badge: "Most Popular",
    features: [
      "Unlimited posts",
      "Featured profile placement",
      "Advanced analytics (views, saves, booking rate)",
      "Last-minute slot notifications",
      "SMS booking reminders",
      "Priority support",
    ],
    cta: "Activate Pro Monthly",
    disabled: false,
  },
  {
    id: "growth" as const,
    name: "Pro Annual",
    price: "$249",
    period: "per year",
    icon: <Crown size={20} />,
    color: "border-primary/40",
    badge: "Save 28%",
    features: [
      "Everything in Pro",
      "Top search placement",
      "Custom booking page URL",
      "Verified badge",
      "Dedicated account manager",
    ],
    cta: "Activate Annual Plan",
    disabled: false,
  },
];

export default function Subscription() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const { data: subscription, refetch } = trpc.subscriptions.mySubscription.useQuery(undefined, { enabled: isAuthenticated });
  const activate = trpc.subscriptions.activate.useMutation({
    onSuccess: () => {
      toast.success("Subscription activated! Welcome to Valisse Pro.");
      refetch();
      setTimeout(() => navigate("/dashboard"), 1500);
    },
    onError: () => toast.error("Failed to activate subscription"),
  });

  const handleActivate = (planId: "monthly" | "growth") => {
    activate.mutate({ tier: planId });
  };

  return (
    <div className="min-h-screen bg-background page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-border">
        <button onClick={() => navigate("/dashboard")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-foreground">Upgrade Your Plan</h1>
      </div>

      <div className="px-4 py-6 pb-24">
        {/* Hero */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-display font-light mb-2">Grow Your Nail Business</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Get more visibility, attract more clients, and manage your business with powerful tools.
          </p>
        </div>

        {/* Current status */}
        {subscription && (
          <div className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-2xl mb-6 text-sm",
            subscription.status === "active" ? "bg-primary/10 text-primary border border-primary/20" :
            subscription.status === "trial" ? "bg-accent text-accent-foreground border border-border" :
            "bg-muted text-muted-foreground border border-border"
          )}>
            <Zap size={15} />
            <span>
              {subscription.status === "active" ? `Active ${subscription.tier === "monthly" ? "Pro Monthly" : "Pro Annual"} plan` :
               subscription.status === "trial" ? "Free trial active" :
               "No active subscription"}
            </span>
            {subscription.currentPeriodEnd && subscription.status === "active" && (
              <span className="ml-auto text-xs opacity-70">
                Renews {new Date(subscription.currentPeriodEnd as any).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        )}

        {/* Plans */}
        <div className="space-y-4">
          {PLANS.map((plan, idx) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "relative rounded-2xl border-2 p-5 bg-card",
                plan.color,
                plan.id === "monthly" && "shadow-lg shadow-primary/10"
              )}
            >
              {plan.badge && (
                <div className={cn(
                  "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold",
                  plan.id === "monthly" ? "bg-primary text-white" : "bg-primary/80 text-white"
                )}>
                  {plan.badge}
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    plan.id === "monthly" ? "bg-primary/10 text-primary" :
                    plan.id === "growth" ? "bg-accent text-accent-foreground" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {plan.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.period}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{plan.price}</p>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2 text-sm">
                    <Check size={14} className={cn("mt-0.5 flex-shrink-0", plan.id === "free" ? "text-muted-foreground" : "text-primary")} />
                    <span className={plan.id === "free" ? "text-muted-foreground" : "text-foreground"}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => !plan.disabled && plan.id !== "free" && handleActivate(plan.id as "monthly" | "growth")}
                disabled={plan.disabled || activate.isPending ||
                  (subscription?.status === "active" && subscription.tier === plan.id)}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-medium transition-all",
                  plan.disabled || (subscription?.status === "active" && subscription.tier === plan.id)
                    ? "bg-muted text-muted-foreground cursor-default"
                    : plan.id === "monthly" ? "btn-valisse"
                    : "bg-primary/80 text-white hover:bg-primary"
                )}
              >
                {activate.isPending ? "Activating..." :
                 subscription?.status === "active" && subscription.tier === plan.id ? "Current Plan" :
                 plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Cancel anytime. No hidden fees. SMS reminders included with Pro plans.
        </p>
      </div>
    </div>
  );
}
