import { NextResponse } from "next/server";

/**
 * Phase 3 wires this to the Anthropic API: assemble context (profile,
 * last 30 days of workouts, Whoop data, tasks, weight log) into a system
 * prompt with the safety guardrails, call Claude, stream the reply.
 * Until then the client uses the local mock engine and this returns 501.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "not_configured",
      hint: "Set ANTHROPIC_API_KEY and implement the Claude call (Phase 3). The client falls back to the mock engine.",
    },
    { status: 501 }
  );
}
