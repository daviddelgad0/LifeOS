"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Dumbbell,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { ExercisePreview } from "@/components/exercise-preview";
import { RoutineEditor } from "@/components/gym/routine-editor";
import { CustomExerciseDialog } from "@/components/gym/custom-exercise-dialog";
import { GymSelector } from "@/components/gym/gym-selector";
import { WorkoutHistory } from "@/components/gym/workout-history";
import { allExercises, getExercise } from "@/lib/exercises";
import { MUSCLES } from "@/lib/fitness";
import {
  READINESS_COLOR,
  readiness,
  readinessCopy,
} from "@/lib/whoop";
import { useWhoopToday } from "@/stores/whoop-store";
import type { Exercise, Muscle, Routine } from "@/lib/types";
import { useWorkoutStore } from "@/stores/workout-store";
import { cn } from "@/lib/utils";

export function GymLogTab() {
  const router = useRouter();
  const active = useWorkoutStore((s) => s.active);
  const routines = useWorkoutStore((s) => s.routines);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const deleteRoutine = useWorkoutStore((s) => s.deleteRoutine);

  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  const [preview, setPreview] = useState<Exercise | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "all">("all");

  const library = useMemo(
    () =>
      allExercises(customExercises).filter(
        (e) =>
          (muscle === "all" || e.muscle === muscle) &&
          (query === "" ||
            e.name.toLowerCase().includes(query.toLowerCase()) ||
            e.equipment.includes(query.toLowerCase()))
      ),
    [customExercises, query, muscle]
  );

  const begin = (routine?: Routine) => {
    startWorkout(routine);
    router.push("/gym/workout");
  };

  const whoop = useWhoopToday();

  return (
    <div className="flex flex-col gap-8">
      {!active && (
        <p
          className="rounded-xl border bg-surface px-4 py-3 text-sm text-text-secondary"
          style={{
            borderColor: `color-mix(in srgb, ${READINESS_COLOR[readiness(whoop.recovery)]} 35%, transparent)`,
          }}
        >
          {readinessCopy(whoop)}
        </p>
      )}
      {active && (
        <button
          type="button"
          onClick={() => router.push("/gym/workout")}
          className="flex items-center justify-between rounded-xl border border-accent-border bg-accent-dim px-4 py-3 text-left transition-transform hover:scale-[1.01]"
        >
          <div>
            <p className="text-sm font-medium text-accent">
              Workout in progress
            </p>
            <p className="text-xs text-text-secondary">
              Started{" "}
              {new Date(active.startedAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              — tap to resume
            </p>
          </div>
          <ArrowRight className="size-4 text-accent" />
        </button>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-text-tertiary">Training at</span>
        <GymSelector className="w-40" />
        <span className="text-[0.65rem] text-text-tertiary">
          — weights compare within a gym
        </span>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-tertiary">Routines</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
              <Plus data-icon="inline-start" className="size-3.5" />
              New routine
            </Button>
            <Button size="sm" onClick={() => begin()} disabled={!!active}>
              Start empty workout
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {routines.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-hover"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-text-tertiary">
                    {r.exercises.length} exercises ·{" "}
                    {r.exercises.reduce((a, e) => a + e.targetSets, 0)} sets
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`${r.name} options`}
                    className="rounded p-1 text-text-tertiary transition-colors hover:bg-muted hover:text-text-primary"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(r)}>
                      <Pencil className="size-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => deleteRoutine(r.id)}
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="line-clamp-2 text-xs text-text-secondary">
                {r.exercises
                  .map((e) => getExercise(e.exerciseId, customExercises)?.name)
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-auto"
                disabled={!!active}
                onClick={() => begin(r)}
              >
                <Play data-icon="inline-start" className="size-3.5" />
                Start
              </Button>
            </div>
          ))}
        </div>
        {routines.length === 0 && (
          <EmptyState
            icon={Dumbbell}
            description="No routines yet. Build one and your next session starts in two taps."
            actionLabel="New routine"
            onAction={() => setEditing("new")}
          />
        )}
      </section>

      <WorkoutHistory />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-tertiary">
            Exercise library
          </h2>
          <Button variant="outline" size="sm" onClick={() => setCustomOpen(true)}>
            <Plus data-icon="inline-start" className="size-3.5" />
            Custom exercise
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 150+ exercises"
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
        <div className="grid gap-2 sm:grid-cols-2">
          {library.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setPreview(e)}
              className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-border-hover"
            >
              <span className="flex items-center gap-2 truncate text-sm">
                {e.name}
                {e.custom && (
                  <span className="shrink-0 rounded-full border border-accent-border bg-accent-dim px-1.5 text-[0.6rem] text-accent">
                    custom
                  </span>
                )}
              </span>
              <span className="flex shrink-0 gap-1">
                <Badge variant="outline">{e.muscle}</Badge>
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {e.equipment}
                </Badge>
              </span>
            </button>
          ))}
        </div>
        {library.length === 0 && (
          <p className="py-6 text-center text-sm text-text-tertiary">
            Nothing matches that search.
          </p>
        )}
      </section>

      <RoutineEditor
        routine={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <ExercisePreview exercise={preview} onOpenChange={() => setPreview(null)} />
      <CustomExerciseDialog open={customOpen} onOpenChange={setCustomOpen} />
    </div>
  );
}
