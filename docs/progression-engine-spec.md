# Implementation spec: Set-suggestion / progression engine

Self-contained spec. Everything needed to implement is in this file plus the
referenced source files — no other context required. Read the referenced
files before writing code. **Read `AGENTS.md` first** (this repo's Next.js
version has breaking changes vs. training data).

## Goal

During a workout, suggest weight + rep range + target RIR for the next set of
each exercise, auto-seed set rows from the model when a workout starts, and
show a one-line reason for every suggestion. The engine enforces double
progression (add reps within a range, then add weight and reset reps), uses
logged RIR as the feedback signal, respects weekly volume limits and Whoop
recovery, and is gym-aware.

## Hard constraints (violating any of these is a failed implementation)

1. **No new persisted/synced state.** Suggestions are computed purely from
   existing state on every render. Do not add fields to any zustand persist
   `partialize`, do not write to localStorage, do not touch `src/lib/sync.ts`.
   (Background: a login-time cloud pull rehydrates stores ~1–2s after load and
   can clobber early writes; `active`/`restTimer` are specially protected in
   `src/components/shell/sync-manager.tsx`. Stay out of that minefield.)
2. **Weights are stored canonically in lb** everywhere. The engine does all
   math in lb. Convert only at the display edge with `toDisplayWeight` /
   `toStoredWeight` from `src/lib/units.ts`. Increment sizes are computed in
   the *display* unit (5 lb / 2.5 kg) then converted back to lb for storage.
3. **History is gym-scoped.** Use `previousSets(sessions, exerciseId, gym)`
   from `src/stores/workout-store.ts`. Semantics of its `matchesGym`: sessions
   tagged with another gym do NOT count; untagged (legacy) sessions count at
   every gym.
4. **RIR data quirk:** `SetEntry.rir` is `number | null`. `null` = not logged.
   The picker stores `6` to mean "5+" (`src/components/gym/set-editor-sheet.tsx`
   line ~109). For all math, clamp `rir = min(rir, 5)`.
5. **Whoop is simulated unless connected.** Only apply the recovery layer when
   `useWhoopStore` has `connected === true`. Otherwise skip it entirely —
   the default `days` array is fake demo data.
6. **The engine is a pure module** (`src/lib/progression.ts`): no React, no
   store imports, no imports from `src/components/`. Callers pass data in.
   `weeklySetsByMuscle` currently lives inline in
   `src/components/gym/progress-tab.tsx` (~line 172) — reimplement the
   equivalent in the lib; do not import from the component.
7. Match repo code style: sparse comments (only non-obvious constraints),
   TypeScript strict, existing naming conventions.

## New module: `src/lib/progression.ts`

```ts
import type { Exercise, WorkoutSession } from "./types";
import type { WeightUnit } from "./units";

export interface SetSuggestion {
  /** Canonical lb. 0 for bodyweight movements. */
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

export function suggestNextSet(args: {
  sessions: WorkoutSession[];          // full history (store.sessions)
  active: WorkoutSession | null;       // in-progress session (store.active)
  exerciseId: string;
  setIndex: number;                    // 0-based index of the set to suggest
  gym: string | undefined;             // active.gym ?? currentGym
  routineTarget?: { targetReps: number };
  customExercises: Exercise[];
  units: WeightUnit;
  whoop?: WhoopContext;
  todayISO: string;                    // pass todayISO() in; keeps engine pure/testable
}): SetSuggestion | null;
```

Return `null` only when there is no basis at all (never trained anywhere AND
no routine target) — caller shows nothing.

### Constants (top of file, exported for tests)

```ts
export const TARGET_RIR_EARLY = 2;   // sets 1..n-1 (acceptable band 1–3)
export const TARGET_RIR_LAST = 1;    // final set (acceptable band 0–1)
export const SANDBAG_MARGIN = 2;     // (reps + rir) beats (hi + targetRir) by ≥ this → jump
export const MAX_JUMP_FRACTION = 0.10;
export const RUST_DAYS = 14;         // no exposure this long → 0.95× and no progression
export const RUST_FACTOR = 0.95;
export const NEW_GYM_FACTOR = 0.90;
export const RED_RECOVERY = 34;      // matches readiness() in src/lib/whoop.ts (<34 = red)
```

### Rep range

- With `routineTarget`: `lo = max(3, targetReps - 2)`, `hi = targetReps + 2`.
  (Routines store a single `targetReps` — see `RoutineExercise` in
  `src/lib/types.ts`; coach-generated splits store the mid-range value.)
- Without a routine (ad-hoc exercise), by `exercise.equipment`:
  barbell → 6–10; dumbbell/cable/machine/kettlebell → 8–12; bodyweight → 8–15.
- Look up the exercise with `getExercise(exerciseId, customExercises)` from
  `src/lib/exercises.ts` (it merges the built-in library + custom).

### Weight increment (one "step")

- Base step: 5 lb when `units === "lb"`, 2.5 kg (converted to lb, ≈5.51) when
  kg. Reuse the spirit of `weightStep` in `src/lib/units.ts`.
