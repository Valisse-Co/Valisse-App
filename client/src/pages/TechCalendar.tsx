import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MessageCircle, Minus, Plus, ShieldCheck, UserRound, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addLocalDays, getBrowserTimeZone, getZonedDateKey, getZonedDateTimeParts, timeToMinutes } from "@shared/lastMinuteBooking";
import { eventAppliesOnDate, getSundayStart } from "@shared/techCalendar";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_START = 0;
const DAY_END = 24 * 60;
const HOUR_HEIGHTS = [40, 56, 72, 88] as const;

const CALENDAR_LEGEND = [
  { label: "Work · anyone", color: "bg-emerald-500", description: "Hours open to all clients" },
  { label: "Work · returning", color: "bg-sky-500", description: "Hours limited to returning clients" },
  { label: "Break", color: "bg-slate-400", description: "Recurring break time" },
  { label: "Client access rule", color: "bg-violet-500", description: "Time-specific client access rule" },
  { label: "Unavailable", color: "bg-zinc-500", description: "Blocked or closed time" },
  { label: "Last-minute opening", color: "bg-fuchsia-500", description: "Active extra opening" },
  { label: "Pending appointment", color: "bg-amber-500", description: "Awaiting your decision" },
  { label: "Confirmed appointment", color: "bg-primary", description: "Upcoming confirmed appointment" },
] as const;

type CalendarView = "day" | "week" | "month";
type CalendarEventForm = {
  kind: "available" | "unavailable";
  recurrence: "once" | "weekly";
  localDate: string;
  startTime: string;
  endTime: string;
  clientTier: "open" | "returning_only";
  title: string;
};

type CalendarItem =
  | { type: "weekly-work"; date: string; schedule: any }
  | { type: "weekly-break"; date: string; schedule: any }
  | { type: "event"; date: string; event: any }
  | { type: "block"; date: string; block: any }
  | { type: "booking-rule"; date: string; rule: any }
  | { type: "last-minute"; date: string; slot: any };

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthStart(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

function monthEnd(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}`;
}

function calendarRange(view: CalendarView, anchorDate: string) {
  if (view === "day") return { fromLocalDate: anchorDate, toLocalDate: anchorDate };
  if (view === "week") {
    const start = getSundayStart(anchorDate);
    return { fromLocalDate: start, toLocalDate: addLocalDays(start, 6) };
  }
  return { fromLocalDate: monthStart(anchorDate), toLocalDate: monthEnd(anchorDate) };
}

function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatDate(dateKey: string, timeZone?: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  const instant = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(instant);
}

function minuteToTime(minutes: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes / 15) * 15));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function bookingLocalParts(booking: any, timeZone: string) {
  const parts = getZonedDateTimeParts(new Date(booking.scheduledAt).getTime(), timeZone);
  return { date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`, minutes: parts.hour * 60 + parts.minute };
}

function bookingRuleDateKey(value: Date | string) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function statusStyle(status: string) {
  if (status === "confirmed") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "pending") return "border-amber-300 bg-amber-50 text-amber-800";
  if (["cancelled", "declined", "no_show"].includes(status)) return "border-border bg-muted text-muted-foreground";
  if (status === "completed") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-violet-200 bg-violet-50 text-violet-800";
}

function availabilityBlockStyle(clientTier: string | null | undefined) {
  return clientTier === "returning_only"
    ? "border-sky-400 bg-sky-100/95 text-sky-950"
    : "border-emerald-300 bg-emerald-100/95 text-emerald-950";
}

function availabilityDotColor(clientTier: string | null | undefined) {
  return clientTier === "returning_only" ? "bg-sky-500" : "bg-emerald-500";
}

function rangeTitle(view: CalendarView, anchorDate: string, range: { fromLocalDate: string; toLocalDate: string }, timeZone?: string) {
  if (view === "day") return formatDate(anchorDate, timeZone, { weekday: "long", month: "long", day: "numeric" });
  if (view === "week") return `${formatDate(range.fromLocalDate, timeZone, { month: "short", day: "numeric" })} – ${formatDate(range.toLocalDate, timeZone, { month: "short", day: "numeric", year: "numeric" })}`;
  return formatDate(anchorDate, timeZone, { month: "long", year: "numeric" });
}

