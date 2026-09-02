"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

import { ACHIEVEMENTS, levelFromXP } from "@/lib/xp";
import { todayISO } from "@/lib/dates";
import { SEED_ACHIEVEMENTS, SEED_XP } from "@/lib/seed";
import type { CoachPersonality, CycleCompound, Profile, WeeklyWeightTarget } from "@/lib/types";

export interface NotificationPrefs {
  tasks: boolean;
  assignments: boolean;
  workouts: boolean;
  productivityReminder: boolean;
}

interface AppState {
  profile: Profile;
  personality: CoachPersonality;
  units: "lb" | "kg";
  defaultRestSeconds: number;
  timerSound: boolean;
  notifications: NotificationPrefs;
  accent: string;
  ringStyle: "round" | "flat";
  googleConnected: boolean;
  monthlyBudget: number;
  coachMessagesSent: number;
  goalWeightLb: number;
  /** Per assignment type: "early" = 1w/3d/1d/day-of, "standard" = 3d/1d/day-of */
  reminderProfiles: Record<string, "early" | "standard">;
  totalXP: number;
  achievements: Record<string, string>; // id -> ISO date unlocked
  lastCheckinWeek: string | null;
  /** Active cycle's day-1 date, or null if none imported. */
  cycleStartDate: string | null;
  weeklyWeightTargets: WeeklyWeightTarget[];
  compounds: CycleCompound[];

  setProfile: (patch: Partial<Profile>) => void;
  set: <K extends keyof AppState>(key: K, value: AppState[K]) => void;
  setNotification: (key: keyof NotificationPrefs, value: boolean) => void;
  awardXP: (amount: number, reason: string) => void;
  unlockAchievement: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: {
        name: "David",
        heightIn: "70",
        weightLb: "176",
        age: "21",
        sex: "Male",
        bodyFat: "15",
        bodyNotes: "Carrying most progress in chest and quads.",
        experience: "Intermediate — 2 years",
        equipment: "Full commercial gym",
        schedule: "Classes MWF until 1pm, trains evenings",
        injuries: "",
        diet: "High protein, no restrictions",
        goal: "Recomp",
        goalTarget: "180 lb lean",
        goalTimeline: "By spring",
        lifeGoals: "Ship LifeOS. Land a software internship.",
      },
      personality: "direct",
      units: "lb",
      defaultRestSeconds: 120,
      timerSound: false,
      notifications: {
        tasks: true,
        assignments: true,
        workouts: false,
        productivityReminder: true,
      },
      accent: "green",
      ringStyle: "round",
      googleConnected: false,
      monthlyBudget: 10,
      coachMessagesSent: 14,
      goalWeightLb: 180,
      reminderProfiles: {},
      totalXP: SEED_XP,
      achievements: SEED_ACHIEVEMENTS,
      lastCheckinWeek: null,
      cycleStartDate: null,
      weeklyWeightTargets: [],
      compounds: [],

      setProfile: (patch) =>
        set((s) => ({ profile: { ...s.profile, ...patch } })),
      set: (key, value) => set({ [key]: value } as Pick<AppState, typeof key>),
      setNotification: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),

      awardXP: (amount, reason) => {
        const before = levelFromXP(get().totalXP).level;
        const total = get().totalXP + amount;
        set({ totalXP: total });
        const after = levelFromXP(total).level;
        toast(`+${amount} XP`, { description: reason });
        if (after > before) {
          toast(`Level ${after}`, {
            description: "New cosmetics may be unlocked in Settings.",
          });
        }
      },

      unlockAchievement: (id) => {
        if (get().achievements[id]) return;
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (!def) return;
        set((s) => ({
          achievements: { ...s.achievements, [id]: todayISO() },
        }));
        toast(`Achievement — ${def.label}`, { description: def.description });
      },
    }),
    { name: "lifeos-app" }
  )
);
