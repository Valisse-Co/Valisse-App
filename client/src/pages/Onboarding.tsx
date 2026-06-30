import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronRight, Sparkles, Scissors, LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";
import ConsentStep from "./ConsentStep";

const STYLE_OPTIONS = ["Minimalist", "Bold", "Floral", "Geometric", "Glam", "Natural", "Abstract", "French"];
const COLOR_OPTIONS = ["Nude", "White", "Black", "Pink", "Red", "Blue", "Green", "Purple", "Gold", "Multicolor"];
const SHAPE_OPTIONS = ["Square", "Round", "Oval", "Almond", "Stiletto", "Coffin", "Ballerina"];
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

type UserType = "client" | "nail_tech";

export default function Onboarding() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState("");
  const [phone, setPhone] = useState("");
  const [geoLat, setGeoLat] = useState<number | undefined>();
  const [geoLng, setGeoLng] = useState<number | undefined>();
  const [locating, setLocating] = useState(false);
  // After profile is saved, show the consent step
  const [profileSaved, setProfileSaved] = useState(false);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLat(pos.coords.latitude);
        setGeoLng(pos.coords.longitude);
        setLocating(false);
        toast.success("Location detected!");
      },
      () => { setLocating(false); toast.error("Could not detect location."); },
      { timeout: 8000 }
    );
  };

  const completeOnboarding = trpc.users.completeOnboarding.useMutation({
    onSuccess: () => {
      // Move to consent step instead of navigating away
      setProfileSaved(true);
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  });

  const toggleItem = (item: string, list: string[], setList: (l: string[]) => void) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleFinish = () => {
    if (!userType) return;
    completeOnboarding.mutate({
      userType,
      stylePreferences: selectedStyles,
      colorPreferences: selectedColors,
      location: location || undefined,
      lat: geoLat,
      lng: geoLng,
      businessName: businessName || undefined,
      bio: bio || undefined,
      services: selectedServices,
      priceRange: priceRange || undefined,
      phone: phone || undefined,
    });
  };

  const handleConsentComplete = () => {
    if (userType === "nail_tech") navigate("/dashboard");
    else navigate("/discover");
  };

  const steps = userType === "nail_tech"
    ? ["role", "tech-info", "services", "done"]
    : ["role", "preferences", "location", "done"];

  const currentStep = steps[step];

  // After profile is saved, show the consent step
  if (profileSaved) {
    return <ConsentStep onComplete={handleConsentComplete} />;
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col">
      {/* Progress bar */}
      {step > 0 && (
        <div className="h-1 bg-border">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((step) / (steps.length - 1)) * 100}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col px-6 py-8">
        <AnimatePresence mode="wait">
          {/* Step 0: Choose Role */}
          {currentStep === "role" && (
            <motion.div
              key="role"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-8 flex-1"
            >
              <div className="flex flex-col gap-3">
                <img
                  src="/manus-storage/valisse_logo_transparent_b005737c.png"
                  alt="Valisse"
                  className="w-16 h-16 object-contain"
                />
                <h1 className="text-3xl font-display font-light text-foreground mb-1">Welcome to Valisse</h1>
                <p className="text-muted-foreground text-sm">How will you be using the app?</p>
              </div>

              <div className="flex flex-col gap-4 flex-1">
                <button
                  onClick={() => { setUserType("client"); setStep(1); }}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl p-6 text-left border-2 transition-all duration-200",
                    userType === "client" ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Sparkles className="text-primary" size={22} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">I'm a Client</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Discover nail inspiration and book appointments with talented nail artists near you.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => { setUserType("nail_tech"); setStep(1); }}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl p-6 text-left border-2 transition-all duration-200",
                    userType === "nail_tech" ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Scissors className="text-primary" size={22} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">I'm a Nail Tech</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Showcase your work, attract new clients, and manage your bookings all in one place.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {/* Client: Preferences */}
          {currentStep === "preferences" && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h2 className="text-2xl font-display font-light mb-1">Your Style</h2>
                <p className="text-muted-foreground text-sm">Select styles you love (pick any)</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {STYLE_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleItem(s, selectedStyles, setSelectedStyles)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm border transition-all duration-150",
                      selectedStyles.includes(s)
                        ? "bg-primary text-white border-primary"
                        : "bg-card border-border text-foreground hover:border-primary/40"
                    )}
                  >{s}</button>
                ))}
              </div>

              <div>
                <p className="text-muted-foreground text-sm mb-3">Favorite colors</p>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => toggleItem(c, selectedColors, setSelectedColors)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm border transition-all duration-150",
                        selectedColors.includes(c)
                          ? "bg-primary text-white border-primary"
                          : "bg-card border-border text-foreground hover:border-primary/40"
                      )}
                    >{c}</button>
                  ))}
                </div>
              </div>

              <button onClick={() => setStep(2)} className="btn-valisse mt-auto py-4 w-full">
                Continue <ChevronRight size={16} className="inline ml-1" />
              </button>
            </motion.div>
          )}

          {/* Client: Location */}
          {currentStep === "location" && (
            <motion.div
              key="location"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h2 className="text-2xl font-display font-light mb-1">Your Location</h2>
                <p className="text-muted-foreground text-sm">We'll show you nail techs near you</p>
              </div>
              <Input
                placeholder="City, State (e.g. Miami, FL)"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="rounded-xl h-12"
              />
              <button
                type="button"
                onClick={detectLocation}
                disabled={locating}
                className="flex items-center gap-2 text-sm text-primary font-medium"
              >
                <LocateFixed size={14} className={locating ? "animate-pulse" : ""} />
                {locating ? "Detecting location…" : geoLat ? "Location detected ✓" : "Detect my location"}
              </button>
              <button onClick={handleFinish} disabled={completeOnboarding.isPending} className="btn-valisse py-4 w-full mt-auto">
                {completeOnboarding.isPending ? "Setting up..." : "Continue"}
              </button>
            </motion.div>
          )}

          {/* Tech: Info */}
          {currentStep === "tech-info" && (
            <motion.div
              key="tech-info"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-5"
            >
              <div>
                <h2 className="text-2xl font-display font-light mb-1">Your Business</h2>
                <p className="text-muted-foreground text-sm">Tell clients about yourself</p>
              </div>
              <div className="flex flex-col gap-3">
                <Input placeholder="Business / Studio name" value={businessName} onChange={e => setBusinessName(e.target.value)} className="rounded-xl h-12" />
                <Input placeholder="Location (City, State)" value={location} onChange={e => setLocation(e.target.value)} className="rounded-xl h-12" />
                <Input placeholder="Phone number (for bookings)" value={phone} onChange={e => setPhone(e.target.value)} className="rounded-xl h-12" />
                <Textarea
                  placeholder="Tell clients about your style and experience..."
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="rounded-xl resize-none"
                  rows={4}
                />
              </div>
              <button onClick={() => setStep(2)} className="btn-valisse py-4 w-full">
                Continue <ChevronRight size={16} className="inline ml-1" />
              </button>
            </motion.div>
          )}

          {/* Tech: Services */}
          {currentStep === "services" && (
            <motion.div
              key="services"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h2 className="text-2xl font-display font-light mb-1">Your Services</h2>
                <p className="text-muted-foreground text-sm">Select what you offer</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SERVICE_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleItem(s, selectedServices, setSelectedServices)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm border transition-all duration-150",
                      selectedServices.includes(s)
                        ? "bg-primary text-white border-primary"
                        : "bg-card border-border text-foreground hover:border-primary/40"
                    )}
                  >{s}</button>
                ))}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-3">Price range</p>
                <div className="flex flex-wrap gap-2">
                  {PRICE_OPTIONS.map(p => (
                    <button
                      key={p}
                      onClick={() => setPriceRange(p)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm border transition-all duration-150",
                        priceRange === p
                          ? "bg-primary text-white border-primary"
                          : "bg-card border-border text-foreground hover:border-primary/40"
                      )}
                    >{p}</button>
                  ))}
                </div>
              </div>
              <button onClick={handleFinish} disabled={completeOnboarding.isPending} className="btn-valisse py-4 w-full mt-auto">
                {completeOnboarding.isPending ? "Setting up..." : "Continue"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
