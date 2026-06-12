"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { allExercises } from "@/lib/exercises";
import { MUSCLES } from "@/lib/fitness";
import type { Exercise, Muscle, WorkoutSession } from "@/lib/types";
import { useWorkoutStore } from "@/stores/workout-store";
import { cn } from "@/lib/utils";

interface ExercisePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (exercise: Exercise) => void;
}

/** Exercise ids used recently surface first. */
function recentIds(sessions: WorkoutSession[]): string[] {
  const seen: string[] = [];
  const sorted = [...sessions]
    .filter((s) => s.endedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    for (const we of s.exercises) {
      if (!seen.includes(we.exerciseId)) seen.push(we.exerciseId);
    }
  }
  return seen;
}

export function ExercisePicker({ open, onOpenChange, onPick }: ExercisePickerProps) {
  const custom = useWorkoutStore((s) => s.customExercises);
  const sessions = useWorkoutStore((s) => s.sessions);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "all">("all");

  const list = useMemo(() => {
    const recents = recentIds(sessions);
    const rank = (e: Exercise) => {
      const i = recents.indexOf(e.id);
      return i === -1 ? 999 : i;
    };
    return allExercises(custom)
      .filter(
        (e) =>
          (muscle === "all" || e.muscle === muscle) &&
          (query === "" ||
            e.name.toLowerCase().includes(query.toLowerCase()) ||
            e.equipment.includes(query.toLowerCase()))
      )
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [custom, sessions, query, muscle]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>Add exercise</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or equipment"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {(["all", ...MUSCLES] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMuscle(m as Muscle | "all")}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
                muscle === m
                  ? "border-accent-border bg-accent-dim text-accent"
                  : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {list.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                onPick(e);
                onOpenChange(false);
              }}
              className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2 text-sm">
                {e.name}
                {e.custom && (
                  <span className="rounded-full border border-accent-border bg-accent-dim px-1.5 text-[0.6rem] text-accent">
                    custom
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-text-tertiary">
                {e.muscle}
              </span>
            </button>
          ))}
          {list.length === 0 && (
            <p className="py-8 text-center text-sm text-text-tertiary">
              Nothing matches that search.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
