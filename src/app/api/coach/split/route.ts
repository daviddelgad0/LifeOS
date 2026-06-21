import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { EXERCISES } from "@/lib/exercises";
import type { Profile } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Compact library so the model only ever picks ids that exist.
const LIBRARY = EXERCISES.map(
  (e) => `${e.id} | ${e.name} | ${e.muscle} | ${e.equipment}`
).join("\n");
const VALID_IDS = new Set(EXERCISES.map((e) => e.id));

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(n)));

interface RawExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
}
interface RawRoutine {
  name: string;
  exercises: RawExercise[];
}

export async function POST(req: NextRequest) {
  const { message, profile } = (await req.json()) as {
    message: string;
    profile?: Partial<Profile>;
  };

  const system = `You build workout splits as structured routines for the LifeOS gym app.
The user will describe a split (e.g. "PPL", "upper/lower", "4-day bro split", "full body 3x/week").
Turn it into one routine per training day and call the create_split tool.

RULES:
- Use ONLY exerciseId values from the library below. Never invent ids.
- 4–7 exercises per day, ordered big compounds first.
- Sets 3–4. Reps: compounds 5–8, isolation 10–15. Rest: compounds 120–180s, isolation 60–90s.
- Name each routine for its day (e.g. "Push", "Pull", "Legs", "Upper A").
- Respect the user's equipment and experience if given; avoid movements that hit a listed injury.

USER PROFILE:
- Experience: ${profile?.experience || "unknown"}
- Equipment: ${profile?.equipment || "full gym"}
- Goal: ${profile?.goal || "general strength & size"}
- Injuries/limits: ${profile?.injuries || "none"}

EXERCISE LIBRARY (exerciseId | name | muscle | equipment):
${LIBRARY}`;

  let routines: RawRoutine[] = [];
  let reply = "Here's your split — added to the gym.";

  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system,
      tools: [
        {
          name: "create_split",
          description: "Save a workout split as routines to the user's gym.",
          input_schema: {
            type: "object",
            properties: {
              reply: {
                type: "string",
                description: "A short, friendly 1–2 sentence note describing the split.",
              },
              routines: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    exercises: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          exerciseId: { type: "string" },
                          targetSets: { type: "number" },
                          targetReps: { type: "number" },
                          restSeconds: { type: "number" },
                        },
                        required: ["exerciseId", "targetSets", "targetReps", "restSeconds"],
                      },
                    },
                  },
                  required: ["name", "exercises"],
                },
              },
            },
            required: ["reply", "routines"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "create_split" },
      messages: [{ role: "user", content: message }],
    });

    const tool = res.content.find((c) => c.type === "tool_use");
    if (tool && tool.type === "tool_use") {
      const input = tool.input as { reply?: string; routines?: RawRoutine[] };
      if (input.reply) reply = input.reply;
      routines = input.routines ?? [];
    }
  } catch {
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  // Validate: drop unknown ids, clamp targets, drop empty routines.
  const clean = routines
    .map((r) => ({
      name: String(r.name || "Routine").slice(0, 40),
      exercises: (r.exercises ?? [])
        .filter((e) => VALID_IDS.has(e.exerciseId))
        .map((e) => ({
          exerciseId: e.exerciseId,
          targetSets: clamp(e.targetSets ?? 3, 1, 10),
          targetReps: clamp(e.targetReps ?? 8, 1, 50),
          restSeconds: clamp(e.restSeconds ?? 120, 30, 600),
        })),
    }))
    .filter((r) => r.exercises.length > 0)
    .slice(0, 7);

  if (clean.length === 0) {
    return NextResponse.json({ error: "no_routines" }, { status: 422 });
  }

  return NextResponse.json({ reply, routines: clean });
}
