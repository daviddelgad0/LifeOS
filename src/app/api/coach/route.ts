import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import type { CoachContext } from "@/lib/coach-engine";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PERSONALITY: Record<string, string> = {
  direct: "Be direct and concise. No filler. Answer the question.",
  warm: "Be warm and supportive. Same honest advice, softer delivery.",
  drill: "You are a drill sergeant. Zero sympathy. Maximum push. Short sentences. Hold them accountable.",
  brother: "Older brother who lifts. Real talk, casual language. Genuinely care but never sugarcoat.",
};

function buildSystem(ctx: CoachContext): string {
  const lb = (n: number | null) => (n ? `${n} lb` : "unknown");
  const style = PERSONALITY[ctx.personality] ?? PERSONALITY.direct;

  return `You are a personal fitness and life coach app called LifeOS. ${style}

USER:
- Name: ${ctx.name}
- Workouts logged: ${ctx.workoutsLogged} | current streak: ${ctx.workoutStreak} days
- Top lifts: bench ${lb(ctx.benchTop)}, squat ${lb(ctx.squatTop)}, deadlift ${lb(ctx.deadliftTop)}
- Last weight: ${lb(ctx.lastWeight)}
- Open tasks: ${ctx.openTasks} | classes: ${ctx.classCount}
${ctx.staleMuscles.length ? `- Undertrained: ${ctx.staleMuscles.join(", ")}` : ""}

TODAY (Whoop):
- Recovery ${ctx.recovery}% | HRV ${ctx.hrv} ms
- Sleep ${ctx.sleepHours}h of ${ctx.sleepNeeded}h needed
- Strain ${ctx.strainToday} → target ${ctx.strainTarget}
- Best gym window: ${ctx.gymWindow} | Bedtime: ${ctx.bedtime}
${ctx.memories.length ? `\nREMEMBERED:\n${ctx.memories.map((m) => `- ${m}`).join("\n")}` : ""}

SAFETY — these override everything:
1. Mental health crisis (depression, suicidal, hopeless): stop coaching. Refer to LMU CAPS 310-338-2868 and 988 Lifeline.
2. Injury or pain: do not diagnose. Say stop the movement, see a doctor.
3. Never recommend illegal substances or extreme diets.

Keep replies under 100 words unless the question genuinely needs more. No markdown headers. Use their actual numbers. Be specific — vague advice is useless.`;
}

export async function POST(req: NextRequest) {
  const { message, ctx, history } = (await req.json()) as {
    message: string;
    ctx: CoachContext;
    history: { role: "user" | "coach"; text: string }[];
  };

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-10).map((h) => ({
      role: h.role === "user" ? ("user" as const) : ("assistant" as const),
      content: h.text,
    })),
    { role: "user" as const, content: message },
  ];

  const stream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: buildSystem(ctx),
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
