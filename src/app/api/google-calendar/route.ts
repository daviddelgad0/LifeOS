import { NextResponse } from "next/server";

/**
 * Stub for one-way Google Calendar sync (LifeOS → a dedicated "LifeOS"
 * calendar). Real version: Google OAuth flow, store tokens server-side,
 * push class meetings + assignment due dates via the Calendar API.
 * Until then this acknowledges actions so the client UI can be exercised.
 */
export async function POST(request: Request) {
  let action = "unknown";
  try {
    const body = (await request.json()) as { action?: string };
    action = body.action ?? "unknown";
  } catch {
    // fall through with unknown action
  }
  if (!["connect", "disconnect", "sync"].includes(action)) {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    action,
    stub: true,
    hint: "Real OAuth + Calendar API integration replaces this response.",
  });
}
