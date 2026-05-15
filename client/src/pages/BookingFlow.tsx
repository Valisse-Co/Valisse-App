import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Scissors,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute, useSearch } from "wouter";

// ─── Service definitions ──────────────────────────────────────────────────────
const SERVICES = [
  { id: "gel_manicure",    label: "Gel Manicure",    duration: 60,  icon: "💅" },
  { id: "acrylic_full",    label: "Acrylic Full Set", duration: 90,  icon: "✨" },
  { id: "nail_art",        label: "Nail Art",         duration: 90,  icon: "🎨" },
  { id: "gel_pedicure",    label: "Gel Pedicure",     duration: 75,  icon: "🦶" },
  { id: "dip_powder",      label: "Dip Powder",       duration: 60,  icon: "🌸" },
  { id: "nail_removal",    label: "Nail Removal",     duration: 45,  icon: "🔧" },
  { id: "nail_repair",     label: "Nail Repair",      duration: 30,  icon: "🩹" },
  { id: "custom_design",   label: "Custom Design",    duration: 120, icon: "🖌️" },
];

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

const STEPS = ["Service", "Date", "Time", "Confirm"];

export default function BookingFlow() {
  const [, params] = useRoute("/book/:techId");
  const techId = params?.techId ? Number(params.techId) : 0;
  const [, navigate] = useLocation();
  const search = useSearch();
  const postId = new URLSearchParams(search).get("postId");
  const { isAuthenticated } = useAuth();

  // ── State ────────────────────────────────────────────────────────────────
  const [step, setStep]                   = useState(0);
  const [selectedService, setSelectedService] = useState<typeof SERVICES[0] | null>(null);
  const [calMonth, setCalMonth]           = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDate, setSelectedDate]   = useState<string | null>(null);
  const [selectedTime, setSelectedTime]   = useState<string | null>(null);
  const [notes, setNotes]                 = useState("");
  const [booked, setBooked]               = useState(false);

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

  // ── Mutations ────────────────────────────────────────────────────────────
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
    if (step === 1) return !!selectedDate;
    if (step === 2) return !!selectedTime;
    if (step === 3) return true; // confirm screen always enabled
    return false;
  }

  function advance() {
    if (step === 3) { handleConfirm(); }
    else { setStep(s => s + 1); }
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
                {SERVICES.map(svc => (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedService(svc)}
                    className={`
                      relative p-4 rounded-2xl border text-left transition-all duration-200
                      ${selectedService?.id === svc.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-primary/40"}
                    `}
                  >
                    {selectedService?.id === svc.id && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <span className="text-2xl mb-2 block">{svc.icon}</span>
                    <p className="text-sm font-medium text-foreground leading-tight">{svc.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {svc.duration} min
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Calendar */}
          {step === 1 && (
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

          {/* Step 2 — Time slots */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-serif font-semibold text-foreground">Choose a time</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedDate ? formatDateStr(selectedDate) : ""} ·{" "}
                  <span className="text-foreground">{selectedService?.label}</span>
                  {selectedService && (
                    <span className="text-muted-foreground"> · {selectedService.duration} min</span>
                  )}
                </p>
              </div>

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
                      const reasonLabel =
                        slot.reason === "booked" ? "Booked" :
                        slot.reason === "break" ? "Break" :
                        slot.reason === "blocked" ? "Blocked" :
                        slot.reason === "outside_hours" ? "End of shift" :
                        slot.reason === "past" ? "Past" : undefined;
                      return (
                        <button
                          key={slot.time}
                          disabled={!slot.available}
                          onClick={() => slot.available && setSelectedTime(slot.time)}
                          title={!slot.available && reasonLabel ? reasonLabel : undefined}
                          className={`
                            py-3 px-2 rounded-xl text-sm font-medium text-center transition-all
                            ${!slot.available
                              ? "bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                              : selectedTime === slot.time
                              ? "bg-primary text-white shadow-sm ring-2 ring-primary/30"
                              : "bg-card border border-border text-foreground hover:border-primary/50 hover:bg-primary/5 cursor-pointer"}
                          `}
                        >
                          {slot.time}
                          {!slot.available && reasonLabel && (
                            <span className="block text-[9px] text-muted-foreground/40 mt-0.5 leading-none truncate">
                              {reasonLabel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-card border border-border inline-block" />
                      Available
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-muted/30 inline-block" />
                      Booked / unavailable
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

          {/* Step 3 — Confirm */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-serif font-semibold text-foreground">Confirm booking</h1>
                <p className="text-sm text-muted-foreground mt-1">Review your appointment details</p>
              </div>
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
            ) : step === 3 ? "Confirm & Request"
              : step === 2 ? "Review Booking"
              : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
