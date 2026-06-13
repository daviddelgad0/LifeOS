"use client";

import { useRouter } from "next/navigation";

import {
  READINESS_COLOR,
  readiness,
  whoopToday,
} from "@/lib/whoop";

/** The Whoop big three, compact. Tap → full Recovery dashboard. */
export function WhoopStrip() {
  const router = useRouter();
  const day = whoopToday();
  const color = READINESS_COLOR[readiness(day.recovery)];

  const tiles = [
    { label: "recovery", value: `${day.recovery}%`, color },
    { label: "strain", value: day.strain.toFixed(1), color: "#5B8DEF" },
    { label: "sleep", value: `${day.sleep.score}%`, color: "#8B5CF6" },
  ];

  return (
    <button
      type="button"
      onClick={() => router.push("/gym?tab=recovery")}
      aria-label="Open recovery dashboard"
      className="grid w-full grid-cols-3 gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-border-hover"
    >
      {tiles.map((t) => (
        <span key={t.label} className="flex flex-col">
          <span className="font-mono text-xl font-medium" style={{ color: t.color }}>
            {t.value}
          </span>
          <span className="text-[0.65rem] text-text-tertiary">{t.label}</span>
        </span>
      ))}
    </button>
  );
}
