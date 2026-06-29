import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Deurenberg BMI-based body-fat formula — a conservative anchor (it reads high
// for muscular people, which suits a "better to overestimate" brief).
function formulaBodyFat(
  heightIn: number,
  weightLb: number,
  age: number,
  sex: "male" | "female"
): number | null {
  if (!heightIn || !weightLb) return null;
  const kg = weightLb * 0.45359237;
  const m = heightIn * 0.0254;
  const bmi = kg / (m * m);
  const bf = 1.2 * bmi + 0.23 * (age || 25) - 10.8 * (sex === "male" ? 1 : 0) - 5.4;
  return Math.round(Math.min(60, Math.max(3, bf)) * 10) / 10;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    imageBase64: string; // raw base64, no data: prefix
    mediaType?: string;
    heightIn: number;
    weightLb: number;
    age: number;
    sex: "male" | "female";
  };

  const anchor = formulaBodyFat(body.heightIn, body.weightLb, body.age, body.sex);
  const media = (body.mediaType ?? "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/webp";

  const system = `You estimate body-fat percentage from a physique photo for a fitness-tracking app, for the user assessing their own progress. Be clinical, supportive, and never body-shaming.

ACCURACY RULES — this matters most:
- Visual body-fat estimation is imprecise. NEVER pretend to be exact.
- The user explicitly wants a CONSERVATIVE estimate: when uncertain, estimate HIGHER, not lower. It is better to over-estimate than under-estimate.
- The user describes themselves as "SKINNY FAT": relatively light/lean limbs but carrying fat at the midsection. The BMI formula UNDER-reads this build, so do NOT cap your estimate at the formula — if the waist looks soft or fuller than the arms/legs suggest, go clearly ABOVE the formula.
- Scrutinize the LOVE HANDLES / obliques / flanks and the lower abdomen FIRST — that is where this person holds fat and it is the single most telling region. Do not be fooled by lean arms, lean legs, or a low body weight; a flat-looking front with soft love handles still means higher body fat.
- Other cues: lower-ab definition (or lack of), waist/oblique thickness, skinfold softness at the flanks and lower back, the "shelf" or overhang at the waistband, vascularity, muscle separation.

Stats: height ${body.heightIn} in, weight ${body.weightLb} lb, age ${body.age}, sex ${body.sex}. Formula (BMI-based) estimate: ${anchor ?? "n/a"}%.

Return your assessment via the report tool. Give a single CONSERVATIVE (high-leaning) estimate plus a plausible low–high range, and a 1–2 sentence rationale citing what you see.`;

  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system,
      tools: [
        {
          name: "report",
          description: "Report the conservative body-fat estimate.",
          input_schema: {
            type: "object",
            properties: {
              estimate: { type: "number", description: "Conservative (high-leaning) body-fat %." },
              low: { type: "number" },
              high: { type: "number" },
              rationale: { type: "string" },
            },
            required: ["estimate", "low", "high", "rationale"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "report" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: media, data: body.imageBase64 },
            },
            {
              type: "text",
              text: "Estimate my body-fat percentage from this photo. Lean conservative (higher when unsure).",
            },
          ],
        },
      ],
    });

    const tool = res.content.find((c) => c.type === "tool_use");
    if (!tool || tool.type !== "tool_use") throw new Error("no_result");
    const out = tool.input as {
      estimate: number;
      low: number;
      high: number;
      rationale: string;
    };
    return NextResponse.json({ ...out, anchor });
  } catch {
    return NextResponse.json({ error: "estimation_failed" }, { status: 502 });
  }
}
