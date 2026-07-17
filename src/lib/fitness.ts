import { addDays, daysBetween, startOfWeek } from "./dates";
import { getExercise } from "./exercises";
import type { Exercise, Muscle, WorkoutSession } from "./types";
import type { WeightUnit } from "./units";

export const MUSCLES: Muscle[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
];

export interface MuscleLandmark {
  /** Minimum effective volume — sets/week below this produce little adaptation. */
  mev: number;
  /** Maximum recoverable volume — sets/week above this outpaces recovery. */
  mrv: number;
}

/** RP Strength / Israetel volume landmarks, conservative beginner–intermediate range. */
export const VOLUME_LANDMARKS: Record<Muscle, MuscleLandmark> = {
  chest:      { mev: 8,  mrv: 22 },
  back:       { mev: 10, mrv: 25 },
  shoulders:  { mev: 6,  mrv: 20 },
  biceps:     { mev: 8,  mrv: 26 },
  triceps:    { mev: 6,  mrv: 22 },
  forearms:   { mev: 4,  mrv: 14 },
  core:       { mev: 0,  mrv: 16 },
  quads:      { mev: 8,  mrv: 20 },
  hamstrings: { mev: 6,  mrv: 20 },
  glutes:     { mev: 0,  mrv: 16 },
  calves:     { mev: 6,  mrv: 16 },
  "full body": { mev: 0,  mrv: 20 },
};

/** Epley formula. */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// Standard gym plate sets and bar weights, per unit. Both calculators run in
// the unit the user is currently viewing (set-editor value is already converted).
const PLATES = { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] };
const BAR = { lb: 45, kg: 20 };

/** Plates needed per side for a target total weight, in the given unit. */
export function plateBreakdown(
  total: number,
  units: WeightUnit = "lb"
): number[] | null {
  const bar = BAR[units];
  if (total < bar) return null;
  let perSide = (total - bar) / 2;
  const out: number[] = [];
  for (const p of PLATES[units]) {
    while (perSide >= p - 1e-9) {
      out.push(p);
      perSide -= p;
    }
  }
  return perSide > 0.01 ? null : out;
}

export const barWeight = (units: WeightUnit = "lb") => BAR[units];

/** Round to the nearest loadable increment (5 lb / 2.5 kg). */
export function roundToStep(n: number, units: WeightUnit = "lb"): number {
  const step = units === "kg" ? 2.5 : 5;
  return Math.max(step, Math.round(n / step) * step);
}

/** Warm-up ramp toward a working weight, in the given unit. */
export function warmupSets(
  working: number,
  units: WeightUnit = "lb"
): { weight: number; reps: number }[] {
  if (working < BAR[units] + 20) return [{ weight: BAR[units], reps: 10 }];
  return [
    { weight: roundToStep(working * 0.4, units), reps: 10 },
    { weight: roundToStep(working * 0.55, units), reps: 6 },
    { weight: roundToStep(working * 0.7, units), reps: 4 },
    { weight: roundToStep(working * 0.85, units), reps: 2 },
  ];
}

export function sessionVolume(s: WorkoutSession): number {
  return s.exercises.reduce(
    (acc, ex) =>
      acc +
      ex.sets.reduce(
        (a, set) => a + (set.completed ? set.weight * set.reps : 0),
        0
      ),
    0
  );
}

export function sessionDurationMin(s: WorkoutSession): number {
  if (!s.endedAt) return Math.round((Date.now() - s.startedAt) / 60000);
  return Math.round((s.endedAt - s.startedAt) / 60000);
}

/** Rough estimate: ~6 kcal per minute of lifting. */
export function sessionCalories(s: WorkoutSession): number {
  return sessionDurationMin(s) * 6;
}

/**
 * Weighted completed-set counts per muscle for one session.
 * Primary muscle counts 1 per set, each secondary muscle 0.5.
 * Skips warmup-flagged sets.
 */
export function sessionSetsByMuscle(
  session: WorkoutSession,
  customExercises: Exercise[] = []
): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const we of session.exercises) {
    const ex = getExercise(we.exerciseId, customExercises);
    if (!ex) continue;
    const n = we.sets.filter((s) => s.completed && !s.warmup).length;
    if (n === 0) continue;
    out[ex.muscle] = (out[ex.muscle] ?? 0) + n;
    for (const sec of ex.secondary) out[sec] = (out[sec] ?? 0) + n * 0.5;
  }
  return out;
}

/** Completed non-warmup sets in the week of `todayISO` vs. the week before. */
export function weeklySetTotals(
  sessions: WorkoutSession[],
  todayISO: string
): { thisWeek: number; lastWeek: number } {
  const weekStart = startOfWeek(todayISO);
  const lastWeekStart = addDays(weekStart, -7);
  let thisWeek = 0;
  let lastWeek = 0;
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const n = s.exercises.reduce(
      (acc, we) => acc + we.sets.filter((x) => x.completed && !x.warmup).length,
      0
    );
    if (s.date >= weekStart) thisWeek += n;
    else if (s.date >= lastWeekStart) lastWeek += n;
  }
  return { thisWeek, lastWeek };
}

/**
 * Days since each muscle (primary only) last got a completed non-warmup set.
 * Muscles never trained are absent. Finished sessions only.
 */
export function daysSinceByMuscle(
  sessions: WorkoutSession[],
  todayISO: string,
  customExercises: Exercise[]
): Partial<Record<Muscle, number>> {
  const lastDate: Partial<Record<Muscle, string>> = {};
  for (const s of sessions) {
    if (!s.endedAt) continue;
    for (const we of s.exercises) {
      const ex = getExercise(we.exerciseId, customExercises);
      if (!ex) continue;
      if (!we.sets.some((x) => x.completed && !x.warmup)) continue;
      if (!lastDate[ex.muscle] || s.date > lastDate[ex.muscle]!) {
        lastDate[ex.muscle] = s.date;
      }
    }
  }
  const out: Partial<Record<Muscle, number>> = {};
  for (const m of Object.keys(lastDate) as Muscle[]) {
    out[m] = daysBetween(lastDate[m]!, todayISO);
  }
  return out;
}
