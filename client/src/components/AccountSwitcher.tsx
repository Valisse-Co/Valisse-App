import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Scissors, ChevronDown, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface AccountSwitcherProps {
  onSwitch?: (mode: "client" | "nail_tech") => void;
}

export function AccountSwitcher({ onSwitch }: AccountSwitcherProps) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  const switchMode = trpc.users.switchMode.useMutation({
    onSuccess: async (data) => {
      // Reactively update the cached user so nav re-renders instantly
      utils.auth.me.setData(undefined, (prev) =>
        prev ? { ...prev, activeMode: data.activeMode } : prev
      );
      onSwitch?.(data.activeMode);
      setOpen(false);
      toast.success(
        data.activeMode === "nail_tech"
          ? "Switched to Nail Tech mode"
          : "Switched to Client mode"
      );
      // Navigate to the correct home for the new mode
      navigate(data.activeMode === "nail_tech" ? "/dashboard" : "/discover");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!user) return null;

  const isTech = user.userType === "nail_tech";
  const hasDual = user.hasDualRole || isTech;
  const activeMode = (user as any).activeMode ?? (isTech ? "nail_tech" : "client");

  // Only show switcher if user has dual roles
  if (!hasDual) return null;

  const currentLabel = activeMode === "nail_tech" ? "Nail Tech Mode" : "Client Mode";
  const currentIcon = activeMode === "nail_tech"
    ? <Scissors size={14} className="text-primary" />
    : <Sparkles size={14} className="text-primary" />;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
          "bg-primary/5 border-primary/20 text-foreground hover:bg-primary/10"
        )}
      >
        {currentIcon}
        <span>{currentLabel}</span>
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden"
            >
              <div className="p-2">
                <p className="text-xs text-muted-foreground px-3 py-2 font-medium uppercase tracking-wider">
                  Switch Account
                </p>

                {/* Client Mode */}
                <button
                  onClick={() => switchMode.mutate({ mode: "client" })}
                  disabled={switchMode.isPending}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                    activeMode === "client"
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={14} className="text-primary" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium">Client Mode</div>
                    <div className="text-xs text-muted-foreground">Discover & book</div>
                  </div>
                  {activeMode === "client" && <Check size={14} className="text-primary" />}
                </button>

                {/* Nail Tech Mode */}
                <button
                  onClick={() => switchMode.mutate({ mode: "nail_tech" })}
                  disabled={switchMode.isPending}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                    activeMode === "nail_tech"
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Scissors size={14} className="text-primary" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium">Nail Tech Mode</div>
                    <div className="text-xs text-muted-foreground">Manage your business</div>
                  </div>
                  {activeMode === "nail_tech" && <Check size={14} className="text-primary" />}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
