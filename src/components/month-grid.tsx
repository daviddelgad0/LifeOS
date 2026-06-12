"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { toISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface MonthGridProps {
  year: number;
  month: number; // 0-based
  onPrev: () => void;
  onNext: () => void;
  renderDay: (iso: string, dayOfMonth: number) => React.ReactNode;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monthly calendar grid with 28px day cells, Monday first. */
export function MonthGrid({ year, month, onPrev, onNext, renderDay }: MonthGridProps) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7;
  const label = first.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous month"
            className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next month"
            className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid w-fit grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <span
            key={i}
            className="flex size-7 items-center justify-center text-[0.65rem] text-text-tertiary"
          >
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`blank-${i}`} className={cn("size-7")} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const iso = toISODate(new Date(year, month, i + 1));
          return <span key={iso}>{renderDay(iso, i + 1)}</span>;
        })}
      </div>
    </div>
  );
}
