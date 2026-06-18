"use client";

import { useMemo } from "react";
import { Dumbbell, Scale, Trophy } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
} from "recharts";

import { Ring } from "@/components/ring";
import { EmptyState } from "@/components/empty-state";
import { ChartBox } from "@/components/gym/chart-box";
import {
  LEVELS,
  muscleBalance,
  parseSex,
  strengthReport,
  type StrengthLevel,
} from "@/lib/strength";
import { toDisplayWeight } from "@/lib/units";
import { useAppStore } from "@/stores/app-store";
import { useWorkoutStore } from "@/stores/workout-store";
import { cn } from "@/lib/utils";

// Cool grey → green → gold as you climb the ladder.
const LEVEL_COLOR: Record<StrengthLevel, string> = {
  Beginner: "#6B7280",
  Novice: "#5B8DEF",
  Intermediate: "#22D3A6",
  Advanced: "var(--accent)",
  Elite: "#F5A623",
  "World Class": "#FFD24A",
};

export function GymStrengthTab() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const customExercises = useWorkoutStore((s) => s.customExercises);
  const profile = useAppStore((s) => s.profile);
  const units = useAppStore((s) => s.units);

  const bw = parseFloat(profile.weightLb) || 0;
  const sex = parseSex(profile.sex);

  const report = useMemo(
    () => strengthReport(sessions, bw, sex),
    [sessions, bw, sex]
  );
  const balance = useMemo(
    () => muscleBalance(sessions, bw, sex, customExercises),
    [sessions, bw, sex, customExercises]
  );

  const wDisp = (lb: number) => toDisplayWeight(lb, units);

  if (report.lifts.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        description="Log the big barbell lifts — squat, bench, deadlift, overhead press, row — to unlock your Strength Score."
      />
    );
  }

  const color = LEVEL_COLOR[report.level];
  const radarData = balance.muscles.map((m) => ({ muscle: m.label, score: m.score }));

  return (
    <div className="flex flex-col gap-8">
      {bw <= 0 && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Add your body weight in Settings → Profile so scores can be calibrated
          to strength standards.
        </p>
      )}

      {/* Strength Score */}
      <section className="flex flex-col items-center gap-4 rounded-xl border bg-surface p-6 sm:flex-row sm:gap-8 sm:px-8"
        style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
      >
        <Ring value={report.score} size={128} color={color} label={`${report.score}`} sublabel="strength" />
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <span className="text-xs uppercase tracking-wide text-text-tertiary">
            Strength Score
          </span>
          <span className="text-2xl font-semibold" style={{ color }}>
            {report.level}
          </span>
          <p className="text-sm text-text-secondary">
            Your big lifts, scored against strength standards for a{" "}
            {Math.round(bw) || "—"} {units} {sex}. Average across{" "}
            {report.lifts.length} lift{report.lifts.length === 1 ? "" : "s"}.
          </p>
          {/* Level ladder */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LEVELS.map((lvl) => (
              <span
                key={lvl}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[0.6rem]",
                  lvl === report.level
                    ? "border-transparent text-background"
                    : "border-border text-text-tertiary"
                )}
                style={lvl === report.level ? { background: color } : undefined}
              >
                {lvl}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Per-lift breakdown */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
          <Dumbbell className="size-3.5" /> Lift breakdown
        </h2>
        <div className="flex flex-col gap-4">
          {report.lifts.map((lift) => {
            const c = LEVEL_COLOR[lift.level];
            const toNext =
              lift.nextAt && lift.nextAt > lift.e1rm
                ? wDisp(lift.nextAt - lift.e1rm)
                : null;
            return (
              <div key={lift.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{lift.label}</span>
                  <span className="font-mono text-xs text-text-secondary">
                    {wDisp(lift.e1rm)} {units} e1RM · {lift.ratio}×BW
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${lift.score}%`, background: c }}
                  />
                </div>
                <div className="flex items-center justify-between text-[0.65rem] text-text-tertiary">
                  <span style={{ color: c }}>{lift.level}</span>
                  {toNext ? (
                    <span>
                      +{toNext} {units} to next level
                    </span>
                  ) : (
                    <span>top of the ladder</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {report.missing.length > 0 && (
          <p className="text-xs text-text-tertiary">
            Not scored yet: {report.missing.join(", ")} — log them to round out
            your score.
          </p>
        )}
      </section>

      {/* Muscle Balance */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
          <Scale className="size-3.5" /> Muscle balance
        </h2>
        <ChartBox height={260}>
          {(w, h) => (
            <RadarChart width={w} height={h} data={radarData} outerRadius="72%">
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis
                dataKey="muscle"
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
              />
              <Radar
                dataKey="score"
                stroke="var(--accent)"
                fill="var(--accent)"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          )}
        </ChartBox>

        {balance.weakest && balance.strongest && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <span className="text-[0.65rem] text-text-tertiary">Lagging</span>
              <p className="text-sm font-medium capitalize text-warning">
                {balance.weakest.label}
              </p>
              <span className="font-mono text-xs text-text-tertiary">
                {balance.weakest.score}/100
              </span>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <span className="text-[0.65rem] text-text-tertiary">Strongest</span>
              <p className="text-sm font-medium capitalize text-accent">
                {balance.strongest.label}
              </p>
              <span className="font-mono text-xs text-text-tertiary">
                {balance.strongest.score}/100
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {balance.pushPull && (
            <BalanceBar
              leftLabel="Push"
              rightLabel="Pull"
              left={balance.pushPull.push}
              right={balance.pushPull.pull}
            />
          )}
          {balance.upperLower && (
            <BalanceBar
              leftLabel="Upper"
              rightLabel="Lower"
              left={balance.upperLower.upper}
              right={balance.upperLower.lower}
            />
          )}
        </div>
        <p className="text-[0.65rem] text-text-tertiary">
          Scores compare your best e1RM per muscle to strength standards. Even
          bars = balanced development.
        </p>
      </section>
    </div>
  );
}

/** A two-sided bar showing the split between two muscle groupings. */
function BalanceBar({
  leftLabel,
  rightLabel,
  left,
  right,
}: {
  leftLabel: string;
  rightLabel: string;
  left: number;
  right: number;
}) {
  const total = left + right || 1;
  const leftPct = Math.round((left / total) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[0.65rem] text-text-tertiary">
        <span>
          {leftLabel} {left}
        </span>
        <span>
          {rightLabel} {right}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full bg-accent" style={{ width: `${leftPct}%` }} />
        <div className="h-full bg-[#5B8DEF]" style={{ width: `${100 - leftPct}%` }} />
      </div>
    </div>
  );
}
