import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface px-6 py-12 text-center",
        className
      )}
    >
      <Icon className="size-10 text-text-tertiary" strokeWidth={1.5} />
      <p className="text-sm text-text-secondary">{description}</p>
      {actionLabel && <Button onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}
