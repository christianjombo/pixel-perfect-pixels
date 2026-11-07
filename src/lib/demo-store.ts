import { useSyncExternalStore } from "react";

/**
 * Tiny in-memory store for sample data shared between pages (e.g. a POS sale lowers Inventory).
 * Resets on reload. Mutations only happen in the browser; the server always renders the initial data.
 */
export function createDemoStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      listeners.forEach((l) => l());
    },
    use(): T {
      return useSyncExternalStore(
        (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
        () => state,
        () => initial,
      );
    },
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/** Short random reference such as "TRF-8K2Q4M". */
export function makeRef(prefix: string) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}
