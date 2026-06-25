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
    pullAll().then(async (count) => {
      if (count === 0) return;
      // Snapshot device-local workout state before the cloud rehydrate. The
      // cloud lags local by the 2s push debounce, so a workout finished or
      // started just before this pull would otherwise be lost when the
      // rehydrate overwrites in-memory state with stale cloud data.
      const before = useWorkoutStore.getState();
      const liveActive = before.active;
      const liveRest = before.restTimer;
      const localSessions = before.sessions;
      const localMeasurements = before.measurements;

      await Promise.all([
        useAppStore.persist.rehydrate(),
        useWorkoutStore.persist.rehydrate(),
        useTaskStore.persist.rehydrate(),
        useProductivityStore.persist.rehydrate(),
        useChatStore.persist.rehydrate(),
      ]);

      // Merge append-only history (sessions/measurements) so locally-logged
      // entries survive alongside any from other devices. active/restTimer are
      // session-local — the device's own value always wins.
      const cloud = useWorkoutStore.getState();
      const byId = new Map(cloud.sessions.map((s) => [s.id, s]));
      for (const s of localSessions) if (!byId.has(s.id)) byId.set(s.id, s);
      const byDate = new Map(cloud.measurements.map((m) => [m.date, m]));
      for (const m of localMeasurements) byDate.set(m.date, m);

      useWorkoutStore.setState({
        sessions: [...byId.values()].sort((a, b) => a.date.localeCompare(b.date)),
        measurements: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
        active: liveActive,
        restTimer: liveRest,
      });
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
