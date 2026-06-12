import { addDays, startOfWeek, todayISO } from "./dates";

/**
 * Consecutive days with activity, counting back from today (or yesterday,
 * so an unfinished today doesn't break the streak).
 */
export function dayStreak(activeDates: Set<string>): number {
  const today = todayISO();
  let cursor = activeDates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (activeDates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestDayStreak(activeDates: Set<string>): number {
  let longest = 0;
  for (const date of activeDates) {
    if (activeDates.has(addDays(date, -1))) continue; // not a streak start
    let len = 1;
    let cursor = addDays(date, 1);
    while (activeDates.has(cursor)) {
      len++;
      cursor = addDays(cursor, 1);
    }
    longest = Math.max(longest, len);
  }
  return longest;
}

/** Consecutive weeks (ending this week) with at least `min` active days. */
export function weeklyConsistencyStreak(
  activeDates: Set<string>,
  min = 3
): number {
  const countInWeek = (weekStart: string) => {
    let n = 0;
    for (let i = 0; i < 7; i++) {
      if (activeDates.has(addDays(weekStart, i))) n++;
    }
    return n;
  };
  let week = startOfWeek(todayISO());
  let streak = 0;
  // Current week counts if it's already at the threshold, but an in-progress
  // week below threshold doesn't break the chain.
  if (countInWeek(week) >= min) streak++;
  week = addDays(week, -7);
  while (countInWeek(week) >= min) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}
