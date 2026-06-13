"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { estimate1RM } from "@/lib/fitness";
import { XP } from "@/lib/xp";

const COLORS = [
  "var(--accent)",
  "#5B8DEF",
  "#8B5CF6",
  "#FFB800",
  "#FB7185",
  "#34D399",
];

function Confetti() {
  const particles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const angle = (i / 36) * 360;
        const dist = 140 + ((i * 13) % 130);
        const rad = (angle * Math.PI) / 180;
        return {
          id: i,
          x: Math.round(Math.cos(rad) * dist),
          y: Math.round(Math.sin(rad) * dist) - 50,
          color: COLORS[i % COLORS.length],
          size: 5 + (i % 5),
          rotate: (i * 47) % 360,
          isCircle: i % 3 === 0,
          delay: ((i * 3) % 9) * 0.03,
        };
      }),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3, rotate: p.rotate }}
          transition={{ duration: 1.5, ease: "easeOut", delay: p.delay }}
          className="absolute"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.isCircle ? "50%" : 2,
          }}
        />
      ))}
    </div>
  );
}

export function PRCelebration({
  exerciseName,
  weight,
  reps,
  onDismiss,
}: {
  exerciseName: string | null;
  weight: number;
  reps: number;
  onDismiss: () => void;
}) {
  const e1rm = estimate1RM(weight, reps);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <Confetti />

      <motion.div
        initial={{ scale: 0.55, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", duration: 0.55, bounce: 0.45 }}
        onClick={(e) => e.stopPropagation()}
        className="relative mx-6 flex flex-col items-center gap-3 rounded-2xl border border-accent-border bg-surface p-8 text-center shadow-2xl"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.15, bounce: 0.6 }}
          className="rounded-full border border-accent-border bg-accent-dim px-3 py-1 font-mono text-xs font-semibold tracking-widest text-accent"
        >
          NEW PR
        </motion.span>

        {exerciseName && (
          <p className="text-sm text-text-secondary">{exerciseName}</p>
        )}

        <motion.p
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", delay: 0.2, bounce: 0.5 }}
          className="font-mono text-7xl font-bold text-accent"
        >
          {weight}
        </motion.p>

        <p className="font-mono text-base text-text-secondary">
          lb &times; {reps} &nbsp;·&nbsp; e1RM {e1rm}
        </p>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-full border border-border bg-surface-raised px-2.5 py-1 font-mono text-xs text-text-secondary"
        >
          +{XP.pr} XP
        </motion.p>

        <p className="mt-1 text-[0.65rem] text-text-tertiary">
          tap anywhere to dismiss
        </p>
      </motion.div>
    </motion.div>
  );
}
