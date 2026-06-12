import type { CoachPersonality } from "./types";

export interface CoachContext {
  name: string;
  personality: CoachPersonality;
  workoutsLogged: number;
  workoutStreak: number;
  classCount: number;
  openTasks: number;
  lastWeight: number | null;
  benchTop: number | null;
  squatTop: number | null;
  deadliftTop: number | null;
  staleMuscles: string[];
  profileComplete: boolean;
}

const lb = (n: number | null) => (n ? `${n} lb` : "—");

function opener(p: CoachPersonality, name: string): string {
  switch (p) {
    case "warm": return `Hey ${name}. `;
    case "drill": return `Listen up, ${name}. `;
    case "brother": return `Alright ${name}, real talk. `;
    default: return "";
  }
}

/**
 * v1 mock engine — keyword matching, in character. Replaced by the real
 * Claude API via /api/coach in Phase 3.
 */
export function coachReply(message: string, ctx: CoachContext): string {
  const m = message.toLowerCase();
  const o = opener(ctx.personality, ctx.name);
  const has = (re: RegExp) => re.test(m);

  // Safety first — these win over everything else.
  if (has(/\b(sad|depress\w*|anxious|anxiety|struggling|hopeless|overwhelmed|panic)\b/)) {
    return `I'm glad you told me, ${ctx.name}. This one's outside what I should coach you through — not because I don't care, but because you deserve real support. LMU CAPS is free for you: 310-338-2868. If things feel heavy right now, the 988 Lifeline is there any hour. Training can wait. You matter more than the log.`;
  }
  if (has(/\b(injur\w*|pain|hurt\w*|tweak\w*|strain\w*)\b/)) {
    return `Don't train through that. I'm not going to diagnose it — a physio or doctor should look at anything that hurts beyond normal soreness. Until then: stop the movements that aggravate it, keep what's pain-free, and treat sleep and protein as rehab. Getting this checked early is what fast recovery looks like.`;
  }

  if (has(/\b(pr|personal record|new best)\b/)) {
    return `${o}That's earned, not lucky — ${ctx.workoutsLogged} sessions in the log is why it happened. Take the win today. Next exposure, don't chase a new max: own this weight for 2-3 clean reps, then we nudge it.`;
  }
  if (has(/\b(deload|recover\w*)\b/)) {
    return `${o}With a ${ctx.workoutStreak}-day streak going, a deload isn't weakness — it's how you cash in the fatigue for strength. Take a week at 60% of your usual weights, same movements, leave 4 reps in the tank. You'll come back sharper.`;
  }
  if (has(/\b(bench|squat|deadlift|ohp|press|row|lift\w*|plateau|progress\w*)\b/)) {
    return `${o}Current top sets I've got for you: bench ${lb(ctx.benchTop)}, squat ${lb(ctx.squatTop)}, deadlift ${lb(ctx.deadliftTop)}. Progression is boring on purpose — add 5 lb or one rep when all working sets hit the target with 1-2 reps in reserve. If a lift stalls for 3-4 sessions, change the rep range before you change the exercise.`;
  }
  if (has(/\b(creatine|supplement\w*|protein powder|whey)\b/)) {
    return `${o}Only two are worth your student budget: creatine monohydrate, 5 g every day (no loading needed), and a protein powder to make hitting your daily protein easier. Everything else on the shelf is marketing. Buy plain, buy cheap, be consistent.`;
  }
  if (has(/\b(calorie\w*|macro\w*|eat\w*|nutrition|diet|food)\b/)) {
    const w = ctx.lastWeight ?? 175;
    return `${o}Simple math at ${w} lb: protein ${Math.round(w * 0.9)}-${Math.round(w)} g a day, every day. Maintenance is roughly ${Math.round(w * 15)} kcal — eat ~300 over to gain, ~400 under to cut. Track for two weeks before trusting any of those numbers; your scale trend is the truth, the formula is the guess.`;
  }
  if (has(/\b(tired|exhausted|sleep|fatigued|drained)\b/)) {
    return `${o}Tired is data. Before you blame the program: how many hours did you sleep this week? Under 7 a night and no plan survives. Tonight — screens off early, same bedtime, and tomorrow's session becomes 3 hard sets per lift instead of 5. Recovery is training.`;
  }
  if (has(/\b(study\w*|exam\w*|assignment\w*|class\w*|test|school|finals?)\b/)) {
    return `${o}You've got ${ctx.classCount} classes and ${ctx.openTasks} open tasks in the system. Same rules as the gym: short focused sets beat marathons. 50 minutes on, 10 off, phone in another room. Start with the assignment you're avoiding — it's the heaviest set, do it first.`;
  }
  if (has(/\b(motivat\w*|stuck|unmotivated|lazy|can'?t start)\b/)) {
    return `${o}Motivation isn't coming, so stop waiting for it. You don't need to want to train — you need to put your shoes on and touch the bar. The ${ctx.workoutsLogged} sessions in your log weren't all motivated either. Ten minutes. If you still want to leave after ten minutes, leave. You won't.`;
  }
  if (has(/\b(cardio|run\w*|conditioning|zone 2)\b/)) {
    return `${o}Two to three sessions of 25-30 min zone 2 — a pace where you can talk — covers 90% of what you need without eating into recovery. Put it after lifting or on rest days, never before. If you hate running, the incline treadmill or bike counts just the same.`;
  }
  if (has(/\b(cut(ting)?|bulk\w*|recomp\w*|lose weight|lean)\b/)) {
    return `${o}Pick one lane for 12 weeks minimum. Cutting: 400 kcal under, protein high, keep lifting heavy — the weights preserve the muscle. Bulking: 300 over, gain ~0.5 lb a week, more is just fat. Recomp works best for newer lifters: eat at maintenance, push progressive overload hard, let the scale bore you while the mirror changes.`;
  }
  if (has(/\b(split|program|routine|ppl|upper lower)\b/)) {
    return `${o}With your schedule I'd run upper/lower 4 days — Mon/Tue, Thu/Fri — or push/pull/legs if you can give it 5-6. The best split is the one you'll actually repeat for months. Build it from the starters in the Gym tab and stop program-hopping.`;
  }

  if (!ctx.profileComplete) {
    return `${o}I can give you sharper answers once your profile is filled in — height, weight, goal, schedule. Two minutes in Settings and I stop guessing.`;
  }
  return `${o}Here's where you stand: ${ctx.workoutsLogged} workouts logged, ${ctx.workoutStreak}-day streak, ${ctx.openTasks} tasks open${ctx.staleMuscles.length ? `, and ${ctx.staleMuscles[0]} is overdue for work` : ""}. Ask me something specific — training, food, sleep, school — and I'll give you a straight answer.`;
}

export function typingDelayMs(reply: string): number {
  return Math.min(2200, 600 + reply.length * 6);
}
