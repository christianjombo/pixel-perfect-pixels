/**
 * Deterministic seeded PRNG (mulberry32) for the shared simulation layer.
 * Same seed → identical dataset on every load, in every browser.
 */
export type Rng = () => number;

/** Stable string → 32-bit integer hash (FNV-1a). */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFor(seed: string): Rng {
  return mulberry32(hashSeed(seed));
}

/** Uniform integer in [min, max] inclusive. */
export const int = (rng: Rng, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

/** Uniform float in [min, max). */
export const float = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

export const pick = <T>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)]!;

export const chance = (rng: Rng, p: number) => rng() < p;

/** Pick from [value, weight] pairs. */
export function weighted<T>(rng: Rng, pairs: readonly (readonly [T, number])[]): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [v, w] of pairs) {
    roll -= w;
    if (roll <= 0) return v;
  }
  return pairs[pairs.length - 1]![0];
}

/** Deterministic id sequence: `cus_0001`, `cus_0002`, … */
export const seqId = (prefix: string, i: number, width = 4) =>
  `${prefix}_${String(i + 1).padStart(width, "0")}`;
