import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Bell, BellOff, ArrowLeft, MapPin, Star, X, Sparkles, Zap, Clock, ChevronRight } from "lucide-react";
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

// ─── Last-Minute Slot Notification Card ──────────────────────────────────────
function SlotNotifCard({ n, onNavigate }: { n: any; onNavigate: (n: any) => void }) {
  const fmt12 = (t: string) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  // Parse "Mon, Jul 14 · 2:00 PM–3:00 PM" from body
  const body: string = n.body ?? "";

  return (
    <motion.button
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onNavigate(n)}
      className={cn(
        "w-full text-left mx-4 mb-3 rounded-2xl overflow-hidden border shadow-sm transition-all",
        n.isRead
          ? "bg-card border-border"
          : "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30"
      )}
      style={{ width: "calc(100% - 2rem)" }}
    >
      {/* Accent bar */}
      {!n.isRead && (
        <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/60" />
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            n.isRead ? "bg-muted" : "bg-primary/15"
          )}>
            <Zap size={18} className={cn(n.isRead ? "text-muted-foreground" : "text-primary")} fill={n.isRead ? "none" : "currentColor"} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn("text-sm leading-snug", !n.isRead && "font-semibold text-foreground")}>
                {n.title}
              </p>
              {!n.isRead && (
                <span className="flex-shrink-0 text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  New
                </span>
              )}
            </div>
            {body && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Clock size={11} className="text-primary flex-shrink-0" />
                <p className={cn("text-xs leading-snug", n.isRead ? "text-muted-foreground" : "text-primary font-medium")}>
                  {body}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </p>
              <span className={cn(
                "text-[10px] font-semibold flex items-center gap-0.5",
                n.isRead ? "text-muted-foreground" : "text-primary"
              )}>
                Book Now <ChevronRight size={10} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [altTechsBookingId, setAltTechsBookingId] = useState<number | null>(null);

  const { data: notifications, refetch } = trpc.notifications.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
  const { data: unreadSlotData, refetch: refetchSlotCount } = trpc.notifications.unreadSlotCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
  const { refetch: refetchCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const markAll = trpc.notifications.markRead.useMutation({
    onSuccess: () => { refetch(); refetchCount(); refetchSlotCount(); },
  });
  const markOne = trpc.notifications.markOne.useMutation({
    onSuccess: () => { refetch(); refetchCount(); refetchSlotCount(); },
  });

  const handleNotifClick = (n: any) => {
    if (!n.isRead) markOne.mutate({ notificationId: n.id });
    if (n.type === "last_minute_slot" && n.relatedId) {
      // relatedId is the slot id; navigate to discover to find and book
      navigate(`/discover`);
    } else if (n.type === "new_post" && n.relatedId) {
      navigate(`/post/${n.relatedId}?from=/notifications`);
    } else if (n.type === "booking_cancelled_by_tech" && n.relatedId) {
      setAltTechsBookingId(n.relatedId);
    }
  };

  const allNotifs = notifications ?? [];
  const slotNotifs = allNotifs.filter((n: any) => n.type === "last_minute_slot");
  const otherNotifs = allNotifs.filter((n: any) => n.type !== "last_minute_slot");
  const unreadSlotCount = unreadSlotData?.count ?? 0;
  const unreadOtherCount = otherNotifs.filter((n: any) => !n.isRead).length;
  const totalUnread = allNotifs.filter((n: any) => !n.isRead).length;

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
            <h1 className="text-xl font-semibold">Alerts</h1>
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-white text-xs font-bold">
                {totalUnread}
              </span>
            )}
          </div>
          {totalUnread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="text-xs text-primary font-medium"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="pb-24">
        {allNotifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
            <BellOff size={40} className="opacity-30" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs opacity-70 text-center px-8">Subscribe to nail techs to get notified when they post or open last-minute slots</p>
          </div>
        ) : (
          <>
            {/* ── Last-Minute Slot Notifications ── */}
            {slotNotifs.length > 0 && (
              <div className="pt-4">
                {/* Section header with badge */}
                <div className="flex items-center gap-2 px-4 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
                    <Zap size={13} className="text-white fill-white" />
                  </div>
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider">Last-Minute Openings</p>
                  {unreadSlotCount > 0 && (
                    <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary text-white text-[10px] font-bold shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {unreadSlotCount} new
                    </span>
                  )}
                </div>

                {/* Slot cards */}
                <div className="flex flex-col">
                  {slotNotifs.map((n: any) => (
                    <SlotNotifCard key={n.id} n={n} onNavigate={handleNotifClick} />
                  ))}
                </div>

                {/* Divider before regular notifications */}
                {otherNotifs.length > 0 && (
                  <div className="relative flex items-center my-2 px-4">
                    <div className="flex-1 border-t border-border/50" />
                    <span className="mx-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest whitespace-nowrap">
                      Other Notifications
                    </span>
                    <div className="flex-1 border-t border-border/50" />
                  </div>
                )}
              </div>
            )}

            {/* ── Regular Notifications ── */}
            {otherNotifs.length > 0 && (
              <div className={cn("divide-y divide-border", slotNotifs.length === 0 && "pt-0")}>
                {otherNotifs.map((n: any) => (
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
                ))}
              </div>
            )}
          </>
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
