import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Clock, Check, X, ChevronDown, ChevronUp, Plus, Trash2, DollarSign, Percent, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return `${h}:00`;
});

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  pending:   { label: "Pending",   bg: "bg-accent text-accent-foreground" },
  confirmed: { label: "Confirmed", bg: "bg-primary/10 text-primary" },
  completed: { label: "Completed", bg: "bg-muted text-foreground" },
  declined:  { label: "Declined",  bg: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", bg: "bg-muted text-muted-foreground" },
};

// ─── Today Tab ────────────────────────────────────────────────────────────────
function TodayTab() {
  const { isAuthenticated } = useAuth();
  const { data: todayData, isLoading } = trpc.bookings.todayBookings.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 30_000 }
  );
  const utils = trpc.useUtils();

  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const updateStatus = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => {
      utils.bookings.todayBookings.invalidate();
      toast.success("Booking updated");
    },
  });

  const cancelBookingMutation = trpc.cancellation.cancel.useMutation({
    onSuccess: () => {
      utils.bookings.todayBookings.invalidate();
      setCancellingId(null);
      toast.success("Booking cancelled. Client has been notified.");
    },
    onError: () => toast.error("Failed to cancel booking."),
  });

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const appointments = todayData ?? [];
  const confirmed = appointments.filter(a => a.booking.status === "confirmed" || a.booking.status === "completed");
  const pending = appointments.filter(a => a.booking.status === "pending");

  if (isLoading) {
    return (
      <div className="px-4 pt-6 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-28">
      {/* Date header */}
      <div className="mb-5">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Today</p>
        <h2 className="text-xl font-display font-light text-foreground">{dateLabel}</h2>
        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
          <span><span className="font-semibold text-foreground">{confirmed.length}</span> confirmed</span>
          <span><span className="font-semibold text-foreground">{pending.length}</span> pending</span>
        </div>
      </div>

      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
            <Calendar size={24} className="text-primary" />
          </div>
          <p className="text-base font-medium text-foreground">No appointments today</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Your schedule is clear. Enjoy the day or check your upcoming bookings.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[22px] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {appointments.map(({ booking, client }, idx) => {
              const time = new Date(booking.scheduledAt as any);
              const timeStr = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
              const endTime = new Date(time.getTime() + booking.duration * 60_000);
              const endStr = endTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
              const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
              const isPast = endTime < new Date();

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex gap-4"
                >
                  {/* Timeline dot */}
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center z-10 border-2 border-background shadow-sm",
                      booking.status === "confirmed" ? "bg-primary" :
                      booking.status === "completed" ? "bg-foreground" :
                      "bg-muted"
                    )}>
                      {booking.status === "completed" ? (
                        <Check size={16} className="text-background" />
                      ) : booking.status === "confirmed" ? (
                        <Clock size={16} className="text-white" />
                      ) : (
                        <Clock size={16} className="text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Appointment card */}
                  <div className={cn(
                    "flex-1 rounded-2xl border border-border bg-card p-4 shadow-sm",
                    isPast && booking.status !== "completed" && "opacity-60"
                  )}>
                    {/* Top row: time + status */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{timeStr}</p>
                        <p className="text-xs text-muted-foreground">{endStr} · {booking.duration} min</p>
                      </div>
                      <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", cfg.bg)}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Client row */}
                    <div className="flex items-center gap-2.5 mb-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={client?.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                          {(client?.name ?? "C").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{client?.name ?? "Client"}</p>
                        {booking.serviceType && (
                          <p className="text-xs text-muted-foreground">{booking.serviceType}</p>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {booking.notes && (
                      <p className="text-xs text-muted-foreground italic mb-3 pl-1 border-l-2 border-border">
                        "{booking.notes}"
                      </p>
                    )}

                    {/* Actions */}
                    {booking.status === "pending" && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => updateStatus.mutate({ bookingId: booking.id, status: "confirmed" })}
                          disabled={updateStatus.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-white text-xs font-medium"
                        >
                          <Check size={13} /> Confirm
                        </button>
                        <button
                          onClick={() => updateStatus.mutate({ bookingId: booking.id, status: "declined" })}
                          disabled={updateStatus.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-medium"
                        >
                          <X size={13} /> Decline
                        </button>
                      </div>
                    )}
                    {booking.status === "confirmed" && !isPast && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => updateStatus.mutate({ bookingId: booking.id, status: "completed" })}
                          disabled={updateStatus.isPending}
                          className="flex-1 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-medium"
                        >
                          Mark as Completed
                        </button>
                        <button
                          onClick={() => setCancellingId(booking.id)}
                          className="px-3 py-2 rounded-xl border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/5 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tech Cancel Confirmation */}
      <AnimatePresence>
        {cancellingId != null && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCancellingId(null)} />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative bg-background rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 shadow-2xl"
            >
              <button onClick={() => setCancellingId(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X size={18} className="text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Cancel This Booking?</p>
                  <p className="text-xs text-muted-foreground">The client will be notified and shown alternative techs nearby</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCancellingId(null)}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Keep
                </button>
                <button
                  onClick={() => cancelBookingMutation.mutate({ bookingId: cancellingId })}
                  disabled={cancelBookingMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {cancelBookingMutation.isPending ? "Cancelling…" : "Yes, Cancel"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Day Row ──────────────────────────────────────────────────────────────────
type ClientTier = "open" | "returning_only";

type DaySchedule = {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  hasBreak: boolean;
  bufferMinutes: number;
  clientTier: ClientTier;
};

const TIER_LABELS: Record<ClientTier, string> = {
  open: "Open to all",
  returning_only: "Returning clients only",
};

const TIER_COLORS: Record<ClientTier, string> = {
  open: "text-primary",
  returning_only: "text-amber-600 dark:text-amber-400",
};

type BookingRule = {
  id: number;
  techId: number;
  dayOfWeek: number | null;
  specificDate: Date | null;
  startTime: string;
  endTime: string;
  clientTier: ClientTier;
  createdAt: Date;
};

function DayRow({
  day,
  onChange,
  rules,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
}: {
  day: DaySchedule;
  onChange: (u: DaySchedule) => void;
  rules: BookingRule[];
  onAddRule: (rule: { dayOfWeek: number | null; specificDate: number | null; startTime: string; endTime: string; clientTier: ClientTier }) => void;
  onRemoveRule: (id: number) => void;
  onUpdateRule: (id: number, data: { startTime?: string; endTime?: string; clientTier?: ClientTier; dayOfWeek?: number | null; specificDate?: number | null }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleType, setRuleType] = useState<"recurring" | "oneoff">("recurring");
  const [ruleStart, setRuleStart] = useState("09:00");
  const [ruleEnd, setRuleEnd] = useState("12:00");
  const [ruleTier, setRuleTier] = useState<ClientTier | "">("" as ClientTier | "");
  const [ruleDate, setRuleDate] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editTier, setEditTier] = useState<ClientTier>("open");
  const [editRuleType, setEditRuleType] = useState<"recurring" | "oneoff">("recurring");
  const [editRuleDate, setEditRuleDate] = useState("");

  return (
    <div className={cn(
      "rounded-2xl border transition-all",
      day.isActive ? "border-border bg-card" : "border-border/50 bg-muted/30"
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => onChange({ ...day, isActive: !day.isActive })}
          className={cn(
            "w-11 h-6 rounded-full transition-all flex items-center px-0.5 flex-shrink-0",
            day.isActive ? "bg-primary" : "bg-muted"
          )}
        >
          <div className={cn(
            "w-5 h-5 rounded-full bg-white shadow-sm transition-all",
            day.isActive ? "translate-x-5" : "translate-x-0"
          )} />
        </button>

        <span className={cn("text-sm font-medium w-10 flex-shrink-0", day.isActive ? "text-foreground" : "text-muted-foreground")}>
          {DAYS[day.dayOfWeek]}
        </span>

        {day.isActive ? (
          <span className="text-sm text-muted-foreground flex-1 truncate">
            {day.startTime} – {day.endTime}
            {day.hasBreak && ` · Break ${day.breakStart}–${day.breakEnd}`}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground flex-1">Off</span>
        )}

        {day.isActive && (
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground p-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {day.isActive && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              {/* Working hours */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-14 flex-shrink-0">Opens</span>
                <select
                  value={day.startTime}
                  onChange={e => onChange({ ...day, startTime: e.target.value })}
                  className="flex-1 text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">to</span>
                <select
                  value={day.endTime}
                  onChange={e => onChange({ ...day, endTime: e.target.value })}
                  className="flex-1 text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              {/* Break toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Lunch break</span>
                <button
                  onClick={() => onChange({ ...day, hasBreak: !day.hasBreak })}
                  className={cn(
                    "w-9 h-5 rounded-full transition-all flex items-center px-0.5",
                    day.hasBreak ? "bg-primary" : "bg-muted"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-white shadow-sm transition-all",
                    day.hasBreak ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>

              <AnimatePresence>
                {day.hasBreak && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-14 flex-shrink-0">Break</span>
                      <select
                        value={day.breakStart}
                        onChange={e => onChange({ ...day, breakStart: e.target.value })}
                        className="flex-1 text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                      >
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="text-xs text-muted-foreground">to</span>
                      <select
                        value={day.breakEnd}
                        onChange={e => onChange({ ...day, breakEnd: e.target.value })}
                        className="flex-1 text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                      >
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Whole-day client tier ── */}
              <div className="pt-1 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">Who can book this day?</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Default for the whole day (can be overridden by time blocks below)</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {(["open", "returning_only"] as ClientTier[]).map(tier => (
                    <button
                      key={tier}
                      onClick={() => onChange({ ...day, clientTier: tier })}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all text-left",
                        day.clientTier === tier
                          ? tier === "open"
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-amber-50 dark:bg-amber-900/20 border-amber-400 text-amber-700 dark:text-amber-300"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {tier === "open" ? (
                        <><span className="block font-semibold">Open to all</span><span className="text-[10px] opacity-70">Anyone can book</span></>
                      ) : (
                        <><span className="block font-semibold">Returning only</span><span className="text-[10px] opacity-70">Must have a past completed visit</span></>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Time-block rules ── */}
              <div className="pt-1 border-t border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-foreground">Time-block overrides</p>
                  <button
                    onClick={() => setShowRuleForm(v => !v)}
                    className="flex items-center gap-1 text-[11px] text-primary font-medium"
                  >
                    <Plus size={11} /> Add rule
                  </button>
                </div>

                {/* Existing rules for this day */}
                {rules.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {rules.map(rule => (
                      <div key={rule.id} className="bg-muted/40 rounded-xl px-3 py-2 space-y-2">
                        {editingRuleId === rule.id ? (
                          // ── Inline edit form ──
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground mb-0.5 block">Start</label>
                                <select value={editStart} onChange={e => setEditStart(e.target.value)}
                                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5">
                                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground mb-0.5 block">End</label>
                                <select value={editEnd} onChange={e => setEditEnd(e.target.value)}
                                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5">
                                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {(["open", "returning_only"] as ClientTier[]).map(t => (
                                <button key={t} onClick={() => setEditTier(t)}
                                  className={cn("flex-1 text-[11px] font-medium py-1.5 rounded-lg border transition-all",
                                    editTier === t ? "bg-primary text-white border-primary" : "bg-background border-border text-muted-foreground")}>
                                  {TIER_LABELS[t]}
                                </button>
                              ))}
                            </div>
                            {/* Rule scope: recurring vs one-off */}
                            <div className="flex gap-2">
                              {(["recurring", "oneoff"] as const).map(t => (
                                <button key={t} onClick={() => setEditRuleType(t)}
                                  className={cn("flex-1 text-[11px] font-medium py-1.5 rounded-lg border transition-all",
                                    editRuleType === t ? "bg-primary/10 text-primary border-primary/30" : "bg-background border-border text-muted-foreground")}>
                                  {t === "recurring" ? "Every week" : "One-off date"}
                                </button>
                              ))}
                            </div>
                            {editRuleType === "oneoff" && (
                              <div>
                                <label className="text-[10px] text-muted-foreground mb-0.5 block">Date</label>
                                <input type="date" value={editRuleDate} onChange={e => setEditRuleDate(e.target.value)}
                                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5" />
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => {
                                const specificDate = editRuleType === "oneoff" && editRuleDate
                                  ? new Date(editRuleDate).getTime()
                                  : null;
                                const dayOfWeek = editRuleType === "recurring" ? day.dayOfWeek : null;
                                onUpdateRule(rule.id, {
                                  startTime: editStart,
                                  endTime: editEnd,
                                  clientTier: editTier,
                                  // Always send both fields so the backend can clear the unused one
                                  dayOfWeek: editRuleType === "recurring" ? day.dayOfWeek : null,
                                  specificDate: editRuleType === "oneoff" && editRuleDate
                                    ? new Date(editRuleDate).getTime()
                                    : null,
                                });
                                setEditingRuleId(null);
                              }} className="flex-1 text-[11px] font-medium py-1.5 rounded-lg bg-primary text-white">
                                Save
                              </button>
                              <button onClick={() => setEditingRuleId(null)}
                                className="flex-1 text-[11px] font-medium py-1.5 rounded-lg border border-border text-muted-foreground">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // ── Rule display row ──
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-foreground">{rule.startTime}–{rule.endTime}</span>
                              <span className={cn("ml-2 text-[11px] font-medium", TIER_COLORS[rule.clientTier])}>
                                {TIER_LABELS[rule.clientTier]}
                              </span>
                              {rule.specificDate && (
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                  ({new Date(rule.specificDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} only)
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setEditingRuleId(rule.id);
                                setEditStart(rule.startTime);
                                setEditEnd(rule.endTime);
                                setEditTier(rule.clientTier);
                                setEditRuleType(rule.specificDate ? "oneoff" : "recurring");
                                setEditRuleDate(rule.specificDate
                                  ? new Date(rule.specificDate).toISOString().split("T")[0]
                                  : "");
                              }}
                              className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                              title="Edit rule"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button
                              onClick={() => onRemoveRule(rule.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add rule form */}
                <AnimatePresence>
                  {showRuleForm && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-muted/30 rounded-xl p-3 space-y-2.5 border border-border/50">
                        {/* Recurring vs one-off toggle */}
                        <div className="flex gap-2">
                          {(["recurring", "oneoff"] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => setRuleType(t)}
                              className={cn(
                                "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                ruleType === t ? "bg-primary text-white border-primary" : "bg-background border-border text-muted-foreground"
                              )}
                            >
                              {t === "recurring" ? "Every " + DAYS[day.dayOfWeek] : "Specific date"}
                            </button>
                          ))}
                        </div>

                        {/* Specific date picker (one-off only) */}
                        {ruleType === "oneoff" && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-10 flex-shrink-0">Date</span>
                            <input
                              type="date"
                              value={ruleDate}
                              onChange={e => setRuleDate(e.target.value)}
                              className="flex-1 text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground"
                            />
                          </div>
                        )}

                        {/* Time window */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-10 flex-shrink-0">From</span>
                          <select
                            value={ruleStart}
                            onChange={e => setRuleStart(e.target.value)}
                            className="flex-1 text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground"
                          >
                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <span className="text-xs text-muted-foreground">to</span>
                          <select
                            value={ruleEnd}
                            onChange={e => setRuleEnd(e.target.value)}
                            className="flex-1 text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground"
                          >
                            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>

                        {/* Tier selector */}
                        <div className="flex gap-2">
                          {(["open", "returning_only"] as ClientTier[]).map(tier => (
                            <button
                              key={tier}
                              onClick={() => setRuleTier(tier)}
                              className={cn(
                                "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all",
                                ruleTier === tier
                                  ? tier === "open"
                                    ? "bg-primary text-white border-primary"
                                    : "bg-amber-500 text-white border-amber-500"
                                  : "bg-background border-border text-muted-foreground"
                              )}
                            >
                              {TIER_LABELS[tier]}
                            </button>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setShowRuleForm(false)}
                            className="flex-1 py-1.5 rounded-lg text-xs border border-border text-muted-foreground"
                          >
                            Cancel
                          </button>
                          <button
                            disabled={!ruleTier}
                            onClick={() => {
                              if (!ruleTier) return;
                              onAddRule({
                                dayOfWeek: ruleType === "recurring" ? day.dayOfWeek : null,
                                specificDate: ruleType === "oneoff" && ruleDate ? new Date(ruleDate).getTime() : null,
                                startTime: ruleStart,
                                endTime: ruleEnd,
                                clientTier: ruleTier as ClientTier,
                              });
                              setShowRuleForm(false);
                              setRuleTier("");
                              setRuleDate("");
                            }}
                            className="flex-1 py-1.5 rounded-lg text-xs bg-primary text-white disabled:opacity-40"
                          >
                            Save rule
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────
// ─── Cancellation Policy Panel ───────────────────────────────────────────────
const WINDOW_OPTIONS = [
  { label: "24 hours", value: 24 },
  { label: "48 hours", value: 48 },
  { label: "72 hours", value: 72 },
  { label: "96 hours", value: 96 },
  { label: "120 hours", value: 120 },
  { label: "144 hours", value: 144 },
  { label: "1 week", value: 168 },
];

function CancellationPolicyPanel() {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const { data: policy } = trpc.cancellation.getPolicy.useQuery(
    { techId: user?.id ?? 0 },
    { enabled: isAuthenticated && !!user?.id }
  );

  const [windowHours, setWindowHours] = useState(48);
  const [feeType, setFeeType] = useState<"flat" | "percent">("flat");
  const [feeAmount, setFeeAmount] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (policy) {
      setWindowHours(policy.windowHours);
      setFeeType(policy.feeType);
      setFeeAmount(policy.feeAmount > 0 ? String(policy.feeAmount) : "");
      setDirty(false);
    }
  }, [policy]);

  const setPolicy = trpc.cancellation.setPolicy.useMutation({
    onSuccess: () => {
      toast.success("Cancellation policy saved");
      utils.cancellation.getPolicy.invalidate();
      setDirty(false);
    },
    onError: () => toast.error("Failed to save policy"),
  });

  const handleSave = () => {
    const amount = parseFloat(feeAmount) || 0;
    if (feeType === "percent" && amount > 100) {
      toast.error("Percentage cannot exceed 100%");
      return;
    }
    setPolicy.mutate({ windowHours, feeType, feeAmount: amount, gracePeriodHours: 1 });
  };

  const feeLabel = feeType === "flat" ? `$${parseFloat(feeAmount) || 0}` : `${parseFloat(feeAmount) || 0}%`;
  const hasFee = parseFloat(feeAmount) > 0;

  return (
    <div className="mb-6 bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-foreground">Cancellation Policy</p>
          <p className="text-xs text-muted-foreground">Shown to clients before they book</p>
        </div>
        <Shield size={16} className="text-muted-foreground" />
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Free cancellation window</p>
        <div className="flex flex-wrap gap-2">
          {WINDOW_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setWindowHours(opt.value); setDirty(true); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                windowHours === opt.value
                  ? "bg-primary text-white border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary hover:text-primary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Clients can cancel for free up to {windowHours}h before the appointment. Cancellations within 1 hour of booking are always free.
        </p>
      </div>

      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-2">Late cancellation fee</p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setFeeType("flat"); setDirty(true); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all",
              feeType === "flat" ? "bg-primary text-white border-primary" : "bg-background border-border text-muted-foreground"
            )}
          >
            <DollarSign size={12} /> Flat amount
          </button>
          <button
            onClick={() => { setFeeType("percent"); setDirty(true); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all",
              feeType === "percent" ? "bg-primary text-white border-primary" : "bg-background border-border text-muted-foreground"
            )}
          >
            <Percent size={12} /> % of service
          </button>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {feeType === "flat" ? "$" : "%"}
          </span>
          <input
            type="number"
            min="0"
            max={feeType === "percent" ? 100 : undefined}
            placeholder={feeType === "flat" ? "e.g. 30" : "e.g. 50"}
            value={feeAmount}
            onChange={e => { setFeeAmount(e.target.value); setDirty(true); }}
            className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {hasFee ? (
          <p className="text-xs text-muted-foreground mt-2">
            A {feeLabel} fee will be recorded as pending when a client cancels within the {windowHours}h window.
            {feeType === "percent" && " Calculated as a percentage of the service price."}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            No fee — clients can cancel at any time without charge.
          </p>
        )}
      </div>

      {dirty && (
        <button
          onClick={handleSave}
          disabled={setPolicy.isPending}
          className="w-full btn-valisse py-3 text-sm mt-2"
        >
          {setPolicy.isPending ? "Saving..." : "Save Policy"}
        </button>
      )}
    </div>
  );
}

const BUFFER_OPTIONS = [
  { label: "No buffer", value: 0 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
];

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS.map((_, i) => ({
  dayOfWeek: i,
  isActive: i >= 1 && i <= 5,
  startTime: "09:00",
  endTime: "18:00",
  breakStart: "12:00",
  breakEnd: "13:00",
  hasBreak: false,
  bufferMinutes: 15,
  clientTier: "open" as ClientTier,
}));

function ScheduleTab() {
  const { isAuthenticated } = useAuth();
  const { data: savedSchedule, isLoading: schedLoading } = trpc.availability.weeklySchedule.useQuery(
    undefined, { enabled: isAuthenticated }
  );
  const { data: blocksData, isLoading: blocksLoading } = trpc.availability.blocks.useQuery(
    undefined, { enabled: isAuthenticated }
  );
  const { data: bookingRulesData } = trpc.availability.bookingRules.useQuery(
    undefined, { enabled: isAuthenticated }
  );
  const utils = trpc.useUtils();

  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [globalBuffer, setGlobalBuffer] = useState(15);
  const [dirty, setDirty] = useState(false);

  // Block form state
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockDate, setBlockDate] = useState("");
  const [blockStart, setBlockStart] = useState("09:00");
  const [blockEnd, setBlockEnd] = useState("17:00");
  const [blockReason, setBlockReason] = useState("");

  // Hydrate from saved schedule
  useEffect(() => {
    if (savedSchedule && savedSchedule.length > 0) {
      const merged = DEFAULT_SCHEDULE.map(def => {
        const saved = savedSchedule.find(s => s.dayOfWeek === def.dayOfWeek);
        if (!saved) return def;
        const hasBreak = !!(saved.breakStart && saved.breakEnd);
        return {
          ...def,
          isActive: saved.isActive,
          startTime: saved.startTime,
          endTime: saved.endTime,
          breakStart: saved.breakStart ?? def.breakStart,
          breakEnd: saved.breakEnd ?? def.breakEnd,
          hasBreak,
          bufferMinutes: saved.bufferMinutes ?? 15,
          clientTier: (saved.clientTier ?? "open") as ClientTier,
        };
      });
      // Use the buffer from the first active saved day as the global value
      const firstSaved = savedSchedule.find(s => s.isActive);
      if (firstSaved?.bufferMinutes != null) setGlobalBuffer(firstSaved.bufferMinutes);
      setSchedule(merged);
    }
  }, [savedSchedule]);

  const setDayTier = trpc.availability.setDayTier.useMutation({
    onSuccess: () => utils.availability.weeklySchedule.invalidate(),
  });

  const addBookingRule = trpc.availability.addBookingRule.useMutation({
    onSuccess: () => {
      utils.availability.bookingRules.invalidate();
      toast.success("Rule saved");
    },
    onError: () => toast.error("Failed to save rule"),
  });

  const removeBookingRule = trpc.availability.removeBookingRule.useMutation({
    onSuccess: () => {
      utils.availability.bookingRules.invalidate();
      toast.success("Rule removed");
    },
  });

  const updateBookingRule = trpc.availability.updateBookingRule.useMutation({
    onSuccess: () => {
      utils.availability.bookingRules.invalidate();
      toast.success("Rule updated");
    },
    onError: () => toast.error("Failed to update rule"),
  });

  const saveSchedule = trpc.availability.setWeeklySchedule.useMutation({
    onSuccess: () => {
      utils.availability.weeklySchedule.invalidate();
      setDirty(false);
      toast.success("Schedule saved");
    },
    onError: () => toast.error("Failed to save schedule"),
  });

  const addBlock = trpc.availability.addBlock.useMutation({
    onSuccess: () => {
      utils.availability.blocks.invalidate();
      setShowBlockForm(false);
      setBlockDate("");
      setBlockReason("");
      toast.success("Time blocked off");
    },
    onError: () => toast.error("Failed to add block"),
  });

  const removeBlock = trpc.availability.removeBlock.useMutation({
    onSuccess: () => {
      utils.availability.blocks.invalidate();
      toast.success("Block removed");
    },
  });

  const handleChange = (dayOfWeek: number, updated: DaySchedule) => {
    // If clientTier changed, persist it immediately (independent of the main save)
    const prev = schedule.find(d => d.dayOfWeek === dayOfWeek);
    if (prev && prev.clientTier !== updated.clientTier) {
      setDayTier.mutate({ dayOfWeek, clientTier: updated.clientTier });
    }
    setSchedule(prev2 => prev2.map(d => d.dayOfWeek === dayOfWeek ? updated : d));
    setDirty(true);
  };

  const handleSave = () => {
    saveSchedule.mutate({
      schedule: schedule.map(d => ({
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        isActive: d.isActive,
        breakStart: d.hasBreak ? d.breakStart : null,
        breakEnd: d.hasBreak ? d.breakEnd : null,
        bufferMinutes: globalBuffer,
      })),
    });
  };

  const handleAddBlock = () => {
    if (!blockDate) return toast.error("Please select a date");
    addBlock.mutate({
      blockDate: new Date(blockDate).getTime(),
      startTime: blockStart,
      endTime: blockEnd,
      reason: blockReason || undefined,
    });
  };

  const activeDays = schedule.filter(d => d.isActive).length;
  const isLoading = schedLoading || blocksLoading;

  if (isLoading) {
    return (
      <div className="px-4 pt-6 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-28">
      {/* Header */}
      <div className="mb-5">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Weekly Schedule</p>
        <h2 className="text-xl font-display font-light text-foreground">Availability</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {activeDays === 0 ? "No working days set" : `Working ${activeDays} day${activeDays !== 1 ? "s" : ""} a week`}
        </p>
      </div>

      {/* Quick presets */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {[
          { label: "Mon–Fri", days: [1,2,3,4,5] },
          { label: "Mon–Sat", days: [1,2,3,4,5,6] },
          { label: "Weekends", days: [0,6] },
          { label: "All week", days: [0,1,2,3,4,5,6] },
        ].map(preset => (
          <button
            key={preset.label}
            onClick={() => {
              setSchedule(prev => prev.map(d => ({ ...d, isActive: preset.days.includes(d.dayOfWeek) })));
              setDirty(true);
            }}
            className="flex-shrink-0 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground bg-card hover:border-primary hover:text-primary transition-all"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Day rows */}
      <div className="space-y-2 mb-6">
        {schedule.map(day => {
          // Rules for this day: recurring rules for this dayOfWeek + one-off rules whose date falls on this day-of-week
          const dayRules = (bookingRulesData ?? []).filter(
            r => r.dayOfWeek === day.dayOfWeek ||
              (r.specificDate !== null && new Date(r.specificDate).getDay() === day.dayOfWeek)
          ) as BookingRule[];
          return (
            <DayRow
              key={day.dayOfWeek}
              day={day}
              onChange={updated => handleChange(day.dayOfWeek, updated)}
              rules={dayRules}
              onAddRule={rule => addBookingRule.mutate(rule)}
              onRemoveRule={id => removeBookingRule.mutate({ ruleId: id })}
              onUpdateRule={(id, data) => updateBookingRule.mutate({ ruleId: id, ...data })}
            />
          );
        })}
      </div>

      {/* ── Buffer Time ── */}
      <div className="mb-6 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-foreground">Buffer Time</p>
            <p className="text-xs text-muted-foreground">Cleanup time between appointments</p>
          </div>
          <Clock size={16} className="text-muted-foreground" />
        </div>
        <div className="flex flex-wrap gap-2">
          {BUFFER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setGlobalBuffer(opt.value); setDirty(true); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                globalBuffer === opt.value
                  ? "bg-primary text-white border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary hover:text-primary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {globalBuffer > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            A {globalBuffer}-minute gap will be reserved after each appointment.
          </p>
        )}
      </div>

      {/* ── Blocked-off time ── */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-foreground">Blocked Time</p>
            <p className="text-xs text-muted-foreground">Dates you're unavailable</p>
          </div>
          <button
            onClick={() => setShowBlockForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-medium"
          >
            <Plus size={13} /> Block Off
          </button>
        </div>

        {/* Add block form */}
        <AnimatePresence>
          {showBlockForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                  <input
                    type="date"
                    value={blockDate}
                    onChange={e => setBlockDate(e.target.value)}
                    className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">From</label>
                    <select
                      value={blockStart}
                      onChange={e => setBlockStart(e.target.value)}
                      className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                    >
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">To</label>
                    <select
                      value={blockEnd}
                      onChange={e => setBlockEnd(e.target.value)}
                      className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                    >
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Reason (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Vacation, personal day…"
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddBlock}
                    disabled={addBlock.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium"
                  >
                    {addBlock.isPending ? "Saving…" : "Block Off"}
                  </button>
                  <button
                    onClick={() => setShowBlockForm(false)}
                    className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Existing blocks */}
        {(blocksData ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No blocked time</p>
        ) : (
          <div className="space-y-2">
            {(blocksData ?? []).map(block => {
              const d = new Date(block.blockDate as any);
              const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              return (
                <div key={block.id} className="flex items-center justify-between bg-card border border-border rounded-2xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{dateStr}</p>
                    <p className="text-xs text-muted-foreground">
                      {block.startTime} – {block.endTime}
                      {block.reason && ` · ${block.reason}`}
                    </p>
                  </div>
                  <button
                    onClick={() => removeBlock.mutate({ blockId: block.id })}
                    disabled={removeBlock.isPending}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Cancellation Policy ── */}
      <CancellationPolicyPanel />

      {/* Floating save button */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-4 right-4 z-50"
          >
            <button
              onClick={handleSave}
              disabled={saveSchedule.isPending}
              className="w-full btn-valisse py-4 text-base shadow-lg"
            >
              {saveSchedule.isPending ? "Saving..." : "Save Schedule"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TechBookings() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"today" | "schedule">("today");

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8">
        <Calendar size={40} className="text-muted-foreground" />
        <h2 className="text-xl font-display font-light">Your Bookings</h2>
        <p className="text-muted-foreground text-sm text-center">Sign in to manage your appointments and schedule.</p>
      </div>
    );
  }

  return (
    <div className="page-enter min-h-screen bg-background">
      {/* Sticky header with tabs */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 pt-12 pb-0">
          <h1 className="text-2xl font-display font-light mb-3">Bookings</h1>
          <div className="flex gap-1 bg-muted/50 rounded-2xl p-1">
            <button
              onClick={() => setTab("today")}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium rounded-xl transition-all",
                tab === "today" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Today
            </button>
            <button
              onClick={() => setTab("schedule")}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium rounded-xl transition-all",
                tab === "schedule" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Schedule
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "today" ? <TodayTab /> : <ScheduleTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
