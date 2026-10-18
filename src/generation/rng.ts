/*
 * Seeded randomness for the tower. Integer-only hashing and mulberry32, so the
 * same seed gives the same floor in every browser and in Node. Shuffles are
 * Fisher-Yates (never sort-based); nothing here reads the clock or Math.random.
 */

/** Mix integers into one 32-bit seed */
export function hashSeed(...parts: number[]): number {
  let h = 0x811c9dc5
  for (const part of parts) {
    h = Math.imul(h ^ (part >>> 0), 0x01000193)
    h ^= h >>> 15
    h = Math.imul(h, 0x2c1b3c6d)
    h ^= h >>> 12
  }
  return h >>> 0
}

/** Turn a short label ("layout", "population") into a number for hashSeed */
export function label(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0
  return h >>> 0
}

export interface Rng {
  /** Float in [0, 1) */
  next(): number
  /** Integer in [lo, hi] (inclusive) */
  int(lo: number, hi: number): number
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
  /** A shuffled copy (Fisher-Yates) */
  shuffle<T>(items: readonly T[]): T[]
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1))
  return {
    next,
    int,
    chance: p => next() < p,
    pick: items => items[int(0, items.length - 1)],
    shuffle: items => {
      const a = [...items]
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(0, i)
        const tmp = a[i]
        a[i] = a[j]
        a[j] = tmp
      }
      return a
    },
  }
}
