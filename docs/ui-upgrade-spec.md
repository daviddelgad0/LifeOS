# Implementation spec: Gym UI upgrade (body map, warmup sets, today strip, ladder, overrides)

Self-contained spec: everything needed is in this file plus the referenced
source files — no other context required. Read every referenced file before
writing code. **Read `AGENTS.md` first** (this repo's Next.js version has
breaking changes vs. training data).

Five phases, **implemented and committed in order, one commit per phase**.
Each phase is independently shippable. Do not start a phase until the
previous one builds clean (`npm run build; echo EXIT=$?` → `EXIT=0`) and its
checks pass.

## Hard constraints (violating any of these is a failed implementation)

1. **No new zustand persist keys.** Adding *optional fields* to types already
   persisted (e.g. `SetEntry.warmup`, `WorkoutSession.routineId`,
   `RoutineExercise.repLo`) is fine — `sessions`/`routines` are already in
   `partialize`. Adding new top-level keys to any `partialize` is NOT.
   Do not touch `src/lib/sync.ts` or `src/components/shell/sync-manager.tsx`.
2. **Weights are stored canonically in lb.** Convert only at the display edge
   (`toDisplayWeight` / `toStoredWeight` in `src/lib/units.ts`).
3. **Pure lib modules stay pure**: nothing in `src/lib/` may import React,
   stores, or components. Callers pass data in.
4. **RIR quirk**: stored `rir` of `6` means "5+". Existing code handles it;
   don't break it.
5. **The dev preview is auth-gated (Supabase).** Do NOT bypass or modify
   `app-shell.tsx` auth. Verify logic via `npx tsx` scratch scripts (pattern:
   build a scenarios array, import the real module, assert) and `npm run
   build` exit code. Owner verifies UI on device after deploy.
6. Match repo style: sparse comments (non-obvious constraints only), strict
   TS, existing naming. Scratch test files live at repo root while
   developing and are **deleted before commit**.
7. Commit style: imperative summary + body explaining *why*, ending with the
   trailer `Co-Authored-By: Claude <model name> <noreply@anthropic.com>`.

Files to read before starting: `src/lib/types.ts`, `src/lib/fitness.ts`,
`src/lib/progression.ts`, `src/lib/units.ts`, `src/lib/dates.ts`,
`src/stores/workout-store.ts`, `src/app/gym/workout/page.tsx`,
`src/components/gym/progress-tab.tsx`, `src/components/gym/log-tab.tsx`,
`src/components/gym/set-editor-sheet.tsx`,
`src/components/gym/routine-editor.tsx`.

---

## Phase 1 — Muscle body map

### 1a. New helper in `src/lib/fitness.ts`

```ts
/**
 * Weighted completed-set counts per muscle for one session.
 * Primary muscle counts 1 per set, each secondary muscle 0.5.
 * Skips warmup-flagged sets (field added in a later phase; the
 * `!s.warmup` filter is written now and is a no-op until then).
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
```

`fitness.ts` doesn't currently import `getExercise` — add
`import { getExercise } from "./exercises";` (lib→lib import is allowed).
NOTE: until Phase 2 lands, `s.warmup` does not exist on `SetEntry`; to keep
Phase 1 compiling standalone, write the filter as `s.completed` only, and
add `&& !s.warmup` in Phase 2 (it is listed there as a call site).

### 1b. New component `src/components/gym/muscle-body-map.tsx`

Use this file **verbatim** — the SVG geometry below is pre-checked for
overlaps and symmetry (front figure centered x=60, back figure x=180; delts
drawn after the back/lat mass so they sit on top). Do not redraw or "improve"
the shapes.

