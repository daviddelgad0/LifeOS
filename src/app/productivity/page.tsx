"use client";

import { useMemo, useState } from "react";
import { Bell, ListTodo, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { MonthGrid } from "@/components/month-grid";
import { QuickAddTask } from "@/components/quick-add-task";
import { StatCard } from "@/components/stat-card";
import { TaskRow } from "@/components/task-row";
import { addDays, formatShort, todayISO } from "@/lib/dates";
import type { TaskCategory } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { useProductivityStore } from "@/stores/productivity-store";
import { useTaskStore } from "@/stores/task-store";
import { cn } from "@/lib/utils";

const VIEWS = ["today", "upcoming", "someday", "completed"] as const;
type View = (typeof VIEWS)[number];

const CATEGORIES: { id: TaskCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "school", label: "School" },
  { id: "fitness", label: "Fitness" },
  { id: "personal", label: "Personal" },
  { id: "job", label: "Job search" },
];

const RATING_COLORS = [
  "",
  "#FF4444",
  "#FF8C42",
  "#FFB800",
  "#9BE15D",
  "var(--accent)",
];

export default function ProductivityPage() {
  const tasks = useTaskStore((s) => s.tasks);
  const classes = useTaskStore((s) => s.classes);
  const toggleTask = useTaskStore((s) => s.toggleTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const ratings = useProductivityStore((s) => s.ratings);
  const setRating = useProductivityStore((s) => s.setRating);
  const reminderPref = useAppStore((s) => s.notifications.productivityReminder);

  const [view, setView] = useState<View>("today");
  const [category, setCategory] = useState<TaskCategory | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [ratingDay, setRatingDay] = useState<string | null>(null);

  const today = todayISO();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const clsById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const filtered = useMemo(() => {
    const byCat = tasks.filter(
      (t) => category === "all" || t.category === category
    );
    switch (view) {
      case "today":
        return byCat.filter(
          (t) => !t.completed && t.due !== null && t.due <= today
        );
      case "upcoming":
        return byCat
          .filter(
            (t) =>
              !t.completed &&
              t.due !== null &&
              t.due > today &&
              t.due <= addDays(today, 7)
          )
          .sort((a, b) => a.due!.localeCompare(b.due!));
      case "someday":
        return byCat.filter((t) => !t.completed && t.due === null);
      case "completed":
        return byCat
          .filter((t) => t.completed)
          .sort((a, b) =>
            (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
          )
          .slice(0, 30);
    }
  }, [tasks, view, category, today]);

  // Average rating for the visible month
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthRatings = Object.entries(ratings).filter(([d]) =>
    d.startsWith(monthPrefix)
  );
  const avg =
    monthRatings.length > 0
      ? Math.round(
          (monthRatings.reduce((a, [, r]) => a + r, 0) / monthRatings.length) * 10
        ) / 10
      : 0;

  const todayUnrated =
    reminderPref && !ratings[today] && new Date().getHours() >= 18;

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") {
      toast("Notifications aren't supported in this browser");
      return;
    }
    const perm = await Notification.requestPermission();
    toast(
      perm === "granted"
        ? "Notifications on — due-date reminders will fire when the app is open"
        : "Notifications stay off"
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 md:px-6 md:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Productivity</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus data-icon="inline-start" className="size-3.5" />
          Add task
        </Button>
      </div>

      {todayUnrated && (
        <button
          type="button"
          onClick={() => setRatingDay(today)}
          className="flex items-center justify-between rounded-xl border border-accent-border bg-accent-dim px-4 py-3 text-left transition-transform hover:scale-[1.01]"
        >
          <span className="text-sm text-accent">
            How productive was today? Tap to rate it.
          </span>
          <span className="font-mono text-xs text-text-secondary">1–5</span>
        </button>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {VIEWS.map((v) => (
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
          <div className="flex gap-1 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
                  category === c.id
                    ? "border-accent-border bg-accent-dim text-accent"
                    : "border-border text-text-secondary hover:border-border-hover"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            description={
              view === "completed"
                ? "Nothing completed yet in this filter."
                : "Nothing here. Clean slate."
            }
            actionLabel={view === "completed" ? undefined : "Add task"}
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                cls={t.classId ? clsById.get(t.classId) : undefined}
                onToggle={() => toggleTask(t.id)}
                onDelete={() => deleteTask(t.id)}
                showDue={
                  view !== "today" && t.due ? formatShort(t.due) : undefined
                }
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={requestNotifications}
          className="flex items-center gap-2 self-start text-xs text-text-tertiary transition-colors hover:text-text-secondary"
        >
          <Bell className="size-3" />
          Enable browser notifications for due dates
        </button>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-tertiary">
            Productivity tracker
          </h2>
          <StatCard
            label="Month average"
            value={avg}
            className="w-36 !p-3"
          />
        </div>
        <MonthGrid
          year={year}
          month={month}
          onPrev={() => {
            if (month === 0) {
              setMonth(11);
              setYear((y) => y - 1);
            } else setMonth((m) => m - 1);
          }}
          onNext={() => {
            if (month === 11) {
              setMonth(0);
              setYear((y) => y + 1);
            } else setMonth((m) => m + 1);
          }}
          renderDay={(iso, dayNum) => {
            const r = ratings[iso];
            const future = iso > today;
            const isToday = iso === today;
            return (
              <button
                type="button"
                disabled={future}
                onClick={() => setRatingDay(iso)}
                aria-label={`Rate ${iso}${r ? ` — currently ${r}` : ""}`}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border font-mono text-[0.65rem] transition-colors",
                  r
                    ? "border-transparent font-medium text-background"
                    : "border-border text-text-tertiary hover:border-border-hover",
                  isToday && !r && "border-accent-border",
                  future && "cursor-not-allowed opacity-40"
                )}
                style={r ? { background: RATING_COLORS[r] } : undefined}
              >
                {dayNum}
              </button>
            );
          }}
        />
        <div className="flex items-center gap-2 text-[0.65rem] text-text-tertiary">
          <span>1</span>
          {RATING_COLORS.slice(1).map((c, i) => (
            <span key={i} className="size-3 rounded-sm" style={{ background: c }} />
          ))}
          <span>5</span>
          <span className="ml-2">tap any past day to rate it</span>
        </div>
      </section>

      <QuickAddTask open={addOpen} onOpenChange={setAddOpen} />

      <Dialog open={!!ratingDay} onOpenChange={(o) => !o && setRatingDay(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {ratingDay === today
                ? "How productive was today?"
                : `Rate ${ratingDay ? formatShort(ratingDay) : ""}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  if (ratingDay) setRating(ratingDay, n);
                  setRatingDay(null);
                }}
                className={cn(
                  "flex h-12 items-center justify-center rounded-xl border font-mono text-lg transition-transform hover:scale-105",
                  ratingDay && ratings[ratingDay] === n
                    ? "border-text-primary"
                    : "border-transparent"
                )}
                style={{ background: RATING_COLORS[n], color: "#0A0A0A" }}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-text-tertiary">
            1 = wrote it off · 5 = locked in
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
