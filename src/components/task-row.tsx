"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SchoolClass, Task } from "@/lib/types";

const CATEGORY_LABEL: Record<Task["category"], string> = {
  school: "School",
  fitness: "Fitness",
  personal: "Personal",
  job: "Job search",
};

interface TaskRowProps {
  task: Task;
  cls?: SchoolClass;
  onToggle: () => void;
  onDelete?: () => void;
  showDue?: string;
}

/** Swipe right to complete, swipe left to delete; buttons work everywhere. */
export function TaskRow({ task, cls, onToggle, onDelete, showDue }: TaskRowProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      layout={!reduced}
      drag={reduced ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.4}
      onDragEnd={(_, info) => {
        if (info.offset.x > 96) onToggle();
        else if (info.offset.x < -96 && onDelete) onDelete();
      }}
      className="group flex min-h-12 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 transition-colors hover:border-border-hover"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          task.completed
            ? "border-accent bg-accent text-background"
            : "border-border-hover hover:border-accent"
        )}
      >
        {task.completed && <Check className="size-3" strokeWidth={3} />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-sm",
            task.completed && "text-text-tertiary line-through"
          )}
        >
          {task.title}
        </span>
        {task.notes && (
          <span className="truncate text-xs text-text-tertiary">
            {task.notes}
          </span>
        )}
      </div>
      {showDue && (
        <span className="shrink-0 text-xs text-text-tertiary">{showDue}</span>
      )}
      {task.time && (
        <span className="shrink-0 font-mono text-xs text-text-tertiary">
          {task.time}
        </span>
      )}
      <span
        className="shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem]"
        style={
          cls
            ? { borderColor: `${cls.color}66`, color: cls.color }
            : { borderColor: "var(--border-hover)", color: "var(--text-secondary)" }
        }
      >
        {cls ? cls.code : CATEGORY_LABEL[task.category]}
      </span>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete task"
          className="hidden shrink-0 rounded p-1 text-text-tertiary transition-colors hover:text-danger group-hover:block"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </motion.div>
  );
}
