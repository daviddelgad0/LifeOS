"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, HeartPulse, Lightbulb, Moon, Wind } from "lucide-react";

import { Ring } from "@/components/ring";
import { StatCard } from "@/components/stat-card";
import { AXIS, ChartBox, TOOLTIP_STYLE } from "@/components/gym/chart-box";
import { formatShort } from "@/lib/dates";
import { formatHour, recommendedBedtime } from "@/lib/energy";
import {
  READINESS_COLOR,
  readiness,
  readinessCopy,
  strainTarget,
  whoopInsights,
} from "@/lib/whoop";
import { useWhoopDays, useWhoopStore, useWhoopToday } from "@/stores/whoop-store";
import { cn } from "@/lib/utils";

const SLEEP_COLORS = {
  deepHrs: "#5B8DEF",
  remHrs: "#8B5CF6",
  lightHrs: "#34506E",
  awakeHrs: "rgba(255,255,255,0.25)",
} as const;

export function GymRecoveryTab() {
  const today = useWhoopToday();
  const days = useWhoopDays();
  const connected = useWhoopStore((s) => s.connected);
  const color = READINESS_COLOR[readiness(today.recovery)];

  const trend = useMemo(
    () =>
      days.map((d) => ({
        date: formatShort(d.date),
        recovery: d.recovery,
        strain: Math.round((d.strain / 21) * 100),
        hrv: d.hrv,
        rhr: d.rhr,
      })),
    [days]
  );

  const sleepWeek = useMemo(
    () =>
      days.slice(-7).map((d) => ({
        date: formatShort(d.date),
        deepHrs: d.sleep.deepHrs,
        remHrs: d.sleep.remHrs,
        lightHrs: d.sleep.lightHrs,
        awakeHrs: d.sleep.awakeHrs,
        needed: d.sleep.needed,
      })),
    [days]
  );

  const insights = useMemo(() => whoopInsights(days), [days]);

  return (
    <div className="flex flex-col gap-8">
      <p className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-tertiary">
        {connected
          ? "Live from your Whoop — today's recovery, strain, and sleep are real. The trend charts below stay simulated until enough live days build up."
          : "Simulated Whoop feed — connect your band in Settings to pull live data."}
      </p>

      {/* Big three */}
      <section className="flex items-center justify-around gap-2 rounded-xl border border-border bg-surface px-2 py-6 sm:justify-start sm:gap-12 sm:px-8">
        <Ring
          value={today.recovery}
          size={104}
          color={color}
          label={`${today.recovery}%`}
          sublabel="recovery"
        />
        <Ring
          value={(today.strain / 21) * 100}
          size={104}
          color="#5B8DEF"
          label={today.strain.toFixed(1)}
          sublabel="strain"
        />
        <Ring
          value={today.sleep.score}
          size={104}
          color="#8B5CF6"
          label={`${today.sleep.score}%`}
          sublabel="sleep"
        />
      </section>

      {/* Readiness */}
      <section
        className="flex flex-col gap-1 rounded-xl border bg-surface p-4"
        style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
      >
        <span className="text-xs text-text-tertiary">Training readiness</span>
        <p className="text-sm">{readinessCopy(today)}</p>
        <p className="text-xs text-text-tertiary">
          Strain so far today: {today.strain.toFixed(1)} · target{" "}
          {strainTarget(today.recovery)} · in bed by{" "}
          {recommendedBedtime(today)} to wake at{" "}
          {formatHour(today.sleep.waketime)} fully recharged
        </p>
      </section>

      {/* Vitals */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="HRV (ms)"
          value={today.hrv}
          sparkline={days.slice(-14).map((d) => d.hrv)}
        />
        <StatCard
          label="Resting HR (bpm)"
          value={today.rhr}
          sparkline={days.slice(-14).map((d) => d.rhr)}
        />
        <StatCard label="Respiratory rate" value={today.respRate} suffix=" /min" />
        <StatCard label="Calories burned" value={today.calories} suffix=" kcal" />
      </section>

      {insights.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
            <Lightbulb className="size-3.5" /> Recovery insights
          </h2>
          {insights.map((i) => (
            <p
              key={i.id}
              className={cn(
                "text-sm",
                i.tone === "warn"
                  ? "text-warning"
                  : i.tone === "win"
                    ? "text-accent"
                    : "text-text-secondary"
              )}
            >
              {i.text}
            </p>
          ))}
        </section>
      )}

      {/* Recovery vs strain, 30 days */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
          <Activity className="size-3.5" /> Recovery vs strain — 30 days
        </h2>
        <ChartBox height={200}>
          {(w, h) => (
            <LineChart width={w} height={h} data={trend}>
              <XAxis dataKey="date" {...AXIS} interval={6} />
              <YAxis {...AXIS} width={34} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <ReferenceLine y={67} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              <ReferenceLine y={34} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="recovery"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="strain"
                stroke="#5B8DEF"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          )}
        </ChartBox>
        <div className="flex gap-4 text-[0.65rem] text-text-tertiary">
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 rounded bg-accent" /> recovery %
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 rounded" style={{ background: "#5B8DEF" }} />
            strain (% of 21)
          </span>
        </div>
      </section>

      {/* Sleep stages, last 7 nights */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
          <Moon className="size-3.5" /> Sleep stages — last 7 nights
        </h2>
        <ChartBox height={200}>
          {(w, h) => (
            <BarChart width={w} height={h} data={sleepWeek}>
              <XAxis dataKey="date" {...AXIS} />
              <YAxis {...AXIS} width={28} unit="h" />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                formatter={(v, name) => [
                  `${Number(v).toFixed(1)}h`,
                  String(name)
                    .replace("Hrs", "")
                    .replace("deep", "deep")
                    .replace("rem", "REM"),
                ]}
              />
              <Bar dataKey="deepHrs" stackId="s" fill={SLEEP_COLORS.deepHrs} />
              <Bar dataKey="remHrs" stackId="s" fill={SLEEP_COLORS.remHrs} />
              <Bar dataKey="lightHrs" stackId="s" fill={SLEEP_COLORS.lightHrs} />
              <Bar
                dataKey="awakeHrs"
                stackId="s"
                fill={SLEEP_COLORS.awakeHrs}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          )}
        </ChartBox>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-text-tertiary">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm" style={{ background: SLEEP_COLORS.deepHrs }} />
            deep
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm" style={{ background: SLEEP_COLORS.remHrs }} />
            REM
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm" style={{ background: SLEEP_COLORS.lightHrs }} />
            light
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm" style={{ background: SLEEP_COLORS.awakeHrs }} />
            awake
          </span>
          <span>
            last night: {today.sleep.hours}h of {today.sleep.needed}h needed ·{" "}
            {today.sleep.efficiency}% efficiency
          </span>
        </div>
      </section>

      {/* HRV and RHR trends */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
            <HeartPulse className="size-3.5" /> HRV — 30 days
          </h2>
          <ChartBox height={140}>
            {(w, h) => (
              <AreaChart width={w} height={h} data={trend}>
                <XAxis dataKey="date" {...AXIS} interval={9} />
                <YAxis {...AXIS} width={30} domain={["auto", "auto"]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="hrv"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="var(--accent)"
                  fillOpacity={0.08}
                />
              </AreaChart>
            )}
          </ChartBox>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
            <Wind className="size-3.5" /> Resting heart rate — 30 days
          </h2>
          <ChartBox height={140}>
            {(w, h) => (
              <AreaChart width={w} height={h} data={trend}>
                <XAxis dataKey="date" {...AXIS} interval={9} />
                <YAxis {...AXIS} width={30} domain={["auto", "auto"]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="rhr"
                  stroke="#5B8DEF"
                  strokeWidth={2}
                  fill="#5B8DEF"
                  fillOpacity={0.08}
                />
              </AreaChart>
            )}
          </ChartBox>
        </div>
      </section>
    </div>
  );
}
