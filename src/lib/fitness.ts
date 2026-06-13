import type { Muscle, WorkoutSession } from "./types";

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

const PLATES = [45, 35, 25, 10, 5, 2.5];

/** Plates needed per side for a target total weight. */
export function plateBreakdown(total: number, bar = 45): number[] | null {
  if (total < bar) return null;
  let perSide = (total - bar) / 2;
  const out: number[] = [];
  for (const p of PLATES) {
    while (perSide >= p) {
      out.push(p);
      perSide -= p;
    }
  }
  return perSide > 0.01 ? null : out;
}

export function roundToFive(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

/** Warm-up ramp toward a working weight. */
export function warmupSets(working: number): { weight: number; reps: number }[] {
  if (working < 65) return [{ weight: 45, reps: 10 }];
  return [
    { weight: roundToFive(working * 0.4), reps: 10 },
    { weight: roundToFive(working * 0.55), reps: 6 },
    { weight: roundToFive(working * 0.7), reps: 4 },
    { weight: roundToFive(working * 0.85), reps: 2 },
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
