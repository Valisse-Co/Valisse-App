import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MessageCircle, Plus, ShieldCheck, UserRound, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addLocalDays, getBrowserTimeZone, getZonedDateKey, getZonedDateTimeParts, timeToMinutes } from "@shared/lastMinuteBooking";
import { eventAppliesOnDate, getSundayStart } from "@shared/techCalendar";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_START = 6 * 60;
const DAY_END = 22 * 60;
const GRID_HEIGHT = 768;

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
  const clamped = Math.max(0, Math.min(23 * 60 + 45, Math.round(minutes / 15) * 15));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function bookingLocalParts(booking: any, timeZone: string) {
  const parts = getZonedDateTimeParts(new Date(booking.scheduledAt).getTime(), timeZone);
  return { date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`, minutes: parts.hour * 60 + parts.minute };
}

function statusStyle(status: string) {
  if (status === "confirmed") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "pending") return "border-amber-300 bg-amber-50 text-amber-800";
  if (["cancelled", "declined", "no_show"].includes(status)) return "border-border bg-muted text-muted-foreground";
  if (status === "completed") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-violet-200 bg-violet-50 text-violet-800";
}

function rangeTitle(view: CalendarView, anchorDate: string, range: { fromLocalDate: string; toLocalDate: string }, timeZone?: string) {
  if (view === "day") return formatDate(anchorDate, timeZone, { weekday: "long", month: "long", day: "numeric" });
  if (view === "week") return `${formatDate(range.fromLocalDate, timeZone, { month: "short", day: "numeric" })} – ${formatDate(range.toLocalDate, timeZone, { month: "short", day: "numeric", year: "numeric" })}`;
  return formatDate(anchorDate, timeZone, { month: "long", year: "numeric" });
}

export default function TechCalendar() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(() => localDateKey());
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewInput, setReviewInput] = useState<any | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const dragStart = useRef<{ date: string; minutes: number } | null>(null);
  const utils = trpc.useUtils();
  const range = useMemo(() => calendarRange(view, anchorDate), [view, anchorDate]);
  const { data, isLoading } = trpc.availability.calendar.useQuery(range, { enabled: isAuthenticated && (user?.userType === "nail_tech" || user?.hasDualRole) });
  const timeZone = (data as any)?.timeZone || getBrowserTimeZone();
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
    onSuccess: () => { utils.availability.calendar.invalidate(); toast.success("Calendar event removed."); },
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
              {(["day", "week", "month"] as CalendarView[]).map((item) => <button key={item} onClick={() => setView(item)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition", view === item ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>{item}</button>)}
            </div>
            <div className="flex items-center gap-1"><button onClick={() => navigateRange(-1)} className="rounded-lg p-2 hover:bg-muted" aria-label="Previous"><ChevronLeft size={16} /></button><button onClick={() => setAnchorDate(localDateKey())} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">Today</button><button onClick={() => navigateRange(1)} className="rounded-lg p-2 hover:bg-muted" aria-label="Next"><ChevronRight size={16} /></button></div>
          </div>
          <p className="mt-2 text-center text-sm font-semibold text-foreground">{rangeTitle(view, anchorDate, range, timeZone)}</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 pt-3">
        {isLoading ? <div className="space-y-3"><div className="h-12 animate-pulse rounded-2xl bg-muted" /><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div> : view === "month" ? <MonthGrid calendar={calendar} anchorDate={anchorDate} timeZone={timeZone} onSelectDay={(date: string) => { setAnchorDate(date); setView("day"); }} /> : <TimeGrid days={days} calendar={calendar} timeZone={timeZone} onBooking={setSelectedBooking} onEventDelete={(eventId: number) => removeEvent.mutate({ eventId })} onDragStart={(date: string, minutes: number) => { dragStart.current = { date, minutes }; }} onDragEnd={(date: string, minutes: number) => { const start = dragStart.current; dragStart.current = null; if (!start || start.date !== date) return; const first = Math.min(start.minutes, minutes); const last = Math.max(start.minutes, minutes); openEventDialog({ localDate: date, startTime: minuteToTime(first), endTime: minuteToTime(Math.max(first + 30, last + 30)) }); }} />}
      </main>

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
    </div>
  );
}

function TimeGrid({ days, calendar, timeZone, onBooking, onEventDelete, onDragStart, onDragEnd }: any) {
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, index) => DAY_START + index * 60);
  const events = calendar?.events ?? [];
  const bookings = calendar?.bookings ?? [];
  const blocks = calendar?.blocks ?? [];
  const slots = calendar?.lastMinuteSlots ?? [];
  const weeklySchedule = calendar?.weeklySchedule ?? [];
  const percentTop = (minutes: number) => ((Math.max(DAY_START, minutes) - DAY_START) / (DAY_END - DAY_START)) * 100;
  const percentHeight = (start: number, end: number) => Math.max(3, ((Math.min(DAY_END, end) - Math.max(DAY_START, start)) / (DAY_END - DAY_START)) * 100);

  const renderBlock = (key: string | number, start: number, end: number, className: string, content: React.ReactNode, onClick?: () => void) => (
    <button
      key={key}
      type="button"
      onClick={(event) => { event.stopPropagation(); onClick?.(); }}
      className={cn("absolute left-1 right-1 overflow-hidden rounded-lg border px-1.5 py-1 text-left text-[10px] leading-tight shadow-sm", className)}
      style={{ top: `${percentTop(start)}%`, height: `${percentHeight(start, end)}%` }}
    >
      {content}
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <div className={cn("grid min-w-[660px]", days.length === 1 ? "grid-cols-[54px_minmax(0,1fr)]" : "grid-cols-[54px_repeat(7,minmax(120px,1fr))]")}>
        <div className="sticky left-0 z-20 border-r border-border bg-card" />
        {days.map((date: string) => (
          <div key={date} className="border-b border-r border-border bg-card px-2 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{formatDate(date, timeZone, { weekday: "short" })}</p>
            <p className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", date === getZonedDateKey(Date.now(), timeZone) && "bg-primary text-white")}>{date.slice(-2)}</p>
          </div>
        ))}
        <div className="sticky left-0 z-20 relative h-[768px] border-r border-border bg-card">
          {hours.slice(0, -1).map((minutes) => <span key={minutes} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: `${percentTop(minutes)}%` }}>{formatTime(minuteToTime(minutes)).replace(":00", "")}</span>)}
        </div>
        {days.map((date: string) => {
          const dow = new Date(`${date}T12:00:00`).getDay();
          const weekly = weeklySchedule.find((row: any) => row.dayOfWeek === dow && row.isActive);
          const dayBookings = bookings.filter((row: any) => bookingLocalParts(row.booking, timeZone).date === date);
          const dayEvents = events.filter((event: any) => eventAppliesOnDate(event, date));
          const dayBlocks = blocks.filter((block: any) => getZonedDateKey(new Date(block.blockDate).getTime(), timeZone) === date);
          const daySlots = slots.filter((slot: any) => slot.slotDate === date && slot.expiresAt > Date.now());
          return (
            <div
              key={date}
              className="relative h-[768px] border-r border-border bg-background/50"
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                const rect = event.currentTarget.getBoundingClientRect();
                onDragStart(date, DAY_START + ((event.clientY - rect.top) / rect.height) * (DAY_END - DAY_START));
              }}
              onPointerUp={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                const rect = event.currentTarget.getBoundingClientRect();
                onDragEnd(date, DAY_START + ((event.clientY - rect.top) / rect.height) * (DAY_END - DAY_START));
              }}
            >
              {hours.map((minutes) => <div key={minutes} className="absolute left-0 right-0 border-t border-border/60" style={{ top: `${percentTop(minutes)}%` }} />)}
              {weekly && renderBlock(`weekly-${date}`, timeToMinutes(weekly.startTime), timeToMinutes(weekly.endTime), "pointer-events-none border-primary/20 bg-primary/5 text-primary/80", <><span className="font-semibold">Work hours</span><span className="ml-1">{weekly.clientTier === "returning_only" ? "Returning only" : "Anyone"}</span></>)}
              {weekly?.breakStart && weekly?.breakEnd && renderBlock(`break-${date}`, timeToMinutes(weekly.breakStart), timeToMinutes(weekly.breakEnd), "pointer-events-none border-border bg-muted text-muted-foreground", <>Break</>)}
              {dayEvents.map((event: any) => renderBlock(`event-${event.id}`, timeToMinutes(event.startTime), timeToMinutes(event.endTime), event.kind === "available" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-300 bg-slate-100 text-slate-700", <><span className="font-semibold">{event.kind === "available" ? "Work hours" : "Unavailable"}</span><span className="ml-1">{event.title || (event.clientTier === "returning_only" ? "Returning only" : "")}</span><span className="float-right text-slate-500">×</span></>, () => onEventDelete(event.id)))}
              {dayBlocks.map((block: any) => renderBlock(`block-${block.id}`, timeToMinutes(block.startTime), timeToMinutes(block.endTime), "pointer-events-none border-slate-300 bg-slate-100 text-slate-700", <>Unavailable {block.reason ? `· ${block.reason}` : ""}</>))}
              {daySlots.map((slot: any) => renderBlock(`slot-${slot.id}`, timeToMinutes(slot.startTime), timeToMinutes(slot.endTime), "pointer-events-none border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800", <><span className="font-semibold">Last-minute opening</span>{slot.note && <span className="ml-1">· {slot.note}</span>}</>))}
              {dayBookings.map((row: any) => {
                const local = bookingLocalParts(row.booking, timeZone);
                return renderBlock(`booking-${row.booking.id}`, local.minutes, local.minutes + row.booking.duration, statusStyle(row.booking.status), <><span className="block truncate font-semibold">{row.client?.name || "Client"}</span><span className="block truncate">{row.booking.serviceType || row.addonService?.customName || "Appointment"}</span></>, () => onBooking(row));
              })}
            </div>
          );
        })}
      </div>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground"><Clock3 className="mr-1 inline" size={13} /> Drag across an empty time range to add hours or unavailable time. Tap an appointment for its details.</p>
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
  const weeklySchedule = calendar?.weeklySchedule ?? [];
  return <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="grid grid-cols-7 border-b border-border bg-muted/40">{DAYS.map((day) => <div key={day} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{day}</div>)}</div><div className="grid grid-cols-7">{cells.map((date) => { const dayBookings = bookings.filter((row: any) => bookingLocalParts(row.booking, timeZone).date === date); const dayEvents = events.filter((event: any) => eventAppliesOnDate(event, date)); const isCurrentMonth = date.slice(0, 7) === anchorDate.slice(0, 7); const dow = new Date(`${date}T12:00:00`).getDay(); const work = weeklySchedule.find((item: any) => item.dayOfWeek === dow && item.isActive); return <button key={date} onClick={() => onSelectDay(date)} className={cn("min-h-24 border-b border-r border-border p-1.5 text-left transition hover:bg-primary/5", !isCurrentMonth && "bg-muted/20 text-muted-foreground", date === getZonedDateKey(Date.now(), timeZone) && "bg-primary/5")}><span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", date === getZonedDateKey(Date.now(), timeZone) && "bg-primary text-white")}>{Number(date.slice(-2))}</span>{work && <p className="mt-1 truncate text-[9px] text-primary">{work.clientTier === "returning_only" ? "Returning only" : "Work hours"}</p>}{dayEvents.slice(0, 1).map((event: any) => <p key={event.id} className={cn("mt-1 truncate rounded px-1 py-0.5 text-[9px] font-medium", event.kind === "available" ? "bg-sky-100 text-sky-800" : "bg-slate-200 text-slate-700")}>{event.kind === "available" ? "Work hours" : "Unavailable"}</p>)}{dayBookings.slice(0, 2).map((row: any) => <p key={row.booking.id} className={cn("mt-1 truncate rounded px-1 py-0.5 text-[9px] font-medium", row.booking.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary")}>{row.client?.name || "Client"}</p>)}{dayBookings.length > 2 && <p className="mt-1 text-[9px] text-muted-foreground">+{dayBookings.length - 2} more</p>}</button>; })}</div></div>;
}
