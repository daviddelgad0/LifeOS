import type { CycleCompound, Routine, WeeklyWeightTarget } from "./types";

// From the 12-week recomp cycle handoff (DEXA Aug 26, 2026). Week 1 starts
// on the DEXA/handoff date; the weekly bands are the doc's own targets.
export const CYCLE_START_DATE = "2026-08-26";

export const CYCLE_WEEKLY_WEIGHT_TARGETS: WeeklyWeightTarget[] = [
  { week: 1, lowLb: 158, highLb: 159 },
  { week: 2, lowLb: 157.5, highLb: 159 },
  { week: 3, lowLb: 157, highLb: 158.5 },
  { week: 4, lowLb: 156.5, highLb: 158 },
  { week: 5, lowLb: 156, highLb: 157.5 },
  { week: 6, lowLb: 155.5, highLb: 157 },
  { week: 7, lowLb: 155, highLb: 156.5 },
  { week: 8, lowLb: 154.5, highLb: 156 },
  { week: 9, lowLb: 154, highLb: 155.5 },
  { week: 10, lowLb: 153, highLb: 155 },
  { week: 11, lowLb: 152, highLb: 154 },
  { week: 12, lowLb: 152, highLb: 155 },
];

// Retatrutide was already ~3 weeks into its current dose as of the Aug 26
// handoff date, per the doc — its startDate is backdated accordingly.
// Test/Clomiphene have no earlier date given, so they default to cycle start.
export const CYCLE_COMPOUNDS: CycleCompound[] = [
  {
    name: "Testosterone Propionate",
    doseLabel: "350 mg/week (50 mg daily SubQ)",
    startDate: CYCLE_START_DATE,
  },
  {
    name: "Retatrutide",
    doseLabel: "2 mg/week",
    startDate: "2026-08-05",
  },
  {
    name: "Clomiphene",
    doseLabel: "Throughout cycle",
    startDate: CYCLE_START_DATE,
  },
];

