import { cn } from "@/lib/utils";

export function SkeletonLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-surface-raised",
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/5 to-transparent motion-safe:animate-shimmer" />
    </div>
  );
}
