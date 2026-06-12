"use client";

import type { Muscle } from "@/lib/types";

export type MuscleStatus = "none" | "low" | "medium" | "high";

const STATUS_COLOR: Record<MuscleStatus, string> = {
  none: "rgba(255,255,255,0.08)",
  low: "#FF4444",
  medium: "#FFB800",
  high: "var(--accent)",
};

interface BodyDiagramProps {
  status: Partial<Record<Muscle, MuscleStatus>>;
  className?: string;
}

/**
 * Stylized front-facing body. Muscles fill by weekly set thresholds:
 * red < 8 sets, yellow 8–12, green 12+, gray untouched.
 * Rear chain (back, triceps, hamstrings, glutes) is shown in the stats
 * table since it isn't visible from the front.
 */
export function BodyDiagram({ status, className }: BodyDiagramProps) {
  const fill = (m: Muscle) => STATUS_COLOR[status[m] ?? "none"];
  const op = (m: Muscle) => ((status[m] ?? "none") === "none" ? 1 : 0.8);

  return (
    <svg
      viewBox="0 0 200 420"
      className={className}
      role="img"
      aria-label="Weekly muscle coverage diagram"
    >
      {/* silhouette */}
      <g fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1">
        <circle cx="100" cy="32" r="22" />
        <path d="M78 56 L122 56 L138 78 L150 150 L144 232 L126 232 L122 168 L78 168 L74 232 L56 232 L50 150 L62 78 Z" />
        <path d="M74 170 L96 170 L92 290 L88 400 L70 400 L72 290 Z" />
        <path d="M126 170 L104 170 L108 290 L112 400 L130 400 L128 290 Z" />
        <path d="M62 80 L50 150 L40 208 L52 212 L66 152 Z" />
        <path d="M138 80 L150 150 L160 208 L148 212 L134 152 Z" />
      </g>

      {/* traps */}
      <path d="M80 58 L120 58 L112 70 L88 70 Z" fill={fill("shoulders")} opacity={op("shoulders")} />
      {/* shoulders */}
      <ellipse cx="66" cy="84" rx="13" ry="11" fill={fill("shoulders")} opacity={op("shoulders")} />
      <ellipse cx="134" cy="84" rx="13" ry="11" fill={fill("shoulders")} opacity={op("shoulders")} />
      {/* chest */}
      <path d="M78 78 L98 80 L98 112 L80 108 Z" fill={fill("chest")} opacity={op("chest")} />
      <path d="M122 78 L102 80 L102 112 L120 108 Z" fill={fill("chest")} opacity={op("chest")} />
      {/* biceps */}
      <ellipse cx="58" cy="116" rx="9" ry="18" fill={fill("biceps")} opacity={op("biceps")} />
      <ellipse cx="142" cy="116" rx="9" ry="18" fill={fill("biceps")} opacity={op("biceps")} />
      {/* forearms */}
      <path d="M50 142 L62 142 L56 200 L46 198 Z" fill={fill("forearms")} opacity={op("forearms")} />
      <path d="M150 142 L138 142 L144 200 L154 198 Z" fill={fill("forearms")} opacity={op("forearms")} />
      {/* core */}
      <rect x="84" y="116" width="32" height="48" rx="6" fill={fill("core")} opacity={op("core")} />
      <path d="M78 118 L82 118 L80 160 L74 156 Z" fill={fill("core")} opacity={op("core")} />
      <path d="M122 118 L118 118 L120 160 L126 156 Z" fill={fill("core")} opacity={op("core")} />
      {/* quads */}
      <path d="M76 176 L94 176 L91 260 L78 260 Z" fill={fill("quads")} opacity={op("quads")} />
      <path d="M124 176 L106 176 L109 260 L122 260 Z" fill={fill("quads")} opacity={op("quads")} />
      {/* calves */}
      <path d="M80 300 L90 300 L88 366 L80 366 Z" fill={fill("calves")} opacity={op("calves")} />
      <path d="M120 300 L110 300 L112 366 L120 366 Z" fill={fill("calves")} opacity={op("calves")} />
    </svg>
  );
}

export function statusForSets(sets: number): MuscleStatus {
  if (sets <= 0) return "none";
  if (sets < 8) return "low";
  if (sets < 12) return "medium";
  return "high";
}
