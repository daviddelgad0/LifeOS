"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { todayISO } from "@/lib/dates";
import { estimate1RM } from "@/lib/fitness";
import { suggestNextSet, type WhoopContext } from "@/lib/progression";
import { dayStreak } from "@/lib/streaks";
import { XP } from "@/lib/xp";
import {
  SEED_MEASUREMENTS,
  SEED_ROUTINES,
  SEED_SESSIONS,
} from "@/lib/seed";
import type {
  CardioEntry,
  Exercise,
  Measurement,
  Routine,
  SetEntry,
  WorkoutExercise,
  WorkoutSession,
} from "@/lib/types";
import { useAppStore } from "./app-store";
import { useWhoopStore } from "./whoop-store";

export interface RestTimer {
  endsAt: number;
  totalSeconds: number;
  label: string;
}

export interface LastPR {
  exerciseId: string;
  weight: number;
  reps: number;
  e1rm: number;
}

interface WorkoutState {
  sessions: WorkoutSession[];
  routines: Routine[];
  customExercises: Exercise[];
  measurements: Measurement[];
  manualGymDays: string[];
  active: WorkoutSession | null;
  restTimer: RestTimer | null;
  /** Ephemeral — set on PR hit, cleared by PRCelebration component. Not persisted. */
  lastPR: LastPR | null;
  /** Gyms the user trains at; weights are compared within the same gym. */
  gyms: string[];
  currentGym: string;

  startWorkout: (routine?: Routine) => void;
  discardWorkout: () => void;
  finishWorkout: (note?: string) => void;
  addExerciseToActive: (exerciseId: string) => void;
  removeExerciseFromActive: (weId: string) => void;
  moveExercise: (weId: string, dir: -1 | 1) => void;
  addSet: (weId: string) => void;
  updateSet: (weId: string, setId: string, patch: Partial<SetEntry>) => void;
  deleteSet: (weId: string, setId: string) => void;
  toggleSetComplete: (weId: string, setId: string) => void;
  setExerciseRest: (weId: string, seconds: number) => void;

  addCardio: (entry: Omit<CardioEntry, "id">) => void;
  updateCardio: (id: string, patch: Partial<CardioEntry>) => void;
  removeCardio: (id: string) => void;

  startRest: (seconds: number, label: string) => void;
  adjustRest: (deltaSeconds: number) => void;
  clearRest: () => void;
  clearLastPR: () => void;

  addGym: (name: string) => void;
  setCurrentGym: (name: string) => void;
  setActiveGym: (name: string) => void;

  addRoutine: (routine: Omit<Routine, "id">) => void;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  addCustomExercise: (ex: Omit<Exercise, "id" | "custom">) => void;
  logMeasurement: (m: Measurement) => void;
  toggleManualGymDay: (date: string) => void;
}

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// A session counts toward a gym's comparisons if it's at that gym, or has no
// gym recorded (legacy/untagged sessions count everywhere). No gym filter
// (undefined) means compare across all gyms.
function matchesGym(s: WorkoutSession, gym?: string): boolean {
  return !gym || !s.gym || s.gym === gym;
}

/** Best completed weight and e1RM for an exercise across saved sessions. */
function bestFor(sessions: WorkoutSession[], exerciseId: string, gym?: string) {
  let weight = 0;
  let e1rm = 0;
  for (const s of sessions) {
    if (!s.endedAt || !matchesGym(s, gym)) continue;
    for (const we of s.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const set of we.sets) {
        if (!set.completed || set.warmup) continue;
        weight = Math.max(weight, set.weight);
        e1rm = Math.max(e1rm, estimate1RM(set.weight, set.reps));
      }
    }
  }
  return { weight, e1rm };
}

