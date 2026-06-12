import { addDays, todayISO } from "./dates";
import { estimate1RM } from "./fitness";
import type {
  ChatMsg,
  Measurement,
  Routine,
  SchoolClass,
  SetEntry,
  Task,
  WorkoutSession,
} from "./types";

// Deterministic RNG so the seed is stable within a session.
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260610);
const pick = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));

let idCounter = 0;
const uid = (p: string) => `${p}-seed-${++idCounter}`;

const TODAY = todayISO();
const day = (offset: number) => addDays(TODAY, offset);

// ---------------------------------------------------------------- workouts

interface LiftPlan {
  exerciseId: string;
  sets: number;
  reps: [number, number];
  start: number;
  end: number; // top weight progression across the month
  rest: number;
}

const PUSH: LiftPlan[] = [
  { exerciseId: "bench-press", sets: 4, reps: [5, 8], start: 135, end: 155, rest: 150 },
  { exerciseId: "incline-db-press", sets: 3, reps: [8, 10], start: 50, end: 60, rest: 120 },
  { exerciseId: "ohp", sets: 3, reps: [6, 8], start: 85, end: 95, rest: 150 },
  { exerciseId: "lateral-raise", sets: 3, reps: [12, 15], start: 15, end: 20, rest: 90 },
  { exerciseId: "pushdown", sets: 3, reps: [10, 12], start: 40, end: 50, rest: 90 },
];
const PULL: LiftPlan[] = [
  { exerciseId: "deadlift", sets: 3, reps: [3, 5], start: 225, end: 275, rest: 180 },
  { exerciseId: "barbell-row", sets: 4, reps: [6, 8], start: 115, end: 135, rest: 150 },
  { exerciseId: "lat-pulldown", sets: 3, reps: [8, 10], start: 120, end: 140, rest: 120 },
  { exerciseId: "db-curl", sets: 3, reps: [10, 12], start: 25, end: 30, rest: 90 },
  { exerciseId: "face-pull", sets: 3, reps: [12, 15], start: 30, end: 40, rest: 90 },
];
const LEGS: LiftPlan[] = [
  { exerciseId: "squat", sets: 4, reps: [5, 8], start: 185, end: 225, rest: 180 },
  { exerciseId: "rdl", sets: 3, reps: [8, 10], start: 135, end: 165, rest: 150 },
  { exerciseId: "leg-press", sets: 3, reps: [10, 12], start: 270, end: 320, rest: 120 },
  { exerciseId: "lying-leg-curl", sets: 3, reps: [10, 12], start: 70, end: 85, rest: 90 },
  { exerciseId: "standing-calf-raise", sets: 3, reps: [12, 15], start: 90, end: 110, rest: 90 },
];

function buildSessions(): WorkoutSession[] {
  // Train on a PPL-ish cadence over the last 30 days, ~14 sessions,
  // ending with a 5-day streak through yesterday.
  const offsets = [-30, -28, -27, -25, -23, -21, -20, -18, -16, -14, -12, -9, -7, -5, -4, -3, -2, -1];
  const plans = [PUSH, PULL, LEGS];
  const bestSoFar = new Map<string, number>();
  const sessions: WorkoutSession[] = [];

  offsets.forEach((offset, i) => {
    const plan = plans[i % 3];
    const progress = (offset + 30) / 30; // 0 → 1 across the month
    const date = day(offset);
    const startHour = pick(16, 18);
    const startedAt =
      new Date(date + "T00:00:00").getTime() + startHour * 3600000;

    const exercises = plan.map((lift) => {
      const top = Math.round((lift.start + (lift.end - lift.start) * progress) / 5) * 5;
      const sets: SetEntry[] = [];
      for (let s = 0; s < lift.sets; s++) {
        const isTop = s === lift.sets - 1 || lift.sets <= 3;
        const weight = isTop ? top : Math.max(5, top - 10);
        const reps = pick(lift.reps[0], lift.reps[1]);
        const prevBestW = bestSoFar.get(lift.exerciseId) ?? 0;
        const prevBestE = bestSoFar.get(lift.exerciseId + ":e") ?? 0;
        const e1rm = estimate1RM(weight, reps);
        const pr = weight > prevBestW || e1rm > prevBestE;
        if (weight > prevBestW) bestSoFar.set(lift.exerciseId, weight);
        if (e1rm > prevBestE) bestSoFar.set(lift.exerciseId + ":e", e1rm);
        sets.push({
          id: uid("set"),
          weight,
          reps,
          rir: pick(1, 3),
          completed: true,
          pr: pr && i > 2, // don't spam PRs on the very first sessions
        });
      }
      return {
        id: uid("we"),
        exerciseId: lift.exerciseId,
        restSeconds: lift.rest,
        sets,
      };
    });

    sessions.push({
      id: uid("w"),
      date,
      startedAt,
      endedAt: startedAt + pick(55, 75) * 60000,
      exercises,
    });
  });
  return sessions;
}

