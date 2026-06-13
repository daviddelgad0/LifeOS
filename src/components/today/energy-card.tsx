"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Zap } from "lucide-react";

import { AXIS, ChartBox, TOOLTIP_STYLE } from "@/components/gym/chart-box";
import {
  energyCurve,
  formatHour,
  optimalGymWindow,
  recommendedBedtime,
} from "@/lib/energy";
import { whoopToday } from "@/lib/whoop";

/**
 * Predicted energy across the day from last night's sleep + recovery,
 * with the optimal 90-minute training window highlighted.
 */
export function EnergyCard() {
  const day = whoopToday();
  // Snapshot "now" once per mount; the marker doesn't need to tick live.
  const [nowHour] = useState(
    () => new Date().getHours() + new Date().getMinutes() / 60
  );

  const { curve, window: gymWindow, bedtime } = useMemo(() => {
    const c = energyCurve(day);
    return {
      curve: c.map((p) => ({ ...p, label: formatHour(p.hour) })),
      window: optimalGymWindow(c),
      bedtime: recommendedBedtime(day),
    };
  }, [day]);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-text-tertiary">
          <Zap className="size-3.5" />
          Energy forecast
        </h2>
        <span className="text-xs text-text-secondary">
          best gym window:{" "}
          <span className="font-mono text-accent">{gymWindow.label}</span>
        </span>
      </div>
      <ChartBox height={150}>
        {(w, h) => (
          <AreaChart width={w} height={h} data={curve}>
            <XAxis
              dataKey="hour"
              {...AXIS}
              type="number"
              domain={[5, 24]}
              ticks={[6, 9, 12, 15, 18, 21, 24]}
              tickFormatter={(v: number) => formatHour(v).replace(":00", "")}
            />
            <YAxis {...AXIS} width={28} domain={[0, 100]} ticks={[0, 50, 100]} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v) => formatHour(Number(v))}
              formatter={(v) => [`${v}/100`, "energy"]}
            />
            <ReferenceArea
              x1={gymWindow.startHour}
              x2={gymWindow.endHour}
              fill="var(--accent)"
              fillOpacity={0.1}
              stroke="var(--accent-border)"
            />
            {nowHour >= 5 && nowHour <= 24 && (
              <ReferenceLine
                x={nowHour}
                stroke="rgba(255,255,255,0.35)"
                strokeDasharray="3 3"
                label={{ value: "now", fill: "#A0A0A0", fontSize: 10, position: "insideTop" }}
              />
            )}
            <Area
              type="monotone"
              dataKey="energy"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="var(--accent)"
              fillOpacity={0.1}
            />
          </AreaChart>
        )}
      </ChartBox>
      <p className="text-xs text-text-tertiary">
        Modeled from {day.sleep.hours}h sleep and {day.recovery}% recovery —
        an estimate, not a measurement. In bed by{" "}
        <span className="font-mono text-text-secondary">{bedtime}</span> to
        recharge for tomorrow.
      </p>
    </section>
  );
}
