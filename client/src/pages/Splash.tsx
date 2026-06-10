import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { motion } from "framer-motion";

export default function Splash() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && user) {
      if (!user.onboardingCompleted) {
        navigate("/onboarding");
      } else {
        // For dual-role users, respect their activeMode; otherwise use userType
        const effectiveMode = user.hasDualRole ? user.activeMode : user.userType;
        if (effectiveMode === "nail_tech") {
          navigate("/dashboard");
        } else {
          navigate("/discover");
        }
      }
    }
  }, [user, loading, isAuthenticated]);

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col items-center justify-between px-8 py-16">
      {/* Top decorative element */}
      <div className="w-full flex justify-end opacity-30">
        <div className="w-24 h-24 rounded-full bg-primary/20 blur-2xl" />
      </div>

      {/* Center content */}
      <div className="flex flex-col items-center gap-8 flex-1 justify-center">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center gap-3"
        >
          {/* Logo mark */}
          <img
            src="/manus-storage/valisse_logo_transparent_b005737c.png"
            alt="Valisse"
            className="w-24 h-24 object-contain drop-shadow-lg"
          />

          {/* Brand name */}
          <h1 className="text-5xl font-display font-light tracking-[0.12em] text-[#1A1714]">
            Valisse
          </h1>

          {/* Tagline */}
          <p className="text-sm font-light tracking-[0.2em] text-[#9C9189] uppercase">
            Book the Look You Love
          </p>
        </motion.div>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="w-16 h-px bg-primary/40"
        />

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center text-[#9C9189] text-sm font-light leading-relaxed max-w-xs"
        >
          Discover nail inspiration and connect directly with the artists who create it.
        </motion.p>
      </div>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="w-full flex flex-col gap-3"
      >
        <a
          href={getLoginUrl()}
          className="w-full btn-valisse text-center py-4 text-base tracking-wide"
        >
          Get Started
        </a>
        <a
          href={getLoginUrl()}
          className="w-full btn-valisse-outline text-center py-4 text-base tracking-wide"
        >
          Sign In
        </a>
        <p className="text-center text-xs text-muted-foreground mt-2">
          By continuing, you agree to our Terms of Service
        </p>
      </motion.div>
    </div>
  );
}
