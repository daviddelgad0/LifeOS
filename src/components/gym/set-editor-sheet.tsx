"use client";

import { useState } from "react";

import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { barWeight, plateBreakdown, warmupSets } from "@/lib/fitness";
import type { SetSuggestion } from "@/lib/progression";
import { toDisplayWeight, toStoredWeight, weightStep } from "@/lib/units";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export interface SetEditorTarget {
  field: "weight" | "reps" | "rir" | "note";
  weId: string;
  setId: string;
  exerciseName: string;
  isBarbell: boolean;
  value: number;
  note?: string;
}

interface SetEditorSheetProps {
  target: SetEditorTarget | null;
  suggestion?: SetSuggestion | null;
  onClose: () => void;
  onCommit: (patch: {
    weight?: number;
    reps?: number;
    rir?: number | null;
    note?: string;
  }) => void;
}

const FIELD_LABEL = {
  weight: "Weight",
  reps: "Reps",
  rir: "RIR — reps in reserve",
  note: "Set note",
} as const;

export function SetEditorSheet({
  target,
  suggestion,
  onClose,
  onCommit,
}: SetEditorSheetProps) {
  const units = useAppStore((s) => s.units);
  const [value, setValue] = useState(0);
  const [note, setNote] = useState("");
  const [showWarmup, setShowWarmup] = useState(false);
  // Sync local state when a new target opens (render-time adjustment). Weight
  // is stored in lb but edited in the user's display unit.
  const [lastKey, setLastKey] = useState("");
  const key = target ? `${target.setId}-${target.field}` : "";
  if (target && key !== lastKey) {
    setLastKey(key);
    setValue(target.field === "weight" ? toDisplayWeight(target.value, units) : target.value);
    setNote(target.note ?? "");
    setShowWarmup(false);
  }

  if (!target) return null;

  const plates =
    target.field === "weight" && target.isBarbell
      ? plateBreakdown(value, units)
      : null;

  const commit = () => {
    if (target.field === "note") onCommit({ note: note.trim() || undefined });
    else if (target.field === "rir") onCommit({ rir: value });
    else if (target.field === "weight") onCommit({ weight: toStoredWeight(value, units) });
    else onCommit({ [target.field]: value });
    onClose();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle className="text-sm font-medium text-text-secondary">
            {target.exerciseName} — {FIELD_LABEL[target.field]}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-2">
          {target.field === "note" ? (
            <Input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commit()}
              placeholder="felt heavy, form broke…"
            />
          ) : target.field === "rir" ? (
            <div className="grid grid-cols-7 gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue(n)}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-xl border font-mono text-base transition-colors",
                    value === n
                      ? "border-accent-border bg-accent-dim text-accent"
                      : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
                  )}
                >
                  {n === 6 ? "5+" : n}
                </button>
              ))}
            </div>
          ) : (
            <NumberInput
              value={value}
              onChange={setValue}
              step={target.field === "weight" ? weightStep(units) : 1}
              min={0}
              max={target.field === "weight" ? 1500 : 100}
              unit={target.field === "weight" ? units : "reps"}
              aria-label={FIELD_LABEL[target.field]}
            />
          )}

          {target.field === "weight" && suggestion && (
            <p className="text-xs text-text-tertiary">
              Suggested: {toDisplayWeight(suggestion.weightLb, units)} {units} ×{" "}
              {suggestion.repsLo}–{suggestion.repsHi} @ {suggestion.targetRir} RIR
              {" — "}
              {suggestion.reason}
            </p>
          )}

          {target.field === "weight" && (
            <div className="flex flex-col gap-2 text-sm">
              {plates && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-2">
                  <span className="text-xs text-text-tertiary">
                    Per side ({barWeight(units)} {units} bar):
                  </span>
                  {plates.length === 0 ? (
                    <span className="font-mono text-xs">empty bar</span>
                  ) : (
                    plates.map((p, i) => (
                      <span
                        key={i}
                        className="rounded border border-border-hover px-1.5 py-0.5 font-mono text-xs"
                      >
                        {p}
                      </span>
                    ))
                  )}
                </div>
              )}
              {target.isBarbell && plates === null && value > 0 && (
                <p className="text-xs text-warning">
                  {value} {units} can&apos;t be loaded exactly with standard plates.
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowWarmup((s) => !s)}
                className="self-start text-xs text-text-secondary underline-offset-4 transition-colors hover:text-accent hover:underline"
              >
                {showWarmup ? "Hide warm-up ramp" : "Show warm-up ramp"}
              </button>
              {showWarmup && (
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised px-3 py-2">
                  {warmupSets(value, units).map((w, i) => (
                    <span key={i} className="font-mono text-xs text-text-secondary">
                      {w.weight} {units} × {w.reps}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button onClick={commit} className="h-12">
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
