import type { SignData, StairData } from '../types.ts'
import { mask4, stamp } from '../../generation/autotile.ts'

/**
 * Map as code: ASCII rows + a legend become the two tile layers. Shared by the
 * hand-made towns and interiors (relative imports so Node QA scripts can load them).
 */

/** What one character of a map becomes: its floor tile and its object tile ('' = none) */
export interface Cell {
  ground?: string | ((x: number, y: number) => string)
  wall?: string | ((x: number, y: number) => string)
}

export class MapCode {
  readonly rows: string[]
  readonly width: number
  readonly height: number
  readonly groundLayer: string[]
  readonly wallsLayer: string[]

  constructor(rows: string[]) {
    this.rows = rows
    this.width = rows[0].length
    this.height = rows.length
    const bad = rows.findIndex(r => r.length !== this.width)
    if (bad >= 0) throw new Error(`map row ${bad} is ${rows[bad].length} wide, expected ${this.width}`)
    this.groundLayer = new Array(this.width * this.height).fill('')
    this.wallsLayer = new Array(this.width * this.height).fill('')
  }

  at(x: number, y: number, outside = ' '): string {
    return x < 0 || y < 0 || x >= this.width || y >= this.height ? outside : this.rows[y][x]
  }

  /** Every tile holding `ch` */
  find(ch: string): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = []
    this.rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === ch) out.push({ x, y }) }))
    return out
  }

  first(ch: string): { x: number; y: number } {
    const p = this.find(ch)[0]
    if (!p) throw new Error(`no "${ch}" in the map`)
    return p
  }

  /** Neighbour mask (N=1, E=2, S=4, W=8) of tiles whose character is in `chars` */
  mask(chars: string, x: number, y: number, outsideCounts = true): number {
    return mask4((nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) return outsideCounts
      return chars.includes(this.rows[ny][nx])
    }, x, y)
  }

  /** Fill both layers from the legend (a default floor under characters without one) */
  paint(legend: Record<string, Cell>, defaultGround: (x: number, y: number) => string): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = legend[this.rows[y][x]] ?? {}
        const g = cell.ground ?? defaultGround
        const w = cell.wall ?? ''
        this.groundLayer[y * this.width + x] = typeof g === 'function' ? g(x, y) : g
        this.wallsLayer[y * this.width + x] = typeof w === 'function' ? w(x, y) : w
      }
    }
    return this
  }

  setWall(x: number, y: number, key: string): void {
    this.wallsLayer[y * this.width + x] = key
  }

  setGround(x: number, y: number, key: string): void {
    this.groundLayer[y * this.width + x] = key
  }

  /** A multi-tile object (tiles `${prefix}_${col}_${row}`) from the top-left of `ch`'s block */
  stamp(ch: string, prefix: string, cols: number, rows: number): { x: number; y: number } {
    const { x, y } = this.first(ch)
    stamp(this.wallsLayer, this.width, prefix, cols, rows, x, y)
    return { x, y }
  }
}

/** A door or stairs: step on it to go to `target`, arriving on its `arrival` when coming back */
export function door(x: number, y: number, target: string, arrival: { x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' }): StairData {
  return { tileX: x, tileY: y, targetMapId: target, arrival: { tileX: arrival.x, tileY: arrival.y, facing: arrival.facing } }
}

export function sign(x: number, y: number, textKey: string): SignData {
  return { tileX: x, tileY: y, textKey }
}
