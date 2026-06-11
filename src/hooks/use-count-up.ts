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

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
