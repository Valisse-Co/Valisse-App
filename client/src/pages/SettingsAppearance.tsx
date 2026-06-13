import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsAppearance() {
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const setDarkMode = trpc.settings.setDarkMode.useMutation();

  const handleSelect = (selected: "light" | "dark") => {
    if (!toggleTheme) return;
    if (selected !== theme) {
      toggleTheme();
      setDarkMode.mutate({ darkMode: selected === "dark" });
    }
  };

  const options = [
    { value: "light" as const, label: "Light", icon: <Sun size={22} />, description: "Clean, bright interface" },
    { value: "dark" as const, label: "Dark", icon: <Moon size={22} />, description: "Easy on the eyes at night" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold flex-1">Appearance</h1>
      </div>

      <div className="px-4 py-6 flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Theme</p>
          <div className="grid grid-cols-2 gap-3">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all",
                  theme === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                {/* Mini preview */}
                <div className={cn(
                  "w-full aspect-video rounded-xl overflow-hidden border",
                  opt.value === "dark" ? "bg-zinc-900 border-zinc-700" : "bg-white border-zinc-200"
                )}>
                  <div className={cn("h-2 w-full", opt.value === "dark" ? "bg-zinc-800" : "bg-zinc-100")} />
                  <div className="p-2 flex flex-col gap-1">
                    <div className={cn("h-1.5 rounded-full w-3/4", opt.value === "dark" ? "bg-zinc-700" : "bg-zinc-200")} />
                    <div className={cn("h-1.5 rounded-full w-1/2", opt.value === "dark" ? "bg-zinc-700" : "bg-zinc-200")} />
                    <div className="mt-1 h-4 rounded-md bg-primary/60 w-1/3" />
                  </div>
                </div>
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center",
                  theme === opt.value ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                )}>
                  {opt.icon}
                </div>
                <div className="text-center">
                  <p className={cn("text-sm font-semibold", theme === opt.value ? "text-primary" : "text-foreground")}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
                {theme === opt.value && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <svg viewBox="0 0 12 12" className="w-3 h-3 text-white fill-current">
                      <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center px-4">
          Your theme preference is saved to this device.
        </p>
      </div>
    </div>
  );
}
