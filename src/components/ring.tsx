"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

interface RingProps {
  /** Progress from 0 to 100. */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  linecap?: "round" | "butt";
}

export function Ring({
  value,
  size = 120,
  strokeWidth = 8,
  color = "var(--accent)",
  label,
  sublabel,
  linecap = "round",
}: RingProps) {
  const reduced = useReducedMotion();

  // 800ms fill on mount, 400ms on later value changes. Tracking the previous
  // value in state (not a ref) keeps the render pure.
  const [prevValue, setPrevValue] = useState(value);
  const [duration, setDuration] = useState(0.8);
  if (prevValue !== value) {
    setPrevValue(value);
    setDuration(0.4);
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(value, 0), 100);
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={sublabel ?? label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap={linecap}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            type: "tween",
            ease: "easeOut",
            duration: reduced ? 0 : duration,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && (
          <span
            className={cn(
              "font-mono font-medium",
              label.length > 5 ? "text-sm" : "text-2xl"
            )}
          >
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-xs text-text-tertiary">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
