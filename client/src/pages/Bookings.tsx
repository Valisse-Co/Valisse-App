import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Clock, AlertTriangle, Shield, X, ChevronRight, MapPin, RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BookingTipDialog } from "@/components/BookingTipDialog";
import { BookingPaymentSetup } from "@/components/BookingPaymentSetup";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-accent text-accent-foreground border border-border",
  confirmed: "bg-primary/10 text-primary border border-primary/20",
  in_progress: "bg-violet-100 text-violet-700 border border-violet-200",
  payment_due: "bg-amber-100 text-amber-800 border border-amber-200",
  disputed: "bg-red-100 text-red-700 border border-red-200",
  declined: "bg-muted text-muted-foreground border border-border",
  cancelled: "bg-muted text-muted-foreground border border-border",
  completed: "bg-accent text-accent-foreground border border-border",
};

// ─── Cancel Confirmation Dialog ───────────────────────────────────────────────
interface CancelDialogProps {
  bookingId: number;
  techId: number;
  onClose: () => void;
  onConfirmed: () => void;
}

function CancelDialog({ bookingId, techId, onClose, onConfirmed }: CancelDialogProps) {
  const { data: preview, isLoading } = trpc.cancellation.previewFee.useQuery({
    bookingId,
    servicePrice: null,
  });

  const cancel = trpc.cancellation.cancel.useMutation({
    onSuccess: (data) => {
      if (data.feeStatus === "pending" && data.feeAmountDollars > 0) {
        toast.warning(
          `Booking cancelled. A $${data.feeAmountDollars.toFixed(2)} late cancellation fee has been recorded as pending.`
        );
      } else {
        toast.success("Booking cancelled successfully.");
      }
      onConfirmed();
    },
    onError: () => toast.error("Failed to cancel booking. Please try again."),
  });

  const handleConfirm = () => cancel.mutate({ bookingId, servicePrice: null });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative bg-background rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle size={18} className="text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">Cancel Booking</p>
            <p className="text-xs text-muted-foreground">This action cannot be undone</p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-16 rounded-xl bg-muted animate-pulse mb-4" />
        ) : preview ? (
          <div className="rounded-xl border border-border bg-card p-4 mb-4">
            <div className="flex items-start gap-2">
              <Shield size={14} className="text-muted-foreground mt-0.5 shrink-0" />
              <div>
                {preview.isGrace ? (
                  <p className="text-xs text-foreground">
                    <span className="font-medium text-green-600 dark:text-green-400">Free cancellation</span> — you're within the 1-hour grace period. No fee applies.
                  </p>
                ) : preview.isLateCancellation && preview.feeAmountDollars > 0 ? (
                  <p className="text-xs text-foreground">
                    <span className="font-medium text-amber-600 dark:text-amber-400">Late cancellation fee: ${preview.feeAmountDollars.toFixed(2)}</span>
                    <span className="text-muted-foreground"> — this fee will be recorded as pending and collected when Stripe billing is enabled.</span>
                  </p>
                ) : preview.isLateCancellation ? (
                  <p className="text-xs text-muted-foreground">
                    This is a late cancellation per the tech's policy, but no fee has been set.
                  </p>
                ) : (
                  <p className="text-xs text-foreground">
                    <span className="font-medium text-green-600 dark:text-green-400">Free cancellation</span> — you're outside the late-cancel window.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 mb-4">
            <p className="text-xs text-muted-foreground">No cancellation policy set by this tech.</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Keep Booking
          </button>
          <button
            onClick={handleConfirm}
            disabled={cancel.isPending || isLoading}
            className="flex-1 py-3 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {cancel.isPending ? "Cancelling…" : "Yes, Cancel"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function RevisionApprovalCard({ bookingId, onResolved }: { bookingId: number; onResolved: () => void }) {
  const { data: context, isLoading } = trpc.smartService.bookingContext.useQuery({ bookingId });
  const respond = trpc.smartService.respondToRevision.useMutation({
    onSuccess: (_, input) => {
      toast.success(input.accepted ? "Updated booking accepted and confirmed." : "Updated booking declined.");
      onResolved();
    },
    onError: (error) => toast.error(error.message || "Could not update the booking."),
  });
  const revision = context?.latestRevision;
  if (isLoading || !revision || revision.status !== "pending") return null;
  const lines = (revision.serviceLines ?? []) as Array<{ serviceName: string; durationMinutes: number; priceInCents: number }>;
  const total = revision.totalPriceInCents ?? lines.reduce((sum, line) => sum + line.priceInCents, 0);
  const duration = revision.totalDurationMinutes ?? lines.reduce((sum, line) => sum + line.durationMinutes, 0);
  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 space-y-3">
      <div><p className="text-xs font-semibold text-amber-800">Your nail tech updated this booking</p><p className="text-xs text-amber-700 mt-0.5">Review the services, duration, and quote before it can be confirmed.</p></div>
      <div className="rounded-lg bg-white/70 border border-amber-200 px-3 py-2 space-y-1.5">
        {lines.map((line, index) => <div key={`${line.serviceName}-${index}`} className="flex justify-between gap-3 text-xs"><span className="text-foreground">{line.serviceName} <span className="text-muted-foreground">· {line.durationMinutes} min</span></span><span className="font-medium text-foreground">${(line.priceInCents / 100).toFixed(2)}</span></div>)}
        <div className="pt-1.5 mt-1.5 border-t border-amber-200 flex justify-between text-xs font-semibold text-foreground"><span>Total · {duration} min</span><span>${(total / 100).toFixed(2)}</span></div>
      </div>
      {revision.techNote && <p className="text-xs text-amber-800 italic">“{revision.techNote}”</p>}
      <div className="flex gap-2"><button onClick={() => respond.mutate({ bookingId, revisionId: revision.id, accepted: true })} disabled={respond.isPending} className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50">Accept updated booking</button><button onClick={() => respond.mutate({ bookingId, revisionId: revision.id, accepted: false })} disabled={respond.isPending} className="flex-1 py-2 rounded-lg border border-amber-300 text-amber-800 text-xs font-semibold disabled:opacity-50">Decline</button></div>
    </div>
  );
}

function ClientAppointmentTools({ bookingId, status, scheduledAt, paymentStatus, payoutStatus, onChanged }: { bookingId: number; status: string; scheduledAt: Date | string; paymentStatus?: string | null; payoutStatus?: string | null; onChanged: () => void }) {
  const { data: code } = trpc.appointment.clientCode.useQuery({ bookingId }, { enabled: status === "confirmed" });
  const [issueOpen, setIssueOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [tipOpen, setTipOpen] = useState(false);
  const [tipClientSecret, setTipClientSecret] = useState<string | null>(null);
  const [tipPaymentIntentId, setTipPaymentIntentId] = useState<string | null>(null);
  const [paymentSetupOpen, setPaymentSetupOpen] = useState(false);
  const [paymentSetupClientSecret, setPaymentSetupClientSecret] = useState<string | null>(null);
  const startPaymentSetup = trpc.appointment.paymentSetup.useMutation({
    onSuccess: ({ clientSecret }) => { setPaymentSetupClientSecret(clientSecret); setPaymentSetupOpen(true); },
    onError: (error) => toast.error(error.message || "Could not update your payment method."),
  });
  const createTip = trpc.appointment.createTip.useMutation({
    onSuccess: (result) => { setTipClientSecret(result.clientSecret); setTipPaymentIntentId(result.paymentIntentId); setTipOpen(true); },
    onError: (error) => toast.error(error.message || "Could not start this tip."),
  });
  const reportIssue = trpc.appointment.reportIssue.useMutation({
    onSuccess: () => { toast.success("Issue reported. The payout is paused for review."); setIssueOpen(false); setReason(""); onChanged(); },
    onError: (error) => toast.error(error.message || "Could not report this issue."),
  });

  return <>
    {status === "confirmed" && !code?.available && <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3"><p className="text-xs font-semibold text-foreground">Appointment check-in</p><p className="mt-0.5 text-xs text-muted-foreground">Your six-digit check-in code will appear here 24 hours before {new Date(scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Share it only with your nail tech when they are ready to begin.</p></div>}
    {code?.available && code.code && <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3"><div className="flex items-start gap-2"><Shield size={15} className="mt-0.5 text-primary" /><div><p className="text-xs font-semibold text-foreground">Your appointment check-in code</p><p className="mt-0.5 text-xs text-muted-foreground">Show this code to your nail tech when your service begins. Do not share it before you are together.</p><p className="mt-2 font-mono text-2xl font-bold tracking-[0.35em] text-primary">{code.code}</p></div></div></div>}
    {status === "in_progress" && <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5"><p className="text-xs font-semibold text-violet-800">Your appointment is in progress</p><p className="mt-0.5 text-xs text-violet-700">Your tech verified your code. When the service is complete, your approved total will be charged and you can choose to add a tip.</p></div>}
    {status === "payment_due" && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-800">Payment needed</p><p className="mt-1 text-xs text-amber-700">Update your saved card to settle this completed appointment before making another booking request.</p><button onClick={() => startPaymentSetup.mutate({ bookingId })} disabled={startPaymentSetup.isPending} className="mt-2 w-full rounded-full bg-amber-700 py-2 text-xs font-semibold text-white disabled:opacity-50">{startPaymentSetup.isPending ? "Preparing…" : "Update payment method"}</button></div>}
    {paymentStatus === "paid" && payoutStatus === "pending_dispute_window" && <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-xs font-semibold text-foreground">Appointment complete</p><p className="mt-0.5 text-xs text-muted-foreground">Your service payment has been processed. Add an optional tip or report an issue within 24 hours.</p><div className="mt-2.5 flex gap-2"><button onClick={() => createTip.mutate({ bookingId, amountInCents: 500 })} disabled={createTip.isPending} className="flex-1 rounded-full bg-primary py-2 text-xs font-medium text-white disabled:opacity-50">{createTip.isPending ? "Preparing…" : "Add $5 tip"}</button><button onClick={() => setIssueOpen(true)} className="flex-1 rounded-full border border-destructive/30 py-2 text-xs font-medium text-destructive hover:bg-destructive/5">Report an issue</button></div></div>}
    <Dialog open={issueOpen} onOpenChange={setIssueOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle>Report an appointment issue</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Tell us what happened. This pauses the nail tech’s payout while an administrator reviews the report.</p><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe the issue" className="min-h-28" /><Button variant="destructive" disabled={reason.trim().length < 10 || reportIssue.isPending} onClick={() => reportIssue.mutate({ bookingId, reason: reason.trim() })}>{reportIssue.isPending ? "Submitting…" : "Submit issue report"}</Button></DialogContent></Dialog>
    <Dialog open={tipOpen} onOpenChange={setTipOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle>Add a tip</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Your $5 tip goes entirely to your nail tech and is released with their payout after the issue window.</p>{tipClientSecret && tipPaymentIntentId && <BookingTipDialog bookingId={bookingId} clientSecret={tipClientSecret} paymentIntentId={tipPaymentIntentId} onComplete={() => { setTipOpen(false); onChanged(); }} />}</DialogContent></Dialog>
    <Dialog open={paymentSetupOpen} onOpenChange={setPaymentSetupOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle>Update payment method</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Save a different card to retry the outstanding appointment charge.</p>{paymentSetupClientSecret && <BookingPaymentSetup bookingId={bookingId} clientSecret={paymentSetupClientSecret} onComplete={() => { setPaymentSetupOpen(false); onChanged(); }} />}</DialogContent></Dialog>
  </>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Bookings() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);
  const [cancellingTechId, setCancellingTechId] = useState<number | null>(null);

  const { data: bookingsData, isLoading, refetch } = trpc.bookings.clientBookings.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const utils = trpc.useUtils();

  const handleCancelConfirmed = () => {
    setCancellingBookingId(null);
    setCancellingTechId(null);
    utils.bookings.clientBookings.invalidate();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8">
        <Calendar size={40} className="text-muted-foreground" />
        <h2 className="text-xl font-display font-light">Your Bookings</h2>
        <p className="text-muted-foreground text-sm text-center">Sign in to view and manage your appointments.</p>
      </div>
    );
  }

  const now = new Date();
  const upcoming = bookingsData?.filter(b => {
    const d = new Date((b.booking.scheduledAt as any));
    return d >= now && b.booking.status !== "cancelled" && b.booking.status !== "declined";
  }) ?? [];
  const past = bookingsData?.filter(b => {
    const d = new Date((b.booking.scheduledAt as any));
    return d < now || b.booking.status === "cancelled" || b.booking.status === "completed" || b.booking.status === "declined";
  }) ?? [];

  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-3">
        <h1 className="text-2xl font-display font-light mb-3">Bookings</h1>
        <div className="flex gap-1 bg-muted rounded-full p-1">
          {(["upcoming", "past"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-1.5 rounded-full text-sm font-medium capitalize transition-all",
                tab === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >{t}</button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-24 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Calendar size={24} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm text-center">
              {tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
            </p>
            {tab === "upcoming" && (
              <button onClick={() => navigate("/discover")} className="btn-valisse px-6 py-2.5 text-sm">
                Discover Nail Techs
              </button>
            )}
          </div>
        ) : (
          displayed.map(({ booking, tech }) => {
            const scheduledDate = new Date(booking.scheduledAt as any);
            const isPendingFee =
              (booking as any).cancellationFeeStatus === "pending" &&
              (booking as any).cancellationFeeAmount > 0;

            return (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-2xl p-4 shadow-sm border border-border"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12 border border-border">
                    <AvatarImage src={tech?.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-accent text-primary font-semibold">
                      {(tech?.name ?? "N").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <p className="font-semibold text-foreground text-sm">{tech?.businessName || tech?.name}</p>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLORS[booking.status])}>
                        {booking.status}
                      </span>
                    </div>
                    {booking.serviceType && (
                      <p className="text-xs text-muted-foreground mt-0.5">{booking.serviceType}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {scheduledDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>

                {(booking as any).inspirationImageUrl && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-2.5">
                    <img src={(booking as any).inspirationImageUrl} alt="Appointment inspiration" className="h-14 w-14 rounded-lg object-cover" />
                    <div><p className="text-xs font-semibold text-foreground">Your selected nail inspiration</p><p className="text-xs text-muted-foreground mt-0.5">Saved from the look you booked.</p></div>
                  </div>
                )}

                {(booking as any).revisionStatus === "pending" && <RevisionApprovalCard bookingId={booking.id} onResolved={() => { utils.bookings.clientBookings.invalidate(); refetch(); }} />}
                <ClientAppointmentTools bookingId={booking.id} status={booking.status} scheduledAt={booking.scheduledAt} paymentStatus={(booking as any).paymentStatus} payoutStatus={(booking as any).payoutStatus} onChanged={() => { utils.bookings.clientBookings.invalidate(); refetch(); }} />

                {/* Address reveal — only for confirmed bookings */}
                {booking.status === "confirmed" && (tech as any)?.fullAddress && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                      <MapPin size={13} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 mb-0.5">Studio Address</p>
                        <p className="text-xs text-emerald-800">{(tech as any).fullAddress}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pending fee notice */}
                {isPendingFee && (
                  <div className="mt-3 pt-3 border-t border-border flex items-start gap-2">
                    <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Late cancellation fee of <span className="font-semibold">${(booking as any).cancellationFeeAmount?.toFixed(2)}</span> is pending. Your tech may waive this.
                    </p>
                  </div>
                )}

                {/* Actions */}
                {tab === "upcoming" && (booking.status === "confirmed" || booking.status === "pending") && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => {
                        setCancellingBookingId(booking.id);
                        setCancellingTechId(tech?.id ?? null);
                      }}
                      className="flex-1 text-xs text-destructive border border-destructive/30 rounded-full py-2 hover:bg-destructive/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => navigate(`/chat/${tech?.id}`)}
                      className="flex-1 text-xs btn-valisse-outline py-2"
                    >
                      Message Tech
                    </button>
                  </div>
                )}

                {tab === "past" && booking.status === "completed" && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => navigate(`/tech/${tech?.id}?from=/bookings`)}
                      className="w-full text-xs btn-valisse py-2"
                    >
                      Leave a Review
                    </button>
                  </div>
                )}

                {/* Declined — offer reschedule + message */}
                {booking.status === "declined" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => navigate(`/book/${tech?.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs btn-valisse py-2"
                    >
                      <RotateCcw size={12} /> Reschedule
                    </button>
                    <button
                      onClick={() => navigate(`/chat/${tech?.id}`)}
                      className="flex-1 text-xs btn-valisse-outline py-2"
                    >
                      Message
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Cancel Dialog */}
      <AnimatePresence>
        {cancellingBookingId != null && cancellingTechId != null && (
          <CancelDialog
            bookingId={cancellingBookingId}
            techId={cancellingTechId}
            onClose={() => { setCancellingBookingId(null); setCancellingTechId(null); }}
            onConfirmed={handleCancelConfirmed}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
