import type { Routine } from "./types";

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
