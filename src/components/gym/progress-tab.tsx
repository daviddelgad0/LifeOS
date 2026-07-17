"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Download,
  FileText,
  Lightbulb,
  Ruler,
  Share2,
  TrendingUp,
} from "lucide-react";

import { StatCard } from "@/components/stat-card";
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
import { Switch } from "@/components/ui/switch";
import { AXIS, ChartBox, TOOLTIP_STYLE } from "@/components/gym/chart-box";
import { EmptyState } from "@/components/empty-state";
import {
  addDays,
  daysBetween,
  formatShort,
  startOfWeek,
  todayISO,
} from "@/lib/dates";
import { download, workoutsToCSV, workoutToText } from "@/lib/export";
import { allExercises, getExercise } from "@/lib/exercises";
import {
  estimate1RM,
  sessionVolume,
  MUSCLES,
  VOLUME_LANDMARKS,
  type MuscleLandmark,
} from "@/lib/fitness";
import { formatNumber } from "@/lib/format";
import { buildInsights, exerciseHistory } from "@/lib/insights";
import { dayStreak, longestDayStreak } from "@/lib/streaks";
import type { Muscle, WorkoutSession } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { toDisplayTotal, toDisplayWeight } from "@/lib/units";
import { MeasurementDialog } from "@/components/gym/measurement-dialog";
import { MuscleBodyMap } from "@/components/gym/muscle-body-map";
import { useChatStore } from "@/stores/chat-store";
import { useProductivityStore } from "@/stores/productivity-store";
import { useTaskStore } from "@/stores/task-store";
import { gymDayDates, useWorkoutStore } from "@/stores/workout-store";
import { cn } from "@/lib/utils";

const MUSCLE_COLORS = [
  "var(--accent)",
  "#5B8DEF",
  "#8B5CF6",
  "#FFB800",
  "#FB7185",
  "#34D399",
  "#F472B6",
  "#60A5FA",
  "#FBBF24",
  "#A3E635",
  "#22D3EE",
];

const RANGES = [
  { id: "30", label: "30d", days: 30 },
  { id: "90", label: "90d", days: 90 },
  { id: "180", label: "6mo", days: 180 },
  { id: "365", label: "1yr", days: 365 },
  { id: "all", label: "All", days: 99999 },
] as const;

const METRICS = [
  { id: "top", label: "Top weight" },
  { id: "e1rm", label: "Est. 1RM" },
  { id: "volume", label: "Volume" },
  { id: "reps", label: "Reps" },
] as const;

