"use client";

import { BODY_BACK, BODY_FRONT } from "./body-map-paths";
import { VOLUME_LANDMARKS } from "@/lib/fitness";
import type { Muscle } from "@/lib/types";
import { cn } from "@/lib/utils";

const SILHOUETTE_FILL = "#2b2b33";
// Neutral parts and untrained muscles sit slightly lighter than the
// silhouette so the figure keeps its internal shape definition.
const NEUTRAL_PART_FILL = "#33333c";
const UNTRAINED_FILL = "#3d3d47";
const OVER_MRV_FILL = "#f59e0b";
// Pale base the accent is mixed into: light tint = light load, full accent
// = heavy load. Keeps the ramp theme-aware across accent colors.
const TINT = "#dce4f2";

interface MuscleBodyMapProps {
  side: "front" | "back";
  /** Weighted set counts per muscle (primary 1, secondary 0.5). */
  sets: Partial<Record<Muscle, number>>;
  /**
   * "landmarks": colors by weekly volume vs MEV/MRV (progress tab).
   * "load": colors by this-session load, saturating at 6 sets.
   */
  mode: "landmarks" | "load";
  /** Callout labels with leader lines for the 4 most-loaded muscles. */
  labels?: boolean;
  className?: string;
}

function fillFor(
  muscle: Muscle,
  n: number,
  mode: MuscleBodyMapProps["mode"]
): string {
  if (n <= 0) return UNTRAINED_FILL;
  if (mode === "load") {
    const p = 35 + 65 * Math.min(n / 6, 1);
    return `color-mix(in srgb, var(--accent) ${p}%, ${TINT})`;
  }
  const { mev, mrv } = VOLUME_LANDMARKS[muscle];
  if (n > mrv) return OVER_MRV_FILL;
  if (n < mev) return `color-mix(in srgb, var(--accent) 35%, ${TINT})`;
  const t = mrv === mev ? 1 : (n - mev) / (mrv - mev);
  return `color-mix(in srgb, var(--accent) ${55 + 45 * t}%, ${TINT})`;
}

function loadWord(
  muscle: Muscle,
  n: number,
  mode: MuscleBodyMapProps["mode"]
): string {
  if (mode === "landmarks") {
    if (n <= 0) return "Untrained";
    const { mev, mrv } = VOLUME_LANDMARKS[muscle];
    return n > mrv ? "Over MRV" : n < mev ? "Below MEV" : "Optimal";
  }
  if (n <= 0) return "No load";
  const t = Math.min(n / 6, 1);
  return t < 0.34 ? "Low load" : t < 0.67 ? "Medium load" : "High load";
}

export function MuscleBodyMap({
  side,
  sets,
  mode,
  labels = false,
  className,
}: MuscleBodyMapProps) {
  const body = side === "front" ? BODY_FRONT : BODY_BACK;
  const base = side === "front" ? 0 : 724;
  const viewBox = labels
    ? `${base - 250} 0 1224 1448`
    : `${base} 0 724 1448`;

  // Top 4 muscles by load, top-to-bottom, alternating right/left columns,
  // pushed apart vertically so labels never overlap.
  const callouts: { m: Muscle; col: "left" | "right"; y: number }[] = [];
  if (labels) {
    const chosen = (Object.keys(body.anchors) as Muscle[])
      .sort((a, b) => (sets[b] ?? 0) - (sets[a] ?? 0))
      .slice(0, 4)
      .sort((a, b) => body.anchors[a]!.right[1] - body.anchors[b]!.right[1]);
    const last = { left: 0, right: 0 };
    for (const [i, m] of chosen.entries()) {
      const col = i % 2 === 0 ? "right" : "left";
      const y = Math.max(
        Math.min(Math.max(body.anchors[m]![col][1], 160), 1320),
        last[col] + 150
      );
      last[col] = y;
      callouts.push({ m, col, y });
    }
  }

  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={`Muscle ${mode === "load" ? "load" : "volume"} body map (${side})`}
      className={cn("w-full", className)}
    >
      {/* One precomputed smooth silhouette behind everything: the figure
          reads as a connected body, and the art's own gaps between muscle
          paths become clean, even seams showing this fill. evenodd keeps
          real voids (between arm and torso) transparent. */}
      <path d={body.silhouette} fill={SILHOUETTE_FILL} fillRule="evenodd" />
      <g fill={NEUTRAL_PART_FILL}>
        {body.neutral.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {(Object.keys(body.muscles) as Muscle[]).map((m) => (
        // color-mix needs CSS `style`, not the SVG fill attribute.
        <g key={m} style={{ fill: fillFor(m, sets[m] ?? 0, mode) }}>
          {body.muscles[m]!.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      ))}
      {callouts.map(({ m, col, y }) => {
        const [ax, ay] = body.anchors[m]![col];
        const n = sets[m] ?? 0;
        const textX = col === "right" ? base + 714 : base + 10;
        const lineX = col === "right" ? base + 704 : base + 20;
        const anchor = col === "right" ? "start" : "end";
        return (
          <g key={m}>
            <line
              x1={lineX}
              y1={y}
              x2={ax}
              y2={ay}
              stroke="#565662"
              strokeWidth={2.5}
            />
            <circle cx={ax} cy={ay} r={8} fill="#565662" />
            <text
              x={textX}
              y={y - 8}
              textAnchor={anchor}
              fontSize={46}
              fontWeight={600}
              fill="#d4d4dc"
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </text>
            <text
              x={textX}
              y={y + 40}
              textAnchor={anchor}
              fontSize={38}
              style={{ fill: n > 0 ? fillFor(m, n, mode) : "#7f7f8a" }}
            >
              {loadWord(m, n, mode)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
