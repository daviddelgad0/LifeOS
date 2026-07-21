import { getExercise } from "./exercises";
import { estimate1RM, VOLUME_LANDMARKS } from "./fitness";
import { addDays, daysBetween, startOfWeek } from "./dates";
import { kgToLb, lbToKg } from "./units";
import type { Exercise, Muscle, SetEntry, WorkoutSession } from "./types";
import type { WeightUnit } from "./units";

export interface SetSuggestion {
  /** Canonical lb. 0 for bodyweight movements with no added load. */
  weightLb: number;
  repsLo: number;
  repsHi: number;
  targetRir: number;
  /** One user-facing line, e.g. "All sets hit 12 last time — +10 lb, aim 8." */
  reason: string;
  kind: "progress" | "hold" | "deload" | "calibrate" | "match" | "within";
}

export interface WhoopContext {
  connected: boolean;
  /** Oldest-first, as stored in useWhoopStore. Only `date` + `recovery` used. */
  days: { date: string; recovery: number }[];
}

export const TARGET_RIR_EARLY = 2; // sets 1..n-1 (acceptable band 1–3)
// Reserved for a future last-set-aware suggestion (the decision order below
// has no "is this the final set" input, since callers don't pass a set
// total — every non-within-session suggestion targets TARGET_RIR_EARLY).
export const TARGET_RIR_LAST = 1; // final set (acceptable band 0–1)
export const SANDBAG_MARGIN = 2; // (reps + rir) beats (hi + targetRir) by ≥ this → jump
export const MAX_JUMP_FRACTION = 0.1;
export const RUST_DAYS = 14; // no exposure this long → 0.95× and no progression
export const RUST_FACTOR = 0.95;
export const NEW_GYM_FACTOR = 0.9;
export const RED_RECOVERY = 34; // matches readiness() in src/lib/whoop.ts (<34 = red)

const LOWER_BODY = new Set<Muscle>(["quads", "hamstrings", "glutes"]);

// ── gym scoping (mirrors matchesGym/previousSets in workout-store.ts — kept
// as a private copy here since this module must not import the store) ──────
function matchesGym(s: WorkoutSession, gym?: string): boolean {
  return !gym || !s.gym || s.gym === gym;
}

interface SessionSets {
  sets: SetEntry[];
  date: string;
}

/** Finished sessions with completed sets for this exercise, gym-scoped, newest first. */
function exerciseSessionsDesc(
  sessions: WorkoutSession[],
  exerciseId: string,
  gym: string | undefined
): SessionSets[] {
  const sorted = [...sessions]
    .filter((s) => s.endedAt && matchesGym(s, gym))
    .sort((a, b) => b.date.localeCompare(a.date));
  const out: SessionSets[] = [];
  for (const s of sorted) {
    const we = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (!we) continue;
    const completed = we.sets.filter((x) => x.completed && !x.warmup);
    if (completed.length > 0) out.push({ sets: completed, date: s.date });
  }
  return out;
}

/** Best e1RM ever logged for this exercise, gym-scoped. */
function bestE1rmAtGym(
  sessions: WorkoutSession[],
  exerciseId: string,
  gym: string | undefined
): number {
  let e1rm = 0;
  for (const s of sessions) {
    if (!s.endedAt || !matchesGym(s, gym)) continue;
    const we = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (!we) continue;
    for (const set of we.sets) {
      if (!set.completed || set.warmup) continue;
      e1rm = Math.max(e1rm, estimate1RM(set.weight, set.reps));
    }
  }
  return e1rm;
}

function topSetOf(sets: SetEntry[]): SetEntry {
  return sets.reduce((best, s) =>
    s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)
      ? s
      : best
  );
}

const clampRir = (rir: number | null): number | null =>
  rir === null ? null : Math.min(rir, 5);

