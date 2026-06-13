import { addDays, todayISO } from "./dates";
import { SEED_SESSIONS } from "./seed";

/**
 * Simulated Whoop feed — same shape the real API returns in Phase 2.
 * Generated fresh per load, anchored to today and correlated with the
 * actual workout log (training days carry higher strain, hard days
 * depress next-morning recovery). Swap `WHOOP_DAYS` for the /api/whoop
 * response when OAuth lands; nothing downstream changes.
 */
export interface WhoopSleep {
  /** 0-100 — how much of needed sleep was banked */
  score: number;
  hours: number;
  needed: number;
  efficiency: number; // 0-100
  deepHrs: number;
  remHrs: number;
  lightHrs: number;
  awakeHrs: number;
  /** decimal hour of day, e.g. 23.5 = 11:30 PM */
  bedtime: number;
  /** decimal hour of day, e.g. 7.25 = 7:15 AM */
  waketime: number;
}

export interface WhoopDay {
  date: string;
  recovery: number; // 0-100
  strain: number; // 0-21 (Whoop scale)
  hrv: number; // ms
  rhr: number; // bpm
  respRate: number; // breaths/min
  calories: number;
  sleep: WhoopSleep;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

function buildDays(): WhoopDay[] {
  const rand = mulberry32(11062026);
  const today = todayISO();
  const trainingDays = new Set(
    SEED_SESSIONS.filter((s) => s.endedAt).map((s) => s.date)
  );

  const days: WhoopDay[] = [];
  let prevStrain = 10;
  let hrvBase = 62;

  for (let offset = -29; offset <= 0; offset++) {
    const date = addDays(today, offset);

    // Sleep first — it drives recovery.
    const needed = round1(8 + (prevStrain > 14 ? 0.5 : 0) + rand() * 0.3);
    const slept = round1(clamp(needed - 1.8 + rand() * 2.4, 5.2, 9.4));
    const efficiency = Math.round(clamp(86 + rand() * 10, 80, 96));
    const bedtime = round1(22.7 + rand() * 1.6); // 10:42 PM – 12:18 AM
    const waketime = round1(bedtime - 24 + slept / (efficiency / 100) + 0.2);
    const deep = round1(slept * (0.17 + rand() * 0.06));
    const rem = round1(slept * (0.2 + rand() * 0.07));
    const awake = round1(slept * (1 / (efficiency / 100) - 1));
    const light = round1(Math.max(0, slept - deep - rem));
    const sleepScore = Math.round(clamp((slept / needed) * 100, 40, 100));

    // Recovery responds to sleep and yesterday's strain.
    hrvBase = clamp(hrvBase + (rand() - 0.5) * 4, 48, 78);
    const sleepFactor = (sleepScore - 70) * 0.55;
    const strainFactor = (12 - prevStrain) * 1.6;
    const recovery = Math.round(
      clamp(58 + sleepFactor + strainFactor + (rand() - 0.5) * 18, 12, 99)
    );
    const hrv = Math.round(hrvBase + (recovery - 60) * 0.35 + (rand() - 0.5) * 6);
    const rhr = Math.round(clamp(60 - (recovery - 60) * 0.12 + rand() * 4, 50, 70));
    const respRate = round1(13.8 + rand() * 1.4);

    // Strain: training days spike it; rest days stay conversational.
    const trained = trainingDays.has(date);
    const strain = round1(
      trained
        ? clamp(12.5 + rand() * 5.5, 11, 19.5)
        : clamp(5 + rand() * 4.5, 3.5, 10)
    );
    const calories = Math.round(1850 + strain * 95 + rand() * 180);

    days.push({
      date,
      recovery,
      strain,
      hrv,
      rhr,
      respRate,
      calories,
      sleep: {
        score: sleepScore,
        hours: slept,
        needed,
        efficiency,
        deepHrs: deep,
        remHrs: rem,
        lightHrs: light,
        awakeHrs: awake,
        bedtime,
        waketime,
      },
    });
    prevStrain = strain;
  }
  return days;
}

export const WHOOP_DAYS: WhoopDay[] = buildDays();

export function whoopToday(): WhoopDay {
  return WHOOP_DAYS[WHOOP_DAYS.length - 1];
}

export type Readiness = "green" | "yellow" | "red";

export function readiness(recovery: number): Readiness {
  if (recovery >= 67) return "green";
  if (recovery >= 34) return "yellow";
  return "red";
}

export const READINESS_COLOR: Record<Readiness, string> = {
  green: "var(--accent)",
  yellow: "#FFB800",
  red: "#FF4444",
};

export function readinessCopy(day: WhoopDay): string {
  const r = readiness(day.recovery);
  if (r === "green")
    return `Recovery ${day.recovery}% — green. Your body can absorb a hard session; aim for strain ${strainTarget(day.recovery)}.`;
  if (r === "yellow")
    return `Recovery ${day.recovery}% — yellow. Train, but keep it controlled; aim for strain ${strainTarget(day.recovery)} and stop short of failure.`;
  return `Recovery ${day.recovery}% — red. Active recovery only: walk, stretch, sleep. Pushing today borrows from the rest of the week.`;
}

/** Whoop-style optimal strain target for a given recovery. */
export function strainTarget(recovery: number): string {
  if (recovery >= 67) return "14–17";
  if (recovery >= 34) return "10–13";
  return "under 8";
}

export interface WhoopInsight {
  id: string;
  text: string;
  tone: "info" | "warn" | "win";
}

export function whoopInsights(days: WhoopDay[]): WhoopInsight[] {
  const out: WhoopInsight[] = [];
  const last = days[days.length - 1];
  const last7 = days.slice(-7);

  // HRV trend over the last 3 mornings
  const h = days.slice(-3).map((d) => d.hrv);
  if (h.length === 3 && h[0] > h[1] && h[1] > h[2]) {
    out.push({
      id: "hrv-down",
      text: `HRV has dropped 3 mornings straight (${h[0]} → ${h[2]} ms) — prioritize sleep tonight`,
      tone: "warn",
    });
  } else if (h.length === 3 && h[0] < h[1] && h[1] < h[2]) {
    out.push({
      id: "hrv-up",
      text: `HRV climbing 3 days straight (${h[0]} → ${h[2]} ms) — adaptation is landing`,
      tone: "win",
    });
  }

  // Cumulative sleep debt this week
  const debt = round1(
    last7.reduce((a, d) => a + Math.max(0, d.sleep.needed - d.sleep.hours), 0)
  );
  if (debt >= 3) {
    out.push({
      id: "sleep-debt",
      text: `${debt}h of sleep debt built up this week — one early night pays most of it back`,
      tone: "warn",
    });
  }

  // Strain vs recovery mismatch yesterday
  const yesterday = days[days.length - 2];
  if (yesterday && yesterday.strain >= 14 && last.recovery < 40) {
    out.push({
      id: "mismatch",
      text: `Yesterday's ${yesterday.strain} strain on a low battery — today should be easy`,
      tone: "warn",
    });
  }

  // Weekly recovery average
  const avg = Math.round(last7.reduce((a, d) => a + d.recovery, 0) / last7.length);
  out.push({
    id: "recovery-avg",
    text: `7-day recovery average: ${avg}%${avg >= 67 ? " — well managed" : avg < 50 ? " — recovery is the limiter right now" : ""}`,
    tone: avg >= 67 ? "win" : avg < 50 ? "warn" : "info",
  });

  return out.slice(0, 4);
}
