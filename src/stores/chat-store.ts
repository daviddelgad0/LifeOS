"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { startOfWeek, todayISO } from "@/lib/dates";
import { XP } from "@/lib/xp";
import { SEED_CHAT } from "@/lib/seed";
import type { ChatMsg } from "@/lib/types";
import { useAppStore } from "./app-store";

interface ChatState {
  messages: ChatMsg[];
  typing: boolean;
  sendUser: (text: string) => void;
  receiveCoach: (text: string) => void;
  clear: () => void;
}

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: SEED_CHAT,
      typing: false,

      sendUser: (text) => {
        set((s) => ({
          typing: true,
          messages: [
            ...s.messages,
            { id: newId(), role: "user", text, at: Date.now() },
          ],
        }));
        const app = useAppStore.getState();
        app.set("coachMessagesSent", app.coachMessagesSent + 1);
        const week = startOfWeek(todayISO());
        if (app.lastCheckinWeek !== week) {
          app.set("lastCheckinWeek", week);
          app.awardXP(XP.coachCheckin, "Weekly coach check-in");
        }
      },

      receiveCoach: (text) =>
        set((s) => ({
          typing: false,
          messages: [
            ...s.messages,
            { id: newId(), role: "coach", text, at: Date.now() },
          ],
        })),

      clear: () => set({ messages: [], typing: false }),
    }),
    {
      name: "lifeos-chat",
      partialize: (s) => ({ messages: s.messages }),
    }
  )
);
