"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { todayISO } from "@/lib/dates";
import { XP } from "@/lib/xp";
import { SEED_CLASSES, SEED_TASKS } from "@/lib/seed";
import type { ParsedClassInfo, ParsedSyllabusItem, SchoolClass, Task } from "@/lib/types";
import { useAppStore } from "./app-store";

interface TaskState {
  tasks: Task[];
  classes: SchoolClass[];

  addTask: (task: Omit<Task, "id" | "completed" | "createdAt">) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  addClass: (cls: Omit<SchoolClass, "id">) => void;
  updateClass: (id: string, patch: Partial<SchoolClass>) => void;
  deleteClass: (id: string) => void;
  importSyllabus: (classId: string, items: ParsedSyllabusItem[]) => void;
  /** Creates a class from parsed syllabus info plus the two things only the
   * user can decide (color, sync), and imports the parsed assignments into
   * it in one shot — atomic, so there's no gap where the class exists but
   * the id used to attach assignments hasn't been read back yet. */
  importSyllabusWithClass: (
    cls: ParsedClassInfo & { color: string; syncToGoogle: boolean },
    items: ParsedSyllabusItem[]
  ) => void;
}

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: SEED_TASKS,
      classes: SEED_CLASSES,

      addTask: (task) =>
        set((s) => ({
          tasks: [
            { ...task, id: newId(), completed: false, createdAt: todayISO() },
            ...s.tasks,
          ],
        })),

      toggleTask: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        const completing = !task.completed;
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  completed: completing,
                  completedAt: completing ? todayISO() : undefined,
                }
              : t
          ),
        }));
        if (completing) {
          const app = useAppStore.getState();
          const onTime =
            task.classId && task.due && todayISO() <= task.due;
          if (onTime) {
            app.awardXP(XP.assignmentOnTime, "Assignment submitted on time");
          } else {
            app.awardXP(XP.task, "Task completed");
          }
        }
      },

      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addClass: (cls) =>
        set((s) => ({ classes: [...s.classes, { ...cls, id: newId() }] })),

      updateClass: (id, patch) =>
        set((s) => ({
          classes: s.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      deleteClass: (id) =>
        set((s) => ({
          classes: s.classes.filter((c) => c.id !== id),
          tasks: s.tasks.filter((t) => t.classId !== id),
        })),

      importSyllabus: (classId, items) => {
        const accepted = items.filter((i) => i.include);
        set((s) => ({
          tasks: [
            ...accepted.map((i) => ({
              id: newId(),
              title: i.title,
              due: i.due,
              priority: (i.type === "exam" || i.type === "paper" || i.type === "project"
                ? "high"
                : "medium") as Task["priority"],
              category: "school" as const,
              classId,
              assignmentType: i.type,
              completed: false,
              createdAt: todayISO(),
            })),
            ...s.tasks,
          ],
        }));
        useAppStore.getState().unlockAchievement("first-syllabus");
      },

      importSyllabusWithClass: (cls, items) => {
        const classId = newId();
        const accepted = items.filter((i) => i.include);
        set((s) => ({
          classes: [
            ...s.classes,
            {
              id: classId,
              name: cls.name,
              code: cls.code,
              professor: cls.professor,
              location: cls.location,
              color: cls.color,
              meetings: cls.meetings,
              gradeWeights: cls.gradeWeights,
              syncToGoogle: cls.syncToGoogle,
            },
          ],
          tasks: [
            ...accepted.map((i) => ({
              id: newId(),
              title: i.title,
              due: i.due,
              priority: (i.type === "exam" || i.type === "paper" || i.type === "project"
                ? "high"
                : "medium") as Task["priority"],
              category: "school" as const,
              classId,
              assignmentType: i.type,
              completed: false,
              createdAt: todayISO(),
            })),
            ...s.tasks,
          ],
        }));
        useAppStore.getState().unlockAchievement("first-syllabus");
      },
    }),
    { name: "lifeos-tasks" }
  )
);
