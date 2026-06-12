import { NextResponse } from "next/server";

/**
 * Phase 2 stub. Real version: Whoop OAuth, then pull daily recovery,
 * strain, sleep, and HRV to drive workout intensity suggestions and
 * Coach context.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "not_configured",
      hint: "Whoop integration is Phase 2 — OAuth connection and recovery data land here.",
    },
    { status: 501 }
  );
}
