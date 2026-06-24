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
import { todayISO } from "@/lib/dates";
import { toStoredWeight } from "@/lib/units";
import { useAppStore } from "@/stores/app-store";

export interface MeasurementInput {
  date: string;
  weight?: number;
  bodyFat?: number;
  chest?: number;
  arms?: number;
  waist?: number;
  thighs?: number;
}

export function MeasurementDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (m: MeasurementInput) => void;
}) {
  const units = useAppStore((s) => s.units);
  const [form, setForm] = useState({
    weight: "",
    bodyFat: "",
    chest: "",
    arms: "",
    waist: "",
    thighs: "",
  });

  const fields = [
    ["weight", `Weight (${units})`],
    ["bodyFat", "Body fat %"],
    ["chest", "Chest (in)"],
    ["arms", "Arms (in)"],
    ["waist", "Waist (in)"],
    ["thighs", "Thighs (in)"],
  ] as const;

  const save = () => {
    const num = (v: string) => (v.trim() === "" ? undefined : parseFloat(v));
    // Body weight is entered in the display unit but stored in lb.
    const w = num(form.weight);
    onSave({
      date: todayISO(),
      weight: w === undefined ? undefined : toStoredWeight(w, units),
      bodyFat: num(form.bodyFat),
      chest: num(form.chest),
      arms: num(form.arms),
      waist: num(form.waist),
      thighs: num(form.thighs),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log measurements</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(([key, label]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`m-${key}`} className="text-xs">
                {label}
              </Label>
              <Input
                id={`m-${key}`}
                type="number"
                inputMode="decimal"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder="—"
              />
            </div>
          ))}
        </div>
        <Button onClick={save}>Save for today</Button>
      </DialogContent>
    </Dialog>
  );
}
