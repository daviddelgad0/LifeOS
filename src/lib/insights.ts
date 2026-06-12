import { daysBetween, todayISO, addDays } from "./dates";
import { estimate1RM, sessionVolume, MUSCLES } from "./fitness";
import { getExercise } from "./exercises";
import { dayStreak, longestDayStreak } from "./streaks";
import type { Exercise, WorkoutSession, Muscle } from "./types";

export interface Insight {
  id: string;
  text: string;
  tone: "info" | "warn" | "win";
}

export function muscleLastTrained(
  sessions: WorkoutSession[],
  custom: Exercise[]
): Map<Muscle, string> {
  const map = new Map<Muscle, string>();
  for (const s of sessions) {
    for (const we of s.exercises) {
      const ex = getExercise(we.exerciseId, custom);
      if (!ex || !we.sets.some((x) => x.completed)) continue;
      const prev = map.get(ex.muscle);
      if (!prev || s.date > prev) map.set(ex.muscle, s.date);
    }
  }
  return map;
}

/** Top completed weight per session date for one exercise, oldest first. */
export function exerciseHistory(
  sessions: WorkoutSession[],
  exerciseId: string
): { date: string; top: number; e1rm: number; volume: number; reps: number }[] {
  const out: { date: string; top: number; e1rm: number; volume: number; reps: number }[] = [];
  const sorted = [...sessions]
    .filter((s) => s.endedAt)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    let top = 0;
    let e1rm = 0;
    let volume = 0;
    let reps = 0;
    for (const we of s.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const set of we.sets) {
        if (!set.completed) continue;
        top = Math.max(top, set.weight);
        e1rm = Math.max(e1rm, estimate1RM(set.weight, set.reps));
        volume += set.weight * set.reps;
        reps += set.reps;
      }
    }
    if (volume > 0) out.push({ date: s.date, top, e1rm, volume, reps });
  }
  return out;
}

export function buildInsights(
  sessions: WorkoutSession[],
  custom: Exercise[]
): Insight[] {
  const done = sessions.filter((s) => s.endedAt);
  if (done.length === 0) return [];
  const insights: Insight[] = [];
  const today = todayISO();

  // Neglected muscles (trained before, but not in the last 7 days)
  const lastTrained = muscleLastTrained(done, custom);
  for (const muscle of MUSCLES) {
    const last = lastTrained.get(muscle);
    if (!last) continue;
    const gap = daysBetween(last, today);
    if (gap >= 7 && gap <= 60) {
      insights.push({
        id: `gap-${muscle}`,
        text: `You haven't trained ${muscle} in ${gap} days`,
        tone: "warn",
      });
    }
  }

  // Stalled lifts: 4+ sessions of an exercise with no top-weight increase
  const exerciseIds = new Set(
    done.flatMap((s) => s.exercises.map((e) => e.exerciseId))
  );
  for (const id of exerciseIds) {
    const hist = exerciseHistory(done, id);
    if (hist.length < 4) continue;
    const recent = hist.slice(-4);
    const best = Math.max(...recent.map((h) => h.top));
    if (recent[0].top >= best) {
      const ex = getExercise(id, custom);
      if (ex) {
        const weeks = Math.max(
          1,
          Math.round(daysBetween(recent[0].date, today) / 7)
        );
        insights.push({
          id: `stall-${id}`,
          text: `${ex.name} hasn't progressed in ${weeks} weeks — consider varying rep ranges`,
          tone: "warn",
        });
      }
    }
  }

  // Volume trend vs previous 30 days
  const last30 = done.filter((s) => daysBetween(s.date, today) < 30);
  const prev30 = done.filter((s) => {
    const d = daysBetween(s.date, today);
    return d >= 30 && d < 60;
  });
  if (prev30.length >= 3) {
    const cur = last30.reduce((a, s) => a + sessionVolume(s), 0);
    const prev = prev30.reduce((a, s) => a + sessionVolume(s), 0);
    if (prev > 0) {
      const delta = Math.round(((cur - prev) / prev) * 100);
      if (delta <= -20)
        insights.push({
          id: "vol-down",
          text: `Weekly volume down ${Math.abs(delta)}% from last month`,
          tone: "warn",
        });
      else if (delta >= 20)
        insights.push({
          id: "vol-up",
          text: `Volume up ${delta}% over last month — recovery matters now`,
          tone: "info",
        });
    }
  }

  // Streak callout
  const dates = new Set(done.map((s) => s.date));
  const streak = dayStreak(dates);
  const longest = longestDayStreak(dates);
  if (streak >= 5) {
    insights.push({
      id: "streak",
      text:
        streak >= longest
          ? `${streak}-day workout streak — your longest ever`
          : `${streak}-day workout streak`,
      tone: "win",
    });
  }

  return insights.slice(0, 5);
}

/** Sets per muscle for the week containing `weekStart` (Mon-based). */
export function weeklySetsPerMuscle(
  sessions: WorkoutSession[],
  custom: Exercise[],
  weekStart: string
): Map<Muscle, number> {
  const map = new Map<Muscle, number>();
  const weekDates = new Set(
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  );
  for (const s of sessions) {
    if (!weekDates.has(s.date)) continue;
    for (const we of s.exercises) {
      const ex = getExercise(we.exerciseId, custom);
      if (!ex) continue;
      const completed = we.sets.filter((x) => x.completed).length;
      if (completed === 0) continue;
      map.set(ex.muscle, (map.get(ex.muscle) ?? 0) + completed);
      for (const sec of ex.secondary) {
        map.set(sec, (map.get(sec) ?? 0) + completed * 0.5);
      }
    }
  }
  return map;
}
