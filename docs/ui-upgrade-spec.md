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

Use this file **verbatim** — the SVG geometry below was rendered and
visually verified (front figure centered x=60, back figure x=180; arms hang
at ±12°, forearms at ±18°; silhouettes are composed from overlapping
same-color primitives so joins are invisible). Muscle groups render with
group-level `opacity` — NOT per-shape `fill-opacity` — so overlapping
shapes inside one muscle composite as a single uniform mass. Do not redraw
or "improve" the shapes.

```tsx
"use client";

import { VOLUME_LANDMARKS } from "@/lib/fitness";
import type { Muscle } from "@/lib/types";
import { cn } from "@/lib/utils";

type Shape =
  | { k: "c"; cx: number; cy: number; r: number; t?: string }
  | { k: "e"; cx: number; cy: number; rx: number; ry: number; t?: string }
  | { k: "r"; x: number; y: number; w: number; h: number; rx: number; t?: string }
  | { k: "p"; d: string; t?: string };

// Body silhouettes: head, neck, torso, arms, hands, legs, feet.
const NEUTRAL: Shape[] = [
  // front figure (cx=60)
  { k: "e", cx: 60, cy: 15, rx: 8, ry: 9.5 },
  { k: "r", x: 55.5, y: 22, w: 9, h: 8, rx: 2 },
  { k: "p", d: "M 38 34 Q 44 27 60 27 Q 76 27 82 34 L 78 47 Q 74 62 73 72 Q 75 80 75 86 L 71 95 Q 66 98 60 98 Q 54 98 49 95 L 45 86 Q 45 80 47 72 Q 46 62 42 47 Z" },
  { k: "r", x: -5.5, y: -2, w: 11, h: 36, rx: 5.5, t: "translate(40,34) rotate(12)" },
  { k: "r", x: -5.5, y: -2, w: 11, h: 36, rx: 5.5, t: "translate(80,34) rotate(-12)" },
  { k: "r", x: -4.5, y: -2, w: 9, h: 32, rx: 4.5, t: "translate(33.3,66) rotate(18)" },
  { k: "r", x: -4.5, y: -2, w: 9, h: 32, rx: 4.5, t: "translate(87,66) rotate(-18)" },
  { k: "c", cx: 23.5, cy: 97, r: 4 },
  { k: "c", cx: 96.5, cy: 97, r: 4 },
  { k: "r", x: 44, y: 88, w: 14, h: 44, rx: 7 },
  { k: "r", x: 62, y: 88, w: 14, h: 44, rx: 7 },
  { k: "r", x: 45.5, y: 128, w: 11, h: 36, rx: 5.5 },
  { k: "r", x: 63.5, y: 128, w: 11, h: 36, rx: 5.5 },
  { k: "r", x: 42.5, y: 161, w: 13, h: 6, rx: 3 },
  { k: "r", x: 64.5, y: 161, w: 13, h: 6, rx: 3 },
  // back figure (cx=180)
  { k: "e", cx: 180, cy: 15, rx: 8, ry: 9.5 },
  { k: "r", x: 175.5, y: 22, w: 9, h: 8, rx: 2 },
  { k: "p", d: "M 158 34 Q 164 27 180 27 Q 196 27 202 34 L 198 47 Q 194 62 193 72 Q 195 80 195 86 L 191 95 Q 186 98 180 98 Q 174 98 169 95 L 165 86 Q 165 80 167 72 Q 166 62 162 47 Z" },
  { k: "r", x: -5.5, y: -2, w: 11, h: 36, rx: 5.5, t: "translate(160,34) rotate(12)" },
  { k: "r", x: -5.5, y: -2, w: 11, h: 36, rx: 5.5, t: "translate(200,34) rotate(-12)" },
  { k: "r", x: -4.5, y: -2, w: 9, h: 32, rx: 4.5, t: "translate(153.3,66) rotate(18)" },
  { k: "r", x: -4.5, y: -2, w: 9, h: 32, rx: 4.5, t: "translate(207,66) rotate(-18)" },
  { k: "c", cx: 143.5, cy: 97, r: 4 },
  { k: "c", cx: 216.5, cy: 97, r: 4 },
  { k: "r", x: 164, y: 88, w: 14, h: 44, rx: 7 },
  { k: "r", x: 182, y: 88, w: 14, h: 44, rx: 7 },
  { k: "r", x: 165.5, y: 128, w: 11, h: 36, rx: 5.5 },
  { k: "r", x: 183.5, y: 128, w: 11, h: 36, rx: 5.5 },
  { k: "r", x: 162.5, y: 161, w: 13, h: 6, rx: 3 },
  { k: "r", x: 184.5, y: 161, w: 13, h: 6, rx: 3 },
];

// Anatomical muscle regions. "shoulders" and "forearms" appear on both
// figures and share one fill. "full body" has no region and is skipped.
// Back = traps kite + lat wings + spinal erectors, all one enum muscle.
const REGIONS: { muscle: Muscle; shapes: Shape[] }[] = [
  {
    muscle: "chest",
    shapes: [
      { k: "p", d: "M 61 33 Q 69 32 75.5 35.5 Q 77.5 41 75 47 Q 68 51.5 61 48.5 Z" },
      { k: "p", d: "M 59 33 Q 51 32 44.5 35.5 Q 42.5 41 45 47 Q 52 51.5 59 48.5 Z" },
    ],
  },
  {
    muscle: "back",
    shapes: [
      { k: "p", d: "M 180 27 Q 186 29 191 33 Q 186 45 180 52 Q 174 45 169 33 Q 174 29 180 27 Z" },
      { k: "p", d: "M 182 50 Q 190 48 195.5 44 Q 196.5 54 193 64 Q 188 73 182 77 Z" },
      { k: "p", d: "M 178 50 Q 170 48 164.5 44 Q 163.5 54 167 64 Q 172 73 178 77 Z" },
      { k: "r", x: 176.3, y: 62, w: 3.2, h: 20, rx: 1.6 },
      { k: "r", x: 180.5, y: 62, w: 3.2, h: 20, rx: 1.6 },
    ],
  },
  {
    muscle: "shoulders",
    shapes: [
      { k: "e", cx: 39, cy: 35.5, rx: 7, ry: 6.5 },
      { k: "e", cx: 81, cy: 35.5, rx: 7, ry: 6.5 },
      { k: "e", cx: 159, cy: 35.5, rx: 7, ry: 6.5 },
      { k: "e", cx: 201, cy: 35.5, rx: 7, ry: 6.5 },
    ],
  },
  {
    muscle: "core",
    shapes: [
      { k: "r", x: 52.5, y: 52, w: 7, h: 8, rx: 2 },
      { k: "r", x: 60.5, y: 52, w: 7, h: 8, rx: 2 },
      { k: "r", x: 52.5, y: 61, w: 7, h: 8, rx: 2 },
      { k: "r", x: 60.5, y: 61, w: 7, h: 8, rx: 2 },
      { k: "r", x: 52.5, y: 70, w: 7, h: 8, rx: 2 },
      { k: "r", x: 60.5, y: 70, w: 7, h: 8, rx: 2 },
      { k: "r", x: 52.5, y: 79, w: 7, h: 12, rx: 3 },
      { k: "r", x: 60.5, y: 79, w: 7, h: 12, rx: 3 },
      { k: "e", cx: 49.2, cy: 70, rx: 2.2, ry: 13 },
      { k: "e", cx: 70.8, cy: 70, rx: 2.2, ry: 13 },
    ],
  },
  {
    muscle: "biceps",
    shapes: [
      { k: "e", cx: 0, cy: 16, rx: 4.5, ry: 10, t: "translate(40,34) rotate(12)" },
      { k: "e", cx: 0, cy: 16, rx: 4.5, ry: 10, t: "translate(80,34) rotate(-12)" },
    ],
  },
  {
    muscle: "triceps",
    shapes: [
      { k: "e", cx: 0, cy: 16, rx: 4.5, ry: 10, t: "translate(160,34) rotate(12)" },
      { k: "e", cx: 0, cy: 16, rx: 4.5, ry: 10, t: "translate(200,34) rotate(-12)" },
    ],
  },
  {
    muscle: "forearms",
    shapes: [
      { k: "e", cx: 0, cy: 13, rx: 3.5, ry: 11, t: "translate(33.3,66) rotate(18)" },
      { k: "e", cx: 0, cy: 13, rx: 3.5, ry: 11, t: "translate(87,66) rotate(-18)" },
      { k: "e", cx: 0, cy: 13, rx: 3.5, ry: 11, t: "translate(153.3,66) rotate(18)" },
      { k: "e", cx: 0, cy: 13, rx: 3.5, ry: 11, t: "translate(207,66) rotate(-18)" },
    ],
  },
  {
    muscle: "quads",
    shapes: [
      { k: "e", cx: 47.4, cy: 105, rx: 3.2, ry: 14 },
      { k: "e", cx: 52.2, cy: 104, rx: 3.8, ry: 13.5 },
      { k: "e", cx: 55.8, cy: 115, rx: 2.6, ry: 7 },
      { k: "e", cx: 72.6, cy: 105, rx: 3.2, ry: 14 },
      { k: "e", cx: 67.8, cy: 104, rx: 3.8, ry: 13.5 },
      { k: "e", cx: 64.2, cy: 115, rx: 2.6, ry: 7 },
    ],
  },
  {
    muscle: "glutes",
    shapes: [
      { k: "e", cx: 173.5, cy: 93, rx: 7, ry: 8 },
      { k: "e", cx: 186.5, cy: 93, rx: 7, ry: 8 },
    ],
  },
  {
    muscle: "hamstrings",
    shapes: [
      { k: "e", cx: 168, cy: 116, rx: 3.5, ry: 14 },
      { k: "e", cx: 175.2, cy: 116, rx: 2.9, ry: 12.5 },
      { k: "e", cx: 192, cy: 116, rx: 3.5, ry: 14 },
      { k: "e", cx: 184.8, cy: 116, rx: 2.9, ry: 12.5 },
    ],
  },
  {
    muscle: "calves",
    shapes: [
      // front (tibialis) slivers
      { k: "e", cx: 48, cy: 142, rx: 2.6, ry: 10 },
      { k: "e", cx: 54.2, cy: 142, rx: 2.2, ry: 9 },
      { k: "e", cx: 72, cy: 142, rx: 2.6, ry: 10 },
      { k: "e", cx: 65.8, cy: 142, rx: 2.2, ry: 9 },
      // back (gastrocnemius) heads
      { k: "e", cx: 168.8, cy: 142, rx: 3, ry: 11 },
      { k: "e", cx: 174.4, cy: 143, rx: 2.2, ry: 10 },
      { k: "e", cx: 191.2, cy: 142, rx: 3, ry: 11 },
      { k: "e", cx: 185.6, cy: 143, rx: 2.2, ry: 10 },
    ],
  },
];

const NEUTRAL_FILL = "#2b2b33";
// Slightly lighter than the silhouette so untrained regions stay visible.
const UNTRAINED_FILL = "#383841";
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

function draw(s: Shape, key: number) {
  if (s.k === "c")
    return <circle key={key} cx={s.cx} cy={s.cy} r={s.r} transform={s.t} />;
  if (s.k === "e")
    return (
      <ellipse key={key} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.t} />
    );
  if (s.k === "r")
    return (
      <rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} transform={s.t} />
    );
  return <path key={key} d={s.d} transform={s.t} />;
}

export function MuscleBodyMap({ sets, mode, className }: MuscleBodyMapProps) {
  return (
    <svg
      viewBox="0 0 240 182"
      role="img"
      aria-label="Muscle load body map"
      className={cn("w-full max-w-xs", className)}
    >
      <g fill={NEUTRAL_FILL}>{NEUTRAL.map((s, i) => draw(s, i))}</g>
      {REGIONS.map((r) => {
        const { fill, opacity } = fillFor(r.muscle, sets[r.muscle] ?? 0, mode);
        return (
          // opacity on the <g>, never per shape: regions overlap internally
          // and must composite as one uniform mass.
          <g key={r.muscle} fill={fill} opacity={opacity}>
            {r.shapes.map((s, i) => draw(s, i))}
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
