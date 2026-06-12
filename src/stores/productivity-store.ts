"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { SEED_RATINGS } from "@/lib/seed";

interface ProductivityState {
  ratings: Record<string, number>; // ISO date -> 1..5
  setRating: (date: string, rating: number) => void;
  clearRating: (date: string) => void;
}

export const useProductivityStore = create<ProductivityState>()(
  persist(
    (set) => ({
      ratings: SEED_RATINGS,
      setRating: (date, rating) =>
        set((s) => ({ ratings: { ...s.ratings, [date]: rating } })),
      clearRating: (date) =>
        set((s) => {
          const next = { ...s.ratings };
          delete next[date];
          return { ratings: next };
        }),
    }),
    { name: "lifeos-productivity" }
  )
);
