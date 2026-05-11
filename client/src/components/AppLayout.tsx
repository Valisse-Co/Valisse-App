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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { AccountSwitcher } from "./AccountSwitcher";

interface NavItem {
  label: string;
  icon: ReactNode;
  href: string;
}

const clientNav: NavItem[] = [
  { label: "Discover", icon: <Compass size={22} />, href: "/discover" },
  { label: "Messages", icon: <MessageCircle size={22} />, href: "/messages" },
  { label: "Bookings", icon: <Calendar size={22} />, href: "/bookings" },
  { label: "Saved", icon: <Bookmark size={22} />, href: "/saved" },
  { label: "Settings", icon: <Settings size={22} />, href: "/settings" },
];

const techNav: NavItem[] = [
  { label: "Dashboard", icon: <LayoutDashboard size={22} />, href: "/dashboard" },
  { label: "Messages", icon: <MessageCircle size={22} />, href: "/messages" },
  { label: "Bookings", icon: <Calendar size={22} />, href: "/tech-bookings" },
  { label: "Post", icon: <PlusSquare size={22} />, href: "/create-post" },
  { label: "Settings", icon: <Settings size={22} />, href: "/settings" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  const isTech = user?.userType === "nail_tech";
  const hasDual = (user as any)?.hasDualRole || isTech;
  // Respect activeMode for dual-role users, fall back to userType
  const activeMode: "client" | "nail_tech" =
    hasDual
      ? ((user as any)?.activeMode ?? (isTech ? "nail_tech" : "client"))
      : (isTech ? "nail_tech" : "client");

  const navItems = activeMode === "nail_tech" ? techNav : clientNav;

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
                  "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-0",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("transition-transform duration-200", isActive && "scale-110")}>
                  {item.icon}
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