// Rest-time convention applied uniformly since the source plan doesn't
// specify rests: 150s for the day's heaviest compound, 120s for secondary
// compounds/rows/presses, 90s for moderate accessories, 60-75s for
// isolation/ab work.
export const PPL_CYCLE_ROUTINES: Omit<Routine, "id">[] = [
  {
    name: "Push A (heavy)",
    exercises: [
      { exerciseId: "bench-press", targetSets: 4, targetReps: 6, repLo: 5, repHi: 7, restSeconds: 150 },
      { exerciseId: "incline-db-press", targetSets: 4, targetReps: 9, repLo: 8, repHi: 10, restSeconds: 120 },
      { exerciseId: "ohp", targetSets: 3, targetReps: 7, repLo: 6, repHi: 8, restSeconds: 120 },
      { exerciseId: "close-grip-bench", targetSets: 3, targetReps: 9, repLo: 8, repHi: 10, restSeconds: 120 },
      { exerciseId: "lateral-raise", targetSets: 4, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 75 },
      { exerciseId: "db-overhead-extension", targetSets: 3, targetReps: 11, repLo: 10, repHi: 12, restSeconds: 75 },
      { exerciseId: "hanging-leg-raise", targetSets: 3, targetReps: 13, repLo: 10, repHi: 15, restSeconds: 75 },
      { exerciseId: "cable-crunch", targetSets: 3, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 60 },
    ],
  },
  {
    name: "Pull A",
    exercises: [
      { exerciseId: "pull-up", targetSets: 4, targetReps: 7, repLo: 6, repHi: 8, restSeconds: 150 },
      { exerciseId: "barbell-row", targetSets: 4, targetReps: 7, repLo: 6, repHi: 8, restSeconds: 120 },
      { exerciseId: "chest-supported-row", targetSets: 3, targetReps: 10, repLo: 8, repHi: 12, restSeconds: 120 },
      { exerciseId: "rear-delt-fly", targetSets: 4, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 75 },
      { exerciseId: "ez-bar-curl", targetSets: 3, targetReps: 9, repLo: 8, repHi: 10, restSeconds: 75 },
      { exerciseId: "face-pull", targetSets: 3, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 60 },
    ],
  },
  {
    name: "Legs A (priority)",
    exercises: [
      { exerciseId: "squat", targetSets: 4, targetReps: 6, repLo: 5, repHi: 7, restSeconds: 150 },
      { exerciseId: "rdl", targetSets: 4, targetReps: 9, repLo: 8, repHi: 10, restSeconds: 120 },
      { exerciseId: "bulgarian-split-squat", targetSets: 3, targetReps: 9, repLo: 8, repHi: 10, restSeconds: 120 },
      { exerciseId: "lying-leg-curl", targetSets: 4, targetReps: 11, repLo: 10, repHi: 12, restSeconds: 90 },
      { exerciseId: "leg-extension", targetSets: 3, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 75 },
      { exerciseId: "standing-calf-raise", targetSets: 4, targetReps: 13, repLo: 10, repHi: 15, restSeconds: 60 },
      { exerciseId: "cable-crunch", targetSets: 3, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 60 },
      { exerciseId: "pallof-press", targetSets: 3, targetReps: 10, repLo: 10, repHi: 10, restSeconds: 60 },
    ],
  },
  {
    name: "Push B (volume)",
    exercises: [
      { exerciseId: "bench-press", targetSets: 4, targetReps: 9, repLo: 8, repHi: 10, restSeconds: 120 },
      { exerciseId: "incline-db-press", targetSets: 3, targetReps: 11, repLo: 10, repHi: 12, restSeconds: 90 },
      { exerciseId: "cable-crossover", targetSets: 3, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 75 },
      { exerciseId: "lateral-raise", targetSets: 4, targetReps: 18, repLo: 15, repHi: 20, restSeconds: 60 },
      { exerciseId: "ohp", targetSets: 3, targetReps: 9, repLo: 8, repHi: 10, restSeconds: 120 },
      { exerciseId: "pushdown", targetSets: 3, targetReps: 11, repLo: 10, repHi: 12, restSeconds: 75 },
      { exerciseId: "hanging-leg-raise", targetSets: 3, targetReps: 10, repLo: 8, repHi: 12, restSeconds: 75 },
      { exerciseId: "ab-wheel", targetSets: 3, targetReps: 10, repLo: 8, repHi: 12, restSeconds: 75 },
    ],
  },
  {
    name: "Pull B",
    exercises: [
      { exerciseId: "rack-pull", targetSets: 3, targetReps: 5, repLo: 5, repHi: 5, restSeconds: 150 },
      { exerciseId: "lat-pulldown", targetSets: 3, targetReps: 9, repLo: 8, repHi: 10, restSeconds: 120 },
      { exerciseId: "db-row", targetSets: 3, targetReps: 9, repLo: 8, repHi: 10, restSeconds: 90 },
      { exerciseId: "rear-delt-fly", targetSets: 3, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 75 },
      { exerciseId: "hammer-curl", targetSets: 3, targetReps: 11, repLo: 10, repHi: 12, restSeconds: 75 },
      { exerciseId: "incline-db-curl", targetSets: 3, targetReps: 11, repLo: 10, repHi: 12, restSeconds: 75 },
    ],
  },
  {
    name: "Legs B",
    exercises: [
      { exerciseId: "leg-press", targetSets: 4, targetReps: 10, repLo: 8, repHi: 12, restSeconds: 120 },
      { exerciseId: "db-rdl", targetSets: 3, targetReps: 9, repLo: 8, repHi: 10, restSeconds: 120 },
      { exerciseId: "seated-leg-curl", targetSets: 4, targetReps: 11, repLo: 10, repHi: 12, restSeconds: 90 },
      { exerciseId: "walking-lunge", targetSets: 3, targetReps: 10, repLo: 10, repHi: 10, restSeconds: 90 },
      { exerciseId: "leg-extension", targetSets: 3, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 75 },
      { exerciseId: "seated-calf-raise", targetSets: 4, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 60 },
      { exerciseId: "hanging-leg-raise", targetSets: 3, targetReps: 13, repLo: 10, repHi: 15, restSeconds: 75 },
      { exerciseId: "cable-crunch", targetSets: 3, targetReps: 14, repLo: 12, repHi: 15, restSeconds: 60 },
    ],
  },
];
