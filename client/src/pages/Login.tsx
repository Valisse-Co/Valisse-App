import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Apple, Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function Login() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  const searchParams = new URLSearchParams(window.location.search);
  const authError = searchParams.get("error");
  const prefillEmail = searchParams.get("email") ?? "";

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (!user.onboardingCompleted) {
        navigate("/onboarding");
      } else {
        const effectiveMode = user.hasDualRole ? user.activeMode : user.userType;
        navigate(effectiveMode === "nail_tech" ? "/dashboard" : "/discover");
      }
    }
  }, [loading, isAuthenticated, user]);

  const emailLoginMutation = trpc.auth.emailLogin.useMutation({
    onSuccess: async (data) => {
      await utils.auth.me.invalidate();
      if (!data.onboardingCompleted) {
        navigate("/onboarding");
      } else {
        const effectiveMode = data.hasDualRole ? data.activeMode : data.userType;
        navigate(effectiveMode === "nail_tech" ? "/dashboard" : "/discover");
      }
    },
    onError: (err) => {
      setFormError(err.message ?? "Invalid email or password.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!email.trim() || !password) {
      setFormError("Please enter your email and password.");
      return;
    }
    emailLoginMutation.mutate({ email: email.trim(), password });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10 text-center"
      >
        <img
          src="/manus-storage/valisse_logo_transparent_b005737c.png"
          alt="Valisse"
          className="w-16 h-16 object-contain mx-auto mb-3"
        />
        <h1 className="font-display text-4xl font-light tracking-widest text-foreground">valisse</h1>
        <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">Welcome back</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-sm"
      >
        {(authError || formError) && (
          <div className="mb-4 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
            <p className="text-sm text-destructive text-center">
              {authError === "email_exists"
                ? `An account with ${prefillEmail || "this email"} already exists. Please sign in below.`
                : authError === "google_failed"
                  ? "Google sign-in failed. Please try again."
                  : formError || "Sign in failed. Please try again."}
            </p>
          </div>
        )}

        <button
          onClick={() => { window.location.href = getLoginUrl("login"); }}
          className="w-full flex items-center justify-center gap-3 h-13 rounded-2xl border border-border bg-white text-foreground text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors mb-4"
        >
          <GoogleIcon size={18} />
          Continue with Google
        </button>

        <button
          disabled
          aria-disabled="true"
          className="w-full flex items-center justify-center gap-3 h-13 rounded-2xl border border-border bg-muted/40 text-muted-foreground text-sm font-medium mt-3 cursor-not-allowed"
        >
          <Apple size={18} />
          Continue with Apple
          <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 uppercase tracking-wide">Coming soon</span>
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or sign in with email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFormError(""); }}
              autoComplete="email"
              className="w-full h-13 pl-11 pr-4 rounded-2xl border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFormError(""); }}
              autoComplete="current-password"
              className="w-full h-13 pl-11 pr-12 rounded-2xl border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {formError && !authError && (
            <p className="text-xs text-destructive text-center -mt-1">{formError}</p>
          )}

          <button
            type="submit"
            disabled={emailLoginMutation.isPending}
            className="btn-valisse h-13 w-full rounded-2xl text-sm font-medium flex items-center justify-center gap-2 mt-1"
          >
            {emailLoginMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            Sign In
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/signup")}
            className="text-primary font-medium underline underline-offset-2"
          >
            Create one
          </button>
        </p>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to Valisse's{" "}
          <a href="/terms" className="text-primary">Terms of Service</a> and{" "}
          <a href="/privacy" className="text-primary">Privacy Policy</a>.
        </p>
      </motion.div>
    </div>
  );
}
