"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";

import { ChatMessage } from "@/components/chat-message";
import { Button } from "@/components/ui/button";
import { coachReply, type CoachContext } from "@/lib/coach-engine";
import { dayStreak } from "@/lib/streaks";
import { buildInsights } from "@/lib/insights";
import {
  energyCurve,
  optimalGymWindow,
  recommendedBedtime,
} from "@/lib/energy";
import { strainTarget } from "@/lib/whoop";
import { useWhoopToday } from "@/stores/whoop-store";
import { useAppStore } from "@/stores/app-store";
import { useChatStore } from "@/stores/chat-store";
import { useTaskStore } from "@/stores/task-store";
import { gymDayDates, useWorkoutStore } from "@/stores/workout-store";

function topWeight(
  sessions: ReturnType<typeof useWorkoutStore.getState>["sessions"],
  exerciseId: string
): number | null {
  let top = 0;
  for (const s of sessions) {
    if (!s.endedAt) continue;
    for (const we of s.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const set of we.sets) {
        if (set.completed) top = Math.max(top, set.weight);
      }
    }
  }
  return top || null;
}

export default function CoachPage() {
  const messages = useChatStore((s) => s.messages);
  const memories = useChatStore((s) => s.memories);
  const typing = useChatStore((s) => s.typing);
  const sendUser = useChatStore((s) => s.sendUser);
  const receiveCoach = useChatStore((s) => s.receiveCoach);
  const forgetFact = useChatStore((s) => s.forgetFact);

  const profile = useAppStore((s) => s.profile);
  const personality = useAppStore((s) => s.personality);
  const sessions = useWorkoutStore((s) => s.sessions);
  const manualGymDays = useWorkoutStore((s) => s.manualGymDays);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const addRoutine = useWorkoutStore((s) => s.addRoutine);
  const measurements = useWorkoutStore((s) => s.measurements);
  const tasks = useTaskStore((s) => s.tasks);
  const classes = useTaskStore((s) => s.classes);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const whoopDay = useWhoopToday();
  const ctx: CoachContext = useMemo(() => {
    const done = sessions.filter((s) => s.endedAt);
    const weights = measurements.filter((m) => m.weight !== undefined);
    const insights = buildInsights(done, customExercises);
    const stale = insights
      .filter((i) => i.id.startsWith("gap-"))
      .map((i) => i.id.replace("gap-", ""));
    const profileComplete = Boolean(
      profile.name && profile.weightLb && profile.goal && profile.schedule
    );
    const whoop = whoopDay;
    return {
      recovery: whoop.recovery,
      strainToday: whoop.strain,
      strainTarget: strainTarget(whoop.recovery),
      sleepHours: whoop.sleep.hours,
      sleepNeeded: whoop.sleep.needed,
      hrv: whoop.hrv,
      gymWindow: optimalGymWindow(energyCurve(whoop)).label,
      bedtime: recommendedBedtime(whoop),
      memories,
      name: profile.name || "David",
      personality,
      workoutsLogged: done.length,
      workoutStreak: dayStreak(gymDayDates(sessions, manualGymDays)),
      classCount: classes.length,
      openTasks: tasks.filter((t) => !t.completed).length,
      lastWeight: weights[weights.length - 1]?.weight ?? null,
      benchTop: topWeight(sessions, "bench-press"),
      squatTop: topWeight(sessions, "squat"),
      deadliftTop: topWeight(sessions, "deadlift"),
      staleMuscles: stale,
      profileComplete,
    };
  }, [
    sessions,
    manualGymDays,
    customExercises,
    measurements,
    tasks,
    classes,
    profile,
    personality,
    memories,
    whoopDay,
  ]);

  const chips = useMemo(() => {
    const out = [
      `Recovery ${ctx.recovery}%`,
      `Sleep ${ctx.sleepHours}h`,
      `${ctx.workoutStreak}-day streak`,
      `${ctx.workoutsLogged} workouts logged`,
      `${ctx.classCount} classes`,
      `${ctx.openTasks} open tasks`,
    ];
    if (ctx.benchTop) out.push(`Bench: ${ctx.benchTop} lb`);
    return out;
  }, [ctx]);

  // Auto-scroll on new messages and while typing.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, typing]);

  // "make me a PPL split", "build an upper/lower routine", "put a push pull
  // legs program in" → generate routines, not just chat. Needs both a split
  // noun and a create verb so questions ("what split should I run?") still chat.
  const wantsSplit = (t: string) =>
    /\b(split|routine|program|workout plan|ppl|push[\s/-]?pull[\s/-]?legs|upper[\s/-]?lower|full[\s/-]?body|bro split)\b/i.test(t) &&
    /\b(make|create|build|set\s?up|give me|generate|put|add|design|write|plan me|build me)\b/i.test(t);

  const runChat = async (trimmed: string) => {
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          ctx,
          history: messages.slice(-10).map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      if (!res.ok || !res.body) throw new Error("api_error");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
      }
      receiveCoach(reply.trim());
    } catch {
      // Fallback to mock engine if API is unavailable
      receiveCoach(coachReply(trimmed, ctx));
    }
  };

  const runSplit = async (trimmed: string) => {
    try {
      const res = await fetch("/api/coach/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, profile }),
      });
      if (!res.ok) throw new Error("split_failed");
      const data = (await res.json()) as {
        reply: string;
        routines: { name: string; exercises: unknown[] }[];
      };
      if (!data.routines?.length) throw new Error("empty");
      for (const r of data.routines) {
        addRoutine(r as Parameters<typeof addRoutine>[0]);
      }
      const summary = data.routines
        .map((r) => `${r.name} (${r.exercises.length})`)
        .join(" · ");
      receiveCoach(
        `${data.reply}\n\nAdded to Gym → Log: ${summary}. Tap a routine there to start it.`
      );
    } catch {
      // If split generation fails, just answer in normal chat instead.
      await runChat(trimmed);
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    sendUser(trimmed);
    setInput("");
    if (wantsSplit(trimmed)) await runSplit(trimmed);
    else await runChat(trimmed);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] w-full max-w-3xl flex-col px-4 md:h-[calc(100dvh-3.5rem)] md:px-6">
      <header className="flex items-baseline gap-2 py-4">
        <h1 className="text-2xl font-semibold">Coach</h1>
        <span className="text-[0.65rem] text-text-tertiary">
          powered by Claude
        </span>
      </header>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4"
      >
        {!ctx.profileComplete && (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-sm">
              Complete your profile so I can actually help you, {ctx.name}.
              Height, weight, goal, schedule — two minutes.
            </p>
            <Button size="sm" variant="secondary">
              <Link href="/settings">Set up profile</Link>
            </Button>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} timestamp={new Date(m.at)}>
            {m.text}
          </ChatMessage>
        ))}
        {typing && <ChatMessage role="coach" typing />}
      </div>

      <div className="flex flex-col gap-2 border-t border-border py-3">
        {memories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            <span className="text-[0.6rem] text-text-tertiary">remembered</span>
            {memories.map((m) => (
              <span
                key={m}
                className="flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[0.65rem] text-text-secondary"
              >
                {m}
                <button
                  type="button"
                  onClick={() => forgetFact(m)}
                  aria-label={`Forget: ${m}`}
                  className="ml-0.5 text-text-tertiary hover:text-text-primary"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => send(`Tell me about this: ${chip}`)}
              className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent-border hover:text-accent"
            >
              {chip}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            aria-label="Message coach"
            className="h-11 flex-1 rounded-xl border border-border bg-surface px-4 text-sm outline-none transition-colors placeholder:text-text-tertiary focus-visible:ring-1 focus-visible:ring-accent/40"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            aria-label="Send"
            className="flex size-11 items-center justify-center rounded-xl bg-accent text-background transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
