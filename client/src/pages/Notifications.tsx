import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Bell, BellOff, ArrowLeft, MapPin, Star, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ─── Alternative Techs Modal ──────────────────────────────────────────────────
interface AltTechsModalProps {
  bookingId: number;
  onClose: () => void;
}

function AltTechsModal({ bookingId, onClose }: AltTechsModalProps) {
  const [, navigate] = useLocation();

  const { data: techs, isLoading } = trpc.cancellation.alternativeTechs.useQuery({
    bookingId,
    clientLat: null,
    clientLng: null,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative bg-background rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col"
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-1 sm:hidden" />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <div>
            <p className="font-semibold text-foreground text-sm">Available Alternatives</p>
            <p className="text-xs text-muted-foreground">Nail techs with openings around that time</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3 pb-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
            ))
          ) : !techs || techs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Sparkles size={32} className="opacity-30" />
              <p className="text-sm text-center">No alternatives found for that time window.</p>
              <button
                onClick={() => { onClose(); navigate("/discover"); }}
                className="btn-valisse px-5 py-2 text-sm mt-1"
              >
                Browse All Techs
              </button>
            </div>
          ) : (
            techs.map((tech) => (
              <button
                key={tech.id}
                onClick={() => { onClose(); navigate(`/tech/${tech.id}?from=/notifications`); }}
                className="w-full flex items-center gap-3 bg-card rounded-2xl p-3 border border-border hover:border-primary/40 transition-colors text-left"
              >
                <Avatar className="w-12 h-12 border border-border shrink-0">
                  <AvatarImage src={tech.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-accent text-primary font-semibold">
                    {(tech.name ?? "N").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">
                    {tech.businessName ?? tech.name}
                  </p>
                  {tech.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <MapPin size={10} /> {tech.location}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {tech.priceRange && (
                      <span className="text-xs text-muted-foreground">{tech.priceRange}</span>
                    )}
                    {tech.distanceMiles != null && (
                      <span className="text-xs text-muted-foreground">
                        {tech.distanceMiles < 1
                          ? `${(tech.distanceMiles * 5280).toFixed(0)} ft`
                          : `${tech.distanceMiles.toFixed(1)} mi`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-primary font-medium shrink-0">View →</div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [altTechsBookingId, setAltTechsBookingId] = useState<number | null>(null);

  const { data: notifications, refetch } = trpc.notifications.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { refetch: refetchCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const markAll = trpc.notifications.markRead.useMutation({
    onSuccess: () => { refetch(); refetchCount(); },
  });
  const markOne = trpc.notifications.markOne.useMutation({
    onSuccess: () => { refetch(); refetchCount(); },
  });

  const handleNotifClick = (n: any) => {
    if (!n.isRead) markOne.mutate({ notificationId: n.id });
    if (n.type === "new_post" && n.relatedId) navigate(`/post/${n.relatedId}`);
    if (n.type === "booking_cancelled_by_tech" && n.relatedId) {
      setAltTechsBookingId(n.relatedId);
    }
  };

  const unreadCount = (notifications ?? []).filter((n: any) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-background page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/discover")}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-semibold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="text-xs text-primary font-medium"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notification list */}
      <div className="divide-y divide-border">
        {!notifications || notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
            <BellOff size={40} className="opacity-30" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs opacity-70">Subscribe to nail techs to get notified when they post</p>
          </div>
        ) : (
          notifications.map((n: any) => (
            <button
              key={n.id}
              onClick={() => handleNotifClick(n)}
              className={cn(
                "w-full text-left px-4 py-4 flex items-start gap-3 transition-colors",
                n.isRead ? "bg-background" : "bg-primary/5"
              )}
            >
              {/* Icon */}
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                n.type === "new_post" ? "bg-primary/10 text-primary"
                  : n.type === "booking_cancelled_by_tech" ? "bg-destructive/10 text-destructive"
                  : "bg-accent text-accent-foreground"
              )}>
                <Bell size={16} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm leading-snug", !n.isRead && "font-semibold")}>
                  {n.title}
                </p>
                {n.body && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                )}
                {n.type === "booking_cancelled_by_tech" && n.relatedId && (
                  <span className="inline-block mt-1.5 text-xs text-primary font-medium underline underline-offset-2">
                    See available alternatives →
                  </span>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>

              {/* Unread dot */}
              {!n.isRead && (
                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
              )}
            </button>
          ))
        )}
      </div>

      {/* Alternative Techs Modal */}
      <AnimatePresence>
        {altTechsBookingId != null && (
          <AltTechsModal
            bookingId={altTechsBookingId}
            onClose={() => setAltTechsBookingId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
