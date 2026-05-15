/**
 * DemoBar — visible only in development mode.
 * Shows one-click buttons to instantly switch between the two demo accounts
 * by navigating to the demo login endpoints, which set a session cookie.
 */
import { Scissors, Sparkles } from "lucide-react";

const IS_DEV = import.meta.env.DEV;

export function DemoBar() {
  if (!IS_DEV) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-black/80 backdrop-blur-sm shadow-xl border border-white/10">
      <span className="text-[10px] text-white/50 font-medium uppercase tracking-widest mr-1">
        Demo
      </span>

      <a
        href="/api/demo-login/nail-tech"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-xs text-white font-medium"
        title="Log in as Ashton Earl (nail tech)"
      >
        <Scissors size={11} />
        Nail Tech
      </a>

      <a
        href="/api/demo-login/client"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-xs text-white font-medium"
        title="Log in as Alex Rivera (client)"
      >
        <Sparkles size={11} />
        Client
      </a>
    </div>
  );
}