function calendarItemDetails(item: CalendarItem) {
  if (item.type === "weekly-work") {
    const audience = item.schedule.clientTier === "returning_only" ? "Returning clients only" : "Open to everyone";
    const services = item.schedule.serviceNames?.length ? `Services: ${item.schedule.serviceNames.join(", ")}.` : "All active services are available.";
    const buffer = item.schedule.bufferMinutes ? ` ${item.schedule.bufferMinutes}-minute buffer between appointments.` : "";
    return { title: "Weekly work hours", source: "Weekly Schedule", startTime: item.schedule.startTime, endTime: item.schedule.endTime, detail: `${audience}. ${services}${buffer}` };
  }
  if (item.type === "weekly-break") return { title: "Weekly break", source: "Weekly Schedule", startTime: item.schedule.breakStart, endTime: item.schedule.breakEnd, detail: "This time is unavailable during your recurring workday." };
  if (item.type === "event") return { title: item.event.kind === "available" ? "One-time work hours" : "One-time unavailable time", source: item.event.recurrence === "weekly" ? "Calendar recurrence" : "Calendar", startTime: item.event.startTime, endTime: item.event.endTime, detail: item.event.title || (item.event.clientTier === "returning_only" ? "Returning clients only" : "Open to everyone") };
  if (item.type === "block") return { title: "Unavailable time", source: "Schedule", startTime: item.block.startTime, endTime: item.block.endTime, detail: item.block.reason || "No reason provided" };
  if (item.type === "booking-rule") return { title: "Client access rule", source: "Schedule", startTime: item.rule.startTime, endTime: item.rule.endTime, detail: item.rule.clientTier === "returning_only" ? "Only returning clients can book this time." : "Any client can book this time." };
  return { title: "Last-minute opening", source: "Schedule", startTime: item.slot.startTime, endTime: item.slot.endTime, detail: item.slot.note || "Visible to eligible clients while active" };
}

