import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Loader2, Sparkles, Scissors } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Social provider status ──────────────────────────────────────────────────

type SocialStatus = { google: boolean; apple: boolean };

function useSocialStatus(): SocialStatus {
  const [status, setStatus] = useState<SocialStatus>({ google: false, apple: false });

  useEffect(() => {
    fetch("/api/oauth/social-status")
      .then(r => r.json())
      .then((data: SocialStatus) => setStatus(data))
      .catch(() => {/* stay disabled on error */});
  }, []);

  return status;
}

// ─── SVG brand icons ─────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 3.99zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

// ─── Social button ────────────────────────────────────────────────────────────

interface SocialButtonProps {
  provider: "google" | "apple";
  enabled: boolean;
}

function SocialButton({ provider, enabled }: SocialButtonProps) {
  const isGoogle = provider === "google";
  const label = isGoogle ? "Continue with Google" : "Continue with Apple";

  const handleClick = () => {
    if (!enabled) return;
    const origin = window.location.origin;
    window.location.href = `/api/oauth/${provider}/start?origin=${encodeURIComponent(origin)}`;
  };

  const button = (
    <button
      onClick={handleClick}
      disabled={!enabled}
      aria-label={label}
      className={[
        "relative h-14 w-full rounded-2xl border text-sm font-medium",
        "flex items-center justify-center gap-3 transition-all",
        enabled
          ? "border-border bg-card text-foreground hover:bg-muted active:scale-[0.98]"
          : "border-border/50 bg-card/50 text-muted-foreground cursor-not-allowed opacity-60",
      ].join(" ")}
    >
      {isGoogle
        ? <GoogleIcon className="w-5 h-5 flex-shrink-0" />
        : <AppleIcon className="w-5 h-5 flex-shrink-0" />}
      <span>{label}</span>
      {!enabled && (
        <span className="absolute right-4 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70">
          Soon
        </span>
      )}
    </button>
  );

  if (enabled) return button;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isGoogle ? "Google Sign In" : "Apple Sign In"} is coming soon
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground">or</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const social = useSocialStatus();

  // Check for error params from failed social callbacks
  const searchParams = new URLSearchParams(window.location.search);
  const authError = searchParams.get("error");

  if (!loading && isAuthenticated) {
    navigate("/discover");
    return null;
  }

  const handleManusSignIn = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <h1 className="font-display text-5xl font-light tracking-widest text-foreground mb-2">
          valisse
        </h1>
        <p className="text-sm text-muted-foreground tracking-wider uppercase">
          Nail Art · Inspiration · Booking
        </p>
      </motion.div>

      {/* Value props */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-sm mb-8 flex flex-col gap-3"
      >
        <div className="flex items-start gap-3 bg-card rounded-2xl border border-border p-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Discover nail inspiration</p>
            <p className="text-xs text-muted-foreground mt-0.5">Browse thousands of nail art styles and book the look you love.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-card rounded-2xl border border-border p-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Scissors size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Grow your nail business</p>
            <p className="text-xs text-muted-foreground mt-0.5">Showcase your portfolio, manage bookings, and attract new clients.</p>
          </div>
        </div>
      </motion.div>

      {/* Auth error */}
      {authError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-sm mb-4 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3"
        >
          <p className="text-sm text-destructive text-center">
            {authError === "google_failed"
              ? "Google sign in failed. Please try again."
              : authError === "apple_failed"
                ? "Apple sign in failed. Please try again."
                : "Sign in failed. Please try again."}
          </p>
        </motion.div>
      )}

      {/* CTA buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full max-w-sm flex flex-col gap-3"
      >
        {/* Social sign-in buttons */}
        <SocialButton provider="google" enabled={social.google} />
        <SocialButton provider="apple" enabled={social.apple} />

        <OrDivider />

        {/* Manus OAuth — always available, used for demo */}
        <button
          onClick={handleManusSignIn}
          disabled={loading}
          className="btn-valisse h-14 w-full rounded-2xl text-base font-medium flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Sign In / Create Account
        </button>

        <p className="text-center text-xs text-muted-foreground">
          One account for both clients and nail techs.
          <br />You can switch roles anytime after signing in.
        </p>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-10 text-xs text-muted-foreground text-center max-w-xs"
      >
        By continuing, you agree to Valisse's{" "}
        <a href="/terms" className="text-primary">Terms of Service</a> and{" "}
        <a href="/privacy" className="text-primary">Privacy Policy</a>.
      </motion.p>
    </div>
  );
}
