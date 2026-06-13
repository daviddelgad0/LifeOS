// Weight is stored canonically in pounds everywhere. These helpers convert to
// and from the user's chosen display unit at the render/input boundary, so no
// persisted data has to change when the lb/kg toggle flips.

export type WeightUnit = "lb" | "kg";

export const KG_PER_LB = 0.45359237;

export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kgToLb = (kg: number) => kg / KG_PER_LB;

/** A stored lb weight shown in the user's unit (0.5 kg / 0.1 lb resolution). */
export function toDisplayWeight(lb: number, units: WeightUnit): number {
  if (units === "kg") return Math.round(lbToKg(lb) * 2) / 2;
  return Math.round(lb * 10) / 10;
}

/** A weight the user typed in their unit, converted back to lb for storage. */
export function toStoredWeight(value: number, units: WeightUnit): number {
  if (units === "kg") return Math.round(kgToLb(value) * 10) / 10;
  return value;
}

/** A stored lb total (e.g. volume) shown in the user's unit, rounded to int. */
export function toDisplayTotal(lb: number, units: WeightUnit): number {
  return Math.round(units === "kg" ? lbToKg(lb) : lb);
}

/** Step size for weight inputs in the display unit. */
export function weightStep(units: WeightUnit): number {
  return units === "kg" ? 2.5 : 5;
}
