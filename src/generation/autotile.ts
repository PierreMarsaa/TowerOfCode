/*
 * Autotiling for platforms over a void (tower floors, the hub island): each
 * floor cell gets an edge tile from which of its 4 neighbours are floor too,
 * each void cell right under a platform gets a cliff face, and interior cells
 * a floor variant picked by hash. Purely visual: collision never reads it.
 * Pure and Node-runnable (the art preview uses it too).
 */

export const N = 1
export const E = 2
export const S = 4
export const W = 8

/** Which of the 4 neighbours are the same terrain (bit set = same) */
export function mask4(has: (x: number, y: number) => boolean, x: number, y: number): number {
  return (has(x, y - 1) ? N : 0) | (has(x + 1, y) ? E : 0) | (has(x, y + 1) ? S : 0) | (has(x - 1, y) ? W : 0)
}

/** Deterministic value in [0, 1) for a cell */
export function cellHash(x: number, y: number, salt: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

/** Index picked by weight from a value in [0, 1) */
export function pickWeighted(h: number, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0)
  let t = h * total
  for (let i = 0; i < weights.length; i++) {
    t -= weights[i]
    if (t < 0) return i
  }
  return weights.length - 1
}

export type CliffEnd = 'mid' | 'left' | 'right' | 'single'

export interface PlatformTiles {
  floors: readonly string[]
  weights: readonly number[]
  edge(mask: number): string
  void: string
  cliff(end: CliffEnd): string
}

/**
 * Ground layer (row-major) for a map whose walkable shape is `isFloor`.
 * A horizontal bridge deck (floor with only E and W neighbours) has its own
 * side face, so the void under it stays plain void.
 */
export function platformGround(
  width: number, height: number,
  isFloor: (x: number, y: number) => boolean,
  tiles: PlatformTiles, salt: number,
): string[] {
  const floor = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && isFloor(x, y)
  const isCliff = (x: number, y: number): boolean =>
    x >= 0 && x < width && !floor(x, y) && floor(x, y - 1) && mask4(floor, x, y - 1) !== (E | W)
  const out: string[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (floor(x, y)) {
        const m = mask4(floor, x, y)
        out.push(m === (N | E | S | W) ? tiles.floors[pickWeighted(cellHash(x, y, salt), tiles.weights)] : tiles.edge(m))
      } else if (isCliff(x, y)) {
        const left = isCliff(x - 1, y), right = isCliff(x + 1, y)
        out.push(tiles.cliff(left && right ? 'mid' : left ? 'right' : right ? 'left' : 'single'))
      } else {
        out.push(tiles.void)
      }
    }
  }
  return out
}

/**
 * Write a multi-tile object (`${prefix}_${col}_${row}`) into a layer at (x, y),
 * optionally with one tile replaced (a door)
 */
export function stamp(
  layer: string[], width: number, prefix: string, cols: number, rows: number, x: number, y: number,
  door?: { col: number; row: number; key: string },
): void {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      layer[(y + r) * width + x + c] = door && door.col === c && door.row === r ? door.key : `${prefix}_${c}_${r}`
    }
  }
}