// ── unit-aware rounding ──────────────────────────────────────────────────
// Rounding happens in the DISPLAY unit, not by converting a step size into
// lb and rounding lb-space — an lb-stored history value (e.g. 150 lb) isn't
// itself aligned to a kg grid, so rounding lb-space by a kg-derived step
// only preserves "nice deltas from an unaligned base," not "lands on the kg
// grid." Converting to kg, rounding there, and converting back guarantees
// the displayed result is actually a clean multiple of the display step.
function roundWeightToStep(
  weightLb: number,
  stepDisplay: number,
  units: WeightUnit
): number {
  const disp = units === "kg" ? lbToKg(weightLb) : weightLb;
  const rounded = Math.round(disp / stepDisplay) * stepDisplay;
  return units === "kg" ? kgToLb(rounded) : rounded;
}

function displayStepToLb(stepDisplay: number, units: WeightUnit): number {
  return units === "kg" ? kgToLb(stepDisplay) : stepDisplay;
}

/** Base step, in the display unit: 5 lb / 2.5 kg. Used for rust/new-gym rounding. */
function baseStepDisplay(units: WeightUnit): number {
  return units === "kg" ? 2.5 : 5;
}

/**
 * Step size for a double-progression weight jump, in the display unit.
 * Cable/machine uses a fixed stack-pitch-sized step; barbell lower-body
 * compounds progress in double steps; everything else uses the base step.
 */
function progressStepDisplay(
  exercise: Exercise | undefined,
  units: WeightUnit
): number {
  const base = baseStepDisplay(units);
  if (!exercise) return base;
  if (exercise.equipment === "cable" || exercise.equipment === "machine") {
    return units === "kg" ? 5 : 10;
  }
  if (exercise.equipment === "barbell" && LOWER_BODY.has(exercise.muscle)) {
    return base * 2;
  }
  return base;
}

// ── rep range ────────────────────────────────────────────────────────────
// Evidence-based hypertrophy range by movement pattern. Takes priority over
// a routine's raw targetReps: a routine number is just whatever was typed in
// when the template was built, not a signal about the exercise itself — the
// equipment class is. Barbell compounds get a lower/heavier band, bodyweight
// movements tolerate a higher ceiling, everything else sits in the middle.
function naturalRangeFor(exercise: Exercise): { lo: number; hi: number } {
  switch (exercise.equipment) {
    case "barbell":
      return { lo: 6, hi: 10 };
    case "bodyweight":
      return { lo: 8, hi: 15 };
    default:
      return { lo: 8, hi: 12 }; // dumbbell, cable, machine, kettlebell
  }
}

function repRangeFor(
  exercise: Exercise | undefined,
  routineTarget: { targetReps: number } | undefined
): { lo: number; hi: number } {
  if (exercise) return naturalRangeFor(exercise);
  // Exercise lookup failed (e.g. a deleted custom exercise) — no
  // equipment-based profile to generate from, fall back to the routine's own
  // number, or a generic default if there isn't even that.
  if (routineTarget) {
    return { lo: Math.max(3, routineTarget.targetReps - 2), hi: routineTarget.targetReps + 2 };
  }
  return { lo: 8, hi: 12 };
}

/** Completed sets per muscle in the week containing `todayISO`, incl. active. */
export function weeklySetsForMuscle(
  sessions: WorkoutSession[],
  active: WorkoutSession | null,
  muscle: Muscle,
  todayISO: string,
  customExercises: Exercise[]
): number {
  const weekStart = startOfWeek(todayISO);
  let count = 0;
  const tally = (s: WorkoutSession) => {
    if (s.date < weekStart) return;
    for (const we of s.exercises) {
      const m = getExercise(we.exerciseId, customExercises)?.muscle;
      if (m !== muscle) continue;
      count += we.sets.filter((x) => x.completed && !x.warmup).length;
    }
  };
  for (const s of sessions) if (s.endedAt) tally(s);
  if (active) tally(active);
  return count;
}

export interface LadderRung {
  weightLb: number;
  reps: number;
  jump: boolean; // true = the weight-increase rung
}

/**
 * The visible double-progression path from the last session to the next
 * weight jump: hold rungs at the current weight climbing one rep at a time
 * up to the range top, then one jump rung at the new weight and range
 * bottom. Illustrative — no e1RM cap, no readiness/volume gates.
 * Returns null when there's no finished history at this gym.
 */
