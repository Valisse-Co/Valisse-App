import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { MediaCarousel } from "@/components/MediaCarousel";
import {
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Scissors,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute, useSearch } from "wouter";

// ─── Service type ────────────────────────────────────────────────────────────
type BookingService = {
  id: string;
  label: string;
  duration: number;
  price: number | null;
  photoUrl: string | null;
  icon?: string;
};

// ─── Calendar helpers ─────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function formatDateStr(str: string) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

const STEPS = ["Service", "Smart Match", "Date", "Time", "Confirm"];

// ─── Smart Match types ────────────────────────────────────────────────────────
type SMQuestion = { id: string; text: string; options: string[] };
type SMOutcome = "match" | "recommend" | "review";

export default function BookingFlow() {
  const [, params] = useRoute("/book/:techId");
  const techId = params?.techId ? Number(params.techId) : 0;
  const [, navigate] = useLocation();
  const search = useSearch();
  const postId = new URLSearchParams(search).get("postId");
  const preselectedServiceId = new URLSearchParams(search).get("serviceId");
  const { isAuthenticated } = useAuth();

  // ── State ────────────────────────────────────────────────────────────────
  const [step, setStep]                   = useState(0);
  const [selectedService, setSelectedService] = useState<BookingService | null>(null);

  // ── Smart Match state ─────────────────────────────────────────────────────
  const [smAnswers, setSmAnswers]           = useState<Record<string, string>>({});
  const [smOutcome, setSmOutcome]           = useState<SMOutcome | null>(null);
  const [smRecommended, setSmRecommended]   = useState<string | null>(null);
  const [smPhotoFiles, setSmPhotoFiles]     = useState<File[]>([]);
  const [smPhotoPreviews, setSmPhotoPreviews] = useState<string[]>([]);
  const [smSkipped, setSmSkipped]           = useState(false);
  const [calMonth, setCalMonth]           = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDate, setSelectedDate]   = useState<string | null>(null);
  const [selectedTime, setSelectedTime]   = useState<string | null>(null);
  const [notes, setNotes]                 = useState("");
  const [booked, setBooked]               = useState(false);

  // ── Smart Match queries ───────────────────────────────────────────────────
  const smEnabledQuery = trpc.smartMatch.isEnabled.useQuery(
    { techId, serviceId: selectedService ? Number(selectedService.id) : 0 },
    { enabled: techId > 0 && !!selectedService && !isNaN(Number(selectedService.id)) }
  );
  const smConfigQuery = trpc.smartMatch.getConfig.useQuery(
    { techId, serviceCategory: selectedService?.label ?? "" },
    { enabled: techId > 0 && !!selectedService }
  );
  const smEvaluate = trpc.smartMatch.evaluate.useMutation();

  // ── Queries ──────────────────────────────────────────────────────────────
  const techQuery = trpc.users.getProfile.useQuery(
    { userId: techId },
    { enabled: techId > 0 }
  );
  const tech = techQuery.data?.user;

  const availabilityQuery = trpc.availability.get.useQuery(
    { techId },
    { enabled: techId > 0 }
  );
  // Build a map of dayOfWeek → availability row for richer calendar info
  const availabilityByDay = useMemo(() => {
    const map = new Map<number, any>();
    if (!availabilityQuery.data) return map;
    for (const a of availabilityQuery.data as any[]) {
      if (a.isActive) map.set(Number(a.dayOfWeek), a);
    }
    return map;
  }, [availabilityQuery.data]);

  const workingDays = useMemo(
    () => new Set(availabilityByDay.keys()),
    [availabilityByDay]
  );

  const slotsQuery = trpc.bookings.availableSlots.useQuery(
    {
      techId,
      date: selectedDate ?? "",
      duration: selectedService?.duration ?? 60,
    },
    { enabled: !!selectedDate && !!selectedService && techId > 0, staleTime: 0 }
  );

  // Fetch per-date bookable status for the current calendar month so the
  // calendar can distinguish "working but fully booked" from "open" days.
  const monthStatusQuery = trpc.bookings.monthBookableStatus.useQuery(
    {
      techId,
      year: calMonth.year,
      month: calMonth.month + 1, // convert 0-indexed to 1-indexed
      duration: selectedService?.duration ?? 60,
    },
    { enabled: techId > 0 && !!selectedService, staleTime: 60_000 }
  );
  const monthStatus = monthStatusQuery.data ?? {};

  // ── Tech services (from Settings) ─────────────────────────────────────────
  const techServicesQuery = trpc.settings.getServicesByTechId.useQuery(
    { techId },
    { enabled: techId > 0 }
  );
  const techServices: BookingService[] = useMemo(() => {
    const raw = techServicesQuery.data as any[] | undefined;
    if (raw && raw.length > 0) {
      return raw.map((s: any) => ({
        id: String(s.id),
        label: s.customName || s.category || s.name,
        duration: s.durationMinutes,
        price: s.priceInCents != null ? s.priceInCents / 100 : (s.price != null ? Number(s.price) : null),
        photoUrl: s.photoUrl ?? null,
      }));
    }
    // Fallback defaults when tech hasn't set up services yet
    return [
      { id: "gel_manicure",        label: "Gel Manicure",                  duration: 60,  price: null, photoUrl: null },
      { id: "structured_gel",      label: "Structured Gel / Builder Gel",  duration: 75,  price: null, photoUrl: null },
      { id: "acrylic_full",        label: "Acrylic Full Set",              duration: 90,  price: null, photoUrl: null },
      { id: "acrylic_fill",        label: "Acrylic Fill",                  duration: 60,  price: null, photoUrl: null },
      { id: "gel_x",               label: "Gel-X / Soft Gel Extensions",   duration: 75,  price: null, photoUrl: null },
      { id: "dip_powder",          label: "Dip Powder",                    duration: 60,  price: null, photoUrl: null },
      { id: "manicure",            label: "Manicure",                      duration: 45,  price: null, photoUrl: null },
      { id: "pedicure",            label: "Pedicure",                      duration: 60,  price: null, photoUrl: null },
      { id: "nail_art",            label: "Nail Art / Add-Ons",            duration: 45,  price: null, photoUrl: null },
      { id: "removal",             label: "Removal / Soak-Off",            duration: 45,  price: null, photoUrl: null },
      { id: "repair",              label: "Repair",                        duration: 30,  price: null, photoUrl: null },
      { id: "press_on",            label: "Press-On Nails",                duration: 45,  price: null, photoUrl: null },
      { id: "custom",              label: "Custom / Not Sure",             duration: 60,  price: null, photoUrl: null },
    ];
  }, [techServicesQuery.data]);

  // ── Mutations ────────────────────────────────────────────────────────────
  // Fetch cancellation policy for the tech
  const policyQuery = trpc.cancellation.getPolicy.useQuery(
    { techId },
    { enabled: techId > 0 }
  );
  const cancellationPolicy = policyQuery.data;

  // Fetch post data when booking from a post
  const postQuery = trpc.posts.getById.useQuery(
    { postId: postId ? Number(postId) : 0 },
    { enabled: !!postId }
  );
  const postData = postQuery.data?.post;

  // ── Auto-select service from post OR from profile service tap ───────────────
  const [autoSelected, setAutoSelected] = useState(false);
  useEffect(() => {
    if (autoSelected) return;
    if (!techServicesQuery.data) return;
    const raw = techServicesQuery.data as any[];

    // Priority 1: service tapped directly on tech profile page
    if (preselectedServiceId) {
      const match = raw.find((s: any) => String(s.id) === preselectedServiceId);
      if (match) {
        setSelectedService({
          id: String(match.id),
          label: match.customName || match.category || match.name,
          duration: match.durationMinutes,
          price: match.priceInCents != null ? match.priceInCents / 100 : null,
          photoUrl: match.photoUrl ?? null,
        });
        setStep(1); // go to Smart Match step
        setAutoSelected(true);
        return;
      }
    }

    // Priority 2: booking from a post with a linked service
    if (!postData) return;
    const linkedServiceId = (postData as any).serviceId;
    if (!linkedServiceId) return;
    const match = raw.find((s: any) => s.id === linkedServiceId);
    if (match) {
      setSelectedService({
        id: String(match.id),
        label: match.customName || match.category || match.name,
        duration: match.durationMinutes,
        price: match.priceInCents != null ? match.priceInCents / 100 : null,
        photoUrl: match.photoUrl ?? null,
      });
      setStep(1); // go to Smart Match step
      setAutoSelected(true);
    }
  }, [postData, techServicesQuery.data, autoSelected, preselectedServiceId]);

  const utils = trpc.useUtils();
  const createBooking = trpc.bookings.create.useMutation({
    onSuccess: () => {
      setBooked(true);
      utils.bookings.clientBookings.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not create booking. Please try again.");
    },
  });

  // ── Derived ──────────────────────────────────────────────────────────────
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const daysInMonth = getDaysInMonth(calMonth.year, calMonth.month);
  const firstDay    = getFirstDay(calMonth.year, calMonth.month);

  function isSelectable(day: number) {
    const str = toDateStr(calMonth.year, calMonth.month, day);
    if (str < todayStr) return false;
    const dow = new Date(calMonth.year, calMonth.month, day).getDay();
    if (!workingDays.has(dow)) return false;
    // If monthStatus has loaded, only allow days with open slots
    if (Object.keys(monthStatus).length > 0) return monthStatus[str] === true;
    return true; // optimistic until loaded
  }

  function isFullyBooked(day: number) {
    const str = toDateStr(calMonth.year, calMonth.month, day);
    const dow = new Date(calMonth.year, calMonth.month, day).getDay();
    if (!workingDays.has(dow)) return false;
    if (str < todayStr) return false;
    return Object.keys(monthStatus).length > 0 && monthStatus[str] === false;
  }

  // Returns the working hours label for a day cell tooltip
  function getDayHours(day: number): string | null {
    const dow = new Date(calMonth.year, calMonth.month, day).getDay();
    const av = availabilityByDay.get(dow);
    if (!av) return null;
    return `${av.startTime}–${av.endTime}`;
  }

  function handleConfirm() {
    if (!isAuthenticated) { toast.error("Please sign in to book."); return; }
    if (!selectedDate || !selectedTime || !selectedService) return;
    const [y, mo, d] = selectedDate.split("-").map(Number);
    const [h, min]   = selectedTime.split(":").map(Number);
    createBooking.mutate({
      techId,
      postId: postId ? Number(postId) : undefined,
      serviceType: selectedService.label,
      scheduledAt: new Date(y, mo - 1, d, h, min).getTime(),
      duration: selectedService.duration,
      notes: notes || undefined,
    });
  }

  function canAdvance() {
    if (step === 0) return !!selectedService;
    if (step === 1) return true; // Smart Match — always can continue (skip allowed)
    if (step === 2) return !!selectedDate;
    if (step === 3) return !!selectedTime;
    if (step === 4) return true;
    return false;
  }

  async function advance() {
    if (step === 4) { handleConfirm(); return; }
    // When leaving Smart Match step, evaluate if answers were provided
    if (step === 1 && !smSkipped && Object.keys(smAnswers).length > 0) {
      const cfg = smConfigQuery.data as any;
      if (cfg) {
        const result = await smEvaluate.mutateAsync({
          techId,
          serviceCategory: selectedService?.label ?? "",
          answers: smAnswers,
        });
        setSmOutcome(result.outcome as SMOutcome);
        setSmRecommended(result.recommendedService);
        // If outcome is "review" or "recommend", stay on step 1 to show outcome screen
        if (result.outcome !== "match") {
          setSmOutcome(result.outcome as SMOutcome);
          return; // show outcome screen
        }
      }
    }
    setStep(s => s + 1);
  }

  useEffect(() => { if (!techId) navigate("/discover"); }, [techId]);

  // ── Success screen ───────────────────────────────────────────────────────
  if (booked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-semibold text-foreground mb-2">Booking Requested</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your request has been sent to{" "}
              <span className="font-medium text-foreground">
                {tech?.businessName ?? tech?.name ?? "the nail tech"}
              </span>
              . You'll be notified once confirmed.
            </p>
          </div>
          <Card className="w-full p-4 rounded-2xl border-border text-left space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Scissors className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium text-foreground">{selectedService?.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">{selectedService?.duration} min</Badge>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span className="text-muted-foreground">{selectedDate ? formatDateStr(selectedDate) : ""}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span className="text-muted-foreground">{selectedTime}</span>
            </div>
          </Card>
          <div className="flex flex-col gap-3 w-full">
            <Button className="w-full" onClick={() => navigate("/bookings")}>View My Bookings</Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/discover")}>Back to Discover</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => step === 0 ? navigate(-1 as any) : setStep(s => s - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
            <h2 className="text-sm font-semibold text-foreground">{STEPS[step]}</h2>
          </div>
          {tech && (
            <div className="flex items-center gap-2">
              {tech.avatarUrl
                ? <img src={tech.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                : <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary">
                      {(tech.businessName ?? tech.name ?? "?")[0]}
                    </span>
                  </div>
              }
              <span className="text-xs font-medium text-foreground truncate max-w-[80px]">
                {tech.businessName ?? tech.name}
              </span>
            </div>
          )}
        </div>
        <div className="max-w-lg mx-auto mt-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6">

          {/* Step 0 — Service selection */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-serif font-semibold text-foreground">Choose a service</h1>
                <p className="text-sm text-muted-foreground mt-1">Select the service you'd like to book</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {techServicesQuery.isLoading ? (
                  <div className="col-span-2 flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : techServices.map((svc: BookingService) => (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedService(svc)}
                    className={`
                      relative rounded-2xl border text-left transition-all duration-200 overflow-hidden
                      ${selectedService?.id === svc.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-primary/40"}
                    `}
                  >
                    {svc.photoUrl && (
                      <div className="w-full h-24 overflow-hidden">
                        <img src={svc.photoUrl} alt={svc.label} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-3">
                      {selectedService?.id === svc.id && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <p className="text-sm font-medium text-foreground leading-tight">{svc.label}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {svc.duration} min
                      </p>
                      {svc.price != null && (
                        <p className="text-xs font-semibold text-primary mt-1">${svc.price.toFixed(2)}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Smart Match Questionnaire */}
          {step === 1 && (() => {
            const smEnabled = smEnabledQuery.data;
            const cfg = smConfigQuery.data as any;
            const questions: SMQuestion[] = cfg?.questions ?? [];

            // If Smart Match is disabled for this service, auto-skip to date step
            if (smEnabledQuery.isFetched && smEnabled === false) {
              setTimeout(() => setStep(2), 0);
              return null;
            }

            // Outcome screen — recommend
            if (smOutcome === "recommend" && smRecommended) {
              return (
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="w-7 h-7 text-amber-500" />
                    </div>
                    <h1 className="text-xl font-serif font-semibold text-foreground">We have a suggestion</h1>
                    <p className="text-sm text-muted-foreground mt-1">Based on your answers, this service may be a better fit:</p>
                  </div>
                  <Card className="p-4 rounded-2xl border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                    <p className="font-semibold text-foreground">{smRecommended}</p>
                    <p className="text-xs text-muted-foreground mt-1">Your nail tech will confirm the details after reviewing your booking.</p>
                  </Card>
                  <div className="flex flex-col gap-2">
                    <Button className="w-full" onClick={() => setStep(2)}>Book with Recommendation</Button>
                    <Button variant="ghost" className="w-full" onClick={() => { setSmOutcome(null); setStep(2); }}>Continue with Original Service</Button>
                  </div>
                </div>
              );
            }

            // Outcome screen — needs review
            if (smOutcome === "review") {
              return (
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="w-7 h-7 text-primary" />
                    </div>
                    <h1 className="text-xl font-serif font-semibold text-foreground">Sending to your nail tech</h1>
                    <p className="text-sm text-muted-foreground mt-1">Your answers suggest a custom consultation. Your nail tech will review and confirm the best service for you.</p>
                  </div>
                  <Card className="p-4 rounded-2xl border-border space-y-2">
                    {Object.entries(smAnswers).map(([qId, ans]) => {
                      const q = questions.find((q: SMQuestion) => q.id === qId);
                      return q ? (
                        <div key={qId} className="text-sm">
                          <span className="text-muted-foreground">{q.text}: </span>
                          <span className="font-medium text-foreground">{ans}</span>
                        </div>
                      ) : null;
                    })}
                  </Card>
                  <Button className="w-full" onClick={() => setStep(2)}>Continue to Booking</Button>
                </div>
              );
            }

            // Loading state
            if (smConfigQuery.isLoading || smEnabledQuery.isLoading) {
              return (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              );
            }

            // No questions configured or SM disabled globally — skip
            if (!questions.length) {
              setTimeout(() => setStep(2), 0);
              return null;
            }

            // Questionnaire
            return (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h1 className="text-xl font-serif font-semibold text-foreground">Smart Service Match</h1>
                  </div>
                  <p className="text-sm text-muted-foreground">Answer a few quick questions so we can make sure you're booked for the right service.</p>
                </div>

                {questions.map((q: SMQuestion) => (
                  <div key={q.id} className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{q.text}</p>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt: string) => (
                        <button
                          key={opt}
                          onClick={() => setSmAnswers(prev => ({ ...prev, [q.id]: opt }))}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                            smAnswers[q.id] === opt
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >{opt}</button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Photo upload */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Inspiration photos <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <div className="flex flex-wrap gap-2">
                    {smPhotoPreviews.map((src, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => {
                            setSmPhotoFiles(f => f.filter((_, j) => j !== i));
                            setSmPhotoPreviews(p => p.filter((_, j) => j !== i));
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center"
                        ><X className="w-2.5 h-2.5 text-white" /></button>
                      </div>
                    ))}
                    {smPhotoPreviews.length < 5 && (
                      <label className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 transition-colors">
                        <Camera className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground mt-0.5">Add</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={e => {
                            const files = Array.from(e.target.files ?? []);
                            files.forEach(file => {
                              const reader = new FileReader();
                              reader.onload = ev => {
                                setSmPhotoPreviews(p => [...p, ev.target?.result as string]);
                              };
                              reader.readAsDataURL(file);
                            });
                            setSmPhotoFiles(f => [...f, ...files]);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => { setSmSkipped(true); setStep(2); }}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >Skip and continue without Smart Match</button>
              </div>
            );
          })()}

          {/* Step 2 — Calendar */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-serif font-semibold text-foreground">Pick a date</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {availabilityQuery.isLoading
                    ? "Loading schedule…"
                    : workingDays.size === 0
                    ? "This nail tech hasn't set their schedule yet."
                    : <>Available days are highlighted · <span className="text-foreground font-medium">{selectedService?.label}</span></>}
                </p>
              </div>
              <Card className="p-4 rounded-2xl border-border">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCalMonth(c => {
                      const d = new Date(c.year, c.month - 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })}
                    disabled={calMonth.year === today.getFullYear() && calMonth.month === today.getMonth()}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-foreground">
                    {MONTH_NAMES[calMonth.month]} {calMonth.year}
                  </span>
                  <button
                    onClick={() => setCalMonth(c => {
                      const d = new Date(c.year, c.month + 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-y-1">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const str = toDateStr(calMonth.year, calMonth.month, day);
                    const sel = selectedDate === str;
                    const ok  = isSelectable(day);
                    const fullyBooked = isFullyBooked(day);
                    const isT = str === todayStr;
                    const hours = getDayHours(day);
                    const isPastDay = str < todayStr;
                    const isWorking = workingDays.has(new Date(calMonth.year, calMonth.month, day).getDay());
                    return (
                      <div key={day} className="flex flex-col items-center gap-0.5">
                        <button
                          disabled={!ok}
                          onClick={() => { if (ok) { setSelectedDate(str); setSelectedTime(null); } }}
                          title={
                            sel ? "Selected" :
                            ok && hours ? `Open ${hours}` :
                            fullyBooked ? "Fully booked" :
                            isPastDay ? "Past" :
                            !isWorking ? "Not available" : undefined
                          }
                          className={`
                            w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-all
                            ${sel
                              ? "bg-primary text-white shadow-sm"
                              : ok
                              ? "text-foreground hover:bg-primary/10 cursor-pointer"
                              : fullyBooked
                              ? "text-muted-foreground/50 cursor-not-allowed line-through decoration-muted-foreground/30"
                              : "text-muted-foreground/30 cursor-not-allowed"}
                            ${isT && !sel ? "ring-1 ring-primary/40" : ""}
                          `}
                        >{day}</button>
                        {ok && !sel && (
                          <span className="w-1 h-1 rounded-full bg-primary/50" />
                        )}
                        {fullyBooked && (
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
              {/* Calendar legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary/50 inline-block" />
                  Open slots
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30 inline-block" />
                  Fully booked
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/30 text-xs line-through">15</span>
                  Unavailable
                </span>
              </div>
              {selectedDate && (
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <Calendar className="w-4 h-4" />
                  {formatDateStr(selectedDate)}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Time slots */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-serif font-semibold text-foreground">Choose a time</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedDate ? formatDateStr(selectedDate) : ""}
                </p>
              </div>

              {/* Service summary banner — shown when auto-selected from a post */}
              {selectedService && (
                <div className="flex items-center gap-3 rounded-2xl bg-primary/5 border border-primary/15 px-4 py-3">
                  {selectedService.photoUrl ? (
                    <img src={selectedService.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Scissors className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{selectedService.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedService.duration} min
                      {selectedService.price != null && (
                        <span className="ml-2 text-primary font-medium">${selectedService.price.toFixed(2)}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Working hours banner for the selected day */}
              {selectedDate && (() => {
                const dow = new Date(
                  Number(selectedDate.split("-")[0]),
                  Number(selectedDate.split("-")[1]) - 1,
                  Number(selectedDate.split("-")[2])
                ).getDay();
                const av = availabilityByDay.get(dow);
                return av ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15 text-xs text-primary">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Open {av.startTime}–{av.endTime}
                      {av.breakStart && av.breakEnd ? ` · Break ${av.breakStart}–${av.breakEnd}` : ""}
                      {av.bufferMinutes > 0 ? ` · ${av.bufferMinutes}-min buffer between appointments` : ""}
                    </span>
                  </div>
                ) : null;
              })()}

              {slotsQuery.isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading availability…</p>
                </div>
              ) : !slotsQuery.data || slotsQuery.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Calendar className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">No time slots found</p>
                  <p className="text-xs text-muted-foreground">
                    This day may not be in the tech's schedule. Go back and choose a highlighted date.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setStep(1)}>Change Date</Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {slotsQuery.data.map(slot => {
                      const isReturningOnly = slot.reason === "returning_only";
                      const reasonLabel =
                        slot.reason === "booked" ? "Booked" :
                        slot.reason === "break" ? "Break" :
                        slot.reason === "blocked" ? "Blocked" :
                        slot.reason === "outside_hours" ? "End of shift" :
                        slot.reason === "past" ? "Past" :
                        isReturningOnly ? "Returning clients" : undefined;
                      return (
                        <button
                          key={slot.time}
                          disabled={!slot.available}
                          onClick={() => slot.available && setSelectedTime(slot.time)}
                          title={!slot.available && reasonLabel ? reasonLabel : undefined}
                          className={`
                            py-3 px-2 rounded-xl text-sm font-medium text-center transition-all
                            ${!slot.available
                              ? isReturningOnly
                                ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600/60 dark:text-amber-400/60 cursor-not-allowed border border-amber-200 dark:border-amber-800/40"
                                : "bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                              : selectedTime === slot.time
                              ? "bg-primary text-white shadow-sm ring-2 ring-primary/30"
                              : "bg-card border border-border text-foreground hover:border-primary/50 hover:bg-primary/5 cursor-pointer"}
                          `}
                        >
                          {slot.time}
                          {!slot.available && reasonLabel && (
                            <span className={`block text-[9px] mt-0.5 leading-none truncate ${isReturningOnly ? "text-amber-500/70 dark:text-amber-400/60" : "text-muted-foreground/40"}`}>
                              {reasonLabel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-card border border-border inline-block" />
                      Available
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-muted/30 inline-block" />
                      Unavailable
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 inline-block" />
                      Returning clients only
                    </span>
                  </div>
                  {slotsQuery.data.every(s => !s.available) && (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">
                        All slots are booked for this day.
                      </p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setStep(1)}>
                        Choose a different date
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4 — Confirm */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-serif font-semibold text-foreground">Confirm booking</h1>
                <p className="text-sm text-muted-foreground mt-1">Review your appointment details</p>
              </div>
              {/* Post preview carousel — shown when booking from a post */}
              {postData && (postData.imageUrls?.length ?? 0) > 0 && (
                <div className="rounded-2xl overflow-hidden border border-border">
                  <MediaCarousel
                    urls={postData.imageUrls ?? []}
                    aspectRatio="4/3"
                    showBadge
                  />
                  {postData.caption && (
                    <div className="px-3 py-2 bg-card">
                      <p className="text-xs text-muted-foreground truncate">{postData.caption}</p>
                    </div>
                  )}
                </div>
              )}
              {tech && (
                <Card className="p-4 rounded-2xl border-border flex items-center gap-3">
                  {tech.avatarUrl
                    ? <img src={tech.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                    : <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {tech.businessName ?? tech.name}
                    </p>
                    {tech.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {tech.location}
                      </p>
                    )}
                  </div>
                </Card>
              )}
              <Card className="p-4 rounded-2xl border-border space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Scissors className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Service</p>
                    <p className="text-sm font-medium text-foreground">{selectedService?.label}</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto text-xs">{selectedService?.duration} min</Badge>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedDate ? formatDateStr(selectedDate) : ""}
                    </p>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Time</p>
                    <p className="text-sm font-medium text-foreground">{selectedTime}</p>
                  </div>
                </div>
              </Card>
              {/* Cancellation Policy Summary */}
              {cancellationPolicy && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className="text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">Cancellation Policy</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Free cancellation up to {cancellationPolicy.windowHours}h before your appointment
                    {cancellationPolicy.feeAmount > 0 && (
                      <> or within 1 hour of booking. After that, a{" "}
                        <span className="text-foreground font-medium">
                          {cancellationPolicy.feeType === "flat"
                            ? `$${cancellationPolicy.feeAmount}`
                            : `${cancellationPolicy.feeAmount}%`}
                        </span>{" "}
                        late cancellation fee applies.
                      </>
                    )}
                    {cancellationPolicy.feeAmount === 0 && " (no fee for late cancellations)."}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Inspo photos, nail length, allergies…"
                  rows={3}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer CTA ──────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border px-4 py-4">
        <div className="max-w-lg mx-auto">
          <Button
            className="w-full h-12 text-sm font-semibold rounded-xl"
            disabled={!canAdvance() || createBooking.isPending}
            onClick={advance}
          >
            {createBooking.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Requesting…</>
            ) : step === 4 ? "Confirm & Request"
              : step === 3 ? "Review Booking"
              : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
