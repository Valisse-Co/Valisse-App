import { motion } from "framer-motion";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Loader2, Sparkles, Scissors } from "lucide-react";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  // Already authenticated — redirect to appropriate home
  if (!loading && isAuthenticated) {
    navigate("/discover");
    return null;
  }

  const handleSignIn = () => {
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
        className="w-full max-w-sm mb-10 flex flex-col gap-3"
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

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full max-w-sm flex flex-col gap-3"
      >
        <button
          onClick={handleSignIn}
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
        <span className="text-primary cursor-pointer">Terms of Service</span> and{" "}
        <span className="text-primary cursor-pointer">Privacy Policy</span>.
      </motion.p>
    </div>
  );
}
