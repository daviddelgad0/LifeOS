"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { addDays, formatShort, fromISO, startOfWeek, toISODate, todayISO } from "@/lib/dates";
import { useTaskStore } from "@/stores/task-store";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function SchoolCalendarTab() {
  const classes = useTaskStore((s) => s.classes);
  const tasks = useTaskStore((s) => s.tasks);
  const [view, setView] = useState<"week" | "month">("week");
  const today = todayISO();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const clsById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const itemsOn = (iso: string) => {
    const weekday = fromISO(iso).getDay();
    const meetings = classes.flatMap((c) =>
      c.meetings
        .filter((m) => m.day === weekday)
        .map((m) => ({ kind: "meeting" as const, cls: c, meeting: m }))
    );
    const assignments = tasks
      .filter((t) => t.classId && t.due === iso && !t.completed)
      .map((t) => ({ kind: "assignment" as const, task: t, cls: clsById.get(t.classId!) }));
    return { meetings, assignments };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1 text-xs capitalize transition-colors",
                view === v
                  ? "bg-muted text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => {
              if (view === "week") setWeekStart((w) => addDays(w, -7));
              else if (month === 0) {
                setMonth(11);
                setYear((y) => y - 1);
              } else setMonth((m) => m - 1);
            }}
            className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-32 text-center text-sm">
            {view === "week"
              ? `Week of ${formatShort(weekStart)}`
              : new Date(year, month, 1).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
          </span>
          <button
            type="button"
            aria-label="Next"
            onClick={() => {
              if (view === "week") setWeekStart((w) => addDays(w, 7));
              else if (month === 11) {
                setMonth(0);
                setYear((y) => y + 1);
              } else setMonth((m) => m + 1);
            }}
            className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {view === "week" ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }, (_, i) => {
            const iso = addDays(weekStart, i);
            const { meetings, assignments } = itemsOn(iso);
            const isToday = iso === today;
            return (
              <div
                key={iso}
                className={cn(
                  "flex flex-col gap-1.5 rounded-xl border bg-surface p-3",
                  isToday ? "border-accent-border" : "border-border"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium",
                    isToday ? "text-accent" : "text-text-tertiary"
                  )}
                >
                  {DAY_NAMES[i]} · {formatShort(iso)}
                  {isToday && " · today"}
                </span>
                {meetings.length === 0 && assignments.length === 0 && (
                  <span className="text-xs text-text-tertiary">—</span>
                )}
                {meetings
                  .sort((a, b) => a.meeting.start.localeCompare(b.meeting.start))
                  .map((m, j) => (
                    <div key={j} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-4 w-1 rounded-full"
                        style={{ background: m.cls.color }}
                      />
                      <span className="font-mono text-xs text-text-tertiary">
                        {m.meeting.start}
                      </span>
                      <span>
                        {m.cls.code} · {m.cls.location}
                      </span>
                    </div>
                  ))}
                {assignments.map((a, j) => (
                  <div key={j} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2 rotate-45"
                      style={{ background: a.cls?.color ?? "#666" }}
                    />
                    <span className="text-text-secondary">
                      Due: {a.task.title}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <MonthCalendar
          year={year}
          month={month}
          today={today}
          itemsOn={itemsOn}
        />
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {classes.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="size-2 rounded-full" style={{ background: c.color }} />
            {c.code}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <span className="size-2 rotate-45 bg-text-tertiary" />
          assignment due
        </span>
      </div>
    </div>
  );
}

function MonthCalendar({
  year,
  month,
  today,
  itemsOn,
}: {
  year: number;
  month: number;
  today: string;
  itemsOn: (iso: string) => {
    meetings: { cls: { color: string } }[];
    assignments: { cls?: { color: string } }[];
  };
}) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = (first.getDay() + 6) % 7;

  return (
    <div className="grid grid-cols-7 gap-1">
      {DAY_NAMES.map((d) => (
        <span key={d} className="py-1 text-center text-[0.65rem] text-text-tertiary">
          {d}
        </span>
      ))}
      {Array.from({ length: blanks }).map((_, i) => (
        <span key={`b-${i}`} />
      ))}
      {Array.from({ length: daysInMonth }, (_, i) => {
        const iso = toISODate(new Date(year, month, i + 1));
        const { meetings, assignments } = itemsOn(iso);
        const isToday = iso === today;
        return (
          <div
            key={iso}
            className={cn(
              "flex min-h-14 flex-col items-center gap-1 rounded-lg border p-1",
              isToday ? "border-accent-border bg-accent-dim/30" : "border-border bg-surface"
            )}
          >
            <span
              className={cn(
                "font-mono text-[0.65rem]",
                isToday ? "text-accent" : "text-text-tertiary"
              )}
            >
              {i + 1}
            </span>
            <div className="flex flex-wrap items-center justify-center gap-0.5">
              {meetings.slice(0, 3).map((m, j) => (
                <span
                  key={`m-${j}`}
                  className="size-1.5 rounded-full"
                  style={{ background: m.cls.color }}
                />
              ))}
              {assignments.slice(0, 2).map((a, j) => (
                <span
                  key={`a-${j}`}
                  className="size-1.5 rotate-45"
                  style={{ background: a.cls?.color ?? "#666" }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
