import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Mail, Lock, User, Sparkles, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

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

type Role = "client" | "nail_tech";

export default function SignUp() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [step, setStep] = useState<"role" | "form">("role");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  // Redirect already-authenticated users
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

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/onboarding");
    },
    onError: (err) => {
      setFormError(err.message ?? "Failed to create account. Please try again.");
    },
  });

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep("form");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) { setFormError("Please enter your name."); return; }
    if (!email.trim()) { setFormError("Please enter your email."); return; }
    if (password.length < 8) { setFormError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setFormError("Passwords do not match."); return; }
    if (!selectedRole) return;
    registerMutation.mutate({ name: name.trim(), email: email.trim(), password, userType: selectedRole });
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
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-center"
      >
        <img
          src="/manus-storage/valisse_logo_transparent_b005737c.png"
          alt="Valisse"
          className="w-14 h-14 object-contain mx-auto mb-3"
        />
        <h1 className="font-display text-4xl font-light tracking-widest text-foreground">valisse</h1>
        <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">
          {step === "role" ? "Create your account" : selectedRole === "nail_tech" ? "I'm a Nail Tech" : "I'm a Client"}
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === "role" ? (
          <motion.div
            key="role"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <p className="text-sm text-muted-foreground text-center mb-6">How will you use Valisse?</p>

            {/* Role cards */}
            <div className="flex flex-col gap-3 mb-6">
              <button
                onClick={() => handleRoleSelect("client")}
                className="flex items-start gap-4 bg-white rounded-2xl border border-border p-5 text-left hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">I'm a Client</p>
                  <p className="text-xs text-muted-foreground mt-1">Discover nail inspiration and book appointments with talented nail artists near you.</p>
                </div>
              </button>
              <button
                onClick={() => handleRoleSelect("nail_tech")}
                className="flex items-start gap-4 bg-white rounded-2xl border border-border p-5 text-left hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Scissors size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">I'm a Nail Tech</p>
                  <p className="text-xs text-muted-foreground mt-1">Showcase your work, attract new clients, and manage your bookings all in one place.</p>
                </div>
              </button>
            </div>

            {/* Google sign-up */}
            <button
              onClick={() => { window.location.href = getLoginUrl(); }}
              className="w-full flex items-center justify-center gap-3 h-13 rounded-2xl border border-border bg-white text-foreground text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors mb-3"
            >
              <GoogleIcon size={18} />
              Continue with Google
            </button>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-primary font-medium underline underline-offset-2"
              >
                Sign in
              </button>
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            {/* Google sign-up */}
            <button
              onClick={() => { window.location.href = getLoginUrl(); }}
              className="w-full flex items-center justify-center gap-3 h-13 rounded-2xl border border-border bg-white text-foreground text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors mb-4"
            >
              <GoogleIcon size={18} />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or create with email</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                <p className="text-sm text-destructive text-center">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="relative">
                <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFormError(""); }}
                  autoComplete="name"
                  className="w-full h-13 pl-11 pr-4 rounded-2xl border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
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
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFormError(""); }}
                  autoComplete="new-password"
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
              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setFormError(""); }}
                  autoComplete="new-password"
                  className="w-full h-13 pl-11 pr-4 rounded-2xl border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={registerMutation.isPending}
                className="btn-valisse h-13 w-full rounded-2xl text-sm font-medium flex items-center justify-center gap-2 mt-1"
              >
                {registerMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Create Account
              </button>
            </form>

            <button
              onClick={() => setStep("role")}
              className="w-full text-center text-xs text-muted-foreground mt-4 underline underline-offset-2"
            >
              ← Change role selection
            </button>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-primary font-medium underline underline-offset-2"
              >
                Sign in
              </button>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-xs text-muted-foreground mt-8 max-w-xs">
        By continuing, you agree to Valisse's{" "}
        <a href="/terms" className="text-primary">Terms of Service</a> and{" "}
        <a href="/privacy" className="text-primary">Privacy Policy</a>.
      </p>
    </div>
  );
}
