import type { WhoopDay } from "./whoop";

/**
 * Rule-based energy forecast for the day — a two-peak circadian curve
 * (mid-morning and early-evening peaks, early-afternoon dip) whose
 * height and shape are driven by last night's sleep and this morning's
 * recovery. A model, not a measurement: directionally useful, honest
 * about being an estimate.
 */
export interface EnergyPoint {
  /** decimal hour of day, 5..24 */
  hour: number;
  energy: number; // 0-100
}

const gauss = (t: number, center: number, width: number) =>
  Math.exp(-((t - center) ** 2) / (2 * width * width));

export function energyCurve(day: WhoopDay): EnergyPoint[] {
  const wake = day.sleep.waketime;
  const sleepDebt = Math.max(0, day.sleep.needed - day.sleep.hours);

  const baseline = 22 + day.recovery * 0.22 - sleepDebt * 4;
  const morningPeak = 34 * (0.55 + day.recovery / 220 + day.sleep.score / 320);
  const eveningPeak = 30 * (0.5 + day.recovery / 250 + day.sleep.score / 350);
  const dipDepth = 11 + sleepDebt * 3.5;

  const points: EnergyPoint[] = [];
  for (let hour = 5; hour <= 24; hour += 0.5) {
    let energy =
      baseline +
      morningPeak * gauss(hour, wake + 3.5, 2.2) +
      eveningPeak * gauss(hour, wake + 10.5, 2.6) -
      dipDepth * gauss(hour, wake + 7, 1.4);
    // Wind-down toward bedtime
    if (hour > wake + 13) energy -= (hour - (wake + 13)) * 6;
    // Pre-wake grogginess
    if (hour < wake + 0.5) energy = Math.min(energy, 25);
    points.push({ hour, energy: Math.round(Math.min(100, Math.max(5, energy))) });
  }
  return points;
}

export interface GymWindow {
  startHour: number;
  endHour: number;
  label: string;
  avgEnergy: number;
}

export function formatHour(decimal: number): string {
  const h24 = Math.floor(decimal) % 24;
  const m = Math.round((decimal % 1) * 60);
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Highest-energy 90-minute block between 8 AM and 9 PM. */
export function optimalGymWindow(curve: EnergyPoint[]): GymWindow {
  const candidates = curve.filter((p) => p.hour >= 8 && p.hour <= 21);
  let best = { start: 17, avg: 0 };
  for (let i = 0; i < candidates.length - 3; i++) {
    const block = candidates.slice(i, i + 4); // 4 half-hour points = 90 min span
    const avg = block.reduce((a, p) => a + p.energy, 0) / block.length;
    if (avg > best.avg) best = { start: block[0].hour, avg };
  }
  return {
    startHour: best.start,
    endHour: best.start + 1.5,
    label: `${formatHour(best.start)}–${formatHour(best.start + 1.5)}`,
    avgEnergy: Math.round(best.avg),
  };
}

/** Suggested bedtime to fully repay sleep need before the same wake time. */
export function recommendedBedtime(day: WhoopDay): string {
  const target =
    day.sleep.waketime + 24 - day.sleep.needed / (day.sleep.efficiency / 100) - 0.3;
  return formatHour(((target % 24) + 24) % 24);
}
