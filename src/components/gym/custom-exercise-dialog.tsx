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
import { Textarea } from "@/components/ui/textarea";
import { MUSCLES } from "@/lib/fitness";
import type { Difficulty, Equipment, Muscle } from "@/lib/types";
import { useWorkoutStore } from "@/stores/workout-store";
import { cn } from "@/lib/utils";

const EQUIPMENT: Equipment[] = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "kettlebell",
];

export function CustomExerciseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addCustomExercise = useWorkoutStore((s) => s.addCustomExercise);
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<Muscle>("chest");
  const [secondary, setSecondary] = useState<Muscle[]>([]);
  const [equipment, setEquipment] = useState<Equipment>("barbell");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [instructions, setInstructions] = useState("");
  const [tip, setTip] = useState("");

  const save = () => {
    if (!name.trim()) return;
    addCustomExercise({
      name: name.trim(),
      muscle,
      secondary,
      equipment,
      difficulty,
      instructions: instructions.trim() || "Logged as a custom exercise.",
      tip: tip.trim() || "Control the negative and keep reps honest.",
    });
    setName("");
    setSecondary([]);
    setInstructions("");
    setTip("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Custom exercise</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ce-name">Name</Label>
            <Input
              id="ce-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cable Y-raise"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Primary muscle</Label>
              <Select value={muscle} onValueChange={(v) => setMuscle(v as Muscle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUSCLES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Equipment</Label>
              <Select
                value={equipment}
                onValueChange={(v) => setEquipment(v as Equipment)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Secondary muscles</Label>
            <div className="flex flex-wrap gap-1">
              {MUSCLES.filter((m) => m !== muscle).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    setSecondary((s) =>
                      s.includes(m) ? s.filter((x) => x !== m) : [...s, m]
                    )
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    secondary.includes(m)
                      ? "border-accent-border bg-accent-dim text-accent"
                      : "border-border text-text-secondary hover:border-border-hover"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Difficulty</Label>
            <Select
              value={difficulty}
              onValueChange={(v) => setDifficulty(v as Difficulty)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ce-instructions">Instructions (optional)</Label>
            <Textarea
              id="ce-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="How to perform it"
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ce-tip">Form tip (optional)</Label>
            <Input
              id="ce-tip"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              placeholder="One cue that matters"
            />
          </div>
          <Button onClick={save} disabled={!name.trim()}>
            Save exercise
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
