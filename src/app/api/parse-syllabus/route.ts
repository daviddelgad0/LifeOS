import { NextResponse } from "next/server";

/**
 * Phase 4 wires this to the Anthropic API: accept a PDF/image upload,
 * extract structured JSON (course info, assignments with dates, exams,
 * office hours). The client mock-parses locally until then.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "not_configured",
      hint: "Set ANTHROPIC_API_KEY and implement document parsing (Phase 4). The client uses its local mock parser.",
    },
    { status: 501 }
  );
}