```tsx
"use client";

import { VOLUME_LANDMARKS } from "@/lib/fitness";
import type { Muscle } from "@/lib/types";
import { cn } from "@/lib/utils";

type Shape =
  | { k: "c"; cx: number; cy: number; r: number }
  | { k: "r"; x: number; y: number; w: number; h: number; rx: number }
  | { k: "p"; d: string };

// Neutral silhouette (head, neck, pelvis, hands, front shins, feet).
const NEUTRAL: Shape[] = [
  // front figure
  { k: "c", cx: 60, cy: 16, r: 9 },
  { k: "r", x: 56, y: 24, w: 8, h: 7, rx: 2 },
  { k: "r", x: 48, y: 76, w: 24, h: 10, rx: 4 },
  { k: "c", cx: 34, cy: 93, r: 3.5 },
  { k: "c", cx: 86, cy: 93, r: 3.5 },
  { k: "r", x: 48.5, y: 126, w: 9, h: 30, rx: 4.5 },
  { k: "r", x: 62.5, y: 126, w: 9, h: 30, rx: 4.5 },
  { k: "r", x: 45, y: 158, w: 12, h: 5, rx: 2.5 },
  { k: "r", x: 63, y: 158, w: 12, h: 5, rx: 2.5 },
  // back figure
  { k: "c", cx: 180, cy: 16, r: 9 },
  { k: "r", x: 176, y: 24, w: 8, h: 7, rx: 2 },
  { k: "c", cx: 154, cy: 93, r: 3.5 },
  { k: "c", cx: 206, cy: 93, r: 3.5 },
  { k: "r", x: 165, y: 154, w: 12, h: 5, rx: 2.5 },
  { k: "r", x: 183, y: 154, w: 12, h: 5, rx: 2.5 },
];

// Muscle regions. "shoulders" and "forearms" appear on both figures and
// share one fill. Order matters: the back/lat path is listed before
// shoulders so rear delts render on top of it. "full body" has no region.
const REGIONS: { muscle: Muscle; shapes: Shape[] }[] = [
  {
    muscle: "back",
    shapes: [
      {
        k: "p",
        d: "M 168 30 L 192 30 Q 196 30 196.5 37 L 196 50 Q 192.5 65 188.5 73 L 171.5 73 Q 167.5 65 164 50 L 163.5 37 Q 164 30 168 30 Z",
      },
    ],
  },
  {
    muscle: "shoulders",
    shapes: [
      { k: "c", cx: 40, cy: 36, r: 6.5 },
      { k: "c", cx: 80, cy: 36, r: 6.5 },
      { k: "c", cx: 160, cy: 36, r: 6.5 },
      { k: "c", cx: 200, cy: 36, r: 6.5 },
    ],
  },
  {
    muscle: "chest",
    shapes: [
      { k: "r", x: 47, y: 32, w: 12.5, h: 14, rx: 5 },
      { k: "r", x: 60.5, y: 32, w: 12.5, h: 14, rx: 5 },
    ],
  },
  { muscle: "core", shapes: [{ k: "r", x: 50, y: 48, w: 20, h: 26, rx: 6 }] },
  {
    muscle: "biceps",
    shapes: [
      { k: "r", x: 31, y: 44, w: 9, h: 20, rx: 4.5 },
      { k: "r", x: 80, y: 44, w: 9, h: 20, rx: 4.5 },
    ],
  },
  {
    muscle: "triceps",
    shapes: [
      { k: "r", x: 150.5, y: 44, w: 9, h: 20, rx: 4.5 },
      { k: "r", x: 200.5, y: 44, w: 9, h: 20, rx: 4.5 },
    ],
  },
  {
    muscle: "forearms",
    shapes: [
      { k: "r", x: 30, y: 66, w: 8, h: 22, rx: 4 },
      { k: "r", x: 82, y: 66, w: 8, h: 22, rx: 4 },
      { k: "r", x: 150, y: 66, w: 8, h: 22, rx: 4 },
      { k: "r", x: 202, y: 66, w: 8, h: 22, rx: 4 },
    ],
  },
  {
    muscle: "quads",
    shapes: [
      { k: "r", x: 46.5, y: 88, w: 12, h: 34, rx: 6 },
      { k: "r", x: 61.5, y: 88, w: 12, h: 34, rx: 6 },
    ],
  },
  {
    muscle: "glutes",
    shapes: [
      { k: "r", x: 167, y: 76, w: 12.5, h: 12, rx: 6 },
      { k: "r", x: 180.5, y: 76, w: 12.5, h: 12, rx: 6 },
    ],
  },
  {
    muscle: "hamstrings",
    shapes: [
      { k: "r", x: 167, y: 90, w: 12, h: 31, rx: 6 },
      { k: "r", x: 181, y: 90, w: 12, h: 31, rx: 6 },
    ],
  },
  {
    muscle: "calves",
    shapes: [
      { k: "r", x: 168.5, y: 123, w: 9.5, h: 28, rx: 4.75 },
      { k: "r", x: 182, y: 123, w: 9.5, h: 28, rx: 4.75 },
    ],
  },
];

const NEUTRAL_FILL = "#26262e";
const UNTRAINED_FILL = "#26262e";
const OVER_MRV_FILL = "#f59e0b";

interface MuscleBodyMapProps {
  /** Weighted set counts per muscle (primary 1, secondary 0.5). */
  sets: Partial<Record<Muscle, number>>;
  /**
   * "landmarks": colors by weekly volume vs MEV/MRV (progress tab).
   * "load": colors by this-session load, saturating at 6 sets.
   */
  mode: "landmarks" | "load";
  className?: string;
}

function fillFor(
  muscle: Muscle,
  n: number,
  mode: MuscleBodyMapProps["mode"]
): { fill: string; opacity: number } {
  if (n <= 0) return { fill: UNTRAINED_FILL, opacity: 1 };
  if (mode === "load") {
    const t = Math.min(n / 6, 1);
    return { fill: "var(--accent)", opacity: 0.25 + 0.75 * t };
  }
  const { mev, mrv } = VOLUME_LANDMARKS[muscle];
  if (n > mrv) return { fill: OVER_MRV_FILL, opacity: 0.9 };
  if (n < mev) return { fill: "var(--accent)", opacity: 0.25 };
  const t = mrv === mev ? 1 : (n - mev) / (mrv - mev);
  return { fill: "var(--accent)", opacity: 0.45 + 0.55 * t };
}

function draw(s: Shape, fill: string, opacity: number, key: number) {
  const common = { fill, fillOpacity: opacity, key };
  if (s.k === "c") return <circle cx={s.cx} cy={s.cy} r={s.r} {...common} />;
  if (s.k === "r")
    return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common} />;
  return <path d={s.d} {...common} />;
}

export function MuscleBodyMap({ sets, mode, className }: MuscleBodyMapProps) {
  return (
    <svg
      viewBox="0 0 240 182"
      role="img"
      aria-label="Muscle load body map"
      className={cn("w-full max-w-xs", className)}
    >
      {NEUTRAL.map((s, i) => draw(s, NEUTRAL_FILL, 1, i))}
      {REGIONS.map((r) => {
        const { fill, opacity } = fillFor(r.muscle, sets[r.muscle] ?? 0, mode);
        return (
          <g key={r.muscle}>
            {r.shapes.map((s, i) => draw(s, fill, opacity, i))}
          </g>
        );
      })}
      <text x="60" y="176" textAnchor="middle" fontSize="8" fill="#8e8e97">
        Front
      </text>
      <text x="180" y="176" textAnchor="middle" fontSize="8" fill="#8e8e97">
        Back
      </text>
    </svg>
  );
}
```

