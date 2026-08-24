"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  MoreHorizontal,
  Plus,
  StickyNote,
  Timer,
  Trash2,
  X,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ExercisePicker } from "@/components/exercise-picker";
import { CardioSheet, type CardioTarget } from "@/components/gym/cardio-sheet";
import { GymSelector } from "@/components/gym/gym-selector";
import { MuscleBodyMap } from "@/components/gym/muscle-body-map";
import { PRCelebration } from "@/components/gym/pr-celebration";
import { RestTimerBar } from "@/components/gym/rest-timer-bar";
import {
  SetEditorSheet,
  type SetEditorTarget,
} from "@/components/gym/set-editor-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useCountUp } from "@/hooks/use-count-up";
import { formatNumber } from "@/lib/format";
import { getExercise } from "@/lib/exercises";
import {
  estimate1RM,
  sessionCalories,
  sessionDurationMin,
  sessionSetsByMuscle,
  sessionVolume,
} from "@/lib/fitness";
import {
  progressionLadder,
  suggestNextSet,
  type LadderRung,
  type SetSuggestion,
  type WhoopContext,
} from "@/lib/progression";
import { todayISO } from "@/lib/dates";
import type { CardioEntry, Muscle, SetEntry, WorkoutExercise } from "@/lib/types";
import { previousSets, useWorkoutStore } from "@/stores/workout-store";
import { useAppStore } from "@/stores/app-store";
import { useWhoopStore } from "@/stores/whoop-store";
import { toDisplayWeight, toDisplayTotal } from "@/lib/units";
import { cn } from "@/lib/utils";

function useTick(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Keep the screen awake mid-workout (best effort). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        if (!nav.wakeLock) return;
        const acquired = await nav.wakeLock.request("screen");
        if (cancelled) acquired.release();
        else lock = acquired;
      } catch {
        // Denied or unsupported — non-fatal.
      }
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release();
    };
  }, []);
}

