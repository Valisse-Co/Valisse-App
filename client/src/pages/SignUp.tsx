import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Apple, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function passwordStrength(password: string) {
  if (!password) return { label: "Use at least 8 characters", score: 0, color: "bg-muted" };
  if (password.length < 8) return { label: "Too short — use at least 8 characters", score: 1, color: "bg-destructive" };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(password)).length;
  if (variety < 2) return { label: "Weak — add a mix of letters, numbers, or symbols", score: 1, color: "bg-amber-500" };
  if (variety < 3) return { label: "Good password", score: 2, color: "bg-primary" };
  return { label: "Strong password", score: 3, color: "bg-primary" };
}

export default function SignUp() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const strength = useMemo(() => passwordStrength(password), [password]);

  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;
    if (!user.onboardingCompleted) {
      if (sessionStorage.getItem("valisse_onboarding_intent") === "new_account") {
        navigate("/onboarding");
      }
      return;
    }
    const mode = user.hasDualRole ? user.activeMode : user.userType;
    navigate(mode === "nail_tech" ? "/dashboard" : "/discover");
  }, [isAuthenticated, loading, navigate, user]);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      sessionStorage.setItem("valisse_onboarding_intent", "new_account");
      await utils.auth.me.invalidate();
      navigate("/onboarding");
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        navigate(`/login?error=email_exists&email=${encodeURIComponent(email.trim().toLowerCase())}`);
        return;
      }
      setFormError(err.message || "We couldn’t create your account. Please try again.");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!name.trim()) return setFormError("Please enter your name.");
    if (!email.trim()) return setFormError("Please enter your email address.");
    if (password.length < 8) return setFormError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setFormError("Passwords do not match.");
    registerMutation.mutate({ name: name.trim(), email: email.trim().toLowerCase(), password });
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col items-center justify-center px-6 py-12">
      <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/manus-storage/valisse_logo_transparent_b005737c.png" alt="Valisse" className="w-16 h-16 object-contain mx-auto mb-3" />
          <h1 className="font-display text-4xl font-light tracking-widest text-foreground">valisse</h1>
          <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">Create your account</p>
          <p className="text-sm text-muted-foreground mt-4">Create your credentials first. Then you’ll choose Client or Nail Tech during setup.</p>
        </div>

        {formError && <div className="mb-4 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3"><p className="text-sm text-destructive text-center">{formError}</p></div>}

        <button onClick={() => { window.location.href = getLoginUrl("signup"); }} className="w-full h-13 rounded-2xl border border-border bg-white text-foreground text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-3">
          <GoogleIcon /> Continue with Google
        </button>
        <button disabled aria-disabled="true" className="w-full h-13 rounded-2xl border border-border bg-muted/40 text-muted-foreground text-sm font-medium mt-3 flex items-center justify-center gap-3 cursor-not-allowed">
          <Apple size={18} /> Continue with Apple <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 uppercase tracking-wide">Coming soon</span>
        </button>

        <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or sign up with email</span><div className="flex-1 h-px bg-border" /></div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative"><User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input required type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" className="w-full h-13 pl-11 pr-4 rounded-2xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
          <div className="relative"><Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input required type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="w-full h-13 pl-11 pr-4 rounded-2xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
          <div>
            <div className="relative"><Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input required type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="w-full h-13 pl-11 pr-12 rounded-2xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
            <div className="flex gap-1 mt-2" aria-hidden="true">{[1, 2, 3].map(level => <span key={level} className={`h-1 flex-1 rounded-full ${level <= strength.score ? strength.color : "bg-muted"}`} />)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{strength.label}</p>
          </div>
          <div className="relative"><Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input required type={showConfirmPassword ? "text" : "password"} placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" className="w-full h-13 pl-11 pr-12 rounded-2xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /><button type="button" aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"} onClick={() => setShowConfirmPassword(value => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          <button type="submit" disabled={registerMutation.isPending} className="btn-valisse h-13 w-full rounded-2xl text-sm font-medium flex items-center justify-center gap-2 mt-1">{registerMutation.isPending && <Loader2 size={16} className="animate-spin" />}Create account</button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">Already have an account? <button onClick={() => navigate("/login")} className="text-primary font-medium underline underline-offset-2">Log in</button></p>
        <p className="text-center text-xs text-muted-foreground mt-6">By continuing, you agree to Valisse’s <a href="/terms" className="text-primary">Terms of Service</a> and <a href="/privacy" className="text-primary">Privacy Policy</a>.</p>
      </motion.main>
    </div>
  );
}
