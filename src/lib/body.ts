import { daysBetween } from "./dates";
import type { CycleCompound, Measurement, WeeklyWeightTarget } from "./types";
import { parseSex, type Sex } from "./strength";

// Body-composition + progress estimates. Body fat uses RFM (Relative Fat Mass),
// a validated waist-and-height estimate that needs no calipers:
//   men:   RFM = 64 − 20 × (height / waist)
//   women: RFM = 76 − 20 × (height / waist)
// (height and waist in the same units — inches here.)
export function estimateBodyFat(
  heightIn: number,
  waistIn: number,
  sex: Sex
): number | null {
  if (!heightIn || !waistIn) return null;
  const base = sex === "female" ? 76 : 64;
  const rfm = base - 20 * (heightIn / waistIn);
  if (!isFinite(rfm)) return null;
  return Math.round(Math.min(60, Math.max(3, rfm)) * 10) / 10;
}

/** Least-squares slope of value-over-time, expressed per week. Needs ≥2 points. */
export function trendPerWeek(points: { date: string; value: number }[]): number | null {
  if (points.length < 2) return null;
  const t0 = new Date(points[0].date).getTime();
  const xs = points.map((p) => (new Date(p.date).getTime() - t0) / 86_400_000); // days
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const perDay = num / den;
  return Math.round(perDay * 7 * 100) / 100;
}

/** Weeks to reach goal at the current rate, or null if not trending toward it. */
export function weeksToGoal(
  current: number,
  goal: number,
  perWeek: number
): number | null {
  const remaining = current - goal;
  // Losing weight toward a lower goal, or gaining toward a higher one.
  if (remaining > 0 && perWeek < 0) return Math.ceil(remaining / -perWeek);
  if (remaining < 0 && perWeek > 0) return Math.ceil(-remaining / perWeek);
  return null;
}

// ── cycle weight-target band ────────────────────────────────────────────
export function weekIndexForDate(dateISO: string, cycleStartISO: string): number {
  return Math.floor(daysBetween(cycleStartISO, dateISO) / 7) + 1;
}

/** The planned weight band for whatever week `dateISO` falls in, or null if
 * outside the target table (before the cycle started or past its last week). */
export function weightTargetForDate(
  dateISO: string,
  cycleStartISO: string,
  targets: WeeklyWeightTarget[]
): { lowLb: number; highLb: number } | null {
  const week = weekIndexForDate(dateISO, cycleStartISO);
  const t = targets.find((x) => x.week === week);
  return t ? { lowLb: t.lowLb, highLb: t.highLb } : null;
}

// ── compound dose escalation readiness ──────────────────────────────────
// Heuristic, not medical advice: "stalled" means the last 2 weeks of weight
// are essentially flat. Doesn't (and can't) check diet adherence — that's
// left for the person to confirm themselves before acting on this.
const STALL_THRESHOLD_LB_PER_WEEK = 0.25;
const MIN_WEEKS_AT_DOSE = 5;

export interface EscalationCheck {
  weeksAtDose: number;
  stalled: boolean;
  ready: boolean;
}

export function escalationCheck(
  compound: CycleCompound,
  measurements: Measurement[],
  todayISO_: string
): EscalationCheck {
  const weeksAtDose = Math.max(
    0,
    Math.floor(daysBetween(compound.startDate, todayISO_) / 7)
  );
  const recent = measurements
    .filter((m) => {
      if (m.weight === undefined) return false;
      const age = daysBetween(m.date, todayISO_);
      return age >= 0 && age <= 14;
    })
    .map((m) => ({ date: m.date, value: m.weight! }));
  const trend = trendPerWeek(recent);
  const stalled = trend !== null && Math.abs(trend) < STALL_THRESHOLD_LB_PER_WEEK;
  return { weeksAtDose, stalled, ready: weeksAtDose >= MIN_WEEKS_AT_DOSE && stalled };
}

export interface BodyReport {
  latestWeight: number | null;
  startWeight: number | null;
  weightDelta: number | null; // since first logged
  latestWaist: number | null;
  waistDelta: number | null;
  bodyFat: number | null; // latest estimate (RFM) or logged value
  weightPerWeek: number | null;
  waistPerWeek: number | null;
  weeksToGoal: number | null;
  /** date → estimated/logged body-fat %, oldest first. */
  bfSeries: { date: string; value: number }[];
}

export function bodyReport(
  measurements: Measurement[],
  heightIn: number,
  sexRaw: string | undefined,
  goalWeightLb: number
): BodyReport {
  const sex = parseSex(sexRaw);
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));

  const weights = sorted.filter((m) => m.weight !== undefined);
  const waists = sorted.filter((m) => m.waist !== undefined);

  const latestWeight = weights.at(-1)?.weight ?? null;
  const startWeight = weights[0]?.weight ?? null;
  const latestWaist = waists.at(-1)?.waist ?? null;

  // Body fat per entry: prefer a logged value, else estimate from waist.
  const bfSeries = sorted
    .map((m) => {
      const bf =
        m.bodyFat ??
        (m.waist ? estimateBodyFat(heightIn, m.waist, sex) : null);
      return bf != null ? { date: m.date, value: bf } : null;
    })
    .filter((x): x is { date: string; value: number } => x !== null);

  const weightPerWeek = trendPerWeek(
    weights.map((m) => ({ date: m.date, value: m.weight! }))
  );
  const waistPerWeek = trendPerWeek(
    waists.map((m) => ({ date: m.date, value: m.waist! }))
  );

  return {
    latestWeight,
    startWeight,
    weightDelta:
      latestWeight != null && startWeight != null
        ? Math.round((latestWeight - startWeight) * 10) / 10
        : null,
    latestWaist,
    waistDelta:
      latestWaist != null && waists[0]?.waist != null
        ? Math.round((latestWaist - waists[0].waist!) * 10) / 10
        : null,
    bodyFat: bfSeries.at(-1)?.value ?? null,
    weightPerWeek,
    waistPerWeek,
    weeksToGoal:
      latestWeight != null && goalWeightLb > 0 && weightPerWeek != null
        ? weeksToGoal(latestWeight, goalWeightLb, weightPerWeek)
        : null,
    bfSeries,
  };
}
