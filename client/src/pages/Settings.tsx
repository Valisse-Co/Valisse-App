import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  Lock,
  CreditCard,
  Moon,
  FileText,
} from "lucide-react";

type SettingsSection = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  techOnly?: boolean;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "profile", label: "Edit Profile", description: "Name, photo, bio, contact info", icon: <User size={20} />, href: "/settings/profile" },
  { id: "notifications", label: "Notifications", description: "In-app, SMS, and email preferences", icon: <Bell size={20} />, href: "/settings/notifications" },
  { id: "privacy", label: "Privacy", description: "Profile visibility, blocked users", icon: <Shield size={20} />, href: "/settings/privacy" },
  { id: "account", label: "Account & Security", description: "Connected account, display name", icon: <Lock size={20} />, href: "/settings/account" },
  { id: "subscription", label: "Subscription", description: "Plan, billing, trial status", icon: <CreditCard size={20} />, href: "/settings/subscription", techOnly: true },
  { id: "appearance", label: "Appearance", description: "Dark mode, display preferences", icon: <Moon size={20} />, href: "/settings/appearance" },
];

const LEGAL_SECTIONS: SettingsSection[] = [
  { id: "terms", label: "Terms of Service", description: "Read our terms", icon: <FileText size={20} />, href: "/terms" },
  { id: "privacy-policy", label: "Privacy Policy", description: "How we use your data", icon: <Shield size={20} />, href: "/privacy" },
  { id: "support", label: "Contact Support", description: "Get help from our team", icon: <HelpCircle size={20} />, href: "/settings/support" },
];

function SettingsRow({ section }: { section: SettingsSection }) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(section.href)}
      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        {section.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{section.label}</p>
        <p className="text-xs text-muted-foreground truncate">{section.description}</p>
      </div>
      <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
    </button>
  );
}

const SERVICE_OPTIONS = [
  "Gel Manicure",
  "Structured Gel / Builder Gel",
  "Acrylic Full Set",
  "Acrylic Fill",
  "Gel-X / Soft Gel Extensions",
  "Dip Powder",
  "Manicure",
  "Pedicure",
  "Nail Art / Add-Ons",
  "Removal / Soak-Off",
  "Repair",
  "Press-On Nails",
  "Custom / Not Sure",
];
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to access settings.</p>
          <button onClick={() => navigate("/login")} className="btn-valisse px-6 py-3 rounded-xl text-sm">Sign In</button>
        </div>
      </div>
    );
  }

  const isTech = user.userType === "nail_tech";
  const hasDual = (user as any).hasDualRole || isTech;
  const activeMode = (user as any).activeMode ?? (isTech ? "nail_tech" : "client");
  const visibleSections = SETTINGS_SECTIONS.filter((s) => !s.techOnly || isTech);
  const initials = user.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "?";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      </div>

      {/* Profile summary card */}
      <div
        className="mx-4 mt-4 mb-2 rounded-2xl bg-card border border-border p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => navigate("/settings/profile")}
      >
        <Avatar className="w-14 h-14 border-2 border-primary/20">
          <AvatarImage src={(user as any).avatarUrl ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{user.name ?? "Your Name"}</p>
          <p className="text-sm text-muted-foreground truncate">{(user as any).email ?? (user as any).phone ?? "Add contact info"}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {activeMode === "nail_tech" ? <Scissors size={11} className="text-primary" /> : <Sparkles size={11} className="text-primary" />}
            <span className="text-xs text-primary">{activeMode === "nail_tech" ? "Nail Tech" : "Client"}</span>
            {hasDual && <span className="text-xs text-muted-foreground">· Dual Account</span>}
          </div>
        </div>
        <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
      </div>

      {/* Account Switcher (dual-role) */}
      {hasDual && (
        <div className="mx-4 mb-4 rounded-2xl bg-card border border-border px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Active mode</span>
          <AccountSwitcher />
        </div>
      )}

      {/* Become a Nail Tech (client-only) */}
      {!isTech && !hasDual && (
        <div className="mx-4 mb-4">
          <button
            onClick={() => setShowBecomeModal(true)}
            className="w-full bg-primary text-white rounded-2xl p-4 flex items-center gap-4 hover:bg-primary/90 transition"
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Scissors size={18} className="text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-white text-sm">Become a Nail Tech</p>
              <p className="text-xs text-white/70 mt-0.5">Add a tech account — keep your client profile</p>
            </div>
            <ChevronRight size={18} className="text-white/70" />
          </button>
        </div>
      )}

      {/* Main settings sections */}
      <div className="mx-4 mt-2 rounded-2xl bg-card border border-border overflow-hidden">
        {visibleSections.map((section, i) => (
          <div key={section.id}>
            <SettingsRow section={section} />
            {i < visibleSections.length - 1 && <Separator className="ml-[68px]" />}
          </div>
        ))}
      </div>

      {/* Legal & Support */}
      <div className="mx-4 mt-4 rounded-2xl bg-card border border-border overflow-hidden">
        {LEGAL_SECTIONS.map((section, i) => (
          <div key={section.id}>
            <SettingsRow section={section} />
            {i < LEGAL_SECTIONS.length - 1 && <Separator className="ml-[68px]" />}
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="mx-4 mt-4 rounded-2xl bg-card border border-border overflow-hidden">
        <button
          onClick={() => { logoutMutation.mutate(); logout(); }}
          disabled={logoutMutation.isPending}
          className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-destructive/5 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0">
            <LogOut size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">{logoutMutation.isPending ? "Signing out…" : "Sign Out"}</p>
          </div>
        </button>
      </div>

      {/* App version */}
      <p className="text-center text-xs text-muted-foreground mt-6">Valisse · v1.0.0</p>

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
