"use client";

import { useEffect } from "react";
import { pullAll, pushData } from "@/lib/sync";
import { useAuthStore } from "@/stores/auth-store";
import { useAppStore } from "@/stores/app-store";
import { useChatStore } from "@/stores/chat-store";
import { useProductivityStore } from "@/stores/productivity-store";
import { useTaskStore } from "@/stores/task-store";
import { useWorkoutStore } from "@/stores/workout-store";

/**
 * Invisible component: pulls cloud data on login, then pushes on store changes.
 * Debounces writes to 2s so rapid mutations don't spam Supabase.
 */
export function SyncManager() {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;

    // Pull cloud → localStorage → rehydrate stores on login.
    pullAll().then((count) => {
      if (count > 0) {
        useAppStore.persist.rehydrate();
        useWorkoutStore.persist.rehydrate();
        useTaskStore.persist.rehydrate();
        useProductivityStore.persist.rehydrate();
        useChatStore.persist.rehydrate();
      }
    });

    // Push on store changes (debounced per key).
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    const push = (key: Parameters<typeof pushData>[0]) => {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => pushData(key), 2000);
    };

    const unsubs = [
      useAppStore.subscribe(() => push("app")),
      useWorkoutStore.subscribe(() => push("workouts")),
      useTaskStore.subscribe(() => push("tasks")),
      useProductivityStore.subscribe(() => push("productivity")),
      useChatStore.subscribe(() => push("chat")),
    ];

    return () => {
      unsubs.forEach((u) => u());
      Object.values(timers).forEach(clearTimeout);
    };
  }, [userId]);

  return null;
}
