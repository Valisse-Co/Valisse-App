import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Bell, BellOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

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
  };

  const unreadCount = (notifications ?? []).filter((n: any) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-background page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1 as any)}
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
                n.type === "new_post" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
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
    </div>
  );
}