function SetRow({
  we,
  set,
  index,
  prev,
  exerciseName,
  isBarbell,
  onEdit,
}: {
  we: WorkoutExercise;
  set: SetEntry;
  index: number;
  prev: SetEntry | undefined;
  exerciseName: string;
  isBarbell: boolean;
  onEdit: (t: SetEditorTarget) => void;
}) {
  const toggleSetComplete = useWorkoutStore((s) => s.toggleSetComplete);
  const deleteSet = useWorkoutStore((s) => s.deleteSet);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const units = useAppStore((s) => s.units);
  const wDisp = (lb: number) => toDisplayWeight(lb, units);

  const open = (field: SetEditorTarget["field"]) =>
    onEdit({
      field,
      weId: we.id,
      setId: set.id,
      exerciseName,
      isBarbell,
      value:
        field === "weight" ? set.weight : field === "reps" ? set.reps : set.rir ?? 2,
      note: set.note,
    });

  const chip =
    "flex h-11 items-center justify-center rounded-lg border border-border bg-surface-raised font-mono text-sm transition-colors hover:border-border-hover";

  return (
    <motion.div
      layout
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.35}
      onDragEnd={(_, info) => {
        if (info.offset.x < -110) deleteSet(we.id, set.id);
      }}
      className={cn(
        "grid grid-cols-[1.5rem_3.5rem_1fr_1fr_2.75rem_2.75rem] items-center gap-2",
        set.pr && "rounded-lg bg-accent-dim/40"
      )}
    >
      <button
        type="button"
        onClick={() => updateSet(we.id, set.id, { warmup: !set.warmup })}
        aria-label={set.warmup ? "Unmark warm-up set" : "Mark as warm-up set"}
        className={cn(
          "text-center font-mono text-xs transition-colors",
          set.warmup ? "text-amber-500" : "text-text-tertiary hover:text-text-secondary"
        )}
      >
        {set.warmup ? "W" : index + 1}
      </button>
      <button
        type="button"
        onClick={() =>
          prev && updateSet(we.id, set.id, { weight: prev.weight, reps: prev.reps })
        }
        disabled={!prev}
        aria-label={prev ? `Copy previous ${wDisp(prev.weight)} by ${prev.reps}` : "No previous data"}
        className={cn(
          "h-11 truncate rounded-lg text-center font-mono text-xs leading-[2.75rem] text-text-tertiary transition-colors",
          prev ? "hover:bg-muted hover:text-text-secondary" : "cursor-default"
        )}
      >
        {prev ? `${wDisp(prev.weight)}×${prev.reps}` : "—"}
      </button>
      <button type="button" onClick={() => open("weight")} className={chip}>
        {set.weight ? wDisp(set.weight) : "—"}
      </button>
      <button type="button" onClick={() => open("reps")} className={chip}>
        {set.reps || "—"}
      </button>
      <button
        type="button"
        onClick={() => open("rir")}
        aria-label="RIR"
        className={cn(chip, "text-xs", set.rir === null && "text-text-tertiary")}
      >
        {set.rir === null ? "RIR" : set.rir === 6 ? "5+" : set.rir}
      </button>
      <button
        type="button"
        onClick={() => toggleSetComplete(we.id, set.id)}
        aria-label={set.completed ? "Mark set incomplete" : "Complete set"}
        className={cn(
          "flex h-11 items-center justify-center rounded-lg border transition-colors",
          set.completed
            ? "border-accent bg-accent text-background"
            : "border-border-hover text-text-tertiary hover:border-accent hover:text-accent"
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </button>
    </motion.div>
  );
}

function cardioSummary(c: CardioEntry): string {
  const parts = [`${c.durationMin} min`];
  if (c.distanceMi) parts.push(`${c.distanceMi} mi`);
  if (c.incline) parts.push(`${c.incline}% incline`);
  if (c.speed) parts.push(`${c.speed} mph`);
  if (c.calories) parts.push(`${c.calories} kcal`);
  return parts.join(" · ");
}

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const active = useWorkoutStore((s) => s.active);
  const sessions = useWorkoutStore((s) => s.sessions);
  const routines = useWorkoutStore((s) => s.routines);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const addSet = useWorkoutStore((s) => s.addSet);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const addExerciseToActive = useWorkoutStore((s) => s.addExerciseToActive);
  const removeExerciseFromActive = useWorkoutStore((s) => s.removeExerciseFromActive);
  const moveExercise = useWorkoutStore((s) => s.moveExercise);
  const setExerciseRest = useWorkoutStore((s) => s.setExerciseRest);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const discardWorkout = useWorkoutStore((s) => s.discardWorkout);
  const lastPR = useWorkoutStore((s) => s.lastPR);
  const clearLastPR = useWorkoutStore((s) => s.clearLastPR);
  const addCardio = useWorkoutStore((s) => s.addCardio);
  const updateCardio = useWorkoutStore((s) => s.updateCardio);
  const removeCardio = useWorkoutStore((s) => s.removeCardio);
  const units = useAppStore((s) => s.units);
  const currentGym = useWorkoutStore((s) => s.currentGym);
  const whoopConnected = useWhoopStore((s) => s.connected);
  const whoopDays = useWhoopStore((s) => s.days);

  const [editor, setEditor] = useState<SetEditorTarget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [cardioTarget, setCardioTarget] = useState<CardioTarget | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [note, setNote] = useState("");
  const [mapSide, setMapSide] = useState<"front" | "back">("front");
  const [ladderFor, setLadderFor] = useState<string | null>(null);

  useWakeLock();
  const now = useTick(1000);

  const prevByExercise = useMemo(() => {
    const map = new Map<string, SetEntry[]>();
    if (!active) return map;
    for (const we of active.exercises) {
      if (!map.has(we.exerciseId))
        map.set(we.exerciseId, previousSets(sessions, we.exerciseId));
    }
    return map;
  }, [active, sessions]);

  const suggestionByExercise = useMemo(() => {
    const map = new Map<string, SetSuggestion | null>();
    if (!active) return map;
    const whoop: WhoopContext = {
      connected: whoopConnected,
      days: whoopDays.map((d) => ({ date: d.date, recovery: d.recovery })),
    };
    const today = todayISO();
    const routine = routines.find((r) => r.id === active.routineId);
    for (const we of active.exercises) {
      const firstUncompleted = we.sets.findIndex((s) => !s.completed);
      if (firstUncompleted === -1) continue;
      const re = routine?.exercises.find((x) => x.exerciseId === we.exerciseId);
      map.set(
        we.exerciseId,
        suggestNextSet({
          sessions,
          active,
          exerciseId: we.exerciseId,
          setIndex: firstUncompleted,
          gym: active.gym ?? currentGym,
          routineTarget: re && {
            targetReps: re.targetReps,
            repLo: re.repLo,
            repHi: re.repHi,
            stepLb: re.stepLb,
          },
          customExercises,
          units,
          whoop,
          todayISO: today,
        })
      );
    }
    return map;
  }, [active, sessions, customExercises, units, currentGym, whoopConnected, whoopDays, routines]);

  const ladderByExercise = useMemo(() => {
    const map = new Map<string, LadderRung[] | null>();
    if (!active) return map;
    const routine = routines.find((r) => r.id === active.routineId);
    for (const we of active.exercises) {
      if (map.has(we.exerciseId)) continue;
      const re = routine?.exercises.find((x) => x.exerciseId === we.exerciseId);
      map.set(
        we.exerciseId,
        progressionLadder({
          sessions,
          exerciseId: we.exerciseId,
          gym: active.gym ?? currentGym,
          routineTarget: re && {
            targetReps: re.targetReps,
            repLo: re.repLo,
            repHi: re.repHi,
            stepLb: re.stepLb,
          },
          customExercises,
          units,
        })
      );
    }
    return map;
  }, [active, sessions, customExercises, units, currentGym, routines]);

  const volume = active ? sessionVolume(active) : 0;
  const volumeDisplay = toDisplayTotal(volume, units);
  const animatedVolume = useCountUp(volumeDisplay);

  if (!active) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <EmptyState
          icon={Dumbbell}
          description="No workout in progress."
          actionLabel="Back to Gym"
          onAction={() => router.push("/gym")}
        />
      </div>
    );
  }

  const elapsed = Math.max(0, now - active.startedAt);
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  const prCount = active.exercises.reduce(
    (a, we) => a + we.sets.filter((s) => s.completed && s.pr).length,
    0
  );
  const completedSets = active.exercises.reduce(
    (a, we) => a + we.sets.filter((s) => s.completed).length,
    0
  );
  const musclesHit = [
    ...new Set(
      active.exercises
        .filter((we) => we.sets.some((s) => s.completed))
        .map((we) => getExercise(we.exerciseId, customExercises)?.muscle)
        .filter((m): m is Muscle => !!m)
    ),
  ];
  const editorExercise = editor
    ? active.exercises.find((w) => w.id === editor.weId)
    : undefined;
  const editorSuggestion = editorExercise
    ? suggestionByExercise.get(editorExercise.exerciseId) ?? null
    : null;

  return (
    <div className="flex min-h-screen flex-col pb-40">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[0.65rem] text-text-tertiary">time</span>
              <span className="font-mono text-lg font-medium leading-none">
                {mins}:{String(secs).padStart(2, "0")}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[0.65rem] text-text-tertiary">volume</span>
              <span className="font-mono text-lg font-medium leading-none">
                {formatNumber(animatedVolume)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[0.65rem] text-text-tertiary">PRs</span>
              <span
                className={cn(
                  "font-mono text-lg font-medium leading-none",
                  prCount > 0 && "text-accent"
                )}
              >
                {prCount}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDiscard(true)}
            >
              <X data-icon="inline-start" className="size-3.5" />
              Discard
            </Button>
            <Button size="sm" onClick={() => setEndOpen(true)}>
              End workout
            </Button>
          </div>
        </div>
        <div className="mx-auto -mt-1 flex max-w-3xl items-center gap-2 px-4 pb-2">
          <GymSelector forActive className="w-40" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4">
        {active.exercises.length === 0 && (
          <EmptyState
            icon={Dumbbell}
            description="Empty session. Add your first exercise."
            actionLabel="Add exercise"
            onAction={() => setPickerOpen(true)}
          />
        )}
        {active.exercises.map((we, i) => {
          const ex = getExercise(we.exerciseId, customExercises);
          const prev = prevByExercise.get(we.exerciseId) ?? [];
          const isBarbell = ex?.equipment === "barbell";
          const topSet = we.sets.reduce(
            (best, s) =>
              s.completed && !s.warmup && s.weight * s.reps > best.weight * best.reps
                ? s
                : best,
            { weight: 0, reps: 0 } as Pick<SetEntry, "weight" | "reps">
          );
          const suggestion = suggestionByExercise.get(we.exerciseId) ?? null;
          const firstUncompleted = we.sets.find((s) => !s.completed);
          const ladder = ladderByExercise.get(we.exerciseId) ?? null;
          return (
            <section
              key={we.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-sm font-medium">
                    {ex?.name ?? we.exerciseId}
                  </h2>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-text-tertiary">
                    {ex?.muscle}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {topSet.weight > 0 && (
                    <span className="mr-1 font-mono text-[0.65rem] text-text-tertiary">
                      e1RM {toDisplayWeight(estimate1RM(topSet.weight, topSet.reps), units)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-mono text-[0.65rem] text-text-tertiary">
                    <Timer className="size-3" />
                    {we.restSeconds}s
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="Exercise options"
                      className="rounded p-1 text-text-tertiary transition-colors hover:bg-muted hover:text-text-primary"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => moveExercise(we.id, -1)} disabled={i === 0}>
                        <ArrowUp className="size-3.5" /> Move up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => moveExercise(we.id, 1)}
                        disabled={i === active.exercises.length - 1}
                      >
                        <ArrowDown className="size-3.5" /> Move down
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          setExerciseRest(
                            we.id,
                            we.restSeconds >= 180 ? 60 : we.restSeconds + 30
                          )
                        }
                      >
                        <Timer className="size-3.5" /> Rest: {we.restSeconds}s (tap to cycle)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => removeExerciseFromActive(we.id)}
                      >
                        <Trash2 className="size-3.5" /> Remove exercise
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {suggestion && firstUncompleted && (
                <div className="flex flex-col gap-2 rounded-lg border border-accent-border bg-accent-dim px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-mono text-xs text-accent">
                        Next: {toDisplayWeight(suggestion.weightLb, units)} {units} ×{" "}
                        {suggestion.repsLo}–{suggestion.repsHi} @ {suggestion.targetRir} RIR
                      </span>
                      <span className="truncate text-xs text-text-tertiary">
                        {suggestion.reason}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {ladder && (
                        <button
                          type="button"
                          aria-label={ladderFor === we.id ? "Hide progression path" : "Show progression path"}
                          onClick={() => setLadderFor(ladderFor === we.id ? null : we.id)}
                          className="rounded p-1.5 text-accent transition-colors hover:bg-accent-dim"
                        >
                          {ladderFor === we.id ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                        </button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateSet(we.id, firstUncompleted.id, {
                            weight: suggestion.weightLb,
                            reps: suggestion.repsLo,
                          })
                        }
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                  {ladderFor === we.id && ladder && (
                    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised px-3 py-2">
                      {ladder.map((r, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            "font-mono text-xs",
                            r.jump ? "text-accent" : "text-text-secondary"
                          )}
                        >
                          {r.jump ? "→ " : ""}
                          {toDisplayWeight(r.weightLb, units)} {units} × {r.reps}
                          {r.jump ? " (add weight)" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-[1.5rem_3.5rem_1fr_1fr_2.75rem_2.75rem] gap-2 text-center text-[0.65rem] text-text-tertiary">
                <span>set</span>
                <span>prev</span>
                <span>{units}</span>
                <span>reps</span>
                <span>RIR</span>
                <span />
              </div>

              <div className="flex flex-col gap-2">
                {we.sets.map((set, idx) => (
                  <div key={set.id} className="flex flex-col gap-1">
                    <SetRow
                      we={we}
                      set={set}
                      index={idx}
                      prev={prev[idx] ?? prev[prev.length - 1]}
                      exerciseName={ex?.name ?? we.exerciseId}
                      isBarbell={isBarbell}
                      onEdit={setEditor}
                    />
                    {set.note && (
                      <span className="pl-8 text-xs text-text-tertiary">
                        “{set.note}”
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => addSet(we.id)}>
                  <Plus data-icon="inline-start" className="size-3.5" />
                  Add set
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    we.sets.length > 0 &&
                    setEditor({
                      field: "note",
                      weId: we.id,
                      setId: we.sets[we.sets.length - 1].id,
                      exerciseName: ex?.name ?? we.exerciseId,
                      isBarbell,
                      value: 0,
                      note: we.sets[we.sets.length - 1].note,
                    })
                  }
                >
                  <StickyNote data-icon="inline-start" className="size-3.5" />
                  Note
                </Button>
              </div>
            </section>
          );
        })}

        {active.exercises.length > 0 && (
          <Button variant="outline" onClick={() => setPickerOpen(true)}>
            <Plus data-icon="inline-start" className="size-4" />
            Add exercise
          </Button>
        )}

        {/* Cardio */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-tertiary">Cardio</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setCardioTarget({ id: null, entry: { type: "Incline walk", durationMin: 0 } })
              }
            >
              <Plus data-icon="inline-start" className="size-4" />
              Add cardio
            </Button>
          </div>
          {(active.cardio ?? []).map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3"
            >
              <button
                type="button"
                onClick={() => setCardioTarget({ id: c.id, entry: c })}
                className="flex flex-1 flex-col text-left"
              >
                <span className="text-sm font-medium">{c.type}</span>
                <span className="font-mono text-xs text-text-tertiary">
                  {cardioSummary(c)}
                </span>
              </button>
              <button
                type="button"
                aria-label="Delete cardio"
                onClick={() => removeCardio(c.id)}
                className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-muted hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </section>

        <p className="text-center text-xs text-text-tertiary">
          Swipe a set left to delete it. Tap prev to copy last session. Tap
          the set number to mark a warm-up.
        </p>
      </main>

      <RestTimerBar />

      <SetEditorSheet
        target={editor}
        suggestion={editorSuggestion}
        onClose={() => setEditor(null)}
        onCommit={(patch) => {
          if (editor) updateSet(editor.weId, editor.setId, patch);
        }}
      />

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(ex) => addExerciseToActive(ex.id)}
      />

      <CardioSheet
        target={cardioTarget}
        onClose={() => setCardioTarget(null)}
        onSave={(id, entry) => {
          if (id) updateCardio(id, entry);
          else addCardio(entry);
        }}
      />

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Workout summary</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <p className="text-xs text-text-tertiary">Total time</p>
              <p className="font-mono text-xl font-medium">
                {sessionDurationMin(active)} min
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <p className="text-xs text-text-tertiary">Volume</p>
              <p className="font-mono text-xl font-medium">
                {formatNumber(volumeDisplay)} {units}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <p className="text-xs text-text-tertiary">PRs hit</p>
              <p
                className={cn(
                  "font-mono text-xl font-medium",
                  prCount > 0 && "text-accent"
                )}
              >
                {prCount}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <p className="text-xs text-text-tertiary">Est. calories</p>
              <p className="font-mono text-xl font-medium">
                {sessionCalories(active)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <MuscleBodyMap
              side={mapSide}
              sets={sessionSetsByMuscle(active, customExercises)}
              mode="load"
              labels
              className="max-w-[16rem]"
            />
            <div className="flex gap-1">
              {(["front", "back"] as const).map((s) => (
                <Button
                  key={s}
                  variant={mapSide === s ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setMapSide(s)}
                >
                  {s === "front" ? "Front" : "Back"}
                </Button>
              ))}
            </div>
          </div>
          {musclesHit.length > 0 && (
            <p className="text-xs text-text-secondary">
              Trained: {musclesHit.join(", ")}
            </p>
          )}
          {(active.cardio?.length ?? 0) > 0 && (
            <p className="text-xs text-text-secondary">
              Cardio:{" "}
              {active.cardio!
                .map((c) => `${c.type} ${c.durationMin}m`)
                .join(", ")}
            </p>
          )}
          {completedSets === 0 && (active.cardio?.length ?? 0) === 0 && (
            <p className="text-xs text-warning">
              Nothing logged — ending now will discard this session.
            </p>
          )}
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Workout note (optional)"
            rows={2}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEndOpen(false)}>
              Keep going
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                finishWorkout(note.trim() || undefined);
                router.push("/gym");
              }}
            >
              Save workout
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Discard this workout?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            {completedSets} completed set{completedSets === 1 ? "" : "s"} will be
            lost. This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmDiscard(false)}
            >
              Keep workout
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                discardWorkout();
                router.push("/gym");
              }}
            >
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed left-4 top-3 z-40 md:hidden" aria-hidden>
        <Link href="/gym" className="sr-only">
          Back to gym
        </Link>
      </div>

      <AnimatePresence>
        {lastPR && (
          <PRCelebration
            key="pr-celebration"
            exerciseName={
              getExercise(lastPR.exerciseId, customExercises)?.name ?? null
            }
            weight={lastPR.weight}
            reps={lastPR.reps}
            onDismiss={clearLastPR}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
