import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Bookmark,
  Calendar,
  Compass,
  MessageCircle,
  LayoutDashboard,
  PlusSquare,
  Settings,
  Bell,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useRef } from "react";
import { AccountSwitcher } from "./AccountSwitcher";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface NavItem {
  label: string;
  icon: ReactNode;
  href: string;
  badge?: number;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();

  const isTech = user?.userType === "nail_tech";
  const hasDual = (user as any)?.hasDualRole || isTech;
  const activeMode: "client" | "nail_tech" =
    hasDual
      ? ((user as any)?.activeMode ?? (isTech ? "nail_tech" : "client"))
      : (isTech ? "nail_tech" : "client");

  // Fetch unread notification count (poll every 30s)
  const { data: unreadData, refetch: refetchUnread } = trpc.notifications.unreadCount.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 30_000 }
  );
  const unreadCount = unreadData?.count ?? 0;

  // Fetch notifications list to detect new_post toasts
  const { data: notifList, refetch: refetchList } = trpc.notifications.list.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 30_000 }
  );

  // Toast new_post notifications that arrive AFTER initial mount
  const seenIdsRef = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!notifList) return;
    // First load: seed seen IDs silently, no toasts
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(notifList.map((n: any) => n.id));
      return;
    }
    // Subsequent polls: only toast genuinely new unread new_post notifications
    const newOnes = notifList.filter(
      (n: any) => n.type === "new_post" && !n.isRead && !seenIdsRef.current!.has(n.id)
    );
    newOnes.forEach((n: any) => {
      seenIdsRef.current!.add(n.id);
      toast(n.title, {
        description: n.body ?? undefined,
        duration: 5000,
        action: n.relatedId
          ? { label: "View", onClick: () => navigate(`/post/${n.relatedId}`) }
          : undefined,
      });
    });
  }, [notifList, navigate]);

  const clientNav: NavItem[] = [
    { label: "Discover", icon: <Compass size={22} />, href: "/discover" },
    { label: "Messages", icon: <MessageCircle size={22} />, href: "/messages" },
    { label: "Bookings", icon: <Calendar size={22} />, href: "/bookings" },
    { label: "Saved", icon: <Bookmark size={22} />, href: "/saved" },
    {
      label: "Alerts",
      icon: <Bell size={22} />,
      href: "/notifications",
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
  ];

  const techNav: NavItem[] = [
    { label: "Dashboard", icon: <LayoutDashboard size={22} />, href: "/dashboard" },
    { label: "Messages", icon: <MessageCircle size={22} />, href: "/messages" },
    { label: "Bookings", icon: <Calendar size={22} />, href: "/tech-bookings" },
    { label: "Post", icon: <PlusSquare size={22} />, href: "/create-post" },
    { label: "Settings", icon: <Settings size={22} />, href: "/settings" },
  ];

  // Admin nav entry — appended to whichever nav is active
  const adminEntry: NavItem = { label: "Reports", icon: <Flag size={22} />, href: "/admin/reports" };
  const navItems = [
    ...(activeMode === "nail_tech" ? techNav : clientNav),
    ...(user?.role === "admin" ? [adminEntry] : []),
  ];

  return (
    <div className="mobile-container bg-background">
      {/* Account Switcher top bar — only shown for dual-role users */}
      {hasDual && (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur-sm border-b border-border z-40 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            {activeMode === "nail_tech" ? "Nail Tech Mode" : "Client Mode"}
          </span>
          <AccountSwitcher />
        </div>
      )}

      {/* Main content with bottom padding for nav */}
      <main className={cn("pb-20 min-h-screen", hasDual && "pt-10")}>
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur-sm border-t border-border z-50">
        <div className="flex items-center justify-around px-1 py-2">
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href + "/"));
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-0 relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("transition-transform duration-200 relative", isActive && "scale-110")}>
                  {item.icon}
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </span>
                <span className={cn("text-[10px] font-medium tracking-wide truncate", isActive && "font-semibold")}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
