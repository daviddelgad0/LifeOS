"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous value to `target`.
 * Jumps straight to the target when the user prefers reduced motion.
 */
export function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const from = fromRef.current;
    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      if (reduced) {
        fromRef.current = target;
        setValue(target);
        return;
      }
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      fromRef.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    // requestAnimationFrame is throttled/paused while the tab is backgrounded
    // (phone locks, a notification pulls focus, switching apps mid-animation,
    // or the page simply mounts while already backgrounded) — the count-up
    // would otherwise be left stuck at a partial value with no way to
    // resume, since this effect only reruns if target/duration change. Snap
    // straight to the target whenever the page isn't visible, so it always
    // shows the correct number rather than a stale one.
    const snapToTarget = () => {
      cancelAnimationFrame(raf);
      fromRef.current = target;
      setValue(target);
    };

    if (document.hidden) {
      snapToTarget();
    } else {
      raf = requestAnimationFrame(tick);
    }

    const onVisibility = () => {
      if (document.hidden) snapToTarget();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [target, duration]);

  return value;
}
