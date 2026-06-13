import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { WhoopDay } from "@/lib/whoop";

const API = "https://api.prod.whoop.com/developer/v2";

// Always run fresh — this reads auth cookies and must never be cached.
export const dynamic = "force-dynamic";

async function getToken(): Promise<string | null> {
  const jar = await cookies();
  const access = jar.get("whoop_access")?.value;
  if (access) return access;

  const refresh = jar.get("whoop_refresh")?.value;
  if (!refresh) return null;

  const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: "55b30dd5-3520-404b-82e8-be484d13e46a",
      client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) return null;

  const { access_token, expires_in } = await res.json();
  jar.set("whoop_access", access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: expires_in ?? 3600,
    path: "/",
    sameSite: "lax",
  });
  return access_token;
}

const milli = (ms: number) => Math.round((ms / 3_600_000) * 10) / 10;

// Whoop timestamps are UTC; each record carries a timezone_offset like "-07:00".
// Shift the UTC instant by that offset so getUTC* reads the local wall clock.
function toLocal(iso: string, offset: string): Date {
  const sign = offset.startsWith("-") ? -1 : 1;
  const [oh, om] = offset.slice(1).split(":").map(Number);
  return new Date(new Date(iso).getTime() + sign * (oh * 60 + om) * 60000);
}

/** Join one cycle with its recovery + sleep into the app's WhoopDay shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDay(cyc: any, rec: any, slp: any): WhoopDay {
  const stages = slp.score?.stage_summary ?? {};
  const needed = slp.score?.sleep_needed ?? {};
  const sleptMs = (stages.total_in_bed_time_milli ?? 0) - (stages.total_awake_time_milli ?? 0);
  const neededMs =
    (needed.baseline_milli ?? 27_000_000) +
    (needed.need_from_sleep_debt_milli ?? 0) +
    (needed.need_from_recent_strain_milli ?? 0);

  const tz = slp.timezone_offset ?? cyc.timezone_offset ?? "+00:00";
  const date = toLocal(cyc.start, cyc.timezone_offset ?? tz).toISOString().split("T")[0];
  const start = slp.start ? toLocal(slp.start, tz) : null;
  const end = slp.end ? toLocal(slp.end, tz) : null;

  return {
    date,
    recovery: Math.round(rec.score?.recovery_score ?? 0),
    strain: Math.round((cyc.score?.strain ?? 0) * 10) / 10,
    hrv: Math.round(rec.score?.hrv_rmssd_milli ?? 0),
    rhr: rec.score?.resting_heart_rate ?? 0,
    respRate: Math.round((slp.score?.respiratory_rate ?? 14) * 10) / 10,
    calories: Math.round((cyc.score?.kilojoule ?? 0) / 4.184),
    sleep: {
      score: Math.round(slp.score?.sleep_performance_percentage ?? 0),
      hours: milli(sleptMs),
      needed: milli(neededMs),
      efficiency: Math.round(slp.score?.sleep_efficiency_percentage ?? 0),
      deepHrs: milli(stages.total_slow_wave_sleep_time_milli ?? 0),
      remHrs: milli(stages.total_rem_sleep_time_milli ?? 0),
      lightHrs: milli(stages.total_light_sleep_time_milli ?? 0),
      awakeHrs: milli(stages.total_awake_time_milli ?? 0),
      bedtime: start ? start.getUTCHours() + start.getUTCMinutes() / 60 : 23,
      waketime: end ? end.getUTCHours() + end.getUTCMinutes() / 60 : 7,
    },
  };
}

export async function GET() {
  const jar = await cookies();
  const hadAccess = !!jar.get("whoop_access")?.value;
  const hadRefresh = !!jar.get("whoop_refresh")?.value;

  const token = await getToken();
  if (!token) {
    return NextResponse.json({
      connected: false,
      debug: { stage: "no_token", hadAccess, hadRefresh },
    });
  }

  const h = { Authorization: `Bearer ${token}` };

  // 25 is Whoop's max page size — ~25 days of history, plenty for the charts.
  const [cycleRes, recoveryRes, sleepRes] = await Promise.all([
    fetch(`${API}/cycle?limit=25`, { headers: h }),
    fetch(`${API}/recovery?limit=25`, { headers: h }),
    fetch(`${API}/activity/sleep?limit=25`, { headers: h }),
  ]);

  if (!cycleRes.ok || !recoveryRes.ok || !sleepRes.ok) {
    const body = await cycleRes.text().catch(() => "");
    return NextResponse.json({
      connected: false,
      debug: {
        stage: "api_error",
        cycle: cycleRes.status,
        recovery: recoveryRes.status,
        sleep: sleepRes.status,
        sample: body.slice(0, 120),
      },
    });
  }

  const [cycle, recovery, sleep] = await Promise.all([
    cycleRes.json(),
    recoveryRes.json(),
    sleepRes.json(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cycles: any[] = cycle.records ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recByCycle = new Map<number, any>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recovery.records ?? []).map((r: any) => [r.cycle_id, r])
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sleepById = new Map<string, any>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sleep.records ?? []).map((s: any) => [s.id, s])
  );

  // A complete day needs cycle + its recovery + that recovery's sleep.
  const days: WhoopDay[] = [];
  for (const cyc of cycles) {
    const rec = recByCycle.get(cyc.id);
    const slp = rec ? sleepById.get(rec.sleep_id) : undefined;
    if (rec && slp) days.push(mapDay(cyc, rec, slp));
  }

  if (days.length === 0) {
    return NextResponse.json({
      connected: false,
      debug: {
        stage: "no_records",
        cycles: cycles.length,
        recoveries: recovery.records?.length ?? 0,
        sleeps: sleep.records?.length ?? 0,
      },
    });
  }

  // Oldest first so the charts read left-to-right and days[last] is today.
  days.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ connected: true, days });
}
