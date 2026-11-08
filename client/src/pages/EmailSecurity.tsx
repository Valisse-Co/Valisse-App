import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Mail, ShieldCheck, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

function SecurityPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground px-6 py-12 flex items-center justify-center"><main className="w-full max-w-sm">
    <img src="/manus-storage/valisse_logo_transparent_b005737c.png" alt="Valisse" className="w-16 h-16 mx-auto mb-5" />
    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto mb-4 flex items-center justify-center"><ShieldCheck size={24} /></div>
    <h1 className="font-display text-3xl text-center">{title}</h1><p className="text-sm text-muted-foreground text-center mt-3 mb-6 leading-relaxed">{description}</p>{children}
  </main></div>;
}
function Message({ text, error = false }: { text: string; error?: boolean }) {
  return text ? <p role={error ? "alert" : "status"} className={`rounded-xl p-3 mb-4 text-sm ${error ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-foreground"}`}>{text}</p> : null;
}
function readAndRemoveToken() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
  if (token) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  return token;
}

export function VerifyEmail() {
  const [token] = useState(readAndRemoveToken);
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).get("sent") === "1" ? "Verification email sent. Check your inbox and spam folder." : "");
  const [error, setError] = useState(() => new URLSearchParams(window.location.search).get("delivery") === "failed" ? "Your account is saved, but we couldn’t send the email. Request a fresh link below." : "");
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const status = trpc.emailSecurity.status.useQuery(undefined, { refetchOnWindowFocus: true, retry: false });
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const resend = trpc.emailSecurity.resendVerification.useMutation({
    onSuccess: () => { setMessage("Verification email sent. Check your inbox and spam folder. Only the newest link will work."); setCooldown(60); setError(""); },
    onError: e => setError(e.message),
  });
  const verify = trpc.emailSecurity.verifyEmail.useMutation({
    onSuccess: async () => { setVerified(true); setError(""); await utils.auth.me.invalidate(); await status.refetch(); },
    onError: e => setError(e.message),
  });
  const isVerified = verified || Boolean(!token && status.data?.verified && !status.data?.needsVerification);
  const continueSetup = () => {
    if (!user) { navigate("/login?verified=1"); return; }
    if (!user.onboardingCompleted) { sessionStorage.setItem("valisse_onboarding_intent", "new_account"); navigate("/onboarding"); return; }
    navigate((user.hasDualRole ? user.activeMode : user.userType) === "nail_tech" ? "/dashboard" : "/discover");
  };
  return <SecurityPage title={isVerified ? "Email verified" : "Verify your email"} description={isVerified ? "Your email is confirmed. You can continue securely." : "Confirm that this email belongs to you before setting up your Valisse account. Verification links expire after 24 hours."}>
    {status.data?.email && <div className="rounded-2xl border border-border bg-card text-card-foreground p-4 flex items-center gap-3 mb-5"><Mail className="shrink-0 text-primary" size={20} /><span className="text-sm break-all">{status.data.email}</span></div>}
    <Message text={error} error /><Message text={message} />
    {status.error && <Message text="We couldn’t check your verification status. Please try again." error />}
    {isVerified ? <button className="btn-valisse w-full h-12 rounded-2xl flex items-center justify-center gap-2" onClick={continueSetup}><CheckCircle2 size={18} />{user ? "Continue" : "Sign in to continue"}</button> : <>
      {token && <button onClick={() => { setError(""); verify.mutate({ token }); }} disabled={verify.isPending || status.isLoading} className="btn-valisse w-full h-12 rounded-2xl mb-3 flex items-center justify-center gap-2">{verify.isPending && <Loader2 className="animate-spin" size={18} />}Verify email address</button>}
      {!token && <p className="text-sm text-muted-foreground mb-4">Open the link in your verification email and tap Verify email address. No email yet? You can request a fresh link below.</p>}
      {status.data?.authenticated ? <button disabled={resend.isPending || cooldown > 0 || verify.isPending} onClick={() => resend.mutate()} className="w-full rounded-2xl border border-border h-12 text-sm flex items-center justify-center gap-2">{resend.isPending && <Loader2 className="animate-spin" size={16} />}{cooldown ? `Resend in ${cooldown}s` : "Send verification email"}</button> : <button onClick={() => navigate("/login")} className="w-full rounded-2xl border border-border h-12 text-sm">Sign in to request a new link</button>}
      {status.data?.emailAvailable === false && <p className="text-xs text-muted-foreground mt-3">Email delivery isn’t available yet. Please try again later; your account is saved.</p>}
    </>}
    <button className="block mx-auto text-sm text-muted-foreground underline mt-6" onClick={async () => { if (user) await logout(); sessionStorage.removeItem("valisse_onboarding_intent"); navigate("/login"); }}>{user ? "Sign out / use a different account" : "Back to sign in"}</button>
  </SecurityPage>;
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [, navigate] = useLocation();
  const request = trpc.emailSecurity.requestPasswordReset.useMutation({ onSuccess: () => setSent(true) });
  return <SecurityPage title={sent ? "Check your inbox" : "Forgot your password?"} description={sent ? "If an eligible email/password account exists, we’ve sent password reset instructions. Check your spam folder too." : "Enter your Valisse email and we’ll send a secure reset link. The link expires after 30 minutes."}>
    {sent ? <p className="text-sm text-muted-foreground mb-5">Google-only accounts must continue with Google. For privacy, this page doesn’t confirm whether an account exists.</p> : <form onSubmit={e => { e.preventDefault(); request.mutate({ email: email.trim().toLowerCase() }); }}>
      <label htmlFor="reset-email" className="text-sm font-medium">Email address</label><input id="reset-email" required type="email" maxLength={320} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full h-12 rounded-xl border border-border bg-card text-card-foreground px-4 mt-2 mb-4" />
      <Message text={request.error?.message ?? ""} error /><button disabled={request.isPending} className="btn-valisse w-full h-12 rounded-2xl flex items-center justify-center gap-2">{request.isPending && <Loader2 size={16} className="animate-spin" />}Send reset link</button>
    </form>}
    <button onClick={() => navigate("/login")} className="mx-auto mt-6 flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={16} />Back to sign in</button>
  </SecurityPage>;
}

