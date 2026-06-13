"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";

import { ChatMessage } from "@/components/chat-message";
import { Button } from "@/components/ui/button";
import { coachReply, typingDelayMs, type CoachContext } from "@/lib/coach-engine";
import { dayStreak } from "@/lib/streaks";
import { buildInsights } from "@/lib/insights";
import {
  energyCurve,
  optimalGymWindow,
  recommendedBedtime,
} from "@/lib/energy";
import { strainTarget, whoopToday } from "@/lib/whoop";
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
  const typing = useChatStore((s) => s.typing);
  const sendUser = useChatStore((s) => s.sendUser);
  const receiveCoach = useChatStore((s) => s.receiveCoach);

  const profile = useAppStore((s) => s.profile);
  const personality = useAppStore((s) => s.personality);
  const sessions = useWorkoutStore((s) => s.sessions);
  const manualGymDays = useWorkoutStore((s) => s.manualGymDays);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const measurements = useWorkoutStore((s) => s.measurements);
  const tasks = useTaskStore((s) => s.tasks);
  const classes = useTaskStore((s) => s.classes);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const whoop = whoopToday();
    return {
      recovery: whoop.recovery,
      strainToday: whoop.strain,
      strainTarget: strainTarget(whoop.recovery),
      sleepHours: whoop.sleep.hours,
      sleepNeeded: whoop.sleep.needed,
      hrv: whoop.hrv,
      gymWindow: optimalGymWindow(energyCurve(whoop)).label,
      bedtime: recommendedBedtime(whoop),
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

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    sendUser(trimmed);
    setInput("");
    const reply = coachReply(trimmed, ctx);
    setTimeout(() => receiveCoach(reply), typingDelayMs(reply));
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
