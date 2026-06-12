"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDays, todayISO } from "@/lib/dates";
import type { Task, TaskCategory, TaskPriority } from "@/lib/types";
import { useTaskStore } from "@/stores/task-store";

interface QuickAddTaskProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: TaskCategory;
}

export function QuickAddTask({
  open,
  onOpenChange,
  defaultCategory = "personal",
}: QuickAddTaskProps) {
  const addTask = useTaskStore((s) => s.addTask);
  const classes = useTaskStore((s) => s.classes);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<TaskCategory>(defaultCategory);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueChoice, setDueChoice] = useState("today");
  const [customDue, setCustomDue] = useState(todayISO());
  const [time, setTime] = useState("");
  const [classId, setClassId] = useState("none");

  const submit = () => {
    if (!title.trim()) return;
    const due =
      dueChoice === "today"
        ? todayISO()
        : dueChoice === "tomorrow"
          ? addDays(todayISO(), 1)
          : dueChoice === "someday"
            ? null
            : customDue;
    addTask({
      title: title.trim(),
      notes: notes.trim() || undefined,
      due,
      time: time || undefined,
      priority,
      category,
      classId:
        category === "school" && classId !== "none" ? classId : undefined,
    } as Omit<Task, "id" | "completed" | "createdAt">);
    setTitle("");
    setNotes("");
    setTime("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="qa-title">Title</Label>
            <Input
              id="qa-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="What needs doing?"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="qa-notes">Notes (optional)</Label>
            <Input
              id="qa-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Details"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as TaskCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="fitness">Fitness</SelectItem>
                  <SelectItem value="job">Job search</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {category === "school" && classes.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Class</Label>
              <Select value={classId} onValueChange={(v) => v && setClassId(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No class</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Due</Label>
              <Select
                value={dueChoice}
                onValueChange={(v) => v && setDueChoice(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="custom">Pick a date</SelectItem>
                  <SelectItem value="someday">Someday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="qa-time">Time (optional)</Label>
              <Input
                id="qa-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          {dueChoice === "custom" && (
            <Input
              type="date"
              value={customDue}
              onChange={(e) => setCustomDue(e.target.value)}
            />
          )}
          <Button onClick={submit} disabled={!title.trim()}>
            Add task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
