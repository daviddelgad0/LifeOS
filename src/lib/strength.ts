import type { Muscle, WorkoutSession } from "./types";
import { estimate1RM } from "./fitness";
import { getExercise } from "./exercises";

// Strength scoring benchmarks every lift against population strength standards
// (expressed as 1RM ÷ bodyweight), the way Strength Level / ExRx do. The
// thresholds below are the *lower bound* of each band, as bodyweight multiples.

export const LEVELS = [
  "Beginner",
  "Novice",
  "Intermediate",
  "Advanced",
  "Elite",
  "World Class",
] as const;
export type StrengthLevel = (typeof LEVELS)[number];

export type Sex = "male" | "female";

/** Loose parse of the free-text profile sex field. */
export function parseSex(raw: string | undefined): Sex {
  return (raw ?? "").trim().toLowerCase().startsWith("f") ? "female" : "male";
}

// Bodyweight-multiple thresholds: [Novice, Intermediate, Advanced, Elite, World].
// Below the first value = Beginner. Approximate adult standards.
interface Standard {
  male: [number, number, number, number, number];
  female: [number, number, number, number, number];
}

/** The big barbell lifts that roll into the overall Strength Score. */
export const STRENGTH_LIFTS: {
  key: string;
  label: string;
  muscle: Muscle;
  exerciseIds: string[];
  standard: Standard;
}[] = [
  {
    key: "squat",
    label: "Squat",
    muscle: "quads",
    exerciseIds: ["squat", "front-squat"],
    standard: { male: [0.75, 1.25, 1.75, 2.5, 3.0], female: [0.5, 0.85, 1.35, 1.9, 2.4] },
  },
  {
    key: "bench",
    label: "Bench press",
    muscle: "chest",
    exerciseIds: ["bench-press"],
    standard: { male: [0.5, 1.0, 1.5, 2.0, 2.4], female: [0.25, 0.5, 0.85, 1.25, 1.6] },
  },
  {
    key: "deadlift",
    label: "Deadlift",
    muscle: "back",
    exerciseIds: ["deadlift", "sumo-deadlift", "trap-bar-deadlift"],
    standard: { male: [1.0, 1.5, 2.0, 2.75, 3.25], female: [0.5, 1.0, 1.5, 2.1, 2.6] },
  },
  {
    key: "ohp",
    label: "Overhead press",
    muscle: "shoulders",
    exerciseIds: ["ohp"],
    standard: { male: [0.35, 0.6, 0.9, 1.2, 1.5], female: [0.2, 0.4, 0.6, 0.85, 1.1] },
  },
  {
    key: "row",
    label: "Barbell row",
    muscle: "back",
    exerciseIds: ["barbell-row", "pendlay-row"],
    standard: { male: [0.5, 0.85, 1.25, 1.65, 2.0], female: [0.3, 0.55, 0.85, 1.2, 1.5] },
  },
];

// Per-muscle benchmarks for the Muscle Balance radar — calibrated to the
// heaviest lift that primarily trains each group.
const MUSCLE_STANDARDS: Partial<Record<Muscle, Standard>> = {
  chest: { male: [0.5, 1.0, 1.5, 2.0, 2.4], female: [0.25, 0.5, 0.85, 1.25, 1.6] },
  back: { male: [1.0, 1.5, 2.0, 2.75, 3.25], female: [0.5, 1.0, 1.5, 2.1, 2.6] },
  shoulders: { male: [0.35, 0.6, 0.9, 1.2, 1.5], female: [0.2, 0.4, 0.6, 0.85, 1.1] },
  quads: { male: [0.75, 1.25, 1.75, 2.5, 3.0], female: [0.5, 0.85, 1.35, 1.9, 2.4] },
  hamstrings: { male: [0.5, 0.9, 1.3, 1.8, 2.2], female: [0.3, 0.55, 0.85, 1.2, 1.5] },
  glutes: { male: [0.75, 1.25, 2.0, 2.75, 3.5], female: [0.6, 1.1, 1.8, 2.5, 3.2] },
  biceps: { male: [0.25, 0.4, 0.6, 0.8, 1.0], female: [0.15, 0.25, 0.4, 0.55, 0.7] },
  triceps: { male: [0.4, 0.7, 1.0, 1.4, 1.8], female: [0.25, 0.45, 0.65, 0.9, 1.2] },
};

/** Map a bodyweight ratio to a 0–100 score across the five thresholds. */
function ratioToScore(ratio: number, t: readonly number[]): number {
  // Each band spans 20 points; Beginner is 0 → t[0].
  if (ratio <= 0) return 0;
  if (ratio >= t[4]) return 100;
  const bands = [0, ...t]; // [0, novice, inter, adv, elite, world]
  for (let i = 1; i < bands.length; i++) {
    if (ratio < bands[i]) {
      const frac = (ratio - bands[i - 1]) / (bands[i] - bands[i - 1]);
      return Math.round((i - 1 + frac) * 20);
    }
  }
  return 100;
}

