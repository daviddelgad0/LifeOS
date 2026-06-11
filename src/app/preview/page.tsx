"use client";

import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { Dumbbell } from "lucide-react";

import { ChatMessage } from "@/components/chat-message";
import { EmptyState } from "@/components/empty-state";
import { NumberInput } from "@/components/number-input";
import { Ring } from "@/components/ring";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { StatCard } from "@/components/stat-card";
import { StreakBadge } from "@/components/streak-badge";
import { XPBar } from "@/components/xp-bar";
import { Button } from "@/components/ui/button";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "tween", ease: "easeOut", duration: 0.4 },
  },
};

const swatches = [
  { name: "background", value: "#0A0A0A", className: "bg-background" },
  { name: "surface", value: "#111111", className: "bg-surface" },
  { name: "surface-raised", value: "#161616", className: "bg-surface-raised" },
  { name: "accent", value: "#00FF88", className: "bg-accent" },
  { name: "accent-dim", value: "15% accent", className: "bg-accent-dim" },
  { name: "danger", value: "#FF4444", className: "bg-danger" },
  { name: "warning", value: "#FFB800", className: "bg-warning" },
  { name: "text-secondary", value: "#A0A0A0", className: "bg-text-secondary" },
  { name: "text-tertiary", value: "#666666", className: "bg-text-tertiary" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section variants={item} className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-text-tertiary">{title}</h2>
      {children}
    </motion.section>
  );
}

export default function PreviewPage() {
  const [weight, setWeight] = useState(135);
  const [reps, setReps] = useState(8);

  return (
    <motion.main
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-16"
    >
      <motion.header variants={item} className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">LifeOS design system</h1>
        <p className="text-text-secondary">
          Every screen builds from these tokens and components. Nothing gets
          hardcoded.
        </p>
      </motion.header>

      <Section title="Colors">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          {swatches.map((s) => (
            <div key={s.name} className="flex flex-col gap-2">
              <div
                className={`h-12 rounded-lg border border-border-hover ${s.className}`}
              />
              <div className="flex flex-col">
                <span className="text-xs text-text-secondary">{s.name}</span>
                <span className="font-mono text-xs text-text-tertiary">
                  {s.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
          <h3 className="text-2xl font-semibold">
            Display — Inter Tight 600, tighter tracking
          </h3>
          <p>
            Body — Inter 400 at 15px with 1.6 line height. Long-form copy sits
            comfortably at this size without crowding the dark surfaces around
            it.
          </p>
          <p className="text-text-secondary">
            Secondary text carries supporting detail at a quieter gray.
          </p>
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-5xl font-medium">405</span>
            <span className="font-mono text-2xl font-medium text-text-secondary">
              lb
            </span>
            <span className="text-xs text-text-tertiary">
              numbers always in JetBrains Mono
            </span>
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Start workout</Button>
          <Button variant="secondary">Add exercise</Button>
          <Button variant="outline">View history</Button>
          <Button variant="ghost">Skip rest</Button>
          <Button variant="destructive">Discard</Button>
          <Button disabled>Saving…</Button>
        </div>
      </Section>

      <Section title="Rings">
        <div className="flex flex-wrap items-center gap-8 rounded-xl border border-border bg-surface p-6">
          <Ring value={66} label="4/6" sublabel="tasks" />
          <Ring value={100} label="1/1" sublabel="workout" />
          <Ring value={40} label="2/5" sublabel="on track" />
          <Ring value={82} size={64} strokeWidth={6} />
        </div>
      </Section>

      <Section title="Stat cards">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Workouts this week" value={4} trend={33} />
          <StatCard
            label="Total volume"
            value={24350}
            suffix=" lb"
            sparkline={[12, 14, 11, 16, 15, 19, 18, 22, 21, 24]}
          />
          <StatCard label="Day streak" value={12} trend={-8} />
        </div>
      </Section>

      <Section title="XP and streaks">
        <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-surface p-6">
          <XPBar level={7} xp={340} xpToNext={500} />
          <div className="flex items-center gap-2">
            <StreakBadge count={12} />
            <StreakBadge count={0} />
          </div>
        </div>
      </Section>

      <Section title="Chat messages">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
          <ChatMessage role="coach" timestamp={new Date()}>
            Morning, David. You hit chest Monday — push day today keeps the
            split honest. How did 135 feel on the last set?
          </ChatMessage>
          <ChatMessage role="user" timestamp={new Date()}>
            Felt solid. Last two reps slowed down a bit.
          </ChatMessage>
          <ChatMessage role="coach" typing />
        </div>
      </Section>

      <Section title="Number input">
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <NumberInput
            value={weight}
            onChange={setWeight}
            step={5}
            unit="lb"
            aria-label="Weight"
          />
          <NumberInput
            value={reps}
            onChange={setReps}
            unit="reps"
            aria-label="Reps"
          />
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState
          icon={Dumbbell}
          description="No workouts yet. Your first session starts your streak."
          actionLabel="Start workout"
        />
      </Section>

      <Section title="Skeleton loader">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
          <SkeletonLoader className="h-4 w-48" />
          <SkeletonLoader className="h-4 w-64" />
          <SkeletonLoader className="h-24 w-full" />
        </div>
      </Section>
    </motion.main>
  );
}