export default function TechCalendar() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(() => localDateKey());
  const [monthDetailDate, setMonthDetailDate] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [selectedCalendarItem, setSelectedCalendarItem] = useState<CalendarItem | null>(null);
  const [deleteEventPending, setDeleteEventPending] = useState<any | null>(null);
  const [hourHeightIndex, setHourHeightIndex] = useState(1);
  const [legendOpen, setLegendOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewInput, setReviewInput] = useState<any | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const dragStart = useRef<{ date: string; minutes: number } | null>(null);
  const utils = trpc.useUtils();
  const range = useMemo(() => calendarRange(view, anchorDate), [view, anchorDate]);
  const { data, isLoading } = trpc.availability.calendar.useQuery(range, { enabled: isAuthenticated && (user?.userType === "nail_tech" || user?.hasDualRole) });
  const { data: activeServices = [] } = trpc.settings.getServices.useQuery(undefined, { enabled: isAuthenticated && (user?.userType === "nail_tech" || user?.hasDualRole) });
  const timeZone = (data as any)?.timeZone || getBrowserTimeZone();
  const hourHeight = HOUR_HEIGHTS[hourHeightIndex];
  const serviceNameById = useMemo(() => new Map((activeServices as any[]).map((service) => [service.id, service.customName || service.category])), [activeServices]);
  const [eventForm, setEventForm] = useState<CalendarEventForm>(() => ({
    kind: "available",
    recurrence: "once",
    localDate: localDateKey(),
    startTime: "09:00",
    endTime: "10:00",
    clientTier: "open",
    title: "",
  }));

  const preview = trpc.availability.previewOverride.useQuery(reviewInput, { enabled: Boolean(reviewInput), retry: false });
  const createEvent = trpc.availability.createCalendarEvent.useMutation({
    onSuccess: () => {
      utils.availability.calendar.invalidate();
      utils.availability.weeklySchedule.invalidate();
      setEventDialogOpen(false);
      toast.success("Calendar event saved.");
    },
    onError: (error) => toast.error(error.message || "Could not save the calendar event."),
  });
  const applyOverride = trpc.availability.applyOverride.useMutation({
    onSuccess: (result) => {
      utils.availability.calendar.invalidate();
      utils.bookings.timeline.invalidate();
      utils.bookings.pastBookings.invalidate();
      utils.notifications.list.invalidate();
      setReviewOpen(false);
      setEventDialogOpen(false);
      setReviewInput(null);
      setCancellationReason("");
      setAcknowledged(false);
      toast.success(result.cancelledBookingIds.length ? `${result.cancelledBookingIds.length} appointment${result.cancelledBookingIds.length === 1 ? "" : "s"} cancelled and clients notified.` : "Unavailable time saved.");
    },
    onError: (error) => toast.error(error.message || "Could not apply this availability override."),
  });
  const removeEvent = trpc.availability.removeCalendarEvent.useMutation({
    onSuccess: () => {
      utils.availability.calendar.invalidate();
      setDeleteEventPending(null);
      setSelectedCalendarItem(null);
      toast.success("Calendar event removed.");
    },
    onError: (error) => toast.error(error.message || "Could not remove the calendar event."),
  });
  const updateStatus = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => { utils.availability.calendar.invalidate(); utils.bookings.timeline.invalidate(); setSelectedBooking(null); toast.success("Booking updated."); },
    onError: (error) => toast.error(error.message || "Could not update booking."),
  });
  const openConversation = trpc.messaging.getOrCreateConversation.useMutation({
    onSuccess: (conversation) => navigate(`/chat/${conversation.id}`),
    onError: (error) => toast.error(error.message || "Could not open the conversation."),
  });

  useEffect(() => {
    if (preview.data && reviewInput) setReviewOpen(true);
  }, [preview.data, reviewInput]);

  const openEventDialog = (prefill?: Partial<CalendarEventForm>) => {
    setEventForm((current) => ({ ...current, localDate: anchorDate, ...prefill }));
    setEventDialogOpen(true);
  };

  const reviewOrCreateEvent = () => {
    const form = {
      ...eventForm,
      localDate: eventForm.recurrence === "once" ? eventForm.localDate : null,
      title: eventForm.title || null,
      dayOfWeek: eventForm.recurrence === "weekly" ? new Date(`${eventForm.localDate}T12:00:00`).getDay() : null,
      timeZone,
    };
    if (form.kind === "unavailable" && form.recurrence === "once") {
      setReviewInput(form);
      return;
    }
    createEvent.mutate(form);
  };

  const applyReviewedOverride = () => {
    if (!reviewInput || !preview.data) return;
    const affectedIds = preview.data.map((row: any) => row.booking.id);
    applyOverride.mutate({ ...reviewInput, expectedBookingIds: affectedIds, cancellationReason: cancellationReason || undefined, confirmCancellation: affectedIds.length === 0 || acknowledged });
  };

  const navigateRange = (direction: -1 | 1) => {
    if (view === "day") setAnchorDate(addLocalDays(anchorDate, direction));
    else if (view === "week") setAnchorDate(addLocalDays(anchorDate, direction * 7));
    else {
      const [year, month] = anchorDate.split("-").map(Number);
      const next = new Date(Date.UTC(year, month - 1 + direction, 1));
      setAnchorDate(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`);
    }
  };

  if (!isAuthenticated) return null;
  if (user?.userType !== "nail_tech" && !user?.hasDualRole) {
    return <div className="min-h-screen px-6 pt-24 text-center"><CalendarDays className="mx-auto text-muted-foreground" size={38} /><h1 className="mt-4 text-xl font-semibold">Technician calendar</h1><p className="mt-2 text-sm text-muted-foreground">Switch to Nail Tech Mode to manage your calendar.</p></div>;
  }

  const calendar = data as any;
  const days = view === "day" ? [anchorDate] : view === "week" ? Array.from({ length: 7 }, (_, index) => addLocalDays(range.fromLocalDate, index)) : [];

  return (
    <div className="min-h-screen bg-background pb-28 page-enter">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 pb-3 pt-12 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => navigate("/tech-bookings")} className="rounded-xl p-2 text-muted-foreground hover:bg-muted" aria-label="Back to bookings"><ChevronLeft size={19} /></button>
            <div className="min-w-0 flex-1 text-center"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Technician workspace</p><h1 className="truncate font-display text-xl font-light text-foreground">Calendar</h1></div>
            <button onClick={() => openEventDialog()} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm"><Plus size={14} /> Add</button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex rounded-xl bg-muted p-1">
              {(["day", "week", "month"] as CalendarView[]).map((item) => <button key={item} onClick={() => setView(item)} aria-pressed={view === item} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition", view === item ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>{item}</button>)}
            </div>
            <div className="flex items-center gap-1"><button onClick={() => navigateRange(-1)} className="rounded-lg p-2 hover:bg-muted" aria-label="Previous"><ChevronLeft size={16} /></button><button onClick={() => setAnchorDate(localDateKey())} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">Today</button><button onClick={() => navigateRange(1)} className="rounded-lg p-2 hover:bg-muted" aria-label="Next"><ChevronRight size={16} /></button></div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {view !== "month" && <div className="flex items-center gap-2" aria-label="Calendar zoom"><button onClick={() => setHourHeightIndex((index) => Math.max(0, index - 1))} disabled={hourHeightIndex === 0} className="rounded-lg border border-border p-1.5 text-muted-foreground disabled:opacity-40" aria-label="Zoom out calendar"><Minus size={14} /></button><span className="min-w-20 text-center text-[11px] font-medium text-muted-foreground" aria-live="polite">{hourHeight} px / hour</span><button onClick={() => setHourHeightIndex((index) => Math.min(HOUR_HEIGHTS.length - 1, index + 1))} disabled={hourHeightIndex === HOUR_HEIGHTS.length - 1} className="rounded-lg border border-border p-1.5 text-muted-foreground disabled:opacity-40" aria-label="Zoom in calendar"><Plus size={14} /></button></div>}
            <button type="button" onClick={() => setLegendOpen((open) => !open)} aria-expanded={legendOpen} aria-controls="calendar-color-legend" className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition", legendOpen ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>Color key</button>
          </div>
          {legendOpen && <section id="calendar-color-legend" aria-label="Calendar color legend" className="mt-2 rounded-xl border border-border bg-card p-2.5 shadow-sm"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Calendar colors</p><div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">{CALENDAR_LEGEND.map((item) => <div key={item.label} className="flex min-w-0 items-start gap-1.5"><span aria-hidden="true" className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10", item.color)} /><span className="min-w-0 text-[10px] leading-tight text-muted-foreground"><span className="block font-semibold text-foreground">{item.label}</span>{item.description}</span></div>)}</div></section>}
          <p className="mt-2 text-center text-sm font-semibold text-foreground">{rangeTitle(view, anchorDate, range, timeZone)}</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 pt-3">
        {isLoading ? <div className="space-y-3"><div className="h-12 animate-pulse rounded-2xl bg-muted" /><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div> : view === "month" ? <MonthGrid calendar={calendar} anchorDate={anchorDate} timeZone={timeZone} onSelectDay={setMonthDetailDate} /> : <TimeGrid view={view} hourHeight={hourHeight} days={days} calendar={calendar} timeZone={timeZone} serviceNameById={serviceNameById} onBooking={setSelectedBooking} onCalendarItem={setSelectedCalendarItem} onDragStart={(date: string, minutes: number) => { dragStart.current = { date, minutes }; }} onDragEnd={(date: string, minutes: number) => { const start = dragStart.current; dragStart.current = null; if (!start || start.date !== date) return; const first = Math.min(start.minutes, minutes); const last = Math.max(start.minutes, minutes); openEventDialog({ localDate: date, startTime: minuteToTime(first), endTime: minuteToTime(Math.max(first + 30, last + 30)) }); }} />}
      </main>

      <Dialog open={Boolean(monthDetailDate)} onOpenChange={(open) => !open && setMonthDetailDate(null)}>
        <DialogContent className="mx-2 max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto rounded-2xl p-3 sm:mx-4 sm:p-5">
          {monthDetailDate && <><DialogHeader><DialogTitle>{formatDate(monthDetailDate, timeZone, { weekday: "long", month: "long", day: "numeric" })}</DialogTitle></DialogHeader><p className="-mt-2 text-xs text-muted-foreground">Daily schedule details. Appointments, work hours, and unavailable time stay in this calendar view.</p><TimeGrid view="day" hourHeight={hourHeight} days={[monthDetailDate]} calendar={calendar} timeZone={timeZone} serviceNameById={serviceNameById} onBooking={setSelectedBooking} onCalendarItem={(item: CalendarItem) => { setMonthDetailDate(null); setSelectedCalendarItem(item); }} onDragStart={(date: string, minutes: number) => { dragStart.current = { date, minutes }; }} onDragEnd={(date: string, minutes: number) => { const start = dragStart.current; dragStart.current = null; if (!start || start.date !== date) return; const first = Math.min(start.minutes, minutes); const last = Math.max(start.minutes, minutes); openEventDialog({ localDate: date, startTime: minuteToTime(first), endTime: minuteToTime(Math.max(first + 30, last + 30)) }); }} /></>}
        </DialogContent>
      </Dialog>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="mx-4 max-h-[88vh] max-w-md overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>Add calendar time</DialogTitle></DialogHeader>
          <p className="text-xs leading-relaxed text-muted-foreground">Add client-facing work hours or unavailable time. If unavailable time overlaps an appointment, you will review every cancellation before it happens.</p>
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2"><Button type="button" variant={eventForm.kind === "available" ? "default" : "outline"} onClick={() => setEventForm((form) => ({ ...form, kind: "available" }))}>Work hours</Button><Button type="button" variant={eventForm.kind === "unavailable" ? "default" : "outline"} onClick={() => setEventForm((form) => ({ ...form, kind: "unavailable", recurrence: "once" }))}>Unavailable</Button></div>
            <div className="grid grid-cols-2 gap-3">{eventForm.kind === "available" ? <div><Label>Repeat</Label><Select value={eventForm.recurrence} onValueChange={(value: "once" | "weekly") => setEventForm((form) => ({ ...form, recurrence: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="once">This date only</SelectItem><SelectItem value="weekly">Every week</SelectItem></SelectContent></Select></div> : <div><Label>Repeat</Label><div className="mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">This date only</div></div>}<div><Label>{eventForm.recurrence === "weekly" ? "Example date" : "Date"}</Label><Input type="date" value={eventForm.localDate} onChange={(event) => setEventForm((form) => ({ ...form, localDate: event.target.value }))} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Starts</Label><Input type="time" value={eventForm.startTime} onChange={(event) => setEventForm((form) => ({ ...form, startTime: event.target.value }))} /></div><div><Label>Ends</Label><Input type="time" value={eventForm.endTime} onChange={(event) => setEventForm((form) => ({ ...form, endTime: event.target.value }))} /></div></div>
            {eventForm.kind === "unavailable" && <button type="button" onClick={() => setEventForm((form) => ({ ...form, startTime: "00:00", endTime: "23:59" }))} className="w-full rounded-lg border border-border py-2 text-xs font-semibold text-foreground hover:border-primary hover:text-primary">Make this a full-day closure</button>}
            {eventForm.kind === "available" && <div><Label>Who can book these hours?</Label><Select value={eventForm.clientTier} onValueChange={(value: "open" | "returning_only") => setEventForm((form) => ({ ...form, clientTier: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Anyone</SelectItem><SelectItem value="returning_only">Returning clients only</SelectItem></SelectContent></Select></div>}
            <div><Label>Label (optional)</Label><Input maxLength={160} placeholder={eventForm.kind === "available" ? "e.g. Evening appointments" : "e.g. Vacation"} value={eventForm.title} onChange={(event) => setEventForm((form) => ({ ...form, title: event.target.value }))} /></div>
            <Button className="w-full" disabled={createEvent.isPending || preview.isFetching} onClick={reviewOrCreateEvent}>{eventForm.kind === "unavailable" && eventForm.recurrence === "once" ? preview.isFetching ? "Reviewing conflicts…" : "Review conflicts" : createEvent.isPending ? "Saving…" : "Save calendar time"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={(open) => { if (!open) { setReviewOpen(false); setReviewInput(null); } }}>
        <DialogContent className="mx-4 max-h-[88vh] max-w-md overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>{(preview.data?.length ?? 0) ? "Review appointment cancellations" : "Save unavailable time"}</DialogTitle></DialogHeader>
          {(preview.data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">There are no pending or confirmed appointments in this time. Save the unavailable time?</p> : <><div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><p className="font-semibold">{preview.data?.length} appointment{preview.data?.length === 1 ? "" : "s"} will be cancelled.</p><p className="mt-1 text-xs text-destructive/80">Affected clients receive an in-app notice and consent-gated SMS with a link to book another time. No cancellation fee is charged to them.</p></div><div className="space-y-2">{preview.data?.map((row: any) => <div key={row.booking.id} className="rounded-xl border border-border p-3"><p className="text-sm font-semibold">{row.client?.name || "Client"}</p><p className="text-xs text-muted-foreground">{formatDate(bookingLocalParts(row.booking, timeZone).date, timeZone)} · {formatTime(minuteToTime(bookingLocalParts(row.booking, timeZone).minutes))} · {row.booking.serviceType || row.addonService?.customName || "Appointment"}</p></div>)}</div><div><Label>Reason for the cancellation</Label><Input value={cancellationReason} maxLength={500} placeholder="Explain why you must cancel these appointments" onChange={(event) => setCancellationReason(event.target.value)} /><p className="mt-1 text-[11px] text-muted-foreground">This detailed reason is retained for the technician and administration; clients receive privacy-safe availability wording.</p></div><label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-xs"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5" /><span>I understand these pending and confirmed appointments will be cancelled before this time is blocked.</span></label></>}
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => { setReviewOpen(false); setReviewInput(null); }}>Back</Button><Button variant={(preview.data?.length ?? 0) ? "destructive" : "default"} disabled={applyOverride.isPending || ((preview.data?.length ?? 0) > 0 && (!acknowledged || cancellationReason.trim().length < 10))} onClick={applyReviewedOverride}>{applyOverride.isPending ? "Applying…" : (preview.data?.length ?? 0) ? "Cancel & block time" : "Save unavailable time"}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedBooking)} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="mx-4 max-h-[88vh] max-w-md overflow-y-auto rounded-2xl">
          {selectedBooking && <><DialogHeader><DialogTitle>Appointment details</DialogTitle></DialogHeader><div className="space-y-3"><div className="rounded-2xl border border-border bg-card p-3"><div className="flex items-center gap-2"><UserRound size={16} className="text-primary" /><div><p className="text-sm font-semibold">{selectedBooking.client?.name || "Client"}</p><p className="text-xs text-muted-foreground">{selectedBooking.booking.serviceType || selectedBooking.addonService?.customName || "Appointment"} · {selectedBooking.booking.duration} min</p></div></div><p className="mt-3 text-sm font-semibold">{formatDate(bookingLocalParts(selectedBooking.booking, timeZone).date, timeZone)} · {formatTime(minuteToTime(bookingLocalParts(selectedBooking.booking, timeZone).minutes))}</p><span className={cn("mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-semibold capitalize", statusStyle(selectedBooking.booking.status))}>{selectedBooking.booking.status.replace("_", " ")}</span></div>{selectedBooking.booking.inspirationImageUrl && <img src={selectedBooking.booking.inspirationImageUrl} alt="Client inspiration" className="h-40 w-full rounded-xl object-cover" />}{selectedBooking.booking.notes && <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">“{selectedBooking.booking.notes}”</div>}{selectedBooking.booking.status === "pending" && <div className="grid grid-cols-2 gap-2"><Button onClick={() => updateStatus.mutate({ bookingId: selectedBooking.booking.id, status: "confirmed" })} disabled={updateStatus.isPending}>Confirm</Button><Button variant="outline" onClick={() => updateStatus.mutate({ bookingId: selectedBooking.booking.id, status: "declined" })} disabled={updateStatus.isPending}>Decline</Button></div>}<Button variant="outline" className="w-full" onClick={() => openConversation.mutate({ targetUserId: selectedBooking.booking.clientId })} disabled={openConversation.isPending}><MessageCircle size={15} /> Message client</Button></div></>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedCalendarItem)} onOpenChange={(open) => !open && setSelectedCalendarItem(null)}>
        <DialogContent className="mx-4 max-w-md rounded-2xl">
          {selectedCalendarItem && (() => {
            const detail = calendarItemDetails(selectedCalendarItem);
            return <><DialogHeader><DialogTitle>{detail.title}</DialogTitle></DialogHeader><div className="space-y-3"><div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{detail.source}</p><p className="mt-1 text-sm font-semibold">{formatDate(selectedCalendarItem.date, timeZone, { weekday: "long", month: "long", day: "numeric" })}</p><p className="mt-1 text-sm text-muted-foreground">{formatTime(detail.startTime)} – {formatTime(detail.endTime)}</p><p className="mt-2 text-sm text-muted-foreground">{detail.detail}</p></div>{selectedCalendarItem.type === "event" ? <Button variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => setDeleteEventPending(selectedCalendarItem.event)}>Remove calendar time</Button> : <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">{selectedCalendarItem.type.startsWith("weekly") ? "Edit recurring work and break times from your Schedule tab." : "This item is managed from your Schedule workspace."}</p>}</div></>;
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteEventPending)} onOpenChange={(open) => !open && setDeleteEventPending(null)}>
        <AlertDialogContent className="mx-4 rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Remove this calendar time?</AlertDialogTitle><AlertDialogDescription>This removes the one-time calendar block only. It will not cancel or change any existing appointment.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={removeEvent.isPending}>Keep it</AlertDialogCancel><AlertDialogAction onClick={() => deleteEventPending && removeEvent.mutate({ eventId: deleteEventPending.id })} disabled={removeEvent.isPending} className="bg-destructive text-white hover:bg-destructive/90">{removeEvent.isPending ? "Removing…" : "Remove time"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TimeGrid({ view, hourHeight, days, calendar, timeZone, serviceNameById, onBooking, onCalendarItem, onDragStart, onDragEnd }: any) {
  const hours = Array.from({ length: 25 }, (_, index) => index * 60);
  const events = calendar?.events ?? [];
  const bookings = calendar?.bookings ?? [];
  const blocks = calendar?.blocks ?? [];
  const slots = calendar?.lastMinuteSlots ?? [];
  const weeklySchedule = calendar?.weeklySchedule ?? [];
  const bookingRules = calendar?.bookingRules ?? [];
  const gridHeight = 24 * hourHeight;
  const pxPerMinute = hourHeight / 60;
  const topPx = (minutes: number) => Math.max(DAY_START, Math.min(DAY_END, minutes)) * pxPerMinute;
  const heightPx = (start: number, end: number, minimum = 12, maximum = Number.POSITIVE_INFINITY) => Math.min(maximum, Math.max(minimum, (Math.min(DAY_END, end) - Math.max(DAY_START, start)) * pxPerMinute));
  const hourLabel = (minutes: number) => minutes === DAY_END ? "12 AM" : formatTime(minuteToTime(minutes)).replace(":00", "");

  const renderItem = (key: string | number, start: number, end: number, className: string, label: string, content: React.ReactNode, onClick: () => void, minimum = 16, maximum?: number) => (
    <button key={key} type="button" data-calendar-item onClick={(event) => { event.stopPropagation(); onClick(); }} className={cn("absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md border px-1 text-left text-[10px] leading-tight shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", className)} style={{ top: topPx(start), height: heightPx(start, end, minimum, maximum) }} aria-label={label}>{content}</button>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className={cn("grid w-full", days.length === 1 ? "grid-cols-[46px_minmax(0,1fr)]" : "grid-cols-[38px_repeat(7,minmax(0,1fr))] sm:grid-cols-[46px_repeat(7,minmax(0,1fr))]")}>
        <div className="sticky left-0 z-20 border-r border-border bg-card" />
        {days.map((date: string) => <div key={date} className="border-b border-r border-border bg-card px-1 py-2 text-center"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">{formatDate(date, timeZone, { weekday: "short" })}</p><p className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", date === getZonedDateKey(Date.now(), timeZone) && "bg-primary text-white")}>{date.slice(-2)}</p></div>)}
        <div className="sticky left-0 z-20 relative border-r border-border bg-card" style={{ height: gridHeight }}>{hours.map((minutes) => <span key={minutes} className="absolute right-0.5 -translate-y-1/2 text-[8px] text-muted-foreground sm:right-1 sm:text-[10px]" style={{ top: topPx(minutes) }}>{hourLabel(minutes)}</span>)}</div>
        {days.map((date: string) => {
          const dow = new Date(`${date}T12:00:00`).getDay();
          const weekly = weeklySchedule.find((row: any) => row.dayOfWeek === dow && row.isActive);
          const dayBookings = bookings.filter((row: any) => bookingLocalParts(row.booking, timeZone).date === date);
          const dayEvents = events.filter((event: any) => eventAppliesOnDate(event, date));
          const dayBlocks = blocks.filter((block: any) => getZonedDateKey(new Date(block.blockDate).getTime(), timeZone) === date);
          const daySlots = slots.filter((slot: any) => slot.slotDate === date && slot.expiresAt > Date.now());
          const dayBookingRules = bookingRules.filter((rule: any) => rule.specificDate ? bookingRuleDateKey(rule.specificDate) === date : rule.dayOfWeek === dow);
          const weeklyServiceNames = (weekly?.serviceIds ?? []).map((serviceId: number) => serviceNameById.get(serviceId)).filter(Boolean);
          return <div key={date} className="relative touch-pan-y border-r border-border bg-slate-100/70" style={{ height: gridHeight }} onPointerDown={(event) => { if (event.pointerType === "touch" || (event.target as HTMLElement).closest("[data-calendar-item]")) return; const rect = event.currentTarget.getBoundingClientRect(); onDragStart(date, DAY_START + ((event.clientY - rect.top) / rect.height) * DAY_END); }} onPointerUp={(event) => { if (event.pointerType === "touch" || (event.target as HTMLElement).closest("[data-calendar-item]")) return; const rect = event.currentTarget.getBoundingClientRect(); onDragEnd(date, DAY_START + ((event.clientY - rect.top) / rect.height) * DAY_END); }}>
            <span className="pointer-events-none absolute left-1 top-1 text-[8px] font-medium uppercase tracking-wide text-slate-400">Unavailable</span>
            {hours.map((minutes) => <div key={minutes} className="absolute left-0 right-0 border-t border-border/60" style={{ top: topPx(minutes) }} />)}
            {weekly && renderItem(`weekly-${date}`, timeToMinutes(weekly.startTime), timeToMinutes(weekly.endTime), availabilityBlockStyle(weekly.clientTier), `Weekly work hours, ${formatTime(weekly.startTime)} to ${formatTime(weekly.endTime)}, ${weekly.clientTier === "returning_only" ? "returning clients only" : "open to everyone"}.`, <><span className="block truncate font-semibold">Available · {weekly.clientTier === "returning_only" ? "Returning" : "Anyone"}</span><span className="block truncate">{weekly.serviceIds?.length ? `${weekly.serviceIds.length} selected services` : "All active services"}</span></>, () => onCalendarItem({ type: "weekly-work", date, schedule: { ...weekly, serviceNames: weeklyServiceNames } }))}
            {weekly?.breakStart && weekly?.breakEnd && renderItem(`break-${date}`, timeToMinutes(weekly.breakStart), timeToMinutes(weekly.breakEnd), "border-slate-400 bg-slate-200/95 text-slate-800", `Weekly break, ${formatTime(weekly.breakStart)} to ${formatTime(weekly.breakEnd)}.`, <><span className="block font-semibold">Break</span><span className="block truncate">{formatTime(weekly.breakStart)}–{formatTime(weekly.breakEnd)}</span></>, () => onCalendarItem({ type: "weekly-break", date, schedule: weekly }))}
            {dayEvents.map((event: any) => {
              const detail = `${event.kind === "available" ? "Available time" : "Unavailable time"}, ${formatTime(event.startTime)} to ${formatTime(event.endTime)}${event.title ? `, ${event.title}` : ""}.`;
              const fallback = `${formatTime(event.startTime)}–${formatTime(event.endTime)}`;
              return renderItem(`event-${event.id}`, timeToMinutes(event.startTime), timeToMinutes(event.endTime), event.kind === "available" ? availabilityBlockStyle(event.clientTier) : "border-zinc-400 bg-zinc-200/95 text-zinc-900", detail, <><span className="block truncate font-semibold">{event.kind === "available" ? event.clientTier === "returning_only" ? "Returning clients" : "Available" : "Unavailable"}</span><span className="block truncate">{event.title || fallback}</span></>, () => onCalendarItem({ type: "event", date, event }));
            })}
            {dayBlocks.map((block: any) => {
              const detail = `Unavailable time, ${formatTime(block.startTime)} to ${formatTime(block.endTime)}${block.reason ? `, ${block.reason}` : ""}.`;
              const fallback = `${formatTime(block.startTime)}–${formatTime(block.endTime)}`;
              return renderItem(`block-${block.id}`, timeToMinutes(block.startTime), timeToMinutes(block.endTime), "border-zinc-400 bg-zinc-200/95 text-zinc-900", detail, <><span className="block font-semibold">Unavailable</span><span className="block truncate">{block.reason || fallback}</span></>, () => onCalendarItem({ type: "block", date, block }));
            })}
            {dayBookingRules.map((rule: any) => {
              const ruleLabel = rule.clientTier === "returning_only" ? "Returning clients only" : "Open to everyone";
              return renderItem(`rule-${rule.id}`, timeToMinutes(rule.startTime), timeToMinutes(rule.endTime), "border-violet-400 bg-violet-100/95 text-violet-950", `Client access rule, ${formatTime(rule.startTime)} to ${formatTime(rule.endTime)}, ${ruleLabel}.`, <><span className="block truncate font-semibold">{ruleLabel}</span><span className="block truncate">{formatTime(rule.startTime)}–{formatTime(rule.endTime)}</span></>, () => onCalendarItem({ type: "booking-rule", date, rule }));
            })}
            {daySlots.map((slot: any) => {
              const detail = `Last-minute opening, ${formatTime(slot.startTime)} to ${formatTime(slot.endTime)}${slot.note ? `, ${slot.note}` : ""}.`;
              const fallback = `${formatTime(slot.startTime)}–${formatTime(slot.endTime)}`;
              return renderItem(`slot-${slot.id}`, timeToMinutes(slot.startTime), timeToMinutes(slot.endTime), "border-fuchsia-400 bg-fuchsia-100/95 text-fuchsia-950", detail, <><span className="block truncate font-semibold">Last-minute opening</span><span className="block truncate">{slot.note || fallback}</span></>, () => onCalendarItem({ type: "last-minute", date, slot }));
            })}
            {dayBookings.map((row: any) => {
              const local = bookingLocalParts(row.booking, timeZone);
              const durationPx = heightPx(local.minutes, local.minutes + row.booking.duration, view === "week" ? 16 : 18);
              const clientName = row.client?.name || "Client";
              const serviceName = row.booking.serviceType || row.addonService?.customName || "Appointment";
              const detailLabel = `${clientName}, ${serviceName}, ${formatTime(minuteToTime(local.minutes))}, ${row.booking.duration} minutes, ${row.booking.status}.`;
              const weekContent = <span className="block truncate text-[9px] font-semibold leading-3">{clientName}</span>;
              const dayContent = <>{durationPx >= 18 && <span className="block truncate font-semibold">{clientName}</span>}{durationPx >= 34 && <span className="block truncate">{serviceName}</span>}{durationPx >= 52 && <span className="block truncate text-[9px]">{formatTime(minuteToTime(local.minutes))}</span>}</>;
              return renderItem(`booking-${row.booking.id}`, local.minutes, local.minutes + row.booking.duration, cn(statusStyle(row.booking.status), view === "week" ? "border-l-2 px-1 py-0.5" : "px-1.5 py-1"), detailLabel, view === "week" ? weekContent : dayContent, () => onBooking(row), view === "week" ? 16 : 18, view === "week" ? 20 : undefined);
            })}
          </div>;
        })}
      </div>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground"><Clock3 className="mr-1 inline" size={13} /> Tap any time block for details. Use Add to create time on a phone; drag an empty range with a mouse or trackpad.</p>
    </div>
  );
}

function MonthGrid({ calendar, anchorDate, timeZone, onSelectDay }: any) {
  const [year, month] = anchorDate.split("-").map(Number);
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = getSundayStart(first);
  const cells = Array.from({ length: 42 }, (_, index) => addLocalDays(start, index));
  const bookings = calendar?.bookings ?? [];
  const events = calendar?.events ?? [];
  const blocks = calendar?.blocks ?? [];
  const weeklySchedule = calendar?.weeklySchedule ?? [];
  const bookingRules = calendar?.bookingRules ?? [];
  return <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="grid grid-cols-7 border-b border-border bg-muted/40">{DAYS.map((day) => <div key={day} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{day}</div>)}</div><div className="grid grid-cols-7">{cells.map((date) => {
    const dayBookings = bookings.filter((row: any) => bookingLocalParts(row.booking, timeZone).date === date);
    const dayEvents = events.filter((event: any) => eventAppliesOnDate(event, date));
    const dayBlocks = blocks.filter((block: any) => getZonedDateKey(new Date(block.blockDate).getTime(), timeZone) === date);
    const isCurrentMonth = date.slice(0, 7) === anchorDate.slice(0, 7);
    const dow = new Date(`${date}T12:00:00`).getDay();
    const work = weeklySchedule.find((item: any) => item.dayOfWeek === dow && item.isActive);
    const dayBookingRules = bookingRules.filter((rule: any) => rule.specificDate ? bookingRuleDateKey(rule.specificDate) === date : rule.dayOfWeek === dow);
    const dots = [work ? availabilityDotColor(work.clientTier) : null, ...dayEvents.map((event: any) => event.kind === "available" ? availabilityDotColor(event.clientTier) : "bg-zinc-500"), ...dayBlocks.map(() => "bg-zinc-500"), ...dayBookingRules.map(() => "bg-violet-500"), ...dayBookings.map((row: any) => row.booking.status === "pending" ? "bg-amber-500" : "bg-primary")].filter(Boolean) as string[];
    const summary = `${formatDate(date, timeZone, { weekday: "long", month: "long", day: "numeric" })}: ${work ? "work hours; " : ""}${dayBookingRules.length} client access rule${dayBookingRules.length === 1 ? "" : "s"}; ${dayBookings.length} appointment${dayBookings.length === 1 ? "" : "s"}; ${dayEvents.filter((event: any) => event.kind === "unavailable").length + dayBlocks.length} unavailable period${dayEvents.filter((event: any) => event.kind === "unavailable").length + dayBlocks.length === 1 ? "" : "s"}. Open daily schedule.`;
    return <button key={date} onClick={() => onSelectDay(date)} aria-label={summary} className={cn("min-h-24 border-b border-r border-border p-1.5 text-left transition hover:bg-primary/5", !isCurrentMonth && "bg-muted/20 text-muted-foreground", date === getZonedDateKey(Date.now(), timeZone) && "bg-primary/5")}><span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", date === getZonedDateKey(Date.now(), timeZone) && "bg-primary text-white")}>{Number(date.slice(-2))}</span><span aria-hidden="true" className="mt-2 flex flex-wrap gap-1">{dots.slice(0, 6).map((color, index) => <span key={`${date}-${index}`} className={cn("h-1.5 w-1.5 rounded-full", color)} />)}</span><span className="sr-only">{summary}</span></button>;
  })}</div></div>;
}