export function progressionLadder(args: {
  sessions: WorkoutSession[];
  exerciseId: string;
  gym: string | undefined;
  routineTarget?: { targetReps: number };
  customExercises: Exercise[];
  units: WeightUnit;
}): LadderRung[] | null {
  const { sessions, exerciseId, gym, routineTarget, customExercises, units } = args;

  const exercise = getExercise(exerciseId, customExercises);
  const { lo, hi } = repRangeFor(exercise, routineTarget);
  const isBodyweight = exercise?.equipment === "bodyweight";

  const gymHistory = exerciseSessionsDesc(sessions, exerciseId, gym);
  if (gymHistory.length === 0) return null;

  const last = gymHistory[0];
  const lastTop = topSetOf(last.sets);
  const lastWeightLb = lastTop.weight;
  const lastBestReps = Math.max(...last.sets.map((s) => s.reps));

  const rungs: LadderRung[] = [];
  for (let r = Math.max(lo, lastBestReps + 1); r <= hi; r++) {
    rungs.push({ weightLb: lastWeightLb, reps: r, jump: false });
  }

  const stepDisplay = progressStepDisplay(exercise, units);
  const stepLb = displayStepToLb(stepDisplay, units);
  const jumpWeightLb = isBodyweight
    ? lastWeightLb // bodyweight doesn't step up — callers render "add weight"
    : roundWeightToStep(lastWeightLb + stepLb, stepDisplay, units);
  rungs.push({ weightLb: jumpWeightLb, reps: lo, jump: true });

  // Keep the last 6 — the jump rung is always the final element, so it
  // always survives; only the earliest hold rungs get dropped.
  return rungs.slice(-6);
}