- Barbell exercises whose primary `muscle` is `quads`, `hamstrings`, or
  `glutes`: 2 steps (lower-body compounds progress faster).
- Cable/machine: 10 lb (typical stack pitch; reproduces the reference
  program's 150 → 160 lat-pulldown example) or 5 kg in kg mode.
- Round all final weights to the step grid *in the display unit*.

### Decision order (first matching rule wins)

Compute `last` = most recent finished session containing this exercise at this
gym (`previousSets`). Compute `completedThisSession` = completed sets for this
exercise in `active`.

**A. Within-session** (`completedThisSession.length > 0` — suggesting set k+1):
- Weight: same as the just-completed set.
- Predicted reps: `prevReps + (prevRir - targetRir) - 1` where `prevRir` is the
  just-logged RIR clamped to ≤5; if RIR is null use `prevReps - 1`.
- Clamp predicted reps to `[lo - 2, hi]`. If prediction < `lo - 2`, instead
  suggest one step lighter at `lo` reps, kind `"deload"`, reason mentions
  staying in range.
- Kind `"within"`. If RIR was null, append " · log RIR to sharpen this" to the
  reason.

**B. First set of the day** — apply these gates in order:

1. **No history anywhere** (any gym): if routine target exists → kind
   `"calibrate"`, `weightLb: 0`, range from routine, reason "find a weight you
   can hit for lo–hi at 2–3 RIR". Else return `null`.
2. **No history at this gym but history elsewhere/untagged returns []** (i.e.
   `previousSets(..., gym)` empty but `previousSets(..., undefined)` not):
   kind `"calibrate"`, weight = `NEW_GYM_FACTOR ×` most recent any-gym top-set
   weight, rounded to step; reason "new gym — machines differ, calibrating".
3. **Rust:** last exposure ≥ `RUST_DAYS` days before `todayISO` → kind
   `"deload"`, weight = `RUST_FACTOR × lastWeight` rounded to step, reps `lo`,
   reason "been N days — rebuild this session".
4. **Readiness veto** (only if `whoop?.connected`): today's recovery
   `< RED_RECOVERY`, or recovery `< RED_RECOVERY` on ≥2 of the last 3 entries
   in `days` → progression is *blocked* for today: skip rules 6–7 below,
   `targetRir += 1`, prepend "Low recovery — " to whatever reason results.
5. **Weekly volume guard:** completed sets this calendar week (Mon-start —
   reuse `startOfWeek` from `src/lib/dates.ts`; include `active`'s completed
   sets) for the exercise's primary muscle ≥ `VOLUME_LANDMARKS[muscle].mrv`
   (from `src/lib/fitness.ts`) → progression blocked; reason
   "«muscle» at N sets this week (MRV M) — holding".
6. **Once-per-week rule:** if the last session's weight for this exercise was
   already higher than the session before it, and that jump happened within
   the past 6 days → don't jump again. Kind `"match"`, same weight, reps =
   best reps from last session (clamped to range), reason "already progressed
   this week — match it".
7. **Double-progression triggers** (only reachable if 4–6 didn't block):
   - **Jump** if every set of `last` hit ≥ `hi` reps with RIR ≥ `TARGET_RIR_EARLY`
     (nulls count as passing — don't punish unlogged RIR), **or** the sandbag
     check fires on the top set: `(reps + min(rir,5)) - (hi + targetRir) ≥
     SANDBAG_MARGIN`.
     New weight = `lastWeight + step(s)`, additionally capped by
     `e1RM`-derived target: `wTarget = e1rm / (1 + (lo + targetRir) / 30)`
     (Epley inverse; `estimate1RM` is in `src/lib/fitness.ts`), i.e.
     `min(lastWeight + step, roundToStep(wTarget))`, but never more than
     `lastWeight × (1 + MAX_JUMP_FRACTION)` and never less than
     `lastWeight + 1 step`. Reps = `lo`. Kind `"progress"`.
   - **Struggle:** top set reps < `lo`, or any set at RIR 0 with reps < `lo`
     → same weight, reps `lo`, kind `"hold"`, reason "didn't reach N last
     time — own the bottom of the range first". (Weight *drop* only via the
     within-session rule or rust rule; cross-session we hold.)
   - **Default:** same weight, reps = `min(lastBestReps + 1, hi)`, kind
     `"hold"`, reason "+1 rep over last time".

**Bodyweight equipment:** weight is always 0 (unless history shows added
weight — then treat that number as the weight). Progress reps only; at the
top of range the reason says "add weight next time (dip belt/vest)".

### Helper also exported

```ts
/** Completed sets per muscle in the week containing `todayISO`, incl. active. */
export function weeklySetsForMuscle(
  sessions: WorkoutSession[],
  active: WorkoutSession | null,
  muscle: Muscle,
  todayISO: string,
  customExercises: Exercise[]
): number;
```

## Integration point 1: seeding in `startWorkout`

`src/stores/workout-store.ts`, `startWorkout` (~line 148). Current behavior
copies `prev[i]`'s weight/reps per set. New behavior, per exercise:

- Call `suggestNextSet` with `setIndex: 0`, `active: null`, the routine's
  target, `currentGym`, and whoop context read via
  `useWhoopStore.getState()` (store-to-store reads at call time are fine —
  the *engine* stays pure; the store action passes data in).
- `kind === "progress"`: every set seeds `{ weight: suggestion.weightLb,
  reps: suggestion.repsLo }`.
- `kind === "hold" | "match"`: keep today's per-set prev-copy behavior for
  weights, but seed reps as `min(prev[i].reps + 1, repsHi)` for "hold"
  (rep-progression pre-filled) and `prev[i].reps` for "match".
- `kind === "deload" | "calibrate"`: seed all sets `{ weight:
  suggestion.weightLb, reps: suggestion.repsLo }` (weight may be 0 for
  calibrate — the em-dash placeholder UI already handles 0).
- `null` suggestion: keep existing behavior exactly.

## Integration point 2: suggestion UI in the workout page

`src/app/gym/workout/page.tsx`, inside each exercise card, between the header
row and the column-header grid:

- Compute (in `useMemo` keyed on `active`, `sessions`) the suggestion for the
  first *uncompleted* set of each exercise (its index = `setIndex`).
- Render a compact row: accent-colored text
  `Next: {weight} {units} × {repsLo}–{repsHi} @ {targetRir} RIR` followed by
  the reason in `text-text-tertiary text-xs`, and an "Apply" ghost button.
- Apply → `updateSet(we.id, firstUncompleted.id, { weight: suggestion.weightLb,
  reps: suggestion.repsLo })`. Weight display must use `toDisplayWeight`.
- Suggestion recomputes automatically after `toggleSetComplete` because
  `active` changes — no store changes needed for this.
- Hide the row when suggestion is `null` or the exercise has no uncompleted
  sets.

## Integration point 3: set editor hint

`src/components/gym/set-editor-sheet.tsx`: when `target.field === "weight"`,
show a one-line hint under the `NumberInput`: suggested weight × reps and the
reason. The sheet doesn't currently receive history — pass the precomputed
`SetSuggestion | null` in via a new optional prop from the workout page
(`suggestion?: SetSuggestion | null`); do not import stores into the sheet.

## Test cases (must all pass before integration)

Write `/tmp`-style verification with `npx tsx` (pattern used throughout this
repo: build a scenarios array, run the real module, assert). Suggested file
while developing: `progression-check.mjs` at repo root, deleted after. Cases,
all with routine target 10 (range 8–12), machine exercise "lat-pulldown",
gym "LMU Gym", units lb, whoop disconnected unless stated:

| # | History (last session at gym) | Expect |
|---|---|---|
| 1 | 150×[12,12,12,12] all RIR 2 | progress → 160 (machine +10), reps 8, kind progress |
| 2 | 150×[10,9,8,8] RIR 2 | hold, 150, reps target 11 (best 10 + 1) |
| 3 | 150×[12] top set RIR 5 ("5+" stored as 6) | progress (sandbag), 160 |
| 4 | 150×[6,6,5] RIR 0 | hold, 150, reps 8, kind hold |
| 5 | within-session: just did 150×10 @ RIR 2 (target 2) | within, 150, predicted 9 |
| 6 | within-session: just did 150×10, RIR null | within, 150, predicted 9, reason mentions logging RIR |
| 7 | case 1 but back muscle already ≥ MRV (25) this week | no jump; hold + MRV reason |
| 8 | case 1 but whoop connected, today recovery 30 | no jump; targetRir 3; "Low recovery" reason |
| 9 | case 1 but last exposure 15 days ago | deload, 142.5→rounds to 145 (0.95×150 stepped), reps 8 |
| 10 | no history at "LA Fitness", history at LMU 150 | calibrate, 135 (0.90×150 stepped), new-gym reason |
| 11 | case 1 but weight already jumped 145→150 four days ago | match, 150, no second jump |
| 12 | bodyweight exercise (pull-up), last 3×[12,12,12] | reps-only progression; reason says add weight |
| 13 | never trained, routine target 10 | calibrate, weight 0, range 8–12 |
| 14 | units kg: case 1 | new weight lands on 2.5 kg grid when displayed |

Also verify the reference program's worked example end-to-end: weeks at
150×(8,8,8,8 → 12,12,12,12) hold, then jump to 160×8.

## Verification checklist for the implementer

1. `npm run build` — check the **exit code** (`echo EXIT=$?`), not just output.
2. All 14 engine cases pass via `npx tsx`.
3. Grep: no new keys added to any `partialize`, no `localStorage` writes, no
   component imports in `src/lib/progression.ts`.
4. UI verification is limited: the dev preview is auth-gated (Supabase login).
   Do NOT bypass or modify `app-shell.tsx` auth. Owner verifies UI on device
   after deploy.
5. Commit style: imperative summary + body explaining *why*; end with the
   repo's standard `Co-Authored-By: Claude <model> <noreply@anthropic.com>`
   trailer. Do not commit this spec's scratch test file.

## Out of scope (do not build)

Automatic deload-week detection, per-exercise rep-range overrides in the
routine editor, per-gym machine stack pitch settings, any ML.
