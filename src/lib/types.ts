export type Muscle =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "full body";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "kettlebell";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  secondary: Muscle[];
  equipment: Equipment;
  difficulty: Difficulty;
  instructions: string;
  tip: string;
  custom?: boolean;
}

export interface SetEntry {
  id: string;
  weight: number;
  reps: number;
  rir: number | null;
  note?: string;
  completed: boolean;
  pr?: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  restSeconds: number;
  sets: SetEntry[];
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO yyyy-mm-dd
  startedAt: number;
  endedAt: number | null;
  exercises: WorkoutExercise[];
  note?: string;
}

export interface RoutineExercise {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  restSeconds: number;
}

export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
}

export interface Measurement {
  date: string;
  weight?: number;
  bodyFat?: number;
  chest?: number;
  arms?: number;
  waist?: number;
  thighs?: number;
}

export type TaskCategory = "school" | "fitness" | "personal" | "job";
export type TaskPriority = "low" | "medium" | "high";
export type AssignmentType =
  | "exam"
  | "paper"
  | "project"
  | "problem set"
  | "reading"
  | "quiz";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  due: string | null; // ISO yyyy-mm-dd
  time?: string; // "14:00"
  priority: TaskPriority;
  category: TaskCategory;
  classId?: string;
  assignmentType?: AssignmentType;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface ClassMeeting {
  day: number; // 0 = Sunday
  start: string;
  end: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  code: string;
  professor: string;
  location: string;
  color: string;
  meetings: ClassMeeting[];
  gradeWeights: { label: string; percent: number }[];
  syncToGoogle: boolean;
}

export interface ChatMsg {
  id: string;
  role: "user" | "coach";
  text: string;
  at: number;
}

export interface Profile {
  name: string;
  heightIn: string;
  weightLb: string;
  age: string;
  sex: string;
  bodyFat: string;
  bodyNotes: string;
  experience: string;
  equipment: string;
  schedule: string;
  injuries: string;
  diet: string;
  goal: string;
  goalTarget: string;
  goalTimeline: string;
  lifeGoals: string;
}

export type CoachPersonality = "direct" | "warm" | "drill" | "brother";

export interface ParsedSyllabusItem {
  title: string;
  type: AssignmentType;
  due: string;
  include: boolean;
}
