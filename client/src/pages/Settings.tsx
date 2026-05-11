import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import {
  Scissors,
  Sparkles,
  LogOut,
  ChevronRight,
  User,
  Bell,
  Shield,
  HelpCircle,
  Star,
  X,
  Check,
} from "lucide-react";

const SERVICE_OPTIONS = ["Gel Manicure", "Acrylic Nails", "Nail Art", "Pedicure", "Nail Extensions", "Dip Powder", "Natural Nails"];
const PRICE_OPTIONS = ["$30–$60", "$60–$100", "$100–$150", "$150+"];

export default function Settings() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [showBecomeModal, setShowBecomeModal] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState("");
  const [phone, setPhone] = useState("");

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      navigate("/login");
    },
  });

  const utils = trpc.useUtils();

  const becomeNailTech = trpc.users.becomeNailTech.useMutation({
    onSuccess: () => {
      toast.success("Nail Tech account created! Switching to Tech Mode…");
      setShowBecomeModal(false);
      // Reactively update cached user to dual-role nail_tech mode
      utils.auth.me.setData(undefined, (prev) =>
        prev ? { ...prev, hasDualRole: true, activeMode: "nail_tech" as const, userType: "nail_tech" as const } : prev
      );
      navigate("/dashboard");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleLogout = () => {
    logoutMutation.mutate();
    logout();
  };

  const toggleService = (s: string) => {
    setSelectedServices(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleBecomeNailTech = () => {
    becomeNailTech.mutate({
      businessName: businessName || undefined,
      bio: bio || undefined,
      services: selectedServices,
      priceRange: priceRange || undefined,
      phone: phone || undefined,
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to access settings.</p>
          <button onClick={() => navigate("/login")} className="btn-valisse px-6 py-3 rounded-xl text-sm">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const isTech = user.userType === "nail_tech";
  const hasDual = (user as any).hasDualRole || isTech;
  const activeMode = (user as any).activeMode ?? (isTech ? "nail_tech" : "client");

  const settingsGroups = [
    {
      title: "Account",
      items: [
        {
          icon: <User size={18} />,
          label: "Edit Profile",
          action: () => toast.info("Profile editor coming soon"),
        },
        {
          icon: <Bell size={18} />,
          label: "Notifications",
          action: () => toast.info("Notification settings coming soon"),
        },
        {
          icon: <Shield size={18} />,
          label: "Privacy & Security",
          action: () => toast.info("Privacy settings coming soon"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: <HelpCircle size={18} />,
          label: "Help Center",
          action: () => toast.info("Help center coming soon"),
        },
        {
          icon: <Star size={18} />,
          label: "Rate Valisse",
          action: () => toast.info("Thank you for your support!"),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F4EE] pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-6">
        <h1 className="font-display text-3xl font-light mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile Card */}
      <div className="mx-5 mb-6 bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xl flex-shrink-0">
            {user.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{user.name ?? "Valisse User"}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email ?? ""}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {activeMode === "nail_tech"
                ? <Scissors size={12} className="text-primary" />
                : <Sparkles size={12} className="text-primary" />
              }
              <span className="text-xs text-primary font-medium">
                {activeMode === "nail_tech" ? "Nail Tech Mode" : "Client Mode"}
              </span>
              {hasDual && (
                <span className="text-xs text-muted-foreground ml-1">· Dual Account</span>
              )}
            </div>
          </div>
        </div>

        {/* Account Switcher */}
        {hasDual && (
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Active mode</span>
            <AccountSwitcher />
          </div>
        )}
      </div>

      {/* Become a Nail Tech (client-only) */}
      {!isTech && !hasDual && (
        <div className="mx-5 mb-6">
          <button
            onClick={() => setShowBecomeModal(true)}
            className="w-full bg-primary text-white rounded-2xl p-5 flex items-center gap-4 hover:bg-primary/90 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Scissors size={18} className="text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-white">Become a Nail Tech</p>
              <p className="text-xs text-white/70 mt-0.5">Add a tech account — keep your client profile</p>
            </div>
            <ChevronRight size={18} className="text-white/70" />
          </button>
        </div>
      )}

      {/* Settings Groups */}
      {settingsGroups.map(group => (
        <div key={group.title} className="mx-5 mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {group.title}
          </p>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            {group.items.map((item, i) => (
              <button
                key={item.label}
                onClick={item.action}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-4 text-sm text-foreground hover:bg-muted/30 transition text-left",
                  i < group.items.length - 1 && "border-b border-border"
                )}
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Logout */}
      <div className="mx-5 mb-4">
        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="w-full bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-3 text-sm text-destructive hover:bg-destructive/5 transition"
        >
          <LogOut size={18} />
          <span className="flex-1 text-left">
            {logoutMutation.isPending ? "Signing out…" : "Sign Out"}
          </span>
          {hasDual && (
            <span className="text-xs text-muted-foreground">Both accounts</span>
          )}
        </button>
      </div>

      {/* App version */}
      <p className="text-center text-xs text-muted-foreground mt-6">
        Valisse v1.0 · Made with care
      </p>

      {/* Become a Nail Tech Modal */}
      <AnimatePresence>
        {showBecomeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={(e) => e.target === e.currentTarget && setShowBecomeModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full bg-[#F7F4EE] rounded-t-3xl max-h-[90vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              <div className="px-6 pb-8">
                <div className="flex items-center justify-between mb-6 pt-2">
                  <div>
                    <h2 className="font-display text-2xl font-light">Become a Nail Tech</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Create your tech profile — your client account stays intact.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowBecomeModal(false)}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* What you get */}
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6">
                  <p className="text-sm font-medium text-primary mb-2">What you'll get</p>
                  {[
                    "Your own portfolio to showcase your work",
                    "Booking management & availability calendar",
                    "Analytics: views, saves, booking rate",
                    "Seamless switching between client & tech mode",
                  ].map(item => (
                    <div key={item} className="flex items-start gap-2 mb-1.5">
                      <Check size={14} className="text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-foreground">{item}</span>
                    </div>
                  ))}
                </div>

                {/* Form */}
                <div className="flex flex-col gap-4">
                  <input
                    type="text"
                    placeholder="Business / Studio name (optional)"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="h-12 rounded-xl border border-border bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                  <input
                    type="tel"
                    placeholder="Phone number (for bookings)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="h-12 rounded-xl border border-border bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                  <textarea
                    placeholder="Tell clients about your style and experience…"
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={3}
                    className="rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
                  />

                  {/* Services */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Services offered</p>
                    <div className="flex flex-wrap gap-2">
                      {SERVICE_OPTIONS.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleService(s)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs border transition-all",
                            selectedServices.includes(s)
                              ? "bg-primary text-white border-primary"
                              : "bg-white border-border text-foreground hover:border-primary/40"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price range */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Price range</p>
                    <div className="flex flex-wrap gap-2">
                      {PRICE_OPTIONS.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriceRange(p)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs border transition-all",
                            priceRange === p
                              ? "bg-primary text-white border-primary"
                              : "bg-white border-border text-foreground hover:border-primary/40"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleBecomeNailTech}
                    disabled={becomeNailTech.isPending}
                    className="btn-valisse w-full py-4 rounded-xl text-sm font-medium mt-2"
                  >
                    {becomeNailTech.isPending ? "Creating your profile…" : "Create Nail Tech Account"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
