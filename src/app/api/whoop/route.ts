import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { WhoopDay } from "@/lib/whoop";

const API = "https://api.prod.whoop.com/developer/v2";

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

  const [cycleRes, recoveryRes, sleepRes] = await Promise.all([
    fetch(`${API}/cycle?limit=1`, { headers: h }),
    fetch(`${API}/recovery?limit=1`, { headers: h }),
    fetch(`${API}/activity/sleep?limit=1`, { headers: h }),
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

  const cyc = cycle.records?.[0];
  const rec = recovery.records?.[0];
  const slp = sleep.records?.[0];

  if (!cyc || !rec || !slp) {
    return NextResponse.json({
      connected: false,
      debug: {
        stage: "no_records",
        cycles: cycle.records?.length ?? 0,
        recoveries: recovery.records?.length ?? 0,
        sleeps: sleep.records?.length ?? 0,
      },
    });
  }

  const milli = (ms: number) => Math.round((ms / 3_600_000) * 10) / 10;
  const stages = slp.score?.stage_summary ?? {};
  const needed = slp.score?.sleep_needed ?? {};
  const sleptMs = (stages.total_in_bed_time_milli ?? 0) - (stages.total_awake_time_milli ?? 0);
  const neededMs =
    (needed.baseline_milli ?? 27_000_000) +
    (needed.need_from_sleep_debt_milli ?? 0) +
    (needed.need_from_recent_strain_milli ?? 0);

  // Whoop timestamps are UTC; each record carries a timezone_offset like
  // "-07:00". Shift the UTC time by the offset, then read the (now local) hour.
  const localHour = (iso?: string, fallback = 0): number => {
    if (!iso) return fallback;
    const offset = slp.timezone_offset ?? "+00:00";
    const sign = offset.startsWith("-") ? -1 : 1;
    const [oh, om] = offset.slice(1).split(":").map(Number);
    const shifted = new Date(new Date(iso).getTime() + sign * (oh * 60 + om) * 60000);
    return shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
  };

  const startH = localHour(slp.start, 23);
  const endH = localHour(slp.end, 7);

  const today: WhoopDay = {
    date: new Date().toISOString().split("T")[0],
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
      bedtime: startH,
      waketime: endH,
    },
  };

  return NextResponse.json({ connected: true, today });
}
