import { create } from "zustand";
import { WHOOP_DAYS, type WhoopDay } from "@/lib/whoop";

interface WhoopState {
  days: WhoopDay[];
  connected: boolean;
  /** ISO timestamp of the last successful live pull, or null. */
  lastSync: string | null;
  init: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useWhoopStore = create<WhoopState>((set) => ({
  days: WHOOP_DAYS,
  connected: false,
  lastSync: null,

  init: async () => {
    try {
      // no-store: a stale cached {connected:false} would otherwise mask a
      // freshly connected band and the tab would keep showing simulated data.
      const res = await fetch("/api/whoop", { cache: "no-store" });
      if (!res.ok) return;
      const data: { connected: boolean; days?: WhoopDay[] } = await res.json();
      if (!data.connected || !data.days?.length) return;
      // Replace the simulated history wholesale with the real band history.
      set({
        days: data.days,
        connected: true,
        lastSync: new Date().toISOString(),
      });
    } catch {}
  },

  disconnect: async () => {
    await fetch("/api/whoop/disconnect", { method: "POST" });
    set({ days: WHOOP_DAYS, connected: false, lastSync: null });
  },
}));

export function useWhoopToday(): WhoopDay {
  return useWhoopStore((s) => s.days[s.days.length - 1]);
}

/** Short human label for when live data was last pulled, e.g. "2m ago". */
export function syncLabel(lastSync: string | null): string | null {
  if (!lastSync) return null;
  const secs = Math.max(0, Math.round((Date.now() - new Date(lastSync).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function useWhoopDays(): WhoopDay[] {
  return useWhoopStore((s) => s.days);
}