/** Last saved session containing an exercise — powers the Previous column. */
export function previousSets(
  sessions: WorkoutSession[],
  exerciseId: string,
  gym?: string
): SetEntry[] {
  const sorted = [...sessions]
    .filter((s) => s.endedAt && matchesGym(s, gym))
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    const we = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (we) {
      const completed = we.sets.filter((x) => x.completed && !x.warmup);
      if (completed.length > 0) return completed;
    }
  }
  return [];
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      sessions: SEED_SESSIONS,
      routines: SEED_ROUTINES,
      customExercises: [],
      measurements: SEED_MEASUREMENTS,
      manualGymDays: [],
      active: null,
      restTimer: null,
      lastPR: null,
      gyms: ["LMU Gym", "LA Fitness"],
      currentGym: "LMU Gym",

      startWorkout: (routine) => {
        if (get().active) return;
        const { sessions, currentGym, customExercises } = get();
        const units = useAppStore.getState().units;
        const whoopState = useWhoopStore.getState();
        const whoop: WhoopContext = {
          connected: whoopState.connected,
          days: whoopState.days.map((d) => ({
            date: d.date,
            recovery: d.recovery,
          })),
        };
        const today = todayISO();
        const exercises: WorkoutExercise[] = (routine?.exercises ?? []).map(
          (re) => {
            const prev = previousSets(sessions, re.exerciseId, currentGym);
            const suggestion = suggestNextSet({
              sessions,
              active: null,
              exerciseId: re.exerciseId,
              setIndex: 0,
              gym: currentGym,
              routineTarget: { targetReps: re.targetReps },
              customExercises,
              units,
              whoop,
              todayISO: today,
            });
            return {
              id: newId(),
              exerciseId: re.exerciseId,
              restSeconds: re.restSeconds,
              sets: Array.from({ length: re.targetSets }, (_, i) => {
                if (
                  suggestion?.kind === "progress" ||
                  suggestion?.kind === "deload" ||
                  suggestion?.kind === "calibrate"
                ) {
                  return {
                    id: newId(),
                    weight: suggestion.weightLb,
                    reps: suggestion.repsLo,
                    rir: null,
                    completed: false,
                  };
                }
                const weight = prev[i]?.weight ?? prev[prev.length - 1]?.weight ?? 0;
                const prevReps = prev[i]?.reps ?? re.targetReps;
                const reps =
                  suggestion?.kind === "hold"
                    ? Math.min(prevReps + 1, suggestion.repsHi)
                    : prevReps;
                return { id: newId(), weight, reps, rir: null, completed: false };
              }),
            };
          }
        );
        set({
          active: {
            id: newId(),
            date: todayISO(),
            startedAt: Date.now(),
            endedAt: null,
            exercises,
            cardio: [],
            gym: currentGym,
          },
        });
      },

      discardWorkout: () => set({ active: null, restTimer: null }),

      finishWorkout: (note) => {
        const active = get().active;
        if (!active) return;
        const finished: WorkoutSession = {
          ...active,
          endedAt: Date.now(),
          note,
          exercises: active.exercises.filter((we) =>
            we.sets.some((s) => s.completed)
          ),
        };
        // Keep the session if it has completed lifts OR any logged cardio.
        if (
          finished.exercises.length === 0 &&
          (finished.cardio?.length ?? 0) === 0
        ) {
          set({ active: null, restTimer: null });
          return;
        }
        const sessions = [...get().sessions, finished];
        set({ sessions, active: null, restTimer: null });

        const app = useAppStore.getState();
        app.awardXP(XP.workout, "Workout completed");
        const prs = finished.exercises.reduce(
          (a, we) => a + we.sets.filter((s) => s.completed && s.pr).length,
          0
        );
        if (prs > 0) app.awardXP(XP.pr * prs, `${prs} PR${prs > 1 ? "s" : ""}`);

        app.unlockAchievement("first-workout");
        if (sessions.filter((s) => s.endedAt).length >= 10)
          app.unlockAchievement("ten-workouts");
        if (prs > 0) app.unlockAchievement("first-pr");

        const dates = new Set(
          sessions.filter((s) => s.endedAt).map((s) => s.date)
        );
        const streak = dayStreak(dates);
        if (streak >= 7) app.unlockAchievement("streak-7");
        if (streak >= 30) app.unlockAchievement("streak-30");
        if (streak > 0 && streak % 7 === 0)
          app.awardXP(XP.streak7Bonus, `${streak}-day streak bonus`);
      },

      addExerciseToActive: (exerciseId) =>
        set((s) => {
          if (!s.active) return s;
          const prev = previousSets(s.sessions, exerciseId, s.active.gym);
          return {
            active: {
              ...s.active,
              exercises: [
                ...s.active.exercises,
                {
                  id: newId(),
                  exerciseId,
                  restSeconds: useAppStore.getState().defaultRestSeconds,
                  sets: Array.from(
                    { length: Math.max(prev.length, 3) },
                    (_, i) => ({
                      id: newId(),
                      // Autofill from last session; extra sets fall back to the
                      // last logged set so weights/reps carry over, not reset.
                      weight: prev[i]?.weight ?? prev[prev.length - 1]?.weight ?? 0,
                      reps: prev[i]?.reps ?? prev[prev.length - 1]?.reps ?? 8,
                      rir: null,
                      completed: false,
                    })
                  ),
                },
              ],
            },
          };
        }),

      removeExerciseFromActive: (weId) =>
        set((s) =>
          s.active
            ? {
                active: {
                  ...s.active,
                  exercises: s.active.exercises.filter((e) => e.id !== weId),
                },
              }
            : s
        ),

      moveExercise: (weId, dir) =>
        set((s) => {
          if (!s.active) return s;
          const list = [...s.active.exercises];
          const i = list.findIndex((e) => e.id === weId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= list.length) return s;
          [list[i], list[j]] = [list[j], list[i]];
          return { active: { ...s.active, exercises: list } };
        }),

      addSet: (weId) =>
        set((s) => {
          if (!s.active) return s;
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((we) => {
                if (we.id !== weId) return we;
                const last = we.sets[we.sets.length - 1];
                return {
                  ...we,
                  sets: [
                    ...we.sets,
                    {
                      id: newId(),
                      weight: last?.weight ?? 0,
                      reps: last?.reps ?? 8,
                      rir: null,
                      completed: false,
                    },
                  ],
                };
              }),
            },
          };
        }),

      updateSet: (weId, setId, patch) =>
        set((s) => {
          if (!s.active) return s;
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((we) =>
                we.id === weId
                  ? {
                      ...we,
                      sets: we.sets.map((x) =>
                        x.id === setId ? { ...x, ...patch } : x
                      ),
                    }
                  : we
              ),
            },
          };
        }),

      deleteSet: (weId, setId) =>
        set((s) => {
          if (!s.active) return s;
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((we) =>
                we.id === weId
                  ? { ...we, sets: we.sets.filter((x) => x.id !== setId) }
                  : we
              ),
            },
          };
        }),

      toggleSetComplete: (weId, setId) => {
        const state = get();
        if (!state.active) return;
        const we = state.active.exercises.find((e) => e.id === weId);
        const target = we?.sets.find((x) => x.id === setId);
        if (!we || !target) return;

        if (target.completed) {
          state.updateSet(weId, setId, { completed: false, pr: false });
          return;
        }
        const best = bestFor(state.sessions, we.exerciseId, state.active.gym);
        const newE1rm = estimate1RM(target.weight, target.reps);
        const pr =
          !target.warmup &&
          target.weight > 0 &&
          (target.weight > best.weight || newE1rm > best.e1rm);
        state.updateSet(weId, setId, { completed: true, pr });
        state.startRest(we.restSeconds, "Rest");
        if (pr) {
          set({ lastPR: { exerciseId: we.exerciseId, weight: target.weight, reps: target.reps, e1rm: newE1rm } });
          if (typeof navigator !== "undefined" && "vibrate" in navigator)
            navigator.vibrate([100, 50, 100, 50, 200]);
        }
      },

      clearLastPR: () => set({ lastPR: null }),

      setExerciseRest: (weId, seconds) =>
        set((s) => {
          if (!s.active) return s;
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((we) =>
                we.id === weId ? { ...we, restSeconds: seconds } : we
              ),
            },
          };
        }),

      startRest: (seconds, label) =>
        set({
          restTimer: {
            endsAt: Date.now() + seconds * 1000,
            totalSeconds: seconds,
            label,
          },
        }),

      adjustRest: (delta) =>
        set((s) =>
          s.restTimer
            ? {
                restTimer: {
                  ...s.restTimer,
                  endsAt: Math.max(Date.now(), s.restTimer.endsAt + delta * 1000),
                  totalSeconds: Math.max(0, s.restTimer.totalSeconds + delta),
                },
              }
            : s
        ),

      clearRest: () => set({ restTimer: null }),

      addGym: (name) =>
        set((s) => {
          const n = name.trim();
          if (!n || s.gyms.includes(n)) return { currentGym: n || s.currentGym };
          return { gyms: [...s.gyms, n], currentGym: n };
        }),

      setCurrentGym: (name) => set({ currentGym: name }),

      // Change the in-progress session's gym (and remember it as the default).
      setActiveGym: (name) =>
        set((s) => ({
          currentGym: name,
          active: s.active ? { ...s.active, gym: name } : s.active,
        })),

      addCardio: (entry) =>
        set((s) =>
          s.active
            ? {
                active: {
                  ...s.active,
                  cardio: [...(s.active.cardio ?? []), { ...entry, id: newId() }],
                },
              }
            : s
        ),

      updateCardio: (id, patch) =>
        set((s) =>
          s.active
            ? {
                active: {
                  ...s.active,
                  cardio: (s.active.cardio ?? []).map((c) =>
                    c.id === id ? { ...c, ...patch } : c
                  ),
                },
              }
            : s
        ),

      removeCardio: (id) =>
        set((s) =>
          s.active
            ? {
                active: {
                  ...s.active,
                  cardio: (s.active.cardio ?? []).filter((c) => c.id !== id),
                },
              }
            : s
        ),

      addRoutine: (routine) =>
        set((s) => ({ routines: [...s.routines, { ...routine, id: newId() }] })),

      updateRoutine: (id, patch) =>
        set((s) => ({
          routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),

      deleteRoutine: (id) =>
        set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),

      addCustomExercise: (ex) =>
        set((s) => ({
          customExercises: [
            { ...ex, id: `custom-${newId()}`, custom: true },
            ...s.customExercises,
          ],
        })),

      logMeasurement: (m) =>
        set((s) => ({
          measurements: [
            ...s.measurements.filter((x) => x.date !== m.date),
            { ...s.measurements.find((x) => x.date === m.date), ...m },
          ].sort((a, b) => a.date.localeCompare(b.date)),
        })),

      toggleManualGymDay: (date) =>
        set((s) => ({
          manualGymDays: s.manualGymDays.includes(date)
            ? s.manualGymDays.filter((d) => d !== date)
            : [...s.manualGymDays, date],
        })),
    }),
    {
      name: "lifeos-workouts",
      partialize: (s) => ({
        sessions: s.sessions,
        routines: s.routines,
        customExercises: s.customExercises,
        measurements: s.measurements,
        manualGymDays: s.manualGymDays,
        active: s.active,
        restTimer: s.restTimer,
        gyms: s.gyms,
        currentGym: s.currentGym,
      }),
    }
  )
);

export function gymDayDates(
  sessions: WorkoutSession[],
  manualGymDays: string[]
): Set<string> {
  const dates = new Set(manualGymDays);
  for (const s of sessions) if (s.endedAt) dates.add(s.date);
  return dates;
}
