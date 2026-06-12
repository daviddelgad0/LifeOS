import type { MuscleStatus } from "./body-diagram";
import type { Exercise, Muscle } from "@/lib/types";

export type MuscleStatusMap = Partial<Record<Muscle, MuscleStatus>>;
export type { Exercise };