export const SEED_SESSIONS = buildSessions();

export const SEED_ROUTINES: Routine[] = [
  { id: "routine-push", name: "Push", exercises: PUSH.map((l) => ({ exerciseId: l.exerciseId, targetSets: l.sets, targetReps: l.reps[1], restSeconds: l.rest })) },
  { id: "routine-pull", name: "Pull", exercises: PULL.map((l) => ({ exerciseId: l.exerciseId, targetSets: l.sets, targetReps: l.reps[1], restSeconds: l.rest })) },
  { id: "routine-legs", name: "Legs", exercises: LEGS.map((l) => ({ exerciseId: l.exerciseId, targetSets: l.sets, targetReps: l.reps[1], restSeconds: l.rest })) },
  {
    id: "routine-upper",
    name: "Upper",
    exercises: [
      { exerciseId: "bench-press", targetSets: 4, targetReps: 8, restSeconds: 150 },
      { exerciseId: "barbell-row", targetSets: 4, targetReps: 8, restSeconds: 150 },
      { exerciseId: "db-shoulder-press", targetSets: 3, targetReps: 10, restSeconds: 120 },
      { exerciseId: "lat-pulldown", targetSets: 3, targetReps: 10, restSeconds: 120 },
      { exerciseId: "db-curl", targetSets: 2, targetReps: 12, restSeconds: 90 },
      { exerciseId: "pushdown", targetSets: 2, targetReps: 12, restSeconds: 90 },
    ],
  },
  {
    id: "routine-lower",
    name: "Lower",
    exercises: [
      { exerciseId: "squat", targetSets: 4, targetReps: 8, restSeconds: 180 },
      { exerciseId: "rdl", targetSets: 3, targetReps: 10, restSeconds: 150 },
      { exerciseId: "walking-lunge", targetSets: 3, targetReps: 12, restSeconds: 120 },
      { exerciseId: "seated-leg-curl", targetSets: 3, targetReps: 12, restSeconds: 90 },
      { exerciseId: "standing-calf-raise", targetSets: 4, targetReps: 15, restSeconds: 60 },
    ],
  },
  {
    id: "routine-full",
    name: "Full body",
    exercises: [
      { exerciseId: "squat", targetSets: 3, targetReps: 8, restSeconds: 180 },
      { exerciseId: "bench-press", targetSets: 3, targetReps: 8, restSeconds: 150 },
      { exerciseId: "barbell-row", targetSets: 3, targetReps: 8, restSeconds: 150 },
      { exerciseId: "rdl", targetSets: 2, targetReps: 10, restSeconds: 120 },
      { exerciseId: "plank", targetSets: 3, targetReps: 1, restSeconds: 60 },
    ],
  },
];

// ------------------------------------------------------------ measurements

function buildMeasurements(): Measurement[] {
  const out: Measurement[] = [];
  let w = 178.4;
  for (let offset = -30; offset <= 0; offset += 2) {
    w -= rand() * 0.5 - 0.05;
    out.push({ date: day(offset), weight: Math.round(w * 10) / 10 });
  }
  out[0].bodyFat = 16.2;
  out[out.length - 1].bodyFat = 15.1;
  out[out.length - 1].chest = 41.5;
  out[out.length - 1].arms = 15.2;
  out[out.length - 1].waist = 32;
  out[out.length - 1].thighs = 23.5;
  return out;
}
export const SEED_MEASUREMENTS = buildMeasurements();

// ----------------------------------------------------------------- school

export const SEED_CLASSES: SchoolClass[] = [
  {
    id: "class-cmsi",
    name: "Data structures",
    code: "CMSI 2120",
    professor: "Prof. Park",
    location: "Doolan 222",
    color: "#5B8DEF",
    meetings: [
      { day: 1, start: "10:00", end: "10:50" },
      { day: 3, start: "10:00", end: "10:50" },
      { day: 5, start: "10:00", end: "10:50" },
    ],
    gradeWeights: [
      { label: "Projects", percent: 40 },
      { label: "Midterms", percent: 30 },
      { label: "Final", percent: 20 },
      { label: "Participation", percent: 10 },
    ],
    syncToGoogle: false,
  },
  {
    id: "class-phil",
    name: "Ethics",
    code: "PHIL 3000",
    professor: "Prof. Rivera",
    location: "University Hall 3320",
    color: "#8B5CF6",
    meetings: [
      { day: 2, start: "13:00", end: "14:15" },
      { day: 4, start: "13:00", end: "14:15" },
    ],
    gradeWeights: [
      { label: "Essays", percent: 50 },
      { label: "Final", percent: 30 },
      { label: "Discussion", percent: 20 },
    ],
    syncToGoogle: false,
  },
  {
    id: "class-math",
    name: "Statistics",
    code: "MATH 2050",
    professor: "Prof. Chen",
    location: "Seaver 200",
    color: "#FFB800",
    meetings: [
      { day: 1, start: "12:00", end: "12:50" },
      { day: 3, start: "12:00", end: "12:50" },
      { day: 5, start: "12:00", end: "12:50" },
    ],
    gradeWeights: [
      { label: "Problem sets", percent: 35 },
      { label: "Midterm", percent: 30 },
      { label: "Final", percent: 35 },
    ],
    syncToGoogle: false,
  },
];

