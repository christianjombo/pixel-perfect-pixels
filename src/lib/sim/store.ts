/**
 * Sim-backed stores: like `createDemoStore`, but the initial data comes from the
 * shared simulation dataset for the active environment, and mutations persist to
 * localStorage so demo actions survive reloads and propagate across pages.
 *
 * - Base data is deterministic (fixed seed), so SSR and first client render match.
 * - Persisted mutations are applied after hydration (microtask) to avoid mismatches.
 * - Switching Test/Live rebuilds the store from that environment's dataset plus its
 *   own persisted mutations.
 * - Large collections (ledger, card transactions…) use an overlay: only appended and
 *   patched records are persisted, never the whole dataset.
 */
import { useSyncExternalStore } from "react";
import { currentEnv, onEnvChange, type SimEnv } from "./env";

const STORAGE_PREFIX = "griv-sim:v1";

type Overlay<T extends { id: string }> = {
  appended: T[];
  patched: Record<string, Partial<T>>;
};

type Options<T> = {
  /** Persist only appended/patched records instead of the whole value (arrays of records with `id`). */
  overlay?: boolean;
};

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function createSimStore<T>(key: string, build: (env: SimEnv) => T, opts: Options<T> = {}) {
  let env: SimEnv = currentEnv();
  let state: T | undefined;
  let hydrated = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const storageKey = (e: SimEnv) => `${STORAGE_PREFIX}:${e}:${key}`;

  const base = (): T => build(env);

  const ensure = (): T => {
    if (state === undefined) state = base();
    return state;
  };

  const readPersisted = (): T | undefined => {
    if (!isBrowser()) return undefined;
    try {
      const raw = window.localStorage.getItem(storageKey(env));
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      if (opts.overlay) {
        const o = parsed as Overlay<never>;
        return applyOverlay(base(), o);
      }
      return parsed as T;
    } catch {
      return undefined;
    }
  };

  const persist = () => {
    if (!isBrowser() || state === undefined) return;
    try {
      if (opts.overlay) {
        window.localStorage.setItem(storageKey(env), JSON.stringify(toOverlay(base(), state)));
      } else {
        window.localStorage.setItem(storageKey(env), JSON.stringify(state));
      }
    } catch {
      // Storage full or unavailable — the session simply won't persist.
    }
  };

  /** Apply persisted mutations after hydration so SSR HTML still matches first paint. */
  const hydrate = () => {
    if (hydrated) return;
    hydrated = true;
    const persisted = readPersisted();
    if (persisted !== undefined) {
      state = persisted;
      notify();
    }
  };

  if (isBrowser()) queueMicrotask(hydrate);

  onEnvChange((next) => {
    env = next;
    state = undefined;
    hydrated = false;
    ensure();
    hydrate();
    notify();
  });

  return {
    get: (): T => ensure(),
    set(next: T | ((prev: T) => T)) {
      state = typeof next === "function" ? (next as (p: T) => T)(ensure()) : next;
      persist();
      notify();
    },
    /** Append records (overlay stores) — persisted as a small delta. */
    append(record: T extends Array<infer R> ? R : never) {
      this.set((prev: unknown) => [record, ...(prev as unknown[])] as unknown as T);
    },
    /** Patch one record by id (overlay stores). */
    patch(id: string, patch: Partial<T extends Array<infer R> ? R : never>) {
      this.set((prev: unknown) =>
        (prev as Array<{ id: string }>).map((r) => (r.id === id ? { ...r, ...(patch as object) } : r)) as unknown as T,
      );
    },
    /** Clear persisted mutations for the current environment (deterministic reset). */
    reset() {
      if (isBrowser()) {
        try {
          window.localStorage.removeItem(storageKey(env));
        } catch {
          /* ignore */
        }
      }
      state = base();
      notify();
    },
    use(): T {
      return useSyncExternalStore(
        (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
        () => ensure(),
        () => base(),
      );
    },
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/* ------------------------------ overlay math ------------------------------ */

function applyOverlay<T extends { id: string }>(base: T[], o: Overlay<T>): T[] {
  const patchedIds = new Set(Object.keys(o.patched));
  const merged = base
    .filter((r) => !o.appended.some((a) => a.id === r.id))
    .map((r) => (patchedIds.has(r.id) ? { ...r, ...o.patched[r.id]! } : r));
  return [...o.appended, ...merged];
}

function toOverlay<T extends { id: string }>(base: T[], state: T[]): Overlay<T> {
  const baseById = new Map(base.map((r) => [r.id, r]));
  const appended: T[] = [];
  const patched: Record<string, Partial<T>> = {};
  for (const r of state) {
    const b = baseById.get(r.id);
    if (!b) {
      appended.push(r);
    } else if (b !== r) {
      const diff: Record<string, unknown> = {};
      let changed = false;
      for (const [k, v] of Object.entries(r)) {
        if ((b as Record<string, unknown>)[k] !== v) {
          diff[k] = v;
          changed = true;
        }
      }
      if (changed) patched[r.id] = diff as Partial<T>;
    }
  }
  return { appended, patched };
}

export type SimStore<T> = ReturnType<typeof createSimStore<T>>;
