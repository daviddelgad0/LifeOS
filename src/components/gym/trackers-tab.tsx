"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { BodyDiagram, statusForSets } from "@/components/body-diagram";
import { MonthGrid } from "@/components/month-grid";
import { StreakBadge } from "@/components/streak-badge";
import { addDays, formatShort, startOfWeek, todayISO } from "@/lib/dates";
import { MUSCLES } from "@/lib/fitness";
import { weeklySetsPerMuscle } from "@/lib/insights";
import { dayStreak, longestDayStreak } from "@/lib/streaks";
import type { Muscle } from "@/lib/types";
import { gymDayDates, useWorkoutStore } from "@/stores/workout-store";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  none: "rgba(255,255,255,0.15)",
  low: "#FF4444",
  medium: "#FFB800",
  high: "var(--accent)",
};

export function GymTrackersTab() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const manualGymDays = useWorkoutStore((s) => s.manualGymDays);
  const toggleManualGymDay = useWorkoutStore((s) => s.toggleManualGymDay);
  const customExercises = useWorkoutStore((s) => s.customExercises);

  const today = todayISO();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [weekOffset, setWeekOffset] = useState(0);

  const gymDates = gymDayDates(sessions, manualGymDays);
  const streak = dayStreak(gymDates);
  const longest = longestDayStreak(gymDates);

  const weekStart = addDays(startOfWeek(today), weekOffset * -7);
  const sets = useMemo(
    () => weeklySetsPerMuscle(sessions, customExercises, weekStart),
    [sessions, customExercises, weekStart]
  );
  const status = useMemo(() => {
    const out: Partial<Record<Muscle, ReturnType<typeof statusForSets>>> = {};
    for (const m of MUSCLES) out[m] = statusForSets(sets.get(m) ?? 0);
    return out;
  }, [sets]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Gym streak tracker */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-tertiary">
            Gym streak
          </h2>
          <div className="flex items-center gap-2">
            <StreakBadge count={streak} />
            <span className="text-xs text-text-tertiary">best {longest}</span>
          </div>
        </div>
        <MonthGrid
          year={year}
          month={month}
          onPrev={prevMonth}
          onNext={nextMonth}
          renderDay={(iso, dayNum) => {
            const went = gymDates.has(iso);
            const isToday = iso === today;
            const future = iso > today;
            return (
              <button
                type="button"
                disabled={future}
                onClick={() => toggleManualGymDay(iso)}
                aria-label={`${iso}${went ? " — gym day" : ""}`}
                title={went ? "Gym day — tap to unmark manual" : "Tap to mark as gym day"}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border font-mono text-[0.65rem] transition-colors",
                  went
                    ? "border-transparent bg-accent font-medium text-background"
                    : "border-border text-text-tertiary hover:border-border-hover",
                  isToday && !went && "border-accent-border",
                  future && "cursor-not-allowed opacity-40 hover:border-border"
                )}
              >
                {dayNum}
              </button>
            );
          }}
        />
        <p className="text-xs text-text-tertiary">
          Saved workouts mark days automatically. Tap a day to mark gym time
          logged elsewhere.
        </p>
      </section>

      {/* Weekly muscle tracker */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-tertiary">
            Weekly muscle coverage
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              aria-label="Previous week"
              className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-24 text-center font-mono text-xs text-text-secondary">
              {weekOffset === 0 ? "This week" : `wk of ${formatShort(weekStart)}`}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
              disabled={weekOffset === 0}
              aria-label="Next week"
              className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <BodyDiagram status={status} className="h-72 w-auto shrink-0" />
          <div className="flex w-full flex-1 flex-col gap-1">
            <div className="grid grid-cols-[1fr_4rem_5rem] gap-2 border-b border-border pb-2 text-xs text-text-tertiary">
              <span>Muscle</span>
              <span className="text-right">Sets</span>
              <span className="text-right">Status</span>
            </div>
            {MUSCLES.map((m) => {
              const n = Math.round((sets.get(m) ?? 0) * 10) / 10;
              const st = status[m] ?? "none";
              return (
                <div
                  key={m}
                  className="grid grid-cols-[1fr_4rem_5rem] items-center gap-2 border-b border-border py-1.5 text-sm last:border-0"
                >
                  <span className="capitalize">{m}</span>
                  <span className="text-right font-mono text-xs">{n}</span>
                  <span className="flex items-center justify-end gap-1.5 text-xs text-text-tertiary">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: STATUS_DOT[st] }}
                    />
                    {st === "none"
                      ? "—"
                      : st === "low"
                        ? "< 8"
                        : st === "medium"
                          ? "8–12"
                          : "12+"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-text-tertiary">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: STATUS_DOT.low }} />
            under 8 sets
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: STATUS_DOT.medium }} />
            8–12 sets
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: STATUS_DOT.high }} />
            12+ sets
          </span>
          <span>secondary muscles count half · resets Monday</span>
        </div>
      </section>
    </div>
  );
}
