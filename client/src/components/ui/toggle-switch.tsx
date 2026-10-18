import * as React from "react";
import { cn } from "@/lib/utils";

type ToggleSize = "sm" | "md" | "lg";

type ToggleSwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: ToggleSize;
};

const sizeClasses: Record<ToggleSize, { track: string; thumb: string; on: string }> = {
  sm: {
    track: "h-5 w-9 p-0.5",
    thumb: "h-4 w-4",
    on: "translate-x-4",
  },
  md: {
    track: "h-6 w-11 p-0.5",
    thumb: "h-5 w-5",
    on: "translate-x-5",
  },
  lg: {
    track: "h-7 w-12 p-1",
    thumb: "h-5 w-5",
    on: "translate-x-5",
  },
};

/**
 * A consistent binary toggle. Its thumb begins on the left in the off state and
 * moves only by the exact remaining track width when enabled.
 */
export function ToggleSwitch({
  checked,
  onCheckedChange,
  size = "md",
  className,
  disabled,
  "aria-label": ariaLabel,
  ...props
}: ToggleSwitchProps) {
  const styles = sizeClasses[size];

  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        styles.track,
        checked ? "bg-primary" : "bg-muted-foreground/30",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-[0_1px_3px_rgba(20,47,41,0.24)] transition-transform duration-200 ease-out",
          styles.thumb,
          checked ? styles.on : "translate-x-0",
        )}
      />
    </button>
  );
}
