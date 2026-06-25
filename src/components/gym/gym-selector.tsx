"use client";

import { useState } from "react";
import { MapPin, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkoutStore } from "@/stores/workout-store";
import { cn } from "@/lib/utils";

const ADD = "__add_gym__";

/**
 * Pick the gym you're training at. `forActive` binds it to the in-progress
 * session so changing it re-scopes that workout's weight comparisons.
 */
export function GymSelector({
  forActive = false,
  className,
}: {
  forActive?: boolean;
  className?: string;
}) {
  const gyms = useWorkoutStore((s) => s.gyms);
  const currentGym = useWorkoutStore((s) => s.currentGym);
  const activeGym = useWorkoutStore((s) => s.active?.gym);
  const setCurrentGym = useWorkoutStore((s) => s.setCurrentGym);
  const setActiveGym = useWorkoutStore((s) => s.setActiveGym);
  const addGym = useWorkoutStore((s) => s.addGym);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const value = forActive ? activeGym ?? currentGym : currentGym;

  const choose = (v: string | null) => {
    if (!v) return;
    if (v === ADD) {
      setOpen(true);
      return;
    }
    if (forActive) setActiveGym(v);
    else setCurrentGym(v);
  };

  const submit = () => {
    const n = name.trim();
    if (n) {
      addGym(n); // sets currentGym
      if (forActive) setActiveGym(n);
    }
    setName("");
    setOpen(false);
  };

  return (
    <>
      <Select value={value} onValueChange={choose}>
        <SelectTrigger className={cn("h-8 gap-1.5 text-xs", className)} aria-label="Gym">
          <MapPin className="size-3.5 text-text-tertiary" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {gyms.map((g) => (
            <SelectItem key={g} value={g}>
              {g}
            </SelectItem>
          ))}
          <SelectItem value={ADD}>
            <span className="flex items-center gap-1.5 text-text-secondary">
              <Plus className="size-3.5" /> Add gym…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Add a gym</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. Gold's Gym"
          />
          <Button onClick={submit} disabled={!name.trim()}>
            Add gym
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
