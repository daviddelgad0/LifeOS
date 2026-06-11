"use client";

import { motion, useReducedMotion } from "framer-motion";

import { formatNumber } from "@/lib/format";

interface XPBarProps {
  level: number;
  xp: number;
  xpToNext: number;
}

export function XPBar({ level, xp, xpToNext }: XPBarProps) {
  const reduced = useReducedMotion();
  const percent = Math.min((xp / xpToNext) * 100, 100);

  return (
    <div className="flex items-center gap-3">
      <span className="whitespace-nowrap text-xs font-medium text-text-secondary">
        Level {level}
      </span>
      <div
        className="h-1 w-24 overflow-hidden rounded-full bg-surface-raised"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${formatNumber(xp)} of ${formatNumber(xpToNext)} XP to level ${level + 1}`}
      >
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{
            type: "tween",
            ease: "easeOut",
            duration: reduced ? 0 : 0.8,
          }}
        />
      </div>
      <span className="whitespace-nowrap font-mono text-xs text-text-tertiary">
        {formatNumber(xp)}/{formatNumber(xpToNext)} XP
      </span>
    </div>
  );
}
