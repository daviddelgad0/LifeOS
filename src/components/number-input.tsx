"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Small unit caption under the number, e.g. "lb". */
  unit?: string;
  "aria-label"?: string;
  className?: string;
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  unit,
  "aria-label": ariaLabel,
  className,
}: NumberInputProps) {
  // Draft holds in-progress typing so partial input like "13." isn't clamped away.
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (n: number) => Math.min(Math.max(n, min), max);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseFloat(draft);
    onChange(Number.isNaN(parsed) ? value : clamp(parsed));
    setDraft(null);
  };

  const stepperClass =
    "flex w-16 shrink-0 items-center justify-center text-text-secondary outline-none transition-colors hover:bg-muted hover:text-text-primary focus-visible:ring-1 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div
      className={cn(
        "flex h-16 items-stretch overflow-hidden rounded-xl border border-border bg-surface transition-colors focus-within:ring-1 focus-within:ring-accent/40",
        className
      )}
    >
      <button
        type="button"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={stepperClass}
      >
        <Minus className="size-4" />
      </button>
      <div className="flex min-w-16 flex-1 flex-col items-center justify-center">
        <input
          type="text"
          inputMode="decimal"
          aria-label={ariaLabel}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full bg-transparent text-center font-mono text-2xl font-medium outline-none"
        />
        {unit && (
          <span className="text-xs leading-none text-text-tertiary">
            {unit}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={stepperClass}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
