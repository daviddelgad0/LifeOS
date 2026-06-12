import { getExercise } from "./exercises";
import { sessionDurationMin, sessionVolume, estimate1RM } from "./fitness";
import { formatLong } from "./dates";
import type { Exercise, WorkoutSession } from "./types";

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function workoutsToCSV(
  sessions: WorkoutSession[],
  custom: Exercise[]
): string {
  const rows = [
    "date,exercise,set,weight_lb,reps,rir,est_1rm,pr,note",
  ];
  for (const s of sessions.filter((x) => x.endedAt)) {
    for (const we of s.exercises) {
      const name = getExercise(we.exerciseId, custom)?.name ?? we.exerciseId;
      we.sets.forEach((set, i) => {
        if (!set.completed) return;
        rows.push(
          [
            s.date,
            `"${name}"`,
            i + 1,
            set.weight,
            set.reps,
            set.rir ?? "",
            estimate1RM(set.weight, set.reps),
            set.pr ? "yes" : "",
            set.note ? `"${set.note.replace(/"/g, '""')}"` : "",
          ].join(",")
        );
      });
    }
  }
  return rows.join("\n");
}

export function workoutToText(
  session: WorkoutSession,
  custom: Exercise[]
): string {
  const lines = [
    `Workout — ${formatLong(session.date)}`,
    `${sessionDurationMin(session)} min · ${sessionVolume(session).toLocaleString("en-US")} lb total volume`,
    "",
  ];
  for (const we of session.exercises) {
    const name = getExercise(we.exerciseId, custom)?.name ?? we.exerciseId;
    lines.push(name);
    we.sets.forEach((s, i) => {
      if (!s.completed) return;
      lines.push(
        `  ${i + 1}. ${s.weight} lb × ${s.reps}${s.rir !== null ? ` @ RIR ${s.rir}` : ""}${s.pr ? "  — PR" : ""}`
      );
    });
    lines.push("");
  }
  return lines.join("\n");
}
