import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a syllabus parser. Extract every graded assignment that has a specific due date.

Return ONLY a valid JSON array — no markdown fences, no explanation. Format:
[{"title":"Assignment name","type":"exam","due":"2025-09-15"},...]

Rules:
- "type" must be exactly one of: exam, quiz, paper, project, problem set, reading
- "due" must be YYYY-MM-DD. Use the year from context (usually the current academic year).
- Skip anything with a vague date like "Week 5" or "TBD".
- Skip class meetings, office hours, holidays, and course policies.
- Return [] if nothing qualifies.`;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "no_file" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const today = new Date().toISOString().split("T")[0];
  const isPdf = file.type === "application/pdf";
  const prompt = { type: "text" as const, text: `Today is ${today}. Parse the syllabus above.` };

  try {
    const content = isPdf
      ? [
          { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } },
          prompt,
        ]
      : [
          { type: "image" as const, source: { type: "base64" as const, media_type: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: base64 } },
          prompt,
        ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text.trim() : "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    const items: { title: string; type: string; due: string }[] = match
      ? JSON.parse(match[0])
      : [];

    return NextResponse.json(items.map((item) => ({ ...item, include: true })));
  } catch (err) {
    console.error("parse-syllabus error", err);
    return NextResponse.json({ error: "parse_failed" }, { status: 500 });
  }
}
