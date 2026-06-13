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
  memories: string[];
  typing: boolean;
  sendUser: (text: string) => void;
  receiveCoach: (text: string) => void;
  rememberFact: (fact: string) => void;
  forgetFact: (fact: string) => void;
  clear: () => void;
}

/** Tries to pull a memorable fact from a user message. */
function extractMemory(text: string): string | null {
  const rem = text.match(/\bremember\b[,:]?\s+(?:that\s+)?(.{5,80})/i);
  if (rem) return rem[1].trim().replace(/\.$/, "");
  const goal = text.match(/\bi(?:'m| am)\s+(cutting|bulking|recomping|on a cut|in a bulk)/i);
  if (goal) return `I'm ${goal[1].toLowerCase()}`;
  const inj = text.match(/\bmy\s+([a-z ]{2,20}?)\s+(?:is|are)\s+(hurt|injured|sore|tweaked|messed up)/i);
  if (inj) return `my ${inj[1]} is ${inj[2]}`;
  const prog = text.match(/\bi(?:'m| am)\s+(?:running|doing|following)\s+([a-z][a-z0-9 /\-]{2,30}?(?:ppl|split|program|5\/3\/1|upper.lower|push.pull|nsuns|greyskull|stronglifts|starting strength))/i);
  if (prog) return `training: ${prog[1].trim()}`;
  const wt = text.match(/\bi\s+(?:weigh|weight)\s+(\d+)\s*(?:lbs?|pounds?|kg)?/i);
  if (wt) return `weighs ${wt[1]} lb`;
  return null;
}

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: SEED_CHAT,
      memories: [],
      typing: false,

      sendUser: (text) => {
        const memory = extractMemory(text);
        set((s) => {
          const newMemories =
            memory && !s.memories.includes(memory)
              ? [...s.memories.slice(-19), memory]
              : s.memories;
          return {
            typing: true,
            memories: newMemories,
            messages: [
              ...s.messages,
              { id: newId(), role: "user", text, at: Date.now() },
            ],
          };
        });
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

      rememberFact: (fact) =>
        set((s) => ({
          memories: s.memories.includes(fact)
            ? s.memories
            : [...s.memories.slice(-19), fact],
        })),

      forgetFact: (fact) =>
        set((s) => ({ memories: s.memories.filter((m) => m !== fact) })),

      clear: () => set({ messages: [], typing: false }),
    }),
    {
      name: "lifeos-chat",
      partialize: (s) => ({ messages: s.messages, memories: s.memories }),
    }
  )
);
