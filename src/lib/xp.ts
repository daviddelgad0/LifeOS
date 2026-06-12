export const XP = {
  workout: 50,
  pr: 100,
  task: 5,
  assignmentOnTime: 25,
  streak7Bonus: 200,
  coachCheckin: 30,
} as const;

/** XP required to go from `level` to `level + 1`. */
export function xpToNextLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

export function levelFromXP(totalXP: number): {
  level: number;
  intoLevel: number;
  toNext: number;
} {
  let level = 1;
  let remaining = totalXP;
  while (level < 100 && remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level++;
  }
  return { level, intoLevel: remaining, toNext: xpToNextLevel(level) };
}

export interface AchievementDef {
  id: string;
  label: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-workout", label: "First workout", description: "Log your first session" },
  { id: "ten-workouts", label: "10 workouts", description: "Log ten sessions" },
  { id: "first-pr", label: "First PR", description: "Set a personal record" },
  { id: "streak-7", label: "7-day streak", description: "Train seven days in a row" },
  { id: "first-syllabus", label: "First syllabus", description: "Import a syllabus" },
  { id: "streak-30", label: "30-day streak", description: "Train thirty days in a row" },
];

export interface AccentDef {
  id: string;
  name: string;
  hex: string;
  rgb: string;
  unlockLevel: number;
}

export const ACCENTS: AccentDef[] = [
  { id: "green", name: "Signal green", hex: "#00FF88", rgb: "0,255,136", unlockLevel: 1 },
  { id: "cyan", name: "Ice cyan", hex: "#00D4FF", rgb: "0,212,255", unlockLevel: 5 },
  { id: "violet", name: "Ultraviolet", hex: "#A78BFA", rgb: "167,139,250", unlockLevel: 10 },
  { id: "amber", name: "Solar amber", hex: "#FFB800", rgb: "255,184,0", unlockLevel: 15 },
  { id: "rose", name: "After burn", hex: "#FB7185", rgb: "251,113,133", unlockLevel: 20 },
];
