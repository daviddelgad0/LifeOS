import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are a syllabus parser. Extract two things from the syllabus: (1) the class's own info, and (2) every graded assignment that has a specific due date.

Return ONLY a valid JSON object — no markdown fences, no explanation. Format:
{"class":{"name":"Course title","code":"Course code as listed","professor":"Instructor name","location":"Room/building","meetings":[{"day":1,"start":"10:00","end":"10:50"}],"gradeWeights":[{"label":"Homework","percent":20}]},"assignments":[{"title":"Midterm 1","type":"exam","due":"2025-10-14"}]}

Rules:
- "day" is 0-6, Sunday=0 ... Saturday=6. Expand patterns like "MWF" or "TuTh" into one meetings entry per day; share the same start/end time across those days unless the syllabus gives different times per day.
- Times are 24-hour "HH:MM".
- gradeWeights percentages don't need to sum to exactly 100 — copy whatever breakdown the syllabus states.
- "type" must be exactly one of: exam, quiz, paper, project, problem set, reading.
- "due" must be YYYY-MM-DD. Use the year from context (usually the current academic year).
- Skip assignments with a vague date like "Week 5" or "TBD".
- Skip office hours, holidays, and course policies from assignments — those aren't assignments.
- Leave any class field you can't find as "" (or [] for meetings/gradeWeights) — never guess a value that isn't stated.
- Always return both top-level keys, even if one side finds nothing: {"class":{...all empty...},"assignments":[]}.`;

interface ParsedClass {
  name: string;
  code: string;
  professor: string;
  location: string;
  meetings: { day: number; start: string; end: string }[];
  gradeWeights: { label: string; percent: number }[];
}

const EMPTY_CLASS: ParsedClass = {
  name: "",
  code: "",
  professor: "",
  location: "",
  meetings: [],
  gradeWeights: [],
};

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
      max_tokens: 1536,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed: {
      class?: Partial<ParsedClass>;
      assignments?: { title: string; type: string; due: string }[];
    } = match ? JSON.parse(match[0]) : {};

    const cls: ParsedClass = {
      name: parsed.class?.name ?? EMPTY_CLASS.name,
      code: parsed.class?.code ?? EMPTY_CLASS.code,
      professor: parsed.class?.professor ?? EMPTY_CLASS.professor,
      location: parsed.class?.location ?? EMPTY_CLASS.location,
      meetings: Array.isArray(parsed.class?.meetings) ? parsed.class.meetings : [],
      gradeWeights: Array.isArray(parsed.class?.gradeWeights) ? parsed.class.gradeWeights : [],
    };
    const assignments = Array.isArray(parsed.assignments) ? parsed.assignments : [];

    return NextResponse.json({
      class: cls,
      assignments: assignments.map((item) => ({ ...item, include: true })),
    });
  } catch (err) {
    console.error("parse-syllabus error", err);
    return NextResponse.json({ error: "parse_failed" }, { status: 500 });
  }
}