// ------------------------------------------------------------------ tasks

export const SEED_TASKS: Task[] = [
  // Today
  { id: uid("t"), title: "Read ch. 6 — dynamic programming", due: TODAY, priority: "medium", category: "school", classId: "class-cmsi", assignmentType: "reading", completed: false, createdAt: day(-3) },
  { id: uid("t"), title: "Push day", due: TODAY, time: "17:00", priority: "high", category: "fitness", completed: false, createdAt: day(-1) },
  { id: uid("t"), title: "Meal prep for the week", due: TODAY, priority: "low", category: "personal", completed: false, createdAt: day(-1) },
  { id: uid("t"), title: "Morning mobility 10 min", due: TODAY, priority: "low", category: "fitness", completed: true, completedAt: TODAY, createdAt: day(-1) },
  // Upcoming
  { id: uid("t"), title: "Problem set 8", due: day(2), priority: "high", category: "school", classId: "class-math", assignmentType: "problem set", completed: false, createdAt: day(-4) },
  { id: uid("t"), title: "Quiz — utilitarianism", due: day(3), priority: "medium", category: "school", classId: "class-phil", assignmentType: "quiz", completed: false, createdAt: day(-4) },
  { id: uid("t"), title: "Midterm 2", due: day(5), priority: "high", category: "school", classId: "class-cmsi", assignmentType: "exam", completed: false, createdAt: day(-10) },
  { id: uid("t"), title: "Essay 3 — virtue ethics", due: day(8), priority: "high", category: "school", classId: "class-phil", assignmentType: "paper", completed: false, createdAt: day(-6) },
  { id: uid("t"), title: "Update resume for summer apps", due: day(4), priority: "medium", category: "job", completed: false, createdAt: day(-2) },
  { id: uid("t"), title: "Call home", due: day(1), priority: "low", category: "personal", completed: false, createdAt: day(-1) },
  // Someday
  { id: uid("t"), title: "Research Whoop API for LifeOS", due: null, priority: "low", category: "job", completed: false, createdAt: day(-5) },
  { id: uid("t"), title: "Plan spring break trip", due: null, priority: "low", category: "personal", completed: false, createdAt: day(-8) },
  // Completed history
  { id: uid("t"), title: "Problem set 7", due: day(-5), priority: "high", category: "school", classId: "class-math", assignmentType: "problem set", completed: true, completedAt: day(-5), createdAt: day(-12) },
  { id: uid("t"), title: "Essay 2 — deontology", due: day(-9), priority: "high", category: "school", classId: "class-phil", assignmentType: "paper", completed: true, completedAt: day(-10), createdAt: day(-20) },
  { id: uid("t"), title: "Laundry", due: day(-1), priority: "low", category: "personal", completed: true, completedAt: day(-1), createdAt: day(-2) },
  { id: uid("t"), title: "Pull day", due: day(-1), priority: "high", category: "fitness", completed: true, completedAt: day(-1), createdAt: day(-2) },
];

// ------------------------------------------------------------ productivity

function buildRatings(): Record<string, number> {
  const out: Record<string, number> = {};
  for (let offset = -24; offset < 0; offset++) {
    if (rand() < 0.15) continue; // a few unrated days
    const r = rand();
    out[day(offset)] = r < 0.1 ? 2 : r < 0.35 ? 3 : r < 0.75 ? 4 : 5;
  }
  return out;
}
export const SEED_RATINGS = buildRatings();

// ------------------------------------------------------------------- chat

export const SEED_CHAT: ChatMsg[] = [
  {
    id: uid("msg"),
    role: "coach",
    text: "Morning, David. Five sessions in five days — solid week. Bench is up 20 lb on the month and your midterm is in five days, so let's keep sessions tight and sleep honest. What's on your mind?",
    at: Date.now() - 3600000,
  },
];

// ----------------------------------------------------------- gamification

export const SEED_XP = 1660; // ≈ level 7 given the seeded history
export const SEED_ACHIEVEMENTS: Record<string, string> = {
  "first-workout": day(-30),
  "ten-workouts": day(-12),
  "first-pr": day(-25),
  "streak-7": day(-14),
};
