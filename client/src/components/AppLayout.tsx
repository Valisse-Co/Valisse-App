import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Bookmark, Calendar, Compass, MessageCircle, LayoutDashboard, PlusSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface NavItem {
  label: string;
  icon: ReactNode;
  href: string;
  roles?: ("client" | "nail_tech")[];
}

const clientNav: NavItem[] = [
  { label: "Discover", icon: <Compass size={22} />, href: "/discover" },
  { label: "Messages", icon: <MessageCircle size={22} />, href: "/messages" },
  { label: "Bookings", icon: <Calendar size={22} />, href: "/bookings" },
  { label: "Saved", icon: <Bookmark size={22} />, href: "/saved" },
];

const techNav: NavItem[] = [
  { label: "Dashboard", icon: <LayoutDashboard size={22} />, href: "/dashboard" },
  { label: "Messages", icon: <MessageCircle size={22} />, href: "/messages" },
  { label: "Bookings", icon: <Calendar size={22} />, href: "/tech-bookings" },
  { label: "Post", icon: <PlusSquare size={22} />, href: "/create-post" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  const isTech = user?.userType === "nail_tech";
  const navItems = isTech ? techNav : clientNav;

  return (
    <div className="mobile-container bg-background">
      {/* Main content with bottom padding for nav */}
      <main className="pb-20 min-h-screen">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur-sm border-t border-border z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("transition-transform duration-200", isActive && "scale-110")}>
                  {item.icon}
                </span>
                <span className={cn("text-[10px] font-medium tracking-wide", isActive && "font-semibold")}>
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
