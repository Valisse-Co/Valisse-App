import { useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";

export default function GoogleSignUpConfirm() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || user?.email || "your Google account";
  const source = params.get("source");

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) {
      navigate("/signup");
      return;
    }
    if (user.onboardingCompleted) {
      const mode = user.hasDualRole ? user.activeMode : user.userType;
      navigate(mode === "nail_tech" ? "/dashboard" : "/discover");
    }
  }, [isAuthenticated, loading, navigate, user]);

  if (loading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center px-6 py-12">
      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm text-center"
      >
        <img
          src="/manus-storage/valisse_logo_transparent_b005737c.png"
          alt="Valisse"
          className="w-16 h-16 object-contain mx-auto mb-6"
        />
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-light text-foreground">Confirm your account</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mt-3">
          {source === "login"
            ? "We couldn’t find an existing Valisse account for this Google identity. You can create one now."
            : "You’re signing up with Google. Please confirm the account you want to use."}
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-white p-4 flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">You’re signing up as</p>
            <p className="text-sm font-medium text-foreground truncate">{email}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-primary/5 px-4 py-3 flex items-start gap-2 text-left">
          <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">Next, you’ll choose whether you’re joining as a client or a nail tech.</p>
        </div>

        <button
          onClick={() => navigate("/onboarding")}
          className="btn-valisse w-full h-13 rounded-2xl text-sm font-medium mt-6"
        >
          Continue to setup
        </button>
        <button
          onClick={() => navigate("/login")}
          className="text-xs text-muted-foreground underline underline-offset-2 mt-4"
        >
          Use a different account
        </button>
      </motion.main>
    </div>
  );
}
