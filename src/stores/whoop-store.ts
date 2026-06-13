import { create } from "zustand";
import { WHOOP_DAYS, type WhoopDay } from "@/lib/whoop";

interface WhoopState {
  days: WhoopDay[];
  connected: boolean;
  init: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useWhoopStore = create<WhoopState>((set, get) => ({
  days: WHOOP_DAYS,
  connected: false,

  init: async () => {
    try {
      const res = await fetch("/api/whoop");
      if (!res.ok) return;
      const data: { connected: boolean; today?: WhoopDay } = await res.json();
      if (!data.connected || !data.today) return;
      set((s) => ({
        days: [...s.days.slice(0, -1), data.today!],
        connected: true,
      }));
    } catch {}
  },

  disconnect: async () => {
    await fetch("/api/whoop/disconnect", { method: "POST" });
    set({ days: WHOOP_DAYS, connected: false });
  },
}));

export function useWhoopToday(): WhoopDay {
  return useWhoopStore((s) => s.days[s.days.length - 1]);
}

export function useWhoopDays(): WhoopDay[] {
  return useWhoopStore((s) => s.days);
}
