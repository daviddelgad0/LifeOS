import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";

interface StreakBadgeProps {
  count: number;
  /** Defaults to active when the streak is above zero. */
  active?: boolean;
  className?: string;
}

export function StreakBadge({ count, active, className }: StreakBadgeProps) {
  const isActive = active ?? count > 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors",
        isActive
          ? "border-accent-border bg-accent-dim text-accent"
          : "border-border bg-surface text-text-tertiary",
        className
      )}
      aria-label={`${count}-day streak${isActive ? "" : " (broken)"}`}
    >
      <Flame className="size-3" />
      <span className="font-mono">{count}</span>
    </div>
  );
}
