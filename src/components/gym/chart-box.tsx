"use client";

import { useEffect, useRef, useState } from "react";

interface ChartBoxProps {
  height: number;
  children: (width: number, height: number) => React.ReactNode;
  className?: string;
}

/**
 * Measures itself and passes explicit dimensions to recharts —
 * avoids ResponsiveContainer's pre-measure warning render.
 */
export function ChartBox({ height, children, className }: ChartBoxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ height }} className={className}>
      {width > 0 && children(width, height)}
    </div>
  );
}

export const AXIS = {
  stroke: "transparent",
  tick: { fill: "#666666", fontSize: 10, fontFamily: "var(--font-jetbrains)" },
  tickLine: false,
  axisLine: false,
} as const;

export const TOOLTIP_STYLE = {
  backgroundColor: "#161616",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
  color: "#FAFAFA",
} as const;
