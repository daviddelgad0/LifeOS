"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BodyDiagram } from "@/components/body-diagram";
import { estimate1RM } from "@/lib/fitness";
import type { Exercise, MuscleStatusMap } from "./exercise-preview-types";
import { previousSets, useWorkoutStore } from "@/stores/workout-store";

interface ExercisePreviewProps {
  exercise: Exercise | null;
  onOpenChange: (open: boolean) => void;
}

export function ExercisePreview({ exercise, onOpenChange }: ExercisePreviewProps) {
  const sessions = useWorkoutStore((s) => s.sessions);
  if (!exercise) return null;

  const status: MuscleStatusMap = { [exercise.muscle]: "high" };
  for (const m of exercise.secondary) status[m] = status[m] ?? "medium";

  const prev = previousSets(sessions, exercise.id);
  const best = prev.reduce(
    (acc, s) => (s.weight > acc.weight ? { weight: s.weight, reps: s.reps } : acc),
    { weight: 0, reps: 0 }
  );

  return (
    <Dialog open={!!exercise} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {exercise.name}
            {exercise.custom && (
              <span className="rounded-full border border-accent-border bg-accent-dim px-2 py-0.5 text-[0.65rem] font-normal text-accent">
                custom
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-4">
          <BodyDiagram status={status} className="h-44 w-auto shrink-0" />
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{exercise.muscle}</Badge>
              <Badge variant="outline">{exercise.equipment}</Badge>
              <Badge variant="outline">{exercise.difficulty}</Badge>
            </div>
            {exercise.secondary.length > 0 && (
              <p className="text-xs text-text-tertiary">
                Also works {exercise.secondary.join(", ")}
              </p>
            )}
            {best.weight > 0 && (
              <p className="text-xs text-text-secondary">
                Last best:{" "}
                <span className="font-mono text-text-primary">
                  {best.weight} lb × {best.reps}
                </span>{" "}
                <span className="text-text-tertiary">
                  (e1RM {estimate1RM(best.weight, best.reps)} lb)
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p>{exercise.instructions}</p>
          <p className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-secondary">
            {exercise.tip}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