export function GymProgressTab() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const manualGymDays = useWorkoutStore((s) => s.manualGymDays);
  const measurements = useWorkoutStore((s) => s.measurements);
  const logMeasurement = useWorkoutStore((s) => s.logMeasurement);
  const goalWeight = useAppStore((s) => s.goalWeightLb);
  const units = useAppStore((s) => s.units);
  // Charts/tables keep their math in lb; convert only at the display edge.
  const wDisp = (lb: number) => toDisplayWeight(lb, units);
  const wTotal = (lb: number) => toDisplayTotal(lb, units);

  const done = useMemo(
    () =>
      sessions
        .filter((s) => s.endedAt)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [sessions]
  );

  const today = todayISO();
  const gymDates = gymDayDates(sessions, manualGymDays);
  const streak = dayStreak(gymDates);
  const longest = longestDayStreak(gymDates);
  const thisWeekStart = startOfWeek(today);
  const workoutsThisWeek = done.filter((s) => s.date >= thisWeekStart).length;
  const workoutsThisMonth = done.filter(
    (s) => s.date >= addDays(today, -30)
  ).length;

  const weights = measurements.filter((m) => m.weight !== undefined);
  const latestWeight = weights[weights.length - 1]?.weight ?? 0;
  const weightSpark = weights.slice(-15).map((m) => m.weight!);

  const recentPRs = useMemo(() => {
    const now = todayISO();
    const out: { exercise: string; weight: number; reps: number; date: string }[] = [];
    for (const s of [...done].reverse()) {
      if (daysBetween(s.date, now) > 30) break;
      for (const we of s.exercises) {
        for (const set of we.sets) {
          if (set.completed && set.pr) {
            out.push({
              exercise: getExercise(we.exerciseId, customExercises)?.name ?? "",
              weight: set.weight,
              reps: set.reps,
              date: s.date,
            });
          }
        }
      }
    }
    return out.slice(0, 6);
  }, [done, customExercises]);

  // Weekly total volume, last 8 weeks
  const weeklyVolume = useMemo(() => {
    const anchor = startOfWeek(todayISO());
    const weeks: { week: string; volume: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = addDays(anchor, -7 * i);
      const end = addDays(start, 7);
      const vol = done
        .filter((s) => s.date >= start && s.date < end)
        .reduce((a, s) => a + sessionVolume(s), 0);
      weeks.push({ week: formatShort(start), volume: vol });
    }
    return weeks;
  }, [done]);

  // Sets per muscle this week — for volume landmarks
  const weeklySetsByMuscle = useMemo(() => {
    const weekStart = startOfWeek(todayISO());
    const out: Partial<Record<Muscle, number>> = {};
    for (const s of done) {
      if (s.date < weekStart) continue;
      for (const we of s.exercises) {
        const m = getExercise(we.exerciseId, customExercises)?.muscle as Muscle | undefined;
        if (!m) continue;
        out[m] = (out[m] ?? 0) + we.sets.filter((x) => x.completed && !x.warmup).length;
      }
    }
    return out;
  }, [done, customExercises]);

  // Weekly volume stacked per muscle, last 8 weeks
  const stacked = useMemo(() => {
    const anchor = startOfWeek(todayISO());
    const rows: Record<string, number | string>[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = addDays(anchor, -7 * i);
      const end = addDays(start, 7);
      const row: Record<string, number | string> = { week: formatShort(start) };
      for (const s of done) {
        if (s.date < start || s.date >= end) continue;
        for (const we of s.exercises) {
          const m = getExercise(we.exerciseId, customExercises)?.muscle;
          if (!m) continue;
          const v = we.sets.reduce(
            (a, x) => a + (x.completed ? x.weight * x.reps : 0),
            0
          );
          row[m] = ((row[m] as number) ?? 0) + v;
        }
      }
      rows.push(row);
    }
    return rows;
  }, [done, customExercises]);

  // PR leaderboard
  const leaderboard = useMemo(() => {
    const best = new Map<
      string,
      { weight: number; reps: number; date: string; session: WorkoutSession }
    >();
    for (const s of done) {
      for (const we of s.exercises) {
        for (const set of we.sets) {
          if (!set.completed || set.warmup || set.weight === 0) continue;
          const cur = best.get(we.exerciseId);
          if (
            !cur ||
            set.weight > cur.weight ||
            (set.weight === cur.weight && set.reps > cur.reps)
          ) {
            best.set(we.exerciseId, {
              weight: set.weight,
              reps: set.reps,
              date: s.date,
              session: s,
            });
          }
        }
      }
    }
    return [...best.entries()]
      .map(([id, b]) => ({
        id,
        name: getExercise(id, customExercises)?.name ?? id,
        ...b,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);
  }, [done, customExercises]);

  // Per-exercise progression controls
  const trainedExercises = useMemo(() => {
    const ids = [...new Set(done.flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
    return allExercises(customExercises).filter((e) => ids.includes(e.id));
  }, [done, customExercises]);
  const [exerciseId, setExerciseId] = useState("bench-press");
  const [metric, setMetric] = useState<(typeof METRICS)[number]["id"]>("top");
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("90");

  const progression = useMemo(() => {
    const now = todayISO();
    const days = RANGES.find((r) => r.id === range)!.days;
    const hist = exerciseHistory(done, exerciseId).filter(
      (h) => daysBetween(h.date, now) <= days
    );
    const points: { date: string; value: number; isPR: boolean }[] = [];
    let runningMax = 0;
    for (const h of hist) {
      const value =
        metric === "top"
          ? h.top
          : metric === "e1rm"
            ? h.e1rm
            : metric === "volume"
              ? h.volume
              : h.reps;
      const isPR = metric !== "reps" && value > runningMax;
      runningMax = Math.max(runningMax, value);
      points.push({ date: formatShort(h.date), value, isPR });
    }
    return points;
  }, [done, exerciseId, metric, range]);

  // 90-day volume heatmap + 52-week consistency
  const heatmap = useMemo(() => {
    const volByDate = new Map<string, number>();
    for (const s of done) {
      volByDate.set(s.date, (volByDate.get(s.date) ?? 0) + sessionVolume(s));
    }
    return volByDate;
  }, [done]);
  const maxDayVol = Math.max(1, ...heatmap.values());

  // Measurements chart
  const [measureMetric, setMeasureMetric] = useState<
    "weight" | "bodyFat" | "chest" | "arms" | "waist" | "thighs"
  >("weight");
  const [smooth, setSmooth] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const measureSeries = useMemo(() => {
    const pts = measurements
      .filter((m) => m[measureMetric] !== undefined)
      .map((m) => ({
        date: formatShort(m.date),
        // Body weight is stored in lb; other measures are %/inches (unitless here).
        value:
          measureMetric === "weight"
            ? toDisplayWeight(m.weight!, units)
            : m[measureMetric]!,
      }));
    if (!smooth || pts.length < 7) return pts;
    return pts.map((p, i) => {
      const window = pts.slice(Math.max(0, i - 6), i + 1);
      return {
        date: p.date,
        value:
          Math.round(
            (window.reduce((a, x) => a + x.value, 0) / window.length) * 10
          ) / 10,
      };
    });
  }, [measurements, measureMetric, smooth, units]);

  const insights = useMemo(
    () => buildInsights(done, customExercises),
    [done, customExercises]
  );

  const [prCard, setPrCard] = useState<(typeof leaderboard)[number] | null>(null);
  const [workoutDetail, setWorkoutDetail] = useState<WorkoutSession | null>(null);

  const exportAllJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      sessions: done,
      measurements,
      tasks: useTaskStore.getState().tasks,
      classes: useTaskStore.getState().classes,
      ratings: useProductivityStore.getState().ratings,
      chat: useChatStore.getState().messages,
      profile: useAppStore.getState().profile,
      totalXP: useAppStore.getState().totalXP,
    };
    download("lifeos-export.json", JSON.stringify(data, null, 2), "application/json");
  };

  if (done.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        description="Progress charts unlock after your first logged workout."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Overview */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`Streak (best ${longest})`} value={streak} suffix=" days" />
        <StatCard label="This week" value={workoutsThisWeek} suffix=" workouts" />
        <StatCard label="Last 30 days" value={workoutsThisMonth} suffix=" workouts" />
        <StatCard
          label="Body weight"
          value={wDisp(latestWeight)}
          suffix={` ${units}`}
          sparkline={weightSpark.map(wDisp)}
        />
      </section>

      {/* Volume Landmarks */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between">
          <h2 className="text-sm font-medium text-text-tertiary">
            Volume landmarks — this week
          </h2>
          <span className="text-[0.6rem] text-text-tertiary">MEV · MRV</span>
        </div>
        <div className="flex justify-center gap-3">
          <MuscleBodyMap
            side="front"
            sets={weeklySetsByMuscle}
            mode="landmarks"
            className="max-w-36"
          />
          <MuscleBodyMap
            side="back"
            sets={weeklySetsByMuscle}
            mode="landmarks"
            className="max-w-36"
          />
        </div>
        <p className="text-center text-[0.6rem] text-text-tertiary">
          pale = below MEV · vivid = optimal · amber = over MRV
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MUSCLES.map((m) => (
            <LandmarkBar
              key={m}
              muscle={m}
              sets={weeklySetsByMuscle[m] ?? 0}
              landmark={VOLUME_LANDMARKS[m]}
            />
          ))}
        </div>
        <p className="text-[0.6rem] text-text-tertiary">
          MEV = min effective volume · MRV = max recoverable volume (RP Strength)
        </p>
      </section>

      {insights.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
            <Lightbulb className="size-3.5" /> Insights
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

      {/* Weekly volume */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-text-tertiary">
          Weekly volume — last 8 weeks
        </h2>
        <ChartBox height={180}>
          {(w, h) => (
            <BarChart width={w} height={h} data={weeklyVolume}>
              <XAxis dataKey="week" {...AXIS} />
              <YAxis {...AXIS} width={42} tickFormatter={(v: number) => formatNumber(wTotal(v))} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                formatter={(v) => [`${formatNumber(wTotal(Number(v)))} ${units}`, "volume"]}
              />
              <Bar dataKey="volume" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ChartBox>
      </section>

      {/* Per-exercise progression */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-text-tertiary">
          Exercise progression
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={exerciseId}
            onValueChange={(v) => v && setExerciseId(v)}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {trainedExercises.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  metric === m.id
                    ? "border-accent-border bg-accent-dim text-accent"
                    : "border-border text-text-secondary hover:border-border-hover"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                  range === r.id
                    ? "border-accent-border bg-accent-dim text-accent"
                    : "border-border text-text-secondary hover:border-border-hover"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {progression.length < 2 ? (
          <p className="py-8 text-center text-sm text-text-tertiary">
            Not enough data in this range yet.
          </p>
        ) : (
          <ChartBox height={220}>
            {(w, h) => (
              <LineChart width={w} height={h} data={progression}>
                <XAxis dataKey="date" {...AXIS} />
                <YAxis
                  {...AXIS}
                  width={42}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) =>
                    metric === "reps"
                      ? formatNumber(v)
                      : formatNumber(metric === "volume" ? wTotal(v) : wDisp(v))
                  }
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [
                    metric === "reps"
                      ? `${formatNumber(Number(v))} reps`
                      : `${formatNumber(metric === "volume" ? wTotal(Number(v)) : wDisp(Number(v)))} ${units}`,
                    METRICS.find((m) => m.id === metric)!.label,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={(props) => {
                    const { key, cx, cy, payload } = props as {
                      key: string; cx: number; cy: number;
                      payload: { isPR: boolean };
                    };
                    return (
                      <circle
                        key={key}
                        cx={cx}
                        cy={cy}
                        r={payload.isPR ? 4 : 2}
                        fill={payload.isPR ? "var(--accent)" : "#666666"}
                      />
                    );
                  }}
                />
              </LineChart>
            )}
          </ChartBox>
        )}
      </section>

      {/* PR leaderboard */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-text-tertiary">PR leaderboard</h2>
        <div className="flex flex-col">
          <div className="grid grid-cols-[1fr_5rem_5rem_4rem] gap-2 border-b border-border pb-2 text-xs text-text-tertiary">
            <span>Exercise</span>
            <span className="text-right">Best</span>
            <span className="text-right">e1RM</span>
            <span className="text-right">Date</span>
          </div>
          {leaderboard.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setWorkoutDetail(row.session)}
              className="grid grid-cols-[1fr_5rem_5rem_4rem] items-center gap-2 border-b border-border py-2 text-left text-sm transition-colors last:border-0 hover:bg-muted/40"
            >
              <span className="truncate">{row.name}</span>
              <span className="text-right font-mono text-xs">
                {wDisp(row.weight)}×{row.reps}
              </span>
              <span className="text-right font-mono text-xs text-accent">
                {wDisp(estimate1RM(row.weight, row.reps))}
              </span>
              <span className="text-right font-mono text-[0.65rem] text-text-tertiary">
                {formatShort(row.date)}
              </span>
            </button>
          ))}
        </div>
        {recentPRs.length > 0 && (
          <p className="text-xs text-text-tertiary">
            {recentPRs.length} PR{recentPRs.length > 1 ? "s" : ""} in the last 30
            days — latest: {recentPRs[0].exercise} {wDisp(recentPRs[0].weight)}×
            {recentPRs[0].reps}
          </p>
        )}
      </section>

      {/* Stacked weekly volume per muscle */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-text-tertiary">
          Volume by body part
        </h2>
        <ChartBox height={200}>
          {(w, h) => (
            <BarChart width={w} height={h} data={stacked}>
              <XAxis dataKey="week" {...AXIS} />
              <YAxis {...AXIS} width={42} tickFormatter={(v: number) => formatNumber(wTotal(v))} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                formatter={(v, name) => [`${formatNumber(wTotal(Number(v)))} ${units}`, name]}
              />
              {MUSCLES.map((m, i) => (
                <Bar
                  key={m}
                  dataKey={m}
                  stackId="vol"
                  fill={MUSCLE_COLORS[i % MUSCLE_COLORS.length]}
                />
              ))}
            </BarChart>
          )}
        </ChartBox>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {MUSCLES.map((m, i) => (
            <span key={m} className="flex items-center gap-1 text-[0.65rem] text-text-tertiary">
              <span
                className="size-2 rounded-sm"
                style={{ background: MUSCLE_COLORS[i % MUSCLE_COLORS.length] }}
              />
              {m}
            </span>
          ))}
        </div>
      </section>

      {/* 90-day heatmap */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-text-tertiary">
          Training volume — last 90 days
        </h2>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 90 }, (_, i) => {
            const date = addDays(today, -(89 - i));
            const vol = heatmap.get(date) ?? 0;
            const intensity = vol / maxDayVol;
            return (
              <div
                key={date}
                title={`${formatShort(date)} — ${formatNumber(wTotal(vol))} ${units}`}
                className="size-4 rounded-sm border border-border"
                style={{
                  background:
                    vol === 0
                      ? "rgba(255,255,255,0.03)"
                      : `color-mix(in srgb, var(--accent) ${Math.round(20 + intensity * 80)}%, transparent)`,
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Consistency calendar */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-text-tertiary">
          Consistency — last year
        </h2>
        <div className="overflow-x-auto pb-1">
          <div className="grid w-max grid-flow-col grid-rows-7 gap-0.5">
            {Array.from({ length: 364 }, (_, i) => {
              const date = addDays(today, -(363 - i));
              const went = gymDates.has(date);
              return (
                <div
                  key={date}
                  title={formatShort(date)}
                  className="size-2.5 rounded-[2px]"
                  style={{
                    background: went ? "var(--accent)" : "rgba(255,255,255,0.05)",
                    opacity: went ? 0.9 : 1,
                  }}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Body measurements */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-tertiary">
            Body measurements
          </h2>
          <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
            <Ruler data-icon="inline-start" className="size-3.5" />
            Log
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={measureMetric}
            onValueChange={(v) => setMeasureMetric(v as typeof measureMetric)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weight">Weight</SelectItem>
              <SelectItem value="bodyFat">Body fat %</SelectItem>
              <SelectItem value="chest">Chest</SelectItem>
              <SelectItem value="arms">Arms</SelectItem>
              <SelectItem value="waist">Waist</SelectItem>
              <SelectItem value="thighs">Thighs</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <Switch checked={smooth} onCheckedChange={setSmooth} />
            7-day average
          </label>
        </div>
        {measureSeries.length < 2 ? (
          <p className="py-6 text-center text-sm text-text-tertiary">
            Log a few entries to see the trend.
          </p>
        ) : (
          <ChartBox height={200}>
            {(w, h) => (
              <LineChart width={w} height={h} data={measureSeries}>
                <XAxis dataKey="date" {...AXIS} />
                <YAxis {...AXIS} width={40} domain={["auto", "auto"]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                {measureMetric === "weight" && (
                  <ReferenceLine
                    y={wDisp(goalWeight)}
                    stroke="rgba(255,255,255,0.25)"
                    strokeDasharray="4 4"
                    label={{
                      value: `goal ${wDisp(goalWeight)}`,
                      fill: "#666666",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            )}
          </ChartBox>
        )}
      </section>

      {/* Export */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-text-tertiary">Export</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              download("lifeos-workouts.csv", workoutsToCSV(done, customExercises), "text/csv")
            }
          >
            <Download data-icon="inline-start" className="size-3.5" />
            Workouts CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportAllJSON}>
            <Download data-icon="inline-start" className="size-3.5" />
            All data JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              download(
                "last-workout.txt",
                workoutToText(done[done.length - 1], customExercises),
                "text/plain"
              )
            }
          >
            <FileText data-icon="inline-start" className="size-3.5" />
            Last workout text
          </Button>
          {leaderboard[0] && (
            <Button variant="outline" size="sm" onClick={() => setPrCard(leaderboard[0])}>
              <Share2 data-icon="inline-start" className="size-3.5" />
              Share PR card
            </Button>
          )}
        </div>
      </section>

      {/* Share PR card */}
      <Dialog open={!!prCard} onOpenChange={(o) => !o && setPrCard(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="sr-only">PR card</DialogTitle>
          </DialogHeader>
          {prCard && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-accent-border bg-background p-6 text-center">
              <span className="text-xs text-text-tertiary">LifeOS · PR</span>
              <span className="text-sm text-text-secondary">{prCard.name}</span>
              <span className="font-mono text-5xl font-medium text-accent">
                {wDisp(prCard.weight)}
              </span>
              <span className="font-mono text-sm text-text-secondary">
                {units} × {prCard.reps} · e1RM {wDisp(estimate1RM(prCard.weight, prCard.reps))}
              </span>
              <span className="text-xs text-text-tertiary">
                {formatShort(prCard.date)}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!prCard) return;
              navigator.clipboard?.writeText(
                `PR — ${prCard.name}: ${prCard.weight} lb × ${prCard.reps} (e1RM ${estimate1RM(prCard.weight, prCard.reps)}) · ${formatShort(prCard.date)}`
              );
            }}
          >
            Copy as text
          </Button>
        </DialogContent>
      </Dialog>

      {/* Workout context for a PR row */}
      <Dialog open={!!workoutDetail} onOpenChange={(o) => !o && setWorkoutDetail(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Workout context</DialogTitle>
          </DialogHeader>
          {workoutDetail && (
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-raised p-3 font-mono text-xs text-text-secondary">
              {workoutToText(workoutDetail, customExercises)}
            </pre>
          )}
        </DialogContent>
      </Dialog>

      {/* Log measurement */}
      <MeasurementDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        onSave={(m) => logMeasurement(m)}
      />
    </div>
  );
}

function LandmarkBar({
  muscle,
  sets,
  landmark,
}: {
  muscle: Muscle;
  sets: number;
  landmark: MuscleLandmark;
}) {
  const { mev, mrv } = landmark;
  const max = Math.max(mrv, sets);
  const fillPct = max === 0 ? 0 : Math.min(100, (sets / max) * 100);
  const mevPct = mrv === 0 ? 0 : (mev / Math.max(mrv, sets)) * 100;

  const status =
    sets === 0 ? "none" :
    sets < mev ? "under" :
    sets <= mrv ? "optimal" :
    "over";

  const fillColor =
    status === "optimal" ? "var(--accent)" :
    status === "over"    ? "#FB7185" :
                           "#5B8DEF";

  const label =
    status === "none"    ? "not trained" :
    status === "under"   ? `${mev - sets} short of MEV` :
    status === "over"    ? "above MRV — deload" :
                           "in zone";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="capitalize text-text-secondary">{muscle}</span>
        <span
          className={cn(
            "font-mono text-[0.65rem]",
            status === "optimal" && "text-accent",
            status === "over" && "text-[#FB7185]",
            (status === "none" || status === "under") && "text-text-tertiary"
          )}
        >
          {sets}s · {label}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${fillPct}%`, background: fillColor }}
        />
        {mev > 0 && (
          <div
            className="absolute top-0 h-full w-px bg-border-hover"
            style={{ left: `${mevPct}%` }}
          />
        )}
      </div>
    </div>
  );
}

