"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CardioEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES = [
  "Incline walk",
  "Run",
  "Walk",
  "Bike",
  "Row",
  "Elliptical",
  "Stairs",
  "Other",
];

type Draft = Omit<CardioEntry, "id">;

export interface CardioTarget {
  id: string | null; // null = new entry
  entry: Draft;
}

const num = (v: string) => (v.trim() === "" ? undefined : parseFloat(v));

export function CardioSheet({
  target,
  onClose,
  onSave,
}: {
  target: CardioTarget | null;
  onClose: () => void;
  onSave: (id: string | null, entry: Draft) => void;
}) {
  const [type, setType] = useState("Incline walk");
  const [form, setForm] = useState({
    durationMin: "",
    distanceMi: "",
    incline: "",
    speed: "",
    calories: "",
    note: "",
  });

  // Sync local state when a new target opens (render-time adjustment).
  const [lastId, setLastId] = useState<string | null | undefined>(undefined);
  const key = target ? (target.id ?? "new") : null;
  if (target && key !== lastId) {
    setLastId(key);
    const e = target.entry;
    setType(e.type || "Incline walk");
    setForm({
      durationMin: e.durationMin ? String(e.durationMin) : "",
      distanceMi: e.distanceMi != null ? String(e.distanceMi) : "",
      incline: e.incline != null ? String(e.incline) : "",
      speed: e.speed != null ? String(e.speed) : "",
      calories: e.calories != null ? String(e.calories) : "",
      note: e.note ?? "",
    });
  }

  if (!target) return null;

  const duration = num(form.durationMin) ?? 0;
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (duration <= 0) return;
    onSave(target.id, {
      type,
      durationMin: duration,
      distanceMi: num(form.distanceMi),
      incline: num(form.incline),
      speed: num(form.speed),
      calories: num(form.calories),
      note: form.note.trim() || undefined,
    });
    onClose();
  };

  const numField = (k: keyof typeof form, label: string, hint?: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`c-${k}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`c-${k}`}
        type="number"
        inputMode="decimal"
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={hint ?? "—"}
      />
    </div>
  );

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle className="text-sm font-medium text-text-secondary">
            {target.id ? "Edit cardio" : "Add cardio"}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  type === t
                    ? "border-accent-border bg-accent-dim text-accent"
                    : "border-border text-text-secondary hover:border-border-hover"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {numField("durationMin", "Duration (min)", "required")}
            {numField("distanceMi", "Distance (mi)")}
            {numField("incline", "Incline (%)")}
            {numField("speed", "Speed (mph)")}
            {numField("calories", "Calories")}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-note" className="text-xs">
                Note
              </Label>
              <Input
                id="c-note"
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          <Button onClick={save} disabled={duration <= 0} className="h-12">
            {target.id ? "Save" : "Add cardio"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
