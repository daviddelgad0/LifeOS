"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { QuickAddTask } from "@/components/quick-add-task";
import { Ring } from "@/components/ring";
import { TaskRow } from "@/components/task-row";
import { EnergyCard } from "@/components/today/energy-card";
import { WhoopStrip } from "@/components/today/whoop-strip";
import { addDays, formatLong, relativeDay, todayISO } from "@/lib/dates";
import { ListChecks } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useTaskStore } from "@/stores/task-store";
import { useWorkoutStore } from "@/stores/workout-store";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "tween", ease: "easeOut", duration: 0.4 },
  },
};

function greeting(name: string): string {
  const h = new Date().getHours();
  if (h < 5) return `Late night, ${name}`;
  if (h < 12) return `Good morning, ${name}`;
  if (h < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

export default function TodayPage() {
  const router = useRouter();
  const name = useAppStore((s) => s.profile.name) || "David";
  const ringStyle = useAppStore((s) => s.ringStyle);
  const tasks = useTaskStore((s) => s.tasks);
  const classes = useTaskStore((s) => s.classes);
  const toggleTask = useTaskStore((s) => s.toggleTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const [addOpen, setAddOpen] = useState(false);

  const today = todayISO();
  const clsById = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );

  const dueToday = tasks.filter((t) => t.due === today);
  const doneToday = dueToday.filter((t) => t.completed).length;
  const taskPct =
    dueToday.length === 0 ? 100 : (doneToday / dueToday.length) * 100;

  const workoutToday = sessions.some((s) => s.date === today && s.endedAt);
  const workoutPct = workoutToday ? 100 : active ? 50 : 0;

  const assignments = tasks.filter(
    (t) => t.classId && !t.completed && t.due
  );
  const overdue = assignments.filter((t) => t.due! < today).length;
  const dueSoon = assignments.filter(
    (t) => t.due! >= today && t.due! <= addDays(today, 7)
  ).length;
  const assignPct =
    overdue + dueSoon === 0 ? 100 : (dueSoon / (overdue + dueSoon)) * 100;

  const upNext = useMemo(() => {
    const now = todayISO();
    const days = [1, 2, 3].map((offset) => addDays(now, offset));
    return days
      .map((d) => ({
        date: d,
        items: tasks.filter((t) => t.due === d && !t.completed),
      }))
      .filter((g) => g.items.length > 0);
  }, [tasks]);

  const linecap = ringStyle === "flat" ? ("butt" as const) : ("round" as const);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 md:px-6 md:py-8"
    >
      <motion.header variants={item} className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{greeting(name)}</h1>
        <p className="text-sm text-text-tertiary">{formatLong(today)}</p>
      </motion.header>

      <motion.section
        variants={item}
        className="flex items-center justify-around gap-2 rounded-xl border border-border bg-surface px-2 py-6 sm:justify-start sm:gap-12 sm:px-8"
      >
        <button
          type="button"
          onClick={() => router.push("/productivity")}
          className="rounded-xl transition-transform hover:scale-[1.02]"
          aria-label="Open tasks"
        >
          <Ring
            value={taskPct}
            size={104}
            label={`${doneToday}/${dueToday.length || 0}`}
            sublabel="tasks"
            linecap={linecap}
          />
        </button>
        <button
          type="button"
          onClick={() => router.push(active ? "/gym/workout" : "/gym")}
          className="rounded-xl transition-transform hover:scale-[1.02]"
          aria-label="Open gym"
        >
          <Ring
            value={workoutPct}
            size={104}
            label={workoutToday ? "1/1" : active ? "···" : "0/1"}
            sublabel="workout"
            linecap={linecap}
          />
        </button>
        <button
          type="button"
          onClick={() => router.push("/school")}
          className="rounded-xl transition-transform hover:scale-[1.02]"
          aria-label="Open school"
        >
          <Ring
            value={assignPct}
            size={104}
            label={overdue > 0 ? `${overdue} late` : "on track"}
            sublabel="assignments"
            linecap={linecap}
          />
        </button>
      </motion.section>

      <motion.div variants={item}>
        <WhoopStrip />
      </motion.div>

      <motion.div variants={item}>
        <EnergyCard />
      </motion.div>

      <motion.section variants={item} className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-tertiary">Today</h2>
        {dueToday.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            description="Nothing due today. Add something or enjoy the slack."
            actionLabel="Add task"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {[...dueToday]
              .sort((a, b) => Number(a.completed) - Number(b.completed))
              .map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  cls={t.classId ? clsById.get(t.classId) : undefined}
                  onToggle={() => toggleTask(t.id)}
                  onDelete={() => deleteTask(t.id)}
                />
              ))}
          </div>
        )}
      </motion.section>

      {upNext.length > 0 && (
        <motion.section variants={item} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-text-tertiary">Up next</h2>
          <div className="flex flex-col gap-4">
            {upNext.map((group) => (
              <div key={group.date} className="flex flex-col gap-2">
                <span className="text-xs text-text-secondary">
                  {relativeDay(group.date)}
                </span>
                {group.items.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    cls={t.classId ? clsById.get(t.classId) : undefined}
                    onToggle={() => toggleTask(t.id)}
                    onDelete={() => deleteTask(t.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </motion.section>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Quick add"
        className="fixed bottom-20 right-4 z-30 flex size-12 items-center justify-center rounded-full bg-accent text-background shadow-lg shadow-accent/20 transition-transform hover:scale-105 md:bottom-8 md:right-8"
      >
        <Plus className="size-5" strokeWidth={2.4} />
      </button>

      <QuickAddTask open={addOpen} onOpenChange={setAddOpen} />
    </motion.div>
  );
}
