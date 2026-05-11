import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Clock, MapPin, ChevronRight, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion } from "framer-motion";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-accent text-accent-foreground border border-border",
  confirmed: "bg-primary/10 text-primary border border-primary/20",
  declined: "bg-muted text-muted-foreground border border-border",
  cancelled: "bg-muted text-muted-foreground border border-border",
  completed: "bg-accent text-accent-foreground border border-border",
};

export default function Bookings() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { data: bookingsData, isLoading } = trpc.bookings.clientBookings.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const updateStatus = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => {
      utils.bookings.clientBookings.invalidate();
      toast.success("Booking updated");
    },
  });

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
    return d < now || b.booking.status === "cancelled" || b.booking.status === "completed";
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

                {/* Actions */}
                {tab === "upcoming" && booking.status === "confirmed" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => updateStatus.mutate({ bookingId: booking.id, status: "cancelled" })}
                      className="flex-1 text-xs text-destructive border border-destructive/30 rounded-full py-2 hover:bg-destructive/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => navigate(`/chat/${booking.clientId}`)}
                      className="flex-1 text-xs btn-valisse-outline py-2"
                    >
                      Message Tech
                    </button>
                  </div>
                )}

                {tab === "past" && booking.status === "completed" && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => navigate(`/tech/${tech?.id}`)}
                      className="w-full text-xs btn-valisse py-2"
                    >
                      Leave a Review
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
