"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Flame, Footprints, Heart, Timer } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { StatCard } from "@/components/stat-card";
import { AXIS, ChartBox, TOOLTIP_STYLE } from "@/components/gym/chart-box";
import { formatShort, startOfWeek, todayISO } from "@/lib/dates";

interface Cardio {
  id: string;
  sport: string;
  date: string;
  durationMin: number;
  distanceMi: number;
  paceMinPerMi: number | null;
  avgHr: number;
  maxHr: number;
  strain: number;
  calories: number;
}

/** 8.5 → "8:30". */
function formatPace(min: number | null): string {
  if (!min) return "—";
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function GymRunsTab() {
  const [state, setState] = useState<"loading" | "off" | "ready">("loading");
  const [items, setItems] = useState<Cardio[]>([]);

  useEffect(() => {
    fetch("/api/whoop/workouts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { connected: boolean; sessions: Cardio[] }) => {
        if (!d.connected) {
          setState("off");
          return;
        }
        setItems(d.sessions ?? []);
        setState("ready");
      })
      .catch(() => setState("off"));
  }, []);

  const weekStart = startOfWeek(todayISO());
  const weekItems = useMemo(
    () => items.filter((r) => r.date >= weekStart),
    [items, weekStart]
  );

  const weekMiles = Math.round(weekItems.reduce((a, r) => a + r.distanceMi, 0) * 10) / 10;
  const weekMin = Math.round(weekItems.reduce((a, r) => a + r.durationMin, 0));
  const paced = items.filter((r) => r.paceMinPerMi);
  const avgPace =
    paced.length > 0
      ? paced.reduce((a, r) => a + (r.paceMinPerMi ?? 0), 0) / paced.length
      : null;

  // Oldest → newest for the chart; minutes works for every cardio type.
  const chart = useMemo(
    () =>
      [...items]
        .reverse()
        .slice(-12)
        .map((r) => ({ date: formatShort(r.date), min: r.durationMin })),
    [items]
  );

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonLoader className="h-24" />
        <SkeletonLoader className="h-48" />
      </div>
    );
  }

  if (state === "off") {
    return (
      <EmptyState
        icon={Footprints}
        description="Connect your Whoop in Settings to pull your cardio here automatically — runs, walks, rides, hikes, and more with pace, heart rate, and strain."
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Footprints}
        description="No cardio on Whoop yet. Log a run, walk, or any cardio activity on your band and it'll show up here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-tertiary">
        Cardio pulled live from your Whoop — runs, walks, rides, and more.
        Distance in miles, pace per mile where your band recorded it.
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="This week" value={weekMiles} suffix=" mi" />
        <StatCard label="Sessions this week" value={weekItems.length} />
        <StatCard label="Active this week" value={weekMin} suffix=" min" />
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
          <span className="text-xs text-text-tertiary">Avg run pace</span>
          <span className="font-mono text-2xl font-medium">
            {avgPace ? formatPace(avgPace) : "—"}
            {avgPace && <span className="text-sm text-text-tertiary"> /mi</span>}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
          <Activity className="size-3.5" /> Minutes per session
        </h2>
        <ChartBox height={180}>
          {(w, h) => (
            <BarChart width={w} height={h} data={chart}>
              <XAxis dataKey="date" {...AXIS} />
              <YAxis {...AXIS} width={32} unit="m" />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                formatter={(v) => [`${v} min`, "duration"]}
              />
              <Bar dataKey="min" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ChartBox>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-text-tertiary">Recent cardio</h2>
        {items.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">
                {r.sport}
                {r.distanceMi > 0 && (
                  <span className="text-text-secondary"> · {r.distanceMi} mi</span>
                )}
              </span>
              <span className="text-xs text-text-tertiary">{formatShort(r.date)}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <Timer className="size-3 text-text-tertiary" />
                {formatDuration(r.durationMin)}
              </span>
              {r.paceMinPerMi && (
                <span className="flex items-center gap-1">
                  <Footprints className="size-3 text-text-tertiary" />
                  {formatPace(r.paceMinPerMi)} /mi
                </span>
              )}
              <span className="flex items-center gap-1">
                <Heart className="size-3 text-text-tertiary" />
                {r.avgHr} avg · {r.maxHr} max
              </span>
              <span className="flex items-center gap-1">
                <Activity className="size-3 text-text-tertiary" />
                {r.strain.toFixed(1)} strain
              </span>
              <span className="flex items-center gap-1">
                <Flame className="size-3 text-text-tertiary" />
                {r.calories} kcal
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
