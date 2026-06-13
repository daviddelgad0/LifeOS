import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const CAL_API = "https://www.googleapis.com/calendar/v3";
const CAL_NAME = "LifeOS School";

interface SyncMeeting {
  day: number; // 0 = Sunday
  start: string; // "14:00"
  end: string; // "15:15"
}
interface SyncClass {
  name: string;
  code: string;
  location: string;
  meetings: SyncMeeting[];
}
interface SyncAssignment {
  title: string;
  due: string; // YYYY-MM-DD
  className?: string;
}

async function getToken(): Promise<string | null> {
  const jar = await cookies();
  const access = jar.get("gcal_access")?.value;
  if (access) return access;

  const refresh = jar.get("gcal_refresh")?.value;
  if (!refresh) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) return null;

  const { access_token, expires_in } = await res.json();
  jar.set("gcal_access", access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: expires_in ?? 3600,
    path: "/",
    sameSite: "lax",
  });
  return access_token;
}

/** Next calendar date (YYYY-MM-DD) on or after today matching a weekday. */
function nextDateForWeekday(day: number): string {
  const now = new Date();
  const diff = (day - now.getUTCDay() + 7) % 7;
  const d = new Date(now.getTime() + diff * 86_400_000);
  return d.toISOString().split("T")[0];
}

/** Reuse the dedicated LifeOS calendar or create it. Returns its id. */
async function ensureCalendar(h: HeadersInit): Promise<string | null> {
  const listRes = await fetch(`${CAL_API}/users/me/calendarList`, { headers: h });
  if (!listRes.ok) return null;
  const list = await listRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (list.items ?? []).find((c: any) => c.summary === CAL_NAME);

  // Delete and recreate so a re-sync never leaves stale duplicates. Only ever
  // touches our own secondary calendar, never the user's primary.
  if (existing && !existing.primary) {
    await fetch(`${CAL_API}/calendars/${encodeURIComponent(existing.id)}`, {
      method: "DELETE",
      headers: h,
    });
  }

  const createRes = await fetch(`${CAL_API}/calendars`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ summary: CAL_NAME }),
  });
  if (!createRes.ok) return null;
  const created = await createRes.json();
  return created.id ?? null;
}

export async function GET() {
  const token = await getToken();
  return NextResponse.json({ connected: !!token });
}

export async function POST(request: Request) {
  let body: {
    action?: string;
    classes?: SyncClass[];
    assignments?: SyncAssignment[];
    timeZone?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  if (body.action === "disconnect") {
    const jar = await cookies();
    jar.delete("gcal_access");
    jar.delete("gcal_refresh");
    return NextResponse.json({ ok: true, action: "disconnect" });
  }

  if (body.action !== "sync") {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  const token = await getToken();
  if (!token) return NextResponse.json({ connected: false }, { status: 401 });
  const h = { Authorization: `Bearer ${token}` };

  const calId = await ensureCalendar(h);
  if (!calId) {
    return NextResponse.json({ ok: false, error: "calendar_failed" }, { status: 502 });
  }

  const tz = body.timeZone || "America/Los_Angeles";
  const insert = (event: Record<string, unknown>) =>
    fetch(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events`, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

  let events = 0;

  // Class meetings → weekly recurring events for ~a semester (16 weeks).
  for (const c of body.classes ?? []) {
    for (const m of c.meetings ?? []) {
      const date = nextDateForWeekday(m.day);
      const ok = await insert({
        summary: c.code ? `${c.name} (${c.code})` : c.name,
        location: c.location || undefined,
        start: { dateTime: `${date}T${m.start}:00`, timeZone: tz },
        end: { dateTime: `${date}T${m.end}:00`, timeZone: tz },
        recurrence: ["RRULE:FREQ=WEEKLY;COUNT=16"],
      });
      if (ok.ok) events++;
    }
  }

  // Assignments → all-day events on the due date.
  for (const a of body.assignments ?? []) {
    if (!a.due) continue;
    const ok = await insert({
      summary: a.className ? `${a.title} — ${a.className}` : a.title,
      start: { date: a.due },
      end: { date: a.due },
    });
    if (ok.ok) events++;
  }

  return NextResponse.json({ ok: true, action: "sync", events });
}
