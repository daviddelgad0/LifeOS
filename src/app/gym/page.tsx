"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GymBodyTab } from "@/components/gym/body-tab";
import { GymLogTab } from "@/components/gym/log-tab";
import { GymProgressTab } from "@/components/gym/progress-tab";
import { GymRecoveryTab } from "@/components/gym/recovery-tab";
import { GymRunsTab } from "@/components/gym/runs-tab";
import { GymStrengthTab } from "@/components/gym/strength-tab";
import { GymTrackersTab } from "@/components/gym/trackers-tab";

const TABS = [
  { id: "log", label: "Log", Comp: GymLogTab },
  { id: "body", label: "Body", Comp: GymBodyTab },
  { id: "progress", label: "Progress", Comp: GymProgressTab },
  { id: "strength", label: "Strength", Comp: GymStrengthTab },
  { id: "runs", label: "Cardio", Comp: GymRunsTab },
  { id: "recovery", label: "Recovery", Comp: GymRecoveryTab },
  { id: "trackers", label: "Trackers", Comp: GymTrackersTab },
] as const;

export default function GymPage() {
  // Deep-linkable (/gym?tab=body). Read location here: the shell renders this
  // page client-side only, after hydration.
  const [tab, setTab] = useState<string>(() => {
    if (typeof window === "undefined") return "log";
    const wanted = new URLSearchParams(window.location.search).get("tab");
    return wanted && TABS.some((t) => t.id === wanted) ? wanted : "log";
  });

  const Active = (TABS.find((t) => t.id === tab) ?? TABS[0]).Comp;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Gym</h1>
        <Select value={tab} onValueChange={(v) => v && setTab(v)}>
          <SelectTrigger className="w-40" aria-label="Gym section">
            <SelectValue>
              {(v: string) => TABS.find((t) => t.id === v)?.label ?? v}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TABS.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Active />
    </div>
  );
}
