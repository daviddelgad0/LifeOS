import { NextResponse } from "next/server";
import { getWhoopToken } from "@/lib/whoop-token";

const API = "https://api.prod.whoop.com/developer/v2";

// Always run fresh — reads auth cookies, must never be cached.
export const dynamic = "force-dynamic";

const METERS_PER_MILE = 1609.344;

export interface Cardio {
  id: string;
  sport: string; // formatted activity name, e.g. "Walking"
  date: string; // YYYY-MM-DD (local)
  durationMin: number;
  distanceMi: number;
  paceMinPerMi: number | null; // null when no distance recorded
  avgHr: number;
  maxHr: number;
  strain: number;
  calories: number;
}

// Any non-strength activity counts as cardio — keyword match keeps it robust
// to Whoop's exact sport_name strings (walking, hiking, cycling, elliptical…).
const CARDIO =
  /run|jog|walk|hik|ruck|cycl|bik|spin|ellipt|stair|row|swim|cardio|treadmill|climb|skat|ski|dance|hiit|elliptical/i;

function titleCase(s: string): string {
  return (s || "Activity")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function localDate(iso: string, offset: string): string {
  const sign = offset.startsWith("-") ? -1 : 1;
  const [oh, om] = offset.slice(1).split(":").map(Number);
  const d = new Date(new Date(iso).getTime() + sign * (oh * 60 + om) * 60000);
  return d.toISOString().split("T")[0];
}

export async function GET() {
  const token = await getWhoopToken();
  if (!token) return NextResponse.json({ connected: false, sessions: [] });

  const res = await fetch(`${API}/activity/workout?limit=25`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return NextResponse.json({ connected: false, sessions: [], status: res.status });
  }

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = data.records ?? [];

  const sessions: Cardio[] = records
    .filter((w) => CARDIO.test(w.sport_name ?? ""))
    .map((w) => {
      const ms = new Date(w.end).getTime() - new Date(w.start).getTime();
      const durationMin = Math.round((ms / 60000) * 10) / 10;
      const meters = w.score?.distance_meter ?? 0;
      const distanceMi = Math.round((meters / METERS_PER_MILE) * 100) / 100;
      const paceMinPerMi =
        distanceMi > 0 ? Math.round((durationMin / distanceMi) * 10) / 10 : null;
      return {
        id: String(w.id),
        sport: titleCase(w.sport_name ?? ""),
        date: localDate(w.start, w.timezone_offset ?? "+00:00"),
        durationMin,
        distanceMi,
        paceMinPerMi,
        avgHr: Math.round(w.score?.average_heart_rate ?? 0),
        maxHr: Math.round(w.score?.max_heart_rate ?? 0),
        strain: Math.round((w.score?.strain ?? 0) * 10) / 10,
        calories: Math.round((w.score?.kilojoule ?? 0) / 4.184),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ connected: true, sessions });
}
