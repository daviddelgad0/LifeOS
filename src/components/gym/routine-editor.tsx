"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExercisePicker } from "@/components/exercise-picker";
import { getExercise } from "@/lib/exercises";
import type { Routine, RoutineExercise } from "@/lib/types";
import { useWorkoutStore } from "@/stores/workout-store";

interface RoutineEditorProps {
  routine: Routine | null; // null = creating new
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoutineEditor({ routine, open, onOpenChange }: RoutineEditorProps) {
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const addRoutine = useWorkoutStore((s) => s.addRoutine);
  const updateRoutine = useWorkoutStore((s) => s.updateRoutine);

  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reload the draft when a different routine (or a fresh open) comes in —
  // render-time state adjustment keeps this out of effects.
  const draftKey = open ? (routine?.id ?? "new") : "closed";
  const [loadedKey, setLoadedKey] = useState("closed");
  if (draftKey !== loadedKey) {
    setLoadedKey(draftKey);
    if (open) {
      setName(routine?.name ?? "");
      setExercises(routine?.exercises ?? []);
    }
  }

  const patch = (i: number, p: Partial<RoutineExercise>) =>
    setExercises((list) =>
      list.map((e, idx) => (idx === i ? { ...e, ...p } : e))
    );

  const move = (i: number, dir: -1 | 1) =>
    setExercises((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = () => {
    if (!name.trim() || exercises.length === 0) return;
    if (routine) updateRoutine(routine.id, { name: name.trim(), exercises });
    else addRoutine({ name: name.trim(), exercises });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>{routine ? "Edit routine" : "New routine"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="routine-name">Name</Label>
          <Input
            id="routine-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Push, Legs, Upper…"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-1">
          {exercises.map((re, i) => {
            const ex = getExercise(re.exerciseId, customExercises);
            return (
              <div
                key={`${re.exerciseId}-${i}`}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {ex?.name ?? re.exerciseId}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                      className="rounded p-1 text-text-tertiary transition-colors hover:bg-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === exercises.length - 1}
                      aria-label="Move down"
                      className="rounded p-1 text-text-tertiary transition-colors hover:bg-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExercises((l) => l.filter((_, idx) => idx !== i))
                      }
                      aria-label="Remove exercise"
                      className="rounded p-1 text-text-tertiary transition-colors hover:bg-muted hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1 text-xs text-text-tertiary">
                    Sets
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={re.targetSets}
                      onChange={(e) =>
                        patch(i, { targetSets: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-text-tertiary">
                    Reps
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={re.targetReps}
                      onChange={(e) =>
                        patch(i, { targetReps: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-text-tertiary">
                    Rest (s)
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={15}
                      value={re.restSeconds}
                      onChange={(e) =>
                        patch(i, { restSeconds: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus data-icon="inline-start" className="size-3.5" />
            Add exercise
          </Button>
        </div>
        <Button onClick={save} disabled={!name.trim() || exercises.length === 0}>
          Save routine
        </Button>
        <ExercisePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onPick={(ex) =>
            setExercises((l) => [
              ...l,
              { exerciseId: ex.id, targetSets: 3, targetReps: 8, restSeconds: 120 },
            ])
          }
        />
      </DialogContent>
    </Dialog>
  );
}
