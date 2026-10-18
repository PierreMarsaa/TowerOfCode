/**
 * Integer hashing for deterministic "randomness" in the art (never Math.random):
 * the same inputs always give the same pixels, on every machine.
 */

export function hash(...parts) {
  let h = 0x9e3779b9
  for (const p of parts) {
    h ^= Math.imul((p | 0) ^ 0x85ebca6b, 0xc2b2ae35)
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
    h ^= h >>> 15
  }
  return h >>> 0
}

/** Value in [0, 1) */
export function rnd(...parts) {
  return hash(...parts) / 4294967296
}