export function ResetPassword() {
  const [token] = useState(readAndRemoveToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const reset = trpc.emailSecurity.resetPassword.useMutation({
    onSuccess: async () => { setComplete(true); setPassword(""); setConfirmPassword(""); sessionStorage.removeItem("valisse_onboarding_intent"); utils.auth.me.setData(undefined, null); await utils.auth.me.invalidate(); },
    onError: e => setError(e.message),
  });
  return <SecurityPage title={complete ? "Password updated" : "Choose a new password"} description={complete ? "Your previous sessions have been signed out. Sign in again using your new password." : "Use at least 8 characters. A mix of letters, numbers, and symbols makes your password stronger."}>
    {complete ? <button onClick={() => navigate("/login?passwordReset=1")} className="btn-valisse w-full h-12 rounded-2xl">Sign in</button> : !token ? <><Message text="This reset link is missing or no longer available. Request a fresh link to continue." error /><button className="btn-valisse w-full h-12 rounded-2xl" onClick={() => navigate("/forgot-password")}>Request a new reset link</button></> : <form onSubmit={e => { e.preventDefault(); setError(""); if (password !== confirmPassword) { setError("Passwords do not match."); return; } reset.mutate({ token, password, confirmPassword }); }}>
      <label htmlFor="new-password" className="text-sm font-medium">New password</label><div className="relative mt-2 mb-4"><input id="new-password" required minLength={8} maxLength={72} autoComplete="new-password" type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full h-12 rounded-xl border border-border bg-card text-card-foreground pl-4 pr-12" /><button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute right-4 top-4 text-muted-foreground">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
      <label htmlFor="confirm-password" className="text-sm font-medium">Confirm new password</label><input id="confirm-password" required minLength={8} maxLength={72} autoComplete="new-password" type={show ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full h-12 rounded-xl border border-border bg-card text-card-foreground px-4 mt-2 mb-4" />
      <Message text={error} error /><button disabled={reset.isPending} className="btn-valisse w-full h-12 rounded-2xl flex items-center justify-center gap-2">{reset.isPending && <Loader2 size={16} className="animate-spin" />}Update password</button>
      <button type="button" onClick={() => navigate("/forgot-password")} className="block mx-auto mt-4 text-sm text-muted-foreground underline">Request a fresh link</button>
    </form>}
  </SecurityPage>;
}
