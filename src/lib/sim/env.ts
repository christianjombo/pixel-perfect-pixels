/**
 * Simulated environments: the Test/Live toggle selects between two isolated,
 * deterministic datasets. Both are fully simulated — "live" is production-like
 * sample data, never real financial data.
 */
import { getDataset, type SimDataset, type SimEnv } from "./dataset";
import { useLiveMode } from "@/lib/live-mode";
import { liveModeStore } from "@/lib/live-mode";

export type { SimEnv };

export const currentEnv = (): SimEnv => (liveModeStore.get() ? "live" : "test");

const listeners = new Set<(env: SimEnv) => void>();
let subscribed = false;

function ensureSubscription() {
  if (subscribed) return;
  subscribed = true;
  let last = currentEnv();
  liveModeStore.subscribe(() => {
    const next = currentEnv();
    if (next !== last) {
      last = next;
      listeners.forEach((l) => l(next));
    }
  });
}

export function onEnvChange(cb: (env: SimEnv) => void): () => void {
  ensureSubscription();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Dataset for the active environment. */
export const getActiveDataset = (): SimDataset => getDataset(currentEnv());

/** React hook: dataset for the active environment, re-rendering on switch. */
export function useDataset(): SimDataset {
  const live = useLiveMode();
  return getDataset(live ? "live" : "test");
}
