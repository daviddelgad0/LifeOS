"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * True only on the client after hydration. localStorage-persisted stores
 * rehydrate synchronously at create(), so once this is true all stores
 * hold their persisted (or seeded) state and can be rendered safely.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
