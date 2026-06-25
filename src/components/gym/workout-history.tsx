"use client";

import { useMemo, useState } from "react";
import { Activity, Dumbbell } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { getExercise } from "@/lib/exercises";
import { sessionDurationMin, sessionVolume } from "@/lib/fitness";
import { formatShort } from "@/lib/dates";
import { toDisplayTotal, toDisplayWeight } from "@/lib/units";
import type { WorkoutSession } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { useWorkoutStore } from "@/stores/workout-store";

export function WorkoutHistory() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const units = useAppStore((s) => s.units);
  const [detail, setDetail] = useState<WorkoutSession | null>(null);

  const done = useMemo(
    () =>
      sessions
        .filter((s) => s.endedAt)
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)),
    [sessions]
  );

  if (done.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-tertiary">History</h2>
        <EmptyState
          icon={Dumbbell}
          description="Your completed workouts will show up here."
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-text-tertiary">
        History · {done.length} workout{done.length === 1 ? "" : "s"}
      </h2>
      <div className="flex flex-col gap-2">
        {done.slice(0, 40).map((s) => {
          const setCount = s.exercises.reduce(
            (a, we) => a + we.sets.filter((x) => x.completed).length,
            0
          );
          const cardio = s.cardio?.length ?? 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setDetail(s)}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-border-hover"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {formatShort(s.date)}
                  {s.gym && (
                    <span className="font-normal text-text-tertiary"> · {s.gym}</span>
                  )}
                </span>
                <span className="font-mono text-xs text-text-tertiary">
                  {s.exercises.length > 0 &&
                    `${s.exercises.length} exercises · ${setCount} sets · ${toDisplayTotal(
                      sessionVolume(s),
                      units
                    )} ${units}`}
                  {s.exercises.length > 0 && cardio > 0 && " · "}
                  {cardio > 0 && `${cardio} cardio`}
                </span>
              </div>
              <span className="shrink-0 font-mono text-xs text-text-tertiary">
                {sessionDurationMin(s)} min
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[80vh] max-w-sm overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail && formatShort(detail.date)}
              {detail?.gym && (
                <span className="ml-2 text-xs font-normal text-text-tertiary">
                  {detail.gym}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-4 text-sm">
              {detail.exercises.map((we) => {
                const ex = getExercise(we.exerciseId, customExercises);
                const sets = we.sets.filter((x) => x.completed);
                if (sets.length === 0) return null;
                return (
                  <div key={we.id} className="flex flex-col gap-1">
                    <span className="font-medium">{ex?.name ?? we.exerciseId}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {sets.map((st) => (
                        <span
                          key={st.id}
                          className="rounded border border-border bg-surface-raised px-2 py-0.5 font-mono text-xs text-text-secondary"
                        >
                          {toDisplayWeight(st.weight, units)}×{st.reps}
                          {st.pr && <span className="ml-1 text-accent">PR</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}

              {(detail.cardio?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Activity className="size-3.5 text-text-tertiary" /> Cardio
                  </span>
                  {detail.cardio!.map((c) => (
                    <span key={c.id} className="font-mono text-xs text-text-secondary">
                      {c.type} · {c.durationMin} min
                      {c.distanceMi ? ` · ${c.distanceMi} mi` : ""}
                      {c.incline ? ` · ${c.incline}% incline` : ""}
                    </span>
                  ))}
                </div>
              )}

              {detail.note && (
                <p className="rounded-lg border border-border bg-surface-raised p-2 text-xs text-text-secondary">
                  {detail.note}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
