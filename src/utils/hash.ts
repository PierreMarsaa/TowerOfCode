// Pure: deterministic integer hashing (same inputs → same value, on every machine)

/** A 32-bit unsigned hash of integers */
export function hash(...parts: number[]): number {
  let h = 0x9e3779b9
  for (const p of parts) {
    h ^= Math.imul((p | 0) ^ 0x85ebca6b, 0xc2b2ae35)
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
    h ^= h >>> 15
  }
  return h >>> 0
}
