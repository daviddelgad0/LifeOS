"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FastForward, Minus, Plus } from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { useWorkoutStore } from "@/stores/workout-store";

function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio is best-effort.
  }
}

export function RestTimerBar() {
  const restTimer = useWorkoutStore((s) => s.restTimer);
  const adjustRest = useWorkoutStore((s) => s.adjustRest);
  const clearRest = useWorkoutStore((s) => s.clearRest);
  const sound = useAppStore((s) => s.timerSound);

  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (!restTimer) return;
    firedRef.current = false;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restTimer]);

  // Vibrate (and optionally beep) once when the countdown crosses zero,
  // then dismiss shortly after.
  useEffect(() => {
    if (!restTimer) return;
    const remaining = restTimer.endsAt - now;
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
      if (sound) beep();
      const id = setTimeout(() => clearRest(), 4000);
      return () => clearTimeout(id);
    }
  }, [restTimer, now, sound, clearRest]);

  if (!restTimer) return null;

  const remainingMs = Math.max(0, restTimer.endsAt - now);
  const remaining = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress =
    restTimer.totalSeconds > 0
      ? 1 - remainingMs / (restTimer.totalSeconds * 1000)
      : 1;
  const done = remaining <= 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md">
      <div
        className="h-1 bg-accent transition-[width] duration-300 ease-linear"
        style={{ width: `${Math.min(100, progress * 100)}%` }}
      />
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col">
          <span className="text-xs text-text-tertiary">
            {done ? "Rest over — go" : restTimer.label}
          </span>
          <motion.span
            key={done ? "done" : "counting"}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            className="font-mono text-5xl font-medium leading-none tracking-tight"
            style={done ? { color: "var(--accent)" } : undefined}
          >
            {mins}:{String(secs).padStart(2, "0")}
          </motion.span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => adjustRest(-15)}
            aria-label="Subtract 15 seconds"
            className="flex h-12 w-14 items-center justify-center rounded-xl border border-border text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
          >
            <span className="flex items-center gap-0.5 font-mono text-xs">
              <Minus className="size-3" />
              15
            </span>
          </button>
          <button
            type="button"
            onClick={() => adjustRest(15)}
            aria-label="Add 15 seconds"
            className="flex h-12 w-14 items-center justify-center rounded-xl border border-border text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
          >
            <span className="flex items-center gap-0.5 font-mono text-xs">
              <Plus className="size-3" />
              15
            </span>
          </button>
          <button
            type="button"
            onClick={clearRest}
            aria-label="Skip rest"
            className="flex h-12 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-background transition-transform hover:scale-[1.02]"
          >
            <FastForward className="size-4" />
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
