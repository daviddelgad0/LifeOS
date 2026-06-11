"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Line, LineChart } from "recharts";

import { useCountUp } from "@/hooks/use-count-up";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  /** Rendered after the number, e.g. " lb". */
  suffix?: string;
  /** Percent change; positive renders accent, negative renders danger. */
  trend?: number;
  sparkline?: number[];
  className?: string;
}

export function StatCard({
  label,
  value,
  suffix,
  trend,
  sparkline,
  className,
}: StatCardProps) {
  const animated = useCountUp(value);
  const TrendIcon = trend !== undefined && trend < 0 ? TrendingDown : TrendingUp;

  // Measure the sparkline box ourselves — recharts' ResponsiveContainer
  // warns on its pre-measure render, so we only mount the chart with a
  // known width and height.
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!boxRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setBox({ w: width, h: height });
    });
    observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "tween", duration: 0.2 }}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-hover",
        className
      )}
    >
      <span className="text-xs text-text-secondary">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="font-mono text-3xl font-medium leading-none">
          {formatNumber(animated)}
          {suffix && (
            <span className="text-base text-text-secondary">{suffix}</span>
          )}
        </span>
        {trend !== undefined && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trend < 0 ? "text-danger" : "text-accent"
            )}
          >
            <TrendIcon className="size-3" />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 1 && (
        <div ref={boxRef} className="h-8">
          {box && (
            <LineChart
              width={box.w}
              height={box.h}
              data={sparkline.map((v, i) => ({ i, v }))}
              margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
            >
              <Line
                type="monotone"
                dataKey="v"
                stroke="var(--accent)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </div>
      )}
    </motion.div>
  );
}