export function suggestNextSet(args: {
  sessions: WorkoutSession[];
  active: WorkoutSession | null;
  exerciseId: string;
  setIndex: number;
  gym: string | undefined;
  routineTarget?: { targetReps: number };
  customExercises: Exercise[];
  units: WeightUnit;
  whoop?: WhoopContext;
  todayISO: string;
}): SetSuggestion | null {
  const {
    sessions,
    active,
    exerciseId,
    gym,
    routineTarget,
    customExercises,
    units,
    whoop,
    todayISO,
  } = args;

  const exercise = getExercise(exerciseId, customExercises);
  const { lo, hi } = repRangeFor(exercise, routineTarget);
  const isBodyweight = exercise?.equipment === "bodyweight";

  // ── A. within-session: suggest the next set based on the one just done ──
  const completedThisSession = active
    ? (active.exercises.find((we) => we.exerciseId === exerciseId)?.sets ?? []).filter(
        (s) => s.completed && !s.warmup
      )
    : [];
  if (completedThisSession.length > 0) {
    const justDone = completedThisSession[completedThisSession.length - 1];
    const prevRir = clampRir(justDone.rir);
    const rawPredicted =
      prevRir !== null
        ? justDone.reps + (prevRir - TARGET_RIR_EARLY) - 1
        : justDone.reps - 1;

    if (rawPredicted < lo - 2) {
      const stepDisplay = progressStepDisplay(exercise, units);
      const lighterLb = Math.max(
        0,
        roundWeightToStep(
          justDone.weight - displayStepToLb(stepDisplay, units),
          stepDisplay,
          units
        )
      );
      return {
        weightLb: lighterLb,
        repsLo: lo,
        repsHi: lo,
        targetRir: TARGET_RIR_EARLY,
        reason: "Fatigue is stacking up — dropping the weight to stay in range.",
        kind: "deload",
      };
    }

    const predicted = Math.max(lo - 2, Math.min(rawPredicted, hi));
    const reason =
      prevRir === null
        ? `Predicted from your last set (${justDone.reps} reps) · log RIR to sharpen this`
        : `Last set: ${justDone.reps} reps @ ${prevRir} RIR`;
    return {
      weightLb: justDone.weight,
      repsLo: predicted,
      repsHi: predicted,
      targetRir: TARGET_RIR_EARLY,
      reason,
      kind: "within",
    };
  }

  // ── B. first set of the day ──────────────────────────────────────────────
  const anyGymHistory = exerciseSessionsDesc(sessions, exerciseId, undefined);

  // B1: never trained anywhere.
  if (anyGymHistory.length === 0) {
    if (!routineTarget) return null;
    return {
      weightLb: 0,
      repsLo: lo,
      repsHi: hi,
      targetRir: TARGET_RIR_EARLY,
      reason: `Find a weight you can hit for ${lo}–${hi} reps at 2–3 RIR.`,
      kind: "calibrate",
    };
  }

  const gymHistory = exerciseSessionsDesc(sessions, exerciseId, gym);

  // B2: history exists elsewhere, but never at this gym.
  if (gymHistory.length === 0) {
    const topAnywhere = topSetOf(anyGymHistory[0].sets);
    const stepDisplay = baseStepDisplay(units);
    const weightLb = isBodyweight
      ? topAnywhere.weight // bodyweight-plus-load carries over as-is
      : roundWeightToStep(topAnywhere.weight * NEW_GYM_FACTOR, stepDisplay, units);
    return {
      weightLb,
      repsLo: lo,
      repsHi: hi,
      targetRir: TARGET_RIR_EARLY,
      reason: "New gym — machines differ, calibrating from your other gym's numbers.",
      kind: "calibrate",
    };
  }

  const last = gymHistory[0];
  const lastTop = topSetOf(last.sets);
  const lastWeightLb = lastTop.weight;
  const lastBestReps = Math.max(...last.sets.map((s) => s.reps));

  // B3: rust — no exposure to this exercise (at this gym) in a while.
  const daysSince = daysBetween(last.date, todayISO);
  if (daysSince >= RUST_DAYS) {
    const stepDisplay = baseStepDisplay(units);
    const weightLb = isBodyweight
      ? lastWeightLb
      : roundWeightToStep(lastWeightLb * RUST_FACTOR, stepDisplay, units);
    return {
      weightLb,
      repsLo: lo,
      repsHi: hi,
      targetRir: TARGET_RIR_EARLY,
      reason: `Been ${daysSince} days since you trained this — rebuild this session.`,
      kind: "deload",
    };
  }

  // B4: readiness veto (Whoop). Only ever narrows/blocks — never drives weight.
  let targetRir = TARGET_RIR_EARLY;
  let readinessBlocked = false;
  if (whoop?.connected && whoop.days.length > 0) {
    const todayRecovery = whoop.days[whoop.days.length - 1].recovery;
    const lastThree = whoop.days.slice(-3);
    const redCount = lastThree.filter((d) => d.recovery < RED_RECOVERY).length;
    if (todayRecovery < RED_RECOVERY || redCount >= 2) {
      readinessBlocked = true;
      targetRir = TARGET_RIR_EARLY + 1;
    }
  }

  // B5: weekly volume guard (MRV cap) — muscle already fully loaded this week.
  let volumeBlocked = false;
  let volumeReason = "";
  if (exercise) {
    const mrv = VOLUME_LANDMARKS[exercise.muscle]?.mrv;
    if (mrv !== undefined) {
      const weeklySets = weeklySetsForMuscle(
        sessions,
        active,
        exercise.muscle,
        todayISO,
        customExercises
      );
      if (weeklySets >= mrv) {
        volumeBlocked = true;
        volumeReason = `${exercise.muscle} at ${weeklySets} sets this week (MRV ${mrv}) — holding.`;
      }
    }
  }

  // B6: once-per-week rule — don't stack a second weight jump onto a recent one.
  let onceBlocked = false;
  if (gymHistory.length > 1) {
    const prior = gymHistory[1];
    const priorTop = topSetOf(prior.sets);
    const jumpedRecently =
      lastWeightLb > priorTop.weight && daysBetween(last.date, todayISO) <= 6;
    if (jumpedRecently) onceBlocked = true;
  }

  const reasonPrefix = readinessBlocked ? "Low recovery — " : "";

  if (onceBlocked) {
    return {
      weightLb: lastWeightLb,
      repsLo: Math.min(Math.max(lastBestReps, lo), hi),
      repsHi: Math.min(Math.max(lastBestReps, lo), hi),
      targetRir,
      reason: `${reasonPrefix}Already progressed this week — match it.`,
      kind: "match",
    };
  }

  if (volumeBlocked) {
    return {
      weightLb: lastWeightLb,
      repsLo: Math.min(lastBestReps + 1, hi),
      repsHi: hi,
      targetRir,
      reason: `${reasonPrefix}${volumeReason}`,
      kind: "hold",
    };
  }

  // B7: double progression, gated by readiness (blocked → skip the jump).
  if (!readinessBlocked) {
    const allSetsAtTop = last.sets.every(
      (s) => s.reps >= hi && (s.rir === null || (clampRir(s.rir) as number) >= TARGET_RIR_EARLY)
    );
    const sandbag =
      lastTop.rir !== null &&
      lastTop.reps + (clampRir(lastTop.rir) as number) - (hi + TARGET_RIR_EARLY) >=
        SANDBAG_MARGIN;

    if (allSetsAtTop || sandbag) {
      if (isBodyweight) {
        return {
          weightLb: lastWeightLb,
          repsLo: hi,
          repsHi: hi,
          targetRir,
          reason: "Hit the top of your range — add weight next time (dip belt/vest).",
          kind: "progress",
        };
      }

      const stepDisplay = progressStepDisplay(exercise, units);
      const stepLb = displayStepToLb(stepDisplay, units);
      const e1rm = bestE1rmAtGym(sessions, exerciseId, gym);
      const wTargetLb = e1rm > 0 ? e1rm / (1 + (lo + targetRir) / 30) : lastWeightLb + stepLb;

      const jumpTarget = roundWeightToStep(lastWeightLb + stepLb, stepDisplay, units);
      const capTarget = roundWeightToStep(wTargetLb, stepDisplay, units);
      const ceilTarget = roundWeightToStep(
        lastWeightLb * (1 + MAX_JUMP_FRACTION),
        stepDisplay,
        units
      );

      let weightLb = Math.min(jumpTarget, capTarget);
      weightLb = Math.min(weightLb, ceilTarget);
      weightLb = Math.max(weightLb, jumpTarget); // always at least one full step

      const reasonBase = sandbag
        ? `Crushed it with reps to spare last time — +${Math.round(weightLb - lastWeightLb)} ${units}, aim ${lo}.`
        : `All sets hit ${hi} last time — +${Math.round(weightLb - lastWeightLb)} ${units}, aim ${lo}.`;
      return {
        weightLb,
        repsLo: lo,
        repsHi: lo,
        targetRir,
        reason: `${reasonPrefix}${reasonBase}`,
        kind: "progress",
      };
    }

    // Struggle: didn't reach the bottom of the range, or ground out at 0 RIR.
    const struggled =
      lastTop.reps < lo || last.sets.some((s) => s.rir === 0 && s.reps < lo);
    if (struggled) {
      return {
        weightLb: lastWeightLb,
        repsLo: lo,
        repsHi: lo,
        targetRir,
        reason: `${reasonPrefix}Didn't reach ${lo} last time — own the bottom of the range first.`,
        kind: "hold",
      };
    }
  }

  // Default: same weight, climbing reps toward the top of the range — repsLo
  // is the realistic next step, repsHi is the true range top (what triggers
  // a weight jump once every set gets there).
  const reps = Math.min(lastBestReps + 1, hi);
  return {
    weightLb: lastWeightLb,
    repsLo: reps,
    repsHi: hi,
    targetRir,
    reason:
      reps >= hi
        ? `${reasonPrefix}At the top of your range — hit it again to trigger a weight jump.`
        : `${reasonPrefix}+1 rep over last time — work up to ${hi} to trigger a jump.`,
    kind: "hold",
  };
}
