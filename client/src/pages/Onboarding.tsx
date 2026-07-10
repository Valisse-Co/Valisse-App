import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronRight, Sparkles, Scissors, LocateFixed, MapPin, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ConsentStep from "./ConsentStep";

const STYLE_OPTIONS = ["Minimalist", "Bold", "Floral", "Geometric", "Glam", "Natural", "Abstract", "French"];
const COLOR_OPTIONS = ["Nude", "White", "Black", "Pink", "Red", "Blue", "Green", "Purple", "Gold", "Multicolor"];
const SHAPE_OPTIONS = ["Square", "Round", "Oval", "Almond", "Stiletto", "Coffin", "Ballerina"];
const SERVICE_OPTIONS = [
  "Gel Manicure",
  "Structured Gel / Builder Gel",
  "Structured Gel / Builder Gel Fill",
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
// Duration dropdown: 5-min increments from 5 to 240 min
const DURATION_OPTIONS = Array.from({ length: 48 }, (_, i) => (i + 1) * 5);

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
  // Per-service detail: price (dollars string) and duration (minutes)
  const [serviceDetails, setServiceDetails] = useState<Record<string, { price: string; duration: number }>>({});
  const [priceRange, setPriceRange] = useState("");
  const [phone, setPhone] = useState("");
  const [geoLat, setGeoLat] = useState<number | undefined>();
  const [geoLng, setGeoLng] = useState<number | undefined>();
  const [locating, setLocating] = useState(false);
  // Tech address autocomplete state
  const [addressInput, setAddressInput] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<{ placeId: string; description: string }[]>([]);
  const [addressConfirmed, setAddressConfirmed] = useState(""); // formatted address after geocode
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
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

  // Address autocomplete — debounced query
  const [debouncedAddress, setDebouncedAddress] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAddress(addressInput), 350);
    return () => clearTimeout(t);
  }, [addressInput]);

  const { data: suggestions } = trpc.users.addressSuggestions.useQuery(
    { input: debouncedAddress },
    { enabled: debouncedAddress.length >= 3 && !addressConfirmed }
  );

  useEffect(() => {
    if (suggestions) {
      setAddressSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    }
  }, [suggestions]);

  const updateTechAddress = trpc.users.updateTechAddress.useMutation({
    onSuccess: (data) => {
      setAddressConfirmed(data.formattedAddress);
      setAddressCity(data.city);
      setAddressState(data.state);
      setLocation(`${data.city}, ${data.state}`);
      setAddressLoading(false);
      setShowSuggestions(false);
    },
    onError: () => {
      setAddressLoading(false);
      toast.error("Address could not be verified. Please try a different address.");
    },
  });

  const handleSelectSuggestion = (description: string) => {
    setAddressInput(description);
    setShowSuggestions(false);
    setAddressLoading(true);
    updateTechAddress.mutate({ address: description });
  };

  const upsertService = trpc.settings.upsertService.useMutation();

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

  const handleFinish = useCallback(async () => {
    if (!userType) return;
    // First complete onboarding profile
    await completeOnboarding.mutateAsync({
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
    // Then upsert each selected service with its price/duration
    if (userType === "nail_tech" && selectedServices.length > 0) {
      await Promise.all(
        selectedServices.map((svc, idx) => {
          const detail = serviceDetails[svc];
          const priceInCents = detail?.price ? Math.round(parseFloat(detail.price) * 100) : 0;
          const durationMinutes = detail?.duration ?? 60;
          return upsertService.mutateAsync({
            category: svc,
            priceInCents,
            durationMinutes,
            sortOrder: idx,
          });
        })
      );
    }
  }, [userType, selectedStyles, selectedColors, location, geoLat, geoLng, businessName, bio, selectedServices, priceRange, phone, serviceDetails, completeOnboarding, upsertService]);

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

                {/* Address autocomplete */}
                <div className="relative">
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Your studio address (e.g. 123 Main St, Miami, FL)"
                      value={addressInput}
                      onChange={e => { setAddressInput(e.target.value); setAddressConfirmed(""); }}
                      className="rounded-xl h-12 pl-9"
                    />
                    {addressLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                    {addressConfirmed && !addressLoading && (
                      <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                    )}
                  </div>
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                      {addressSuggestions.map(s => (
                        <button
                          key={s.placeId}
                          type="button"
                          onClick={() => handleSelectSuggestion(s.description)}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-accent transition-colors border-b border-border last:border-0"
                        >
                          <MapPin size={12} className="inline mr-2 text-muted-foreground" />
                          {s.description}
                        </button>
                      ))}
                    </div>
                  )}
                  {addressConfirmed && (
                    <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Address verified: {addressCity}, {addressState}
                      <span className="text-muted-foreground ml-1">(exact address hidden from clients until booking confirmed)</span>
                    </p>
                  )}
                </div>

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
              className="flex flex-col gap-4"
            >
              <div>
                <h2 className="text-2xl font-display font-light mb-1">Your Services</h2>
                <p className="text-muted-foreground text-sm">Select what you offer and set pricing</p>
              </div>
              <div className="flex flex-col gap-2">
                {SERVICE_OPTIONS.map(s => {
                  const isSelected = selectedServices.includes(s);
                  const detail = serviceDetails[s] ?? { price: "", duration: 60 };
                  return (
                    <div key={s} className={cn(
                      "rounded-2xl border transition-all duration-150 overflow-hidden",
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                    )}>
                      <button
                        onClick={() => {
                          toggleItem(s, selectedServices, setSelectedServices);
                          if (!serviceDetails[s]) {
                            setServiceDetails(prev => ({ ...prev, [s]: { price: "", duration: 60 } }));
                          }
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left"
                      >
                        <span>{s}</span>
                        <span className={cn(
                          "w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors",
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                        )} />
                      </button>
                      {isSelected && (
                        <div className="px-4 pb-3 flex gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Price ($)</label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="e.g. 65"
                              value={detail.price}
                              onChange={e => setServiceDetails(prev => ({ ...prev, [s]: { ...prev[s] ?? { price: "", duration: 60 }, price: e.target.value } }))}
                              className="h-9 rounded-xl text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Duration</label>
                            <select
                              value={detail.duration}
                              onChange={e => setServiceDetails(prev => ({ ...prev, [s]: { ...prev[s] ?? { price: "", duration: 60 }, duration: Number(e.target.value) } }))}
                              className="w-full h-9 rounded-xl border border-input bg-background px-3 text-sm"
                            >
                              {DURATION_OPTIONS.map(d => (
                                <option key={d} value={d}>
                                  {d < 60 ? `${d} min` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h ${d % 60}m`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleFinish}
                disabled={completeOnboarding.isPending || upsertService.isPending}
                className="btn-valisse py-4 w-full mt-2"
              >
                {(completeOnboarding.isPending || upsertService.isPending) ? "Setting up..." : "Continue"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
