import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getUnansweredQuestions } from "../../../shared/bookingComposition";
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
  category: string;
  duration: number;
  price: number | null;
  photoUrl: string | null;
  icon?: string;
};

// ─── Time helpers ────────────────────────────────────────────────────────────
function to12Hour(time: string): string {
  if (!time) return time;
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const period = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

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
type SMQuestion = { id: string; text: string; options: string[]; allowsPhoto?: boolean };
type SMOutcome = "match" | "recommendation" | "review";
type SMAssessment = {
  serviceCategory: string;
  answers: Record<string, string>;
  outcome: SMOutcome;
  recommendedService: string | null;
  recommendedAddOns: string[];
  explanation: string;
  photoUrls: string[];
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read inspiration photo."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export default function BookingFlow() {
  const [, params] = useRoute("/book/:techId");
  const techId = params?.techId ? Number(params.techId) : 0;
  const [, navigate] = useLocation();
  const search = useSearch();
  const postId = new URLSearchParams(search).get("postId");
  const preselectedServiceId = new URLSearchParams(search).get("serviceId");
  const requestedInspirationImage = new URLSearchParams(search).get("inspirationImage");
  const { isAuthenticated } = useAuth();

  // ── State ────────────────────────────────────────────────────────────────
  const [step, setStep]                   = useState(0);
  const [initialSelectedServices, setInitialSelectedServices] = useState<BookingService[]>([]);
  const selectedService = initialSelectedServices[0] ?? null;
  const setSelectedService = (service: BookingService | null) => setInitialSelectedServices(service ? [service] : []);

  // ── Smart Match state ─────────────────────────────────────────────────────
  const [smAnswers, setSmAnswers]           = useState<Record<string, string>>({});
  const [smOutcome, setSmOutcome]           = useState<SMOutcome | null>(null);
  const [smRecommended, setSmRecommended]   = useState<string | null>(null);
  const [smRecommendedAddOns, setSmRecommendedAddOns] = useState<string[]>([]);
  const [smPhotoFiles, setSmPhotoFiles]     = useState<File[]>([]);
  const [smPhotoPreviews, setSmPhotoPreviews] = useState<string[]>([]);
  const [smSkipped, setSmSkipped]           = useState(false);
  const [smMessage, setSmMessage]           = useState<string | null>(null);
  const [smSelectedAddOnServices, setSmSelectedAddOnServices] = useState<BookingService[]>([]);
  const [smResolvedOutcome, setSmResolvedOutcome] = useState<SMOutcome | null>(null);
  const [smServiceIndex, setSmServiceIndex] = useState(0);
  const [smAssessments, setSmAssessments] = useState<SMAssessment[]>([]);
  const [smAnswersByQuestionText, setSmAnswersByQuestionText] = useState<Record<string, string>>({});
  const [smPendingAssessment, setSmPendingAssessment] = useState<SMAssessment | null>(null);
  const bookingServices = useMemo(() => {
    const all = [...initialSelectedServices, ...smSelectedAddOnServices];
    return all.filter((service, index) => all.findIndex((candidate) => candidate.id === service.id) === index);
  }, [initialSelectedServices, smSelectedAddOnServices]);
  const bookingDuration = bookingServices.reduce((sum, service) => sum + service.duration, 0) || 60;
  const bookingTotal = bookingServices.reduce((sum, service) => sum + (service.price ?? 0), 0);
  const hasCompletePricing = bookingServices.every((service) => service.price != null);
  const activeMatchService = initialSelectedServices[smServiceIndex] ?? selectedService;
  const [calMonth, setCalMonth]           = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDate, setSelectedDate]   = useState<string | null>(null);
  const [selectedTime, setSelectedTime]   = useState<string | null>(null);
  const [notes, setNotes]                 = useState("");
  const [appointmentInspirationImage, setAppointmentInspirationImage] = useState<string | null>(requestedInspirationImage);
  const [booked, setBooked]               = useState(false);

  // ── Smart Match queries ───────────────────────────────────────────────────
  const smEnabledQuery = trpc.smartService.isEnabled.useQuery(
    { techId, serviceId: activeMatchService ? Number(activeMatchService.id) : 0 },
    { enabled: techId > 0 && !!activeMatchService && !isNaN(Number(activeMatchService.id)) }
  );
  const smConfigQuery = trpc.smartService.getConfig.useQuery(
    { serviceCategory: activeMatchService?.category ?? "" },
    { enabled: techId > 0 && !!activeMatchService }
  );
  const smEvaluate = trpc.smartService.evaluate.useMutation();
  const smUploadPhoto = trpc.smartService.uploadPhoto.useMutation();

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
      duration: bookingDuration,
    },
    { enabled: !!selectedDate && !!selectedService && techId > 0, staleTime: 0 }
  );

  // Fetch per-date bookable status for the current calendar month so the
  // calendar can distinguish "working but fully booked" from "open" days.
  const monthStatusQuery = trpc.bookings.monthBookableStatus.useQuery(
    {
      techId,
      year: calMonth.year,
      month: calMonth.month + 1, // convert 0-indexed
      duration: bookingDuration,
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
        category: s.category || s.customName || s.name,
        duration: s.durationMinutes,
        price: s.priceInCents != null ? s.priceInCents / 100 : (s.price != null ? Number(s.price) : null),
        photoUrl: s.photoUrl ?? null,
      }));
    }
    // Fallback defaults when tech hasn't set up services yet
    return [
      { id: "gel_manicure", category: "Gel Manicure", label: "Gel Manicure", duration: 60, price: null, photoUrl: null },
      { id: "structured_gel", category: "Structured Gel / Builder Gel", label: "Structured Gel / Builder Gel", duration: 75, price: null, photoUrl: null },
      { id: "structured_gel_fill", category: "Structured Gel / Builder Gel Fill", label: "Structured Gel / Builder Gel Fill", duration: 60, price: null, photoUrl: null },
      { id: "acrylic_full", category: "Acrylic Full Set", label: "Acrylic Full Set", duration: 90, price: null, photoUrl: null },
      { id: "acrylic_fill", category: "Acrylic Fill", label: "Acrylic Fill", duration: 60, price: null, photoUrl: null },
      { id: "extended_fill", category: "Extended Fill", label: "Extended Fill", duration: 90, price: null, photoUrl: null },
      { id: "gel_x", category: "Gel-X / Soft Gel Extensions", label: "Gel-X / Soft Gel Extensions", duration: 75, price: null, photoUrl: null },
      { id: "dip_powder", category: "Dip Powder", label: "Dip Powder", duration: 60, price: null, photoUrl: null },
      { id: "dip_tips", category: "Dip Powder with Tips", label: "Dip Powder with Tips", duration: 75, price: null, photoUrl: null },
      { id: "manicure", category: "Manicure", label: "Manicure", duration: 45, price: null, photoUrl: null },
      { id: "pedicure", category: "Pedicure", label: "Pedicure", duration: 60, price: null, photoUrl: null },
      { id: "spa_pedicure", category: "Spa / Callus Pedicure Upgrade", label: "Spa / Callus Pedicure Upgrade", duration: 30, price: null, photoUrl: null },
      { id: "nail_art", category: "Nail Art / Add-Ons", label: "Nail Art / Add-Ons", duration: 45, price: null, photoUrl: null },
      { id: "removal", category: "Removal / Soak-Off", label: "Removal / Soak-Off", duration: 45, price: null, photoUrl: null },
      { id: "repair", category: "Repair", label: "Repair", duration: 30, price: null, photoUrl: null },
      { id: "press_on", category: "Press-On Nails", label: "Press-On Nails", duration: 45, price: null, photoUrl: null },
      { id: "sizing_kit", category: "Sizing Kit / Consultation", label: "Sizing Kit / Consultation", duration: 20, price: null, photoUrl: null },
      { id: "custom", category: "Custom / Not Sure", label: "Custom / Not Sure", duration: 60, price: null, photoUrl: null },
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
          category: match.category || match.customName || match.name,
          duration: match.durationMinutes,
          price: match.priceInCents != null ? match.priceInCents / 100 : null,
          photoUrl: match.photoUrl ?? null,
        });
        setStep(0); // keep the selected service visible so the client can add more services
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
          category: match.category || match.customName || match.name,
        duration: match.durationMinutes,
        price: match.priceInCents != null ? match.priceInCents / 100 : null,
        photoUrl: match.photoUrl ?? null,
      });
      setStep(0); // keep the linked post service selected so the client can add more services
      setAutoSelected(true);
    }
  }, [postData, techServicesQuery.data, autoSelected, preselectedServiceId]);

  const utils = trpc.useUtils();
  const createBooking = trpc.bookings.createWithServiceLines.useMutation({
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
    return `${to12Hour(av.startTime)}${to12Hour(av.endTime)}`;
  }

  function completeCurrentSmartMatch(assessment: SMAssessment, additions: BookingService[] = smSelectedAddOnServices) {
    setSmAssessments((current) => [...current.filter((item) => item.serviceCategory !== assessment.serviceCategory), assessment]);
    setSmSelectedAddOnServices((current) => {
      const combined = [...current, ...additions];
      return combined.filter((service, index) => service.id !== activeMatchService?.id && combined.findIndex((candidate) => candidate.id === service.id) === index);
    });
    const nextIndex = smServiceIndex + 1;
    if (nextIndex < initialSelectedServices.length) {
      setSmServiceIndex(nextIndex);
      setSmAnswers({});
      setSmOutcome(null);
      setSmRecommended(null);
      setSmRecommendedAddOns([]);
      setSmMessage(null);
      setSmPendingAssessment(null);
      return;
    }
    setSmOutcome(null);
    setSmPendingAssessment(null);
    setStep(2);
  }

  async function handleConfirm() {
    if (!isAuthenticated) { toast.error("Please sign in to book."); return; }
    if (!selectedDate || !selectedTime || !selectedService) return;
    const [y, mo, d] = selectedDate.split("-").map(Number);
    const [h, min]   = selectedTime.split(":").map(Number);
    try {
      const photoUrls = smSkipped || smPhotoFiles.length === 0
        ? []
        : await Promise.all(smPhotoFiles.map(async (file) => {
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
              throw new Error("Please use JPG, PNG, or WebP inspiration photos.");
            }
            const base64 = await readFileAsBase64(file);
            const uploaded = await smUploadPhoto.mutateAsync({ base64, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" });
            return uploaded.url;
          }));
      const serviceLines = bookingServices.map((service, position) => ({
        techServiceId: Number(service.id),
        lineType: position === 0 ? "primary" as const : "addon" as const,
      }));
      if (serviceLines.some((line) => Number.isNaN(line.techServiceId))) {
        throw new Error("This nail tech needs to finish setting up their services before you can request a booking.");
      }
      await createBooking.mutateAsync({
        techId,
        postId: postId ? Number(postId) : undefined,
        inspirationImageUrl: appointmentInspirationImage ?? undefined,
        scheduledAt: new Date(y, mo - 1, d, h, min).getTime(),
        notes: notes || undefined,
        serviceLines,
        smartServiceMatches: smSkipped || smAssessments.length === 0 ? undefined : smAssessments.map((assessment, index) => ({
          ...assessment,
          photoUrls: index === 0 ? [...assessment.photoUrls, ...photoUrls] : assessment.photoUrls,
        })),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create booking. Please try again.");
    }
  }

  function canAdvance() {
    if (step === 0) return initialSelectedServices.length > 0;
    if (step === 1) return true; // Smart Match — always can continue (skip allowed)
    if (step === 2) return !!selectedDate;
    if (step === 3) return !!selectedTime;
    if (step === 4) return true;
    return false;
  }

  async function advance() {
    if (step === 4) { handleConfirm(); return; }
    if (step === 0) {
      setSmServiceIndex(0);
      setSmAssessments([]);
      setSmAnswers({});
      setSmAnswersByQuestionText({});
      setSmPendingAssessment(null);
      setSmSelectedAddOnServices([]);
      setSmSkipped(false);
      setStep(1);
      return;
    }
    // When leaving Smart Match step, evaluate if answers were provided
    if (step === 1 && !smSkipped) {
      const cfg = smConfigQuery.data as any;
      const questions: SMQuestion[] = cfg?.questions ?? [];
      const mergedAnswers = Object.fromEntries(questions.map((question) => [question.id, smAnswers[question.id] ?? smAnswersByQuestionText[question.text]]).filter(([, answer]) => Boolean(answer))) as Record<string, string>;
      const requiredQuestionCount = questions.length;
      if (!Object.keys(mergedAnswers).length) {
        toast.error("Answer the service questions or choose Skip and continue.");
        return;
      }
      if (requiredQuestionCount && Object.keys(mergedAnswers).length < requiredQuestionCount) {
        toast.error("Please answer each service question before continuing.");
        return;
      }
      if (cfg) {
        const result = await smEvaluate.mutateAsync({
          techId,
          serviceCategory: activeMatchService?.category ?? "",
          answers: mergedAnswers,
        });
        const assessment: SMAssessment = {
          serviceCategory: activeMatchService?.category ?? "",
          answers: mergedAnswers,
          outcome: result.outcome as SMOutcome,
          recommendedService: result.recommendedService,
          recommendedAddOns: result.recommendedAddOns ?? [],
          explanation: result.explanation ?? "Your selected service looks like a good match.",
          photoUrls: [],
        };
        setSmOutcome(result.outcome as SMOutcome);
        setSmResolvedOutcome(result.outcome as SMOutcome);
        setSmRecommended(result.recommendedService);
        setSmRecommendedAddOns(result.recommendedAddOns ?? []);
        setSmMessage(result.explanation ?? null);
        setSmPendingAssessment(assessment);
        // If outcome is not "match", stay on step 1 to show outcome screen
        if (result.outcome !== "match") {
          return; // show outcome screen
        }
        completeCurrentSmartMatch(assessment);
        return;
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
            onClick={() => {
              if (step === 0) {
                // Navigate back to the originating post or tech profile
                if (postId) navigate(`/post/${postId}`);
                else if (techId) navigate(`/tech/${techId}`);
                else navigate("/discover");
              } else {
                setStep(s => s - 1);
              }
            }}
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
                <p className="text-sm text-muted-foreground mt-1">Select one or more services for the same appointment</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {techServicesQuery.isLoading ? (
                  <div className="col-span-2 flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : techServices.map((svc: BookingService) => (
                  <button
                    key={svc.id}
                    onClick={() => setInitialSelectedServices((current) => current.some((service) => service.id === svc.id) ? current.filter((service) => service.id !== svc.id) : [...current, svc])}
                    className={`
                      relative rounded-2xl border text-left transition-all duration-200 overflow-hidden
                      ${initialSelectedServices.some((service) => service.id === svc.id)
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
                      {initialSelectedServices.some((service) => service.id === svc.id) && (
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
              {initialSelectedServices.length > 0 && (
                <Card className="rounded-2xl border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-sm font-semibold text-foreground">{initialSelectedServices.length} service{initialSelectedServices.length === 1 ? "" : "s"} selected</p><p className="text-xs text-muted-foreground mt-0.5">One appointment · {bookingDuration} min total</p></div>
                    {hasCompletePricing && <p className="text-sm font-semibold text-primary">${bookingTotal.toFixed(2)}</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">{initialSelectedServices.map((service) => <span key={service.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-foreground border border-primary/15">{service.label}<button type="button" aria-label={`Remove ${service.label}`} onClick={() => setInitialSelectedServices((current) => current.filter((item) => item.id !== service.id))}><X className="h-3 w-3 text-muted-foreground" /></button></span>)}</div>
                  <Button className="mt-4 w-full" onClick={advance}>Continue to Smart Match</Button>
                </Card>
              )}
            </div>
          )}

          {/* Step 1 — Smart Match Questionnaire */}
          {step === 1 && (() => {
            const smEnabled = smEnabledQuery.data;
            const cfg = smConfigQuery.data as any;
            const questions: SMQuestion[] = cfg?.questions ?? [];
            const visibleQuestions = getUnansweredQuestions(questions, smAnswersByQuestionText);
            const allowsPhotoUpload = Boolean(cfg?.supportsPhotoUpload) || questions.some((question: any) => question.allowsPhoto);

            // If Smart Match is disabled for this service, auto-skip to date step
            if (smEnabledQuery.isFetched && smEnabled === false) {
              setTimeout(() => completeCurrentSmartMatch({ serviceCategory: activeMatchService?.category ?? "", answers: {}, outcome: "match", recommendedService: null, recommendedAddOns: [], explanation: "Smart Service Match is disabled for this service.", photoUrls: [] }), 0);
              return null;
            }

            // System result — recommendations and review are resolved before date/time selection.
            if (smOutcome === "recommendation" || smOutcome === "review") {
              const suggestedAddOnServices = smRecommendedAddOns
                .map((name) => techServices.find((service) => service.category === name || service.label === name))
                .filter((service): service is BookingService => Boolean(service));
              const suggestedPrimary = smRecommended
                ? techServices.find((service) => service.category === smRecommended || service.label === smRecommended) ?? null
                : null;
              const continueAfterOutcome = (outcome: SMOutcome, nextAddOns: BookingService[] = []) => {
                const assessment = { ...(smPendingAssessment ?? { serviceCategory: activeMatchService?.category ?? "", answers: smAnswers, outcome, recommendedService: smRecommended, recommendedAddOns: smRecommendedAddOns, explanation: smMessage ?? "", photoUrls: [] }), outcome } as SMAssessment;
                setSmResolvedOutcome(outcome);
                completeCurrentSmartMatch(assessment, nextAddOns);
              };

              if (smOutcome === "review") {
                return (
                  <div className="space-y-5">
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3"><Shield className="w-7 h-7 text-primary" /></div>
                      <h1 className="text-xl font-serif font-semibold text-foreground">Your tech will review this</h1>
                      <p className="text-sm text-muted-foreground mt-1">{smMessage ?? "Your answers need a technician review before this booking can be confirmed."}</p>
                    </div>
                    <Card className="p-4 rounded-2xl border-border space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your answers</p>
                      {Object.entries(smAnswers).map(([qId, answer]) => {
                        const question = questions.find((item) => item.id === qId);
                        return question ? <p key={qId} className="text-sm"><span className="text-muted-foreground">{question.text}: </span><span className="font-medium text-foreground">{answer}</span></p> : null;
                      })}
                    </Card>
                    <Button className="w-full" onClick={() => continueAfterOutcome("review")}>Continue to next service</Button>
                  </div>
                );
              }

              return (
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3"><Sparkles className="w-7 h-7 text-amber-500" /></div>
                    <h1 className="text-xl font-serif font-semibold text-foreground">We have a suggestion</h1>
                    <p className="text-sm text-muted-foreground mt-1">{smMessage ?? "We adjusted your booking recommendation based on your answers."}</p>
                  </div>
                  <Card className="p-4 rounded-2xl border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 space-y-3">
                    {suggestedPrimary && <div><p className="text-xs text-muted-foreground">Recommended primary service</p><p className="font-semibold text-foreground">{suggestedPrimary.label}</p></div>}
                    {suggestedAddOnServices.length > 0 && <div><p className="text-xs text-muted-foreground mb-1">Suggested add-ons</p><div className="space-y-1.5">{suggestedAddOnServices.map((service) => <div key={service.id} className="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-2 text-xs"><span className="font-medium text-foreground">+ {service.label}</span><span className="text-muted-foreground">{service.duration} min{service.price != null ? ` · $${service.price.toFixed(2)}` : ""}</span></div>)}</div></div>}
                  </Card>
                  <div className="flex flex-col gap-2">
                    {suggestedPrimary && <Button className="w-full" onClick={() => { setInitialSelectedServices((current) => current.map((service, index) => index === smServiceIndex ? suggestedPrimary : service).filter((service, index, all) => all.findIndex((candidate) => candidate.id === service.id) === index)); continueAfterOutcome("recommendation", suggestedAddOnServices); }}>Switch to {suggestedPrimary.label}</Button>}
                    {suggestedAddOnServices.length > 0 && <Button variant={suggestedPrimary ? "outline" : "default"} className="w-full" onClick={() => continueAfterOutcome("recommendation", suggestedAddOnServices)}>Add suggested services</Button>}
                    <Button variant="ghost" className="w-full" onClick={() => continueAfterOutcome("recommendation", [])}>Continue with {activeMatchService?.label}</Button>
                    <button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => continueAfterOutcome("review", [])}>Send to tech for review</button>
                  </div>
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
              setTimeout(() => completeCurrentSmartMatch({ serviceCategory: activeMatchService?.category ?? "", answers: {}, outcome: "match", recommendedService: null, recommendedAddOns: [], explanation: "No questionnaire is needed for this service.", photoUrls: [] }), 0);
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
                  <p className="text-sm text-muted-foreground">{activeMatchService?.label} · {smServiceIndex + 1} of {initialSelectedServices.length} selected services</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${visibleQuestions.length ? (Object.keys(smAnswers).length / visibleQuestions.length) * 100 : 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{Object.keys(smAnswers).length} of {visibleQuestions.length}</span>
                  </div>
                </div>

                {visibleQuestions.map((q: SMQuestion) => (
                  <div key={q.id} className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{q.text}</p>
                    <div className="grid gap-2">
                      {q.options.map((opt: string) => (
                        <button
                          key={opt}
                          onClick={() => { setSmAnswers(prev => ({ ...prev, [q.id]: opt })); setSmAnswersByQuestionText(prev => ({ ...prev, [q.text]: opt })); }}
                          className={`min-h-11 px-4 py-2.5 rounded-xl text-sm border text-left transition-all ${
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
                {allowsPhotoUpload && <div className="space-y-2">
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
                </div>}

                <button
                  type="button"
                  onClick={() => { setSmOutcome(null); setSmAnswers({}); setStep(0); }}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  ← Choose a different service
                </button>

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
                      Open {to12Hour(av.startTime)}\u2013{to12Hour(av.endTime)}
                      {av.breakStart && av.breakEnd ? ` · Break ${to12Hour(av.breakStart)}–${to12Hour(av.breakEnd)}` : ""}
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
                          {to12Hour(slot.time)}
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
              {appointmentInspirationImage && (
                <Card className="rounded-2xl border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-3">
                    <img src={appointmentInspirationImage} alt="Selected appointment inspiration" className="h-16 w-16 rounded-xl object-cover border border-primary/15" />
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-foreground">Book This Look inspiration</p><p className="text-xs text-muted-foreground mt-0.5">Your tech will see this exact image with the appointment.</p></div>
                    <button type="button" onClick={() => setAppointmentInspirationImage(null)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Remove</button>
                  </div>
                  {(postData?.imageUrls?.length ?? 0) > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{postData?.imageUrls?.map((url: string) => <button type="button" key={url} onClick={() => setAppointmentInspirationImage(url)} className={cn("h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2", appointmentInspirationImage === url ? "border-primary" : "border-transparent")}><img src={url} alt="Choose a different inspiration" className="h-full w-full object-cover" /></button>)}</div>}
                </Card>
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
                    <p className="text-xs text-muted-foreground">Services</p>
                    <p className="text-sm font-medium text-foreground">{bookingServices.length} selected</p>
                  </div>
                  <div className="ml-auto text-right"><Badge variant="secondary" className="text-xs">{bookingDuration} min total</Badge>{hasCompletePricing && <p className="text-xs text-primary font-medium mt-1">${bookingTotal.toFixed(2)}</p>}</div>
                </div>
                {bookingServices.map((service, index) => (
                  <div key={service.id} className="flex items-center gap-3 pl-5">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-sm leading-none">{index === 0 ? "•" : "+"}</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{initialSelectedServices.some((item) => item.id === service.id) ? "Selected service" : "Smart Match add-on"}</p>
                      <p className="text-sm font-medium text-foreground">{service.label}</p>
                    </div>
                    <div className="ml-auto text-right"><Badge variant="secondary" className="text-xs">{service.duration} min</Badge>{service.price != null && <p className="text-xs text-primary font-medium mt-1">${service.price.toFixed(2)}</p>}</div>
                  </div>
                ))}
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Estimated total</span><span className="font-semibold text-foreground">{hasCompletePricing ? `$${bookingTotal.toFixed(2)}` : "Your tech will confirm pricing"}</span></div>
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