### 1c. Progress tab integration

`src/components/gym/progress-tab.tsx`, in the "Volume Landmarks" section
(~line 368): the section currently renders a header then a grid of
`LandmarkBar`s fed by `weeklySetsByMuscle`. Insert the map between the
header row and the grid, centered:

```tsx
<div className="flex justify-center">
  <MuscleBodyMap sets={weeklySetsByMuscle} mode="landmarks" />
</div>
```

plus a one-line legend under it, `text-[0.6rem] text-text-tertiary`
centered: `dim = below MEV · bright = optimal · amber = over MRV`.
Keep the existing bars — the map is the overview, bars are the detail.

### 1d. End-workout dialog integration

`src/app/gym/workout/page.tsx`, in the end-workout `Dialog` ("Workout
summary", ~line 625): after the 2×2 stat grid and before the
`musclesHit` "Trained: …" line, add:

```tsx
<div className="flex justify-center">
  <MuscleBodyMap
    sets={sessionSetsByMuscle(active, customExercises)}
    mode="load"
  />
</div>
```

Import `sessionSetsByMuscle` from `@/lib/fitness` and `MuscleBodyMap` from
`@/components/gym/muscle-body-map`. Keep the "Trained:" text line.

### Phase 1 checks

- `npx tsx` scratch test for `sessionSetsByMuscle`: a session with 3
  completed bench-press sets (primary chest, secondary shoulders+triceps in
  the library) yields `{ chest: 3, shoulders: 1.5, triceps: 1.5 }`; sets with
  `completed: false` don't count; unknown exerciseId contributes nothing.
- Build exit 0. Grep: `muscle-body-map.tsx` imports nothing from
  `src/stores/`.

---

## Phase 2 — Warmup set tagging

### 2a. Schema

`src/lib/types.ts`, `SetEntry`: add `warmup?: boolean;` after `rir`.
Optional → old persisted/synced data needs no migration.

### 2b. Every consumer of "completed sets" that reasons about strength or
hard-set volume must exclude warmups

Exact call sites (grep `completed` in each file to confirm you got all):

1. `src/lib/progression.ts`
   - `exerciseSessionsDesc`: `we.sets.filter((x) => x.completed && !x.warmup)`
   - `bestE1rmAtGym`: skip sets where `!set.completed || set.warmup`
   - `weeklySetsForMuscle`: count `x.completed && !x.warmup`
   - section A `completedThisSession`: filter `s.completed && !s.warmup`
2. `src/stores/workout-store.ts`
   - `previousSets`: `we.sets.filter((x) => x.completed && !x.warmup)` — the
     prev column and startWorkout seeding then reference working sets only.
   - `bestFor`: skip `set.warmup` (PR baseline must ignore warmups).
   - `toggleSetComplete` (~line 393): a warmup set can never be a PR —
     `const pr = !target.warmup && target.weight > 0 && (…)` .
3. `src/lib/fitness.ts`
   - `sessionSetsByMuscle` (from Phase 1): add `&& !s.warmup`.
   - `sessionVolume`: **leave unchanged** — tonnage is total work done,
     warmups included. Only strength/PR/hard-set-count math excludes them.
4. `src/components/gym/progress-tab.tsx`
   - the inline `weeklySetsByMuscle` memo (~line 172):
     `we.sets.filter((x) => x.completed && !x.warmup).length`.
5. `src/app/gym/workout/page.tsx`
   - `topSet` reduce inside the exercise-card map (feeds the e1RM header
     stat): require `s.completed && !s.warmup`.

Do NOT change: `sessionVolume`, `sessionCalories`, XP/streak logic, cardio.

### 2c. UI toggle

`src/app/gym/workout/page.tsx`, `SetRow`: the first grid cell is currently a
plain `<span>` with the set number. Replace with a button that toggles the
flag (SetRow already has `updateSet` in scope):

```tsx
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
```

Add a hint to the existing footer tip line ("Swipe a set left to delete…"):
append ` Tap the set number to mark a warm-up.`

### Phase 2 checks

- `npx tsx` scratch test against `progression.ts`: one finished session with
  sets `[95×10 warmup, 150×8, 150×8]` (all completed, RIR 2, machine
  exercise, lb, routine target 10) → suggestion weight is based on 150, not
  95; `weeklySetsForMuscle` counts 2, not 3.
- Build exit 0; grep confirms no `partialize` changes.

---

## Phase 3 — "Should I push today?" strip on the Gym landing tab

### 3a. Helpers in `src/lib/fitness.ts` (pure, exported)

```ts
/** Completed non-warmup sets in the week of `todayISO` vs. the week before. */
export function weeklySetTotals(
  sessions: WorkoutSession[],
  todayISO: string
): { thisWeek: number; lastWeek: number };

/** Days since each muscle (primary only) last got a completed non-warmup set.
 *  Muscles never trained are absent. Finished sessions only. */
export function daysSinceByMuscle(
  sessions: WorkoutSession[],
  todayISO: string,
  customExercises: Exercise[]
): Partial<Record<Muscle, number>>;
```

Implementation notes: `startOfWeek`/`addDays`/`daysBetween` come from
`src/lib/dates.ts` (Monday-start weeks). `thisWeek` = sessions with
`endedAt` and `date >= startOfWeek(today)`; `lastWeek` = `date >=
addDays(weekStart, -7) && date < weekStart`. For `daysSinceByMuscle`, walk
finished sessions, track the max date per primary muscle, convert to
`daysBetween(lastDate, todayISO)`.

### 3b. UI

`src/components/gym/log-tab.tsx`: directly under the readiness copy `<p>`
(~line 78–87) and the active-workout banner, add one card:

```tsx
<section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3">
  <div className="flex items-baseline gap-2">
    <span className="font-mono text-lg font-medium">{totals.thisWeek}</span>
    <span className="text-xs text-text-tertiary">sets this week</span>
    {totals.lastWeek > 0 && totals.thisWeek !== totals.lastWeek && (
      <span className={cn("font-mono text-xs", totals.thisWeek > totals.lastWeek ? "text-emerald-400" : "text-red-400")}>
        {totals.thisWeek > totals.lastWeek ? "+" : ""}
        {Math.round(((totals.thisWeek - totals.lastWeek) / totals.lastWeek) * 100)}%
      </span>
    )}
  </div>
  {stale.map(([m, d]) => (
    <span key={m} className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-text-tertiary">
      {m} · {d}d
    </span>
  ))}
</section>
```

where `totals = weeklySetTotals(sessions, todayISO())` and `stale` = entries
of `daysSinceByMuscle(...)` with `d >= 4`, sorted descending, top 3, both in
`useMemo` keyed on `sessions`. `sessions` and `customExercises` are already
available from `useWorkoutStore` in this component (check imports; add
selectors if missing). Skip the whole card when there are no finished
sessions.

### Phase 3 checks

- `npx tsx` test: two sessions this week (3 + 4 non-warmup completed sets)
  and one last week (5 sets) → `{ thisWeek: 7, lastWeek: 5 }`; a session
  9 days ago training back → `daysSinceByMuscle` has `back: 9`; warmup sets
  don't count.
- Build exit 0.

---

## Phase 4 — Progression ladder (expandable suggestion row)

### 4a. New export in `src/lib/progression.ts`

```ts
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
}): LadderRung[] | null;
```

Implementation: reuse the module's own private helpers —
`exerciseSessionsDesc` for history, `topSetOf`, `repRangeFor`,
`progressStepDisplay`, `displayStepToLb`, `roundWeightToStep`. Compute
`lastWeightLb`/`lastBestReps` exactly as `suggestNextSet` does. Rungs:
`for r = max(lo, lastBestReps + 1) … hi` → `{ weightLb: lastWeightLb, reps:
r, jump: false }`; then one rung `{ weightLb: roundWeightToStep(lastWeightLb
+ stepLb, stepDisplay, units), reps: lo, jump: true }`. Bodyweight
exercises: hold rungs as above, and the jump rung keeps the same weight
(callers render it as "add weight"). Cap at 6 rungs total (slice from the
start so the jump rung always survives).

### 4b. UI

`src/app/gym/workout/page.tsx`: the suggestion row (accent-bordered box per
exercise card) gets a chevron toggle. Add page-level state
`const [ladderFor, setLadderFor] = useState<string | null>(null);`. In the
suggestion row, next to Apply, a ghost icon button (`ChevronDown` /
`ChevronUp` from lucide) toggling `ladderFor === we.id ? null : we.id`.
When open, render under the row:

```tsx
{ladderFor === we.id && ladder && (
  <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised px-3 py-2">
    {ladder.map((r, i) => (
      <span key={i} className={cn("font-mono text-xs", r.jump ? "text-accent" : "text-text-secondary")}>
        {r.jump ? "→ " : ""}
        {toDisplayWeight(r.weightLb, units)} {units} × {r.reps}
        {r.jump ? " (add weight)" : ""}
      </span>
    ))}
  </div>
)}
```

`ladder` comes from a `useMemo` map like `suggestionByExercise` (same keying
on `active`/`sessions`), calling `progressionLadder` per exercise with
`gym: active.gym ?? currentGym`.

### Phase 4 checks

- `npx tsx`: machine exercise, lb, last 150×10, range 8–12 →
  `[150×11, 150×12, 160×8(jump)]`. Last 150×12 → `[160×8(jump)]` only.
  No history → `null`. kg mode: jump weight displays on the 2.5 kg grid.
- Build exit 0.

---

## Phase 5 — Per-exercise progression overrides

### 5a. Schema

`src/lib/types.ts`:
- `RoutineExercise`: add `repLo?: number; repHi?: number; stepLb?: number;`
  (stepLb canonical lb).
- `WorkoutSession`: add `routineId?: string;` so mid-workout suggestions can
  find the routine that started the session. Optional → no migration.

### 5b. Engine

`src/lib/progression.ts`: widen the `routineTarget` parameter type on BOTH
`suggestNextSet` and `progressionLadder` to
`{ targetReps: number; repLo?: number; repHi?: number; stepLb?: number }`.
- `repRangeFor`: if `routineTarget?.repLo && routineTarget?.repHi`, return
  `{ lo: max(1, repLo), hi: max(lo, repHi) }` — user override beats the
  equipment-based natural range. Otherwise unchanged.
- `progressStepDisplay` currently takes `(exercise, units)`; thread an
  optional `stepLb` through: where jump steps are computed, if
  `routineTarget?.stepLb` is set use
  `stepDisplay = units === "kg" ? lbToKg(stepLb) : stepLb` instead of the
  equipment default.

### 5c. Store

`src/stores/workout-store.ts` `startWorkout`: pass the whole override
through — `routineTarget: { targetReps: re.targetReps, repLo: re.repLo,
repHi: re.repHi, stepLb: re.stepLb }` — and set `routineId: routine?.id` on
the new `active` session object.

### 5d. Workout page

`src/app/gym/workout/page.tsx`: in the `suggestionByExercise` and ladder
memos, look up `const routine = routines.find((r) => r.id ===
active.routineId)` (add the `routines` selector), then per exercise
`const re = routine?.exercises.find((x) => x.exerciseId === we.exerciseId)`
and pass `routineTarget: re && { targetReps: re.targetReps, repLo: re.repLo,
repHi: re.repHi, stepLb: re.stepLb }`.

### 5e. Routine editor

`src/components/gym/routine-editor.tsx` (~line 129–160): each exercise row
has three numeric `Input`s (sets/reps/rest). Add a fourth and fifth field in
an "Advanced" disclosure per exercise (a small text button toggling a row):
"Rep range" (two inputs, lo/hi, blank = auto) and "Weight step" (one input
in the user's display unit; store via `toStoredWeight`, display via
`toDisplayWeight`; blank = auto). Blank inputs must write `undefined`, not
`0` — `0` would activate the override.

### Phase 5 checks

- `npx tsx`: machine exercise with override `repLo 5, repHi 8, stepLb 5`,
  last session all sets at 8 reps RIR 2 → progress fires at hi=8 and jumps
  +5 lb (not the machine default 10). No override → behavior identical to
  before (re-run the Phase 4 ladder cases unchanged).
- Build exit 0; grep confirms `partialize` untouched.

---

## Out of scope (do not build)

Sub-muscle heads (rear/lateral delt etc.), GPS gym auto-tagging, Apple
Watch anything, nutrition, %1RM reference lines on charts, automatic
deload weeks, editing the SVG geometry.

## Final verification (after all phases)

1. `npm run build; echo EXIT=$?` → 0.
2. All `npx tsx` scratch checks pass; scratch files deleted.
3. `git log --oneline` shows five commits, one per phase, correct trailer.
4. Greps: no store/component imports in `src/lib/*`; no `localStorage`
   writes added; every `partialize` unchanged.