export function scoreToLevel(score: number): StrengthLevel {
  return LEVELS[Math.min(LEVELS.length - 1, Math.floor(score / 20))];
}

/** Best completed e1RM for an exercise id across finished sessions. */
function bestE1RM(sessions: WorkoutSession[], ids: string[]): number {
  const set = new Set(ids);
  let best = 0;
  for (const s of sessions) {
    if (!s.endedAt) continue;
    for (const we of s.exercises) {
      if (!set.has(we.exerciseId)) continue;
      for (const st of we.sets) {
        if (st.completed) best = Math.max(best, estimate1RM(st.weight, st.reps));
      }
    }
  }
  return best;
}

/** Best e1RM across every exercise whose *primary* muscle is the given group. */
function bestE1RMForMuscle(
  sessions: WorkoutSession[],
  muscle: Muscle,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  custom: any[]
): number {
  let best = 0;
  for (const s of sessions) {
    if (!s.endedAt) continue;
    for (const we of s.exercises) {
      if (getExercise(we.exerciseId, custom)?.muscle !== muscle) continue;
      for (const st of we.sets) {
        if (st.completed) best = Math.max(best, estimate1RM(st.weight, st.reps));
      }
    }
  }
  return best;
}

export interface LiftScore {
  key: string;
  label: string;
  e1rm: number; // lb
  ratio: number;
  score: number; // 0–100
  level: StrengthLevel;
  /** e1RM (lb) needed to reach the next level, or null at World Class. */
  nextAt: number | null;
}

export interface StrengthReport {
  score: number; // overall 0–100
  level: StrengthLevel;
  lifts: LiftScore[]; // only lifts with data
  missing: string[]; // labels of big lifts not yet logged
}

export function strengthReport(
  sessions: WorkoutSession[],
  bodyweightLb: number,
  sex: Sex
): StrengthReport {
  const lifts: LiftScore[] = [];
  const missing: string[] = [];
  const bw = bodyweightLb > 0 ? bodyweightLb : 1;

  for (const lift of STRENGTH_LIFTS) {
    const e1rm = bestE1RM(sessions, lift.exerciseIds);
    if (e1rm <= 0) {
      missing.push(lift.label);
      continue;
    }
    const t = lift.standard[sex];
    const ratio = e1rm / bw;
    const score = ratioToScore(ratio, t);
    const level = scoreToLevel(score);
    // Next threshold's bodyweight multiple → required e1RM.
    const idx = LEVELS.indexOf(level);
    const nextMult = idx < t.length ? t[idx] : null;
    lifts.push({
      key: lift.key,
      label: lift.label,
      e1rm,
      ratio: Math.round(ratio * 100) / 100,
      score,
      level,
      nextAt: nextMult ? Math.round(nextMult * bw) : null,
    });
  }

  const score =
    lifts.length > 0
      ? Math.round(lifts.reduce((a, l) => a + l.score, 0) / lifts.length)
      : 0;
  return { score, level: scoreToLevel(score), lifts, missing };
}

export interface MuscleScore {
  muscle: Muscle;
  label: string;
  score: number; // 0–100
}

export interface BalanceReport {
  muscles: MuscleScore[];
  weakest: MuscleScore | null;
  strongest: MuscleScore | null;
  pushPull: { push: number; pull: number } | null;
  upperLower: { upper: number; lower: number } | null;
}

const BALANCE_MUSCLES: Muscle[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
];

export function muscleBalance(
  sessions: WorkoutSession[],
  bodyweightLb: number,
  sex: Sex,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  custom: any[]
): BalanceReport {
  const bw = bodyweightLb > 0 ? bodyweightLb : 1;
  const muscles: MuscleScore[] = [];

  for (const m of BALANCE_MUSCLES) {
    const std = MUSCLE_STANDARDS[m];
    if (!std) continue;
    const e1rm = bestE1RMForMuscle(sessions, m, custom);
    const score = e1rm > 0 ? ratioToScore(e1rm / bw, std[sex]) : 0;
    muscles.push({ muscle: m, label: m, score });
  }

  const trained = muscles.filter((m) => m.score > 0);
  const weakest = trained.length
    ? trained.reduce((a, b) => (b.score < a.score ? b : a))
    : null;
  const strongest = trained.length
    ? trained.reduce((a, b) => (b.score > a.score ? b : a))
    : null;

  const avg = (keys: Muscle[]) => {
    const vals = muscles.filter((m) => keys.includes(m.muscle) && m.score > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b.score, 0) / vals.length) : 0;
  };

  const push = avg(["chest", "shoulders", "triceps"]);
  const pull = avg(["back", "biceps"]);
  const upper = avg(["chest", "back", "shoulders", "biceps", "triceps"]);
  const lower = avg(["quads", "hamstrings", "glutes"]);

  return {
    muscles,
    weakest,
    strongest,
    pushPull: push && pull ? { push, pull } : null,
    upperLower: upper && lower ? { upper, lower } : null,
  };
}
