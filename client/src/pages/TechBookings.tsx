import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Clock, Check, X, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
  completed: "bg-blue-100 text-blue-700",
};

export default function TechBookings() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"pending" | "upcoming" | "past">("pending");

  const { data: bookingsData, isLoading, refetch } = trpc.bookings.techBookings.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const updateStatus = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Booking updated");
    },
  });

  const now = new Date();
  const pending = bookingsData?.filter(b => b.booking.status === "pending") ?? [];
  const upcoming = bookingsData?.filter(b => {
    const d = new Date(b.booking.scheduledAt as any);
    return d >= now && b.booking.status === "confirmed";
  }) ?? [];
  const past = bookingsData?.filter(b => {
    const d = new Date(b.booking.scheduledAt as any);
    return d < now || b.booking.status === "completed" || b.booking.status === "cancelled" || b.booking.status === "declined";
  }) ?? [];

  const displayed = tab === "pending" ? pending : tab === "upcoming" ? upcoming : past;

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-3">
        <h1 className="text-2xl font-display font-light mb-3">Bookings</h1>
        <div className="flex gap-1 bg-muted rounded-full p-1">
          {(["pending", "upcoming", "past"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-1.5 rounded-full text-xs font-medium capitalize transition-all relative",
                tab === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {t}
              {t === "pending" && pending.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-24 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
          ))
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Calendar size={24} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm text-center">
              {tab === "pending" ? "No pending requests" : tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
            </p>
          </div>
        ) : (
          displayed.map(({ booking, client }) => {
            const scheduledDate = new Date(booking.scheduledAt as any);
            return (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-2xl border border-border p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12 border border-border">
                    <AvatarImage src={client?.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-accent text-primary font-semibold">
                      {(client?.name ?? "C").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <p className="font-semibold text-foreground text-sm">{client?.name ?? "Client"}</p>
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
                    {booking.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 italic">"{booking.notes}"</p>
                    )}
                  </div>
                </div>

                {/* Actions for pending */}
                {booking.status === "pending" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => updateStatus.mutate({ bookingId: booking.id, status: "declined" })}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs text-destructive border border-destructive/30 rounded-full py-2.5 hover:bg-destructive/5 transition-colors"
                    >
                      <X size={13} /> Decline
                    </button>
                    <button
                      onClick={() => updateStatus.mutate({ bookingId: booking.id, status: "confirmed" })}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs btn-valisse py-2.5"
                    >
                      <Check size={13} /> Confirm
                    </button>
                  </div>
                )}

                {/* Actions for confirmed */}
                {booking.status === "confirmed" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => updateStatus.mutate({ bookingId: booking.id, status: "completed" })}
                      className="flex-1 text-xs btn-valisse py-2.5"
                    >
                      Mark Completed
                    </button>
                    <button
                      onClick={() => navigate(`/messages`)}
                      className="flex items-center justify-center gap-1.5 px-4 text-xs btn-valisse-outline py-2.5"
                    >
                      <MessageCircle size={13} />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
