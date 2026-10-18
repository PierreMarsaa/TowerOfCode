import type { Direction, TeleportData, TileEffectData } from '@/data/types'
import type { Rng } from './rng.ts'
import type { Layout, Point, Room } from './layout.ts'
import { DIR_OFFSETS, OPPOSITE } from '../utils/directions.ts'
import { cellHash } from './autotile.ts'

/*
 * The floor as a tile grid while it's being built, and the room fillers.
 * Every filler keeps door tiles (and the tile just inside each door) plain.
 * Walking rooms (plain, rocks, maze) are checked here: every door connected,
 * no sealed-off floor. Puzzle rooms (ice, arrows, teleporters) depend on the
 * movement rules, so the whole floor is proven with the simulator afterwards
 * (src/generation/tower.ts: solvable, no traps).
 */

export const VOID = 0
export const FLOOR = 1
export const ROCK = 2
export type CellKind = typeof VOID | typeof FLOOR | typeof ROCK

export interface FloorGrid {
  width: number
  height: number
  cells: CellKind[]
  /** Ice and arrow tiles ("x,y" → effect), on floor cells */
  effects: Map<string, TileEffectData>
  /** Teleporter pairs, on floor cells */
  teleports: TeleportData[]
}

export type RoomKind = 'plain' | 'rocks' | 'maze' | 'ice' | 'arrows' | 'teleport'

export interface Door {
  /** Room tile where a bridge lands */
  at: Point
  /** Direction pointing into the room */
  inward: Direction
}

export const cellAt = (g: FloorGrid, x: number, y: number): CellKind =>
  x < 0 || y < 0 || x >= g.width || y >= g.height ? VOID : g.cells[y * g.width + x]

const setCell = (g: FloorGrid, x: number, y: number, kind: CellKind): void => {
  g.cells[y * g.width + x] = kind
}

const key = (p: Point): string => `${p.x},${p.y}`

/** Rooms and bridges as floor; everything else void */
export function carveLayout(layout: Layout): FloorGrid {
  const grid: FloorGrid = {
    width: layout.width,
    height: layout.height,
    cells: new Array(layout.width * layout.height).fill(VOID),
    effects: new Map(),
    teleports: [],
  }
  for (const room of layout.rooms) {
    for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
      for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) setCell(grid, x, y, FLOOR)
    }
  }
  for (const bridge of layout.bridges) for (const t of bridge.tiles) setCell(grid, t.x, t.y, FLOOR)
  return grid
}

export function doorsOf(layout: Layout, roomId: number): Door[] {
  const doors: Door[] = []
  for (const b of layout.bridges) {
    if (b.to === roomId) doors.push({ at: b.doorTo, inward: b.dir })
    if (b.from === roomId) doors.push({ at: b.doorFrom, inward: OPPOSITE[b.dir] })
  }
  return doors
}

/** Door tiles and the tile just inside each door: always plain floor */
export function protectedTiles(doors: readonly Door[]): Set<string> {
  const tiles = new Set<string>()
  for (const d of doors) {
    tiles.add(key(d.at))
    tiles.add(key({ x: d.at.x + DIR_OFFSETS[d.inward].x, y: d.at.y + DIR_OFFSETS[d.inward].y }))
  }
  return tiles
}

const inRoom = (room: Room, x: number, y: number): boolean =>
  x >= room.rect.x && y >= room.rect.y && x < room.rect.x + room.rect.w && y < room.rect.y + room.rect.h

/** Every floor tile of the room (and every door) reachable from the first door, walking only */
function roomIsConnected(grid: FloorGrid, room: Room, doors: readonly Door[]): boolean {
  const floor: string[] = []
  for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
      if (cellAt(grid, x, y) === FLOOR) floor.push(`${x},${y}`)
    }
  }
  if (!floor.length) return false
  const [sx, sy] = (doors.length ? key(doors[0].at) : floor[0]).split(',').map(Number)
  const start = { x: sx, y: sy }
  if (cellAt(grid, start.x, start.y) !== FLOOR) return false
  const seen = new Set([key(start)])
  const queue: Point[] = [start]
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]
    for (const off of Object.values(DIR_OFFSETS)) {
      const q = { x: p.x + off.x, y: p.y + off.y }
      if (!inRoom(room, q.x, q.y) || cellAt(grid, q.x, q.y) !== FLOOR || seen.has(key(q))) continue
      seen.add(key(q))
      queue.push(q)
    }
  }
  return floor.every(t => seen.has(t)) && doors.every(d => seen.has(key(d.at)))
}

/** Fill a room; returns the kind actually used (falls back to plain when a fill can't stay connected) */
export function fillRoom(grid: FloorGrid, layout: Layout, room: Room, kind: RoomKind, rng: Rng): RoomKind {
  const doors = doorsOf(layout, room.id)
  const prot = protectedTiles(doors)
  if (kind === 'ice') return fillIce(grid, room, prot, rng)
  if (kind === 'arrows') return fillArrows(grid, room, prot, rng)
  if (kind === 'teleport' && fillTeleport(grid, room, doors, prot, rng)) return 'teleport'
  if (kind === 'maze' && fillMaze(grid, room, doors, prot, rng)) return 'maze'
  if (kind === 'rocks' || kind === 'maze') {
    scatterRocks(grid, room, doors, prot, rng, 0.15 + rng.next() * 0.12)
    return 'rocks'
  }
  scatterRocks(grid, room, doors, prot, rng, 0, 2)
  return 'plain'
}

/**
 * Natural outlines (forest clearings, cave chambers): nibble the outer ring of a
 * walking room, corners first, never a door path, an effect or a teleporter,
 * and never cutting the room apart. Hash-driven: no random stream is consumed.
 */
export function erodeRoom(grid: FloorGrid, layout: Layout, room: Room, salt: number): void {
  const { x: rx, y: ry, w, h } = room.rect
  if (w < 5 || h < 4) return
  const doors = doorsOf(layout, room.id)
  const prot = protectedTiles(doors)
  const teleporters = new Set(grid.teleports.map(t => `${t.tileX},${t.tileY}`))
  for (let y = ry; y < ry + h; y++) {
    for (let x = rx; x < rx + w; x++) {
      const dx = Math.min(x - rx, rx + w - 1 - x), dy = Math.min(y - ry, ry + h - 1 - y)
      if (dx > 0 && dy > 0) continue // the outer ring only
      const k = `${x},${y}`
      if (prot.has(k) || grid.effects.has(k) || teleporters.has(k) || cellAt(grid, x, y) === VOID) continue
      const chance = dx === 0 && dy === 0 ? 1 : dx + dy === 1 ? 0.6 : 0.3
      if (cellHash(x, y, salt) >= chance) continue
      const was = cellAt(grid, x, y)
      setCell(grid, x, y, VOID)
      if (!roomIsConnected(grid, room, doors)) setCell(grid, x, y, was)
    }
  }
}

/** Add rocks one at a time, keeping each only if the room stays fully connected */
function scatterRocks(grid: FloorGrid, room: Room, doors: readonly Door[], prot: Set<string>, rng: Rng, density: number, maxRocks?: number): void {
  const candidates: Point[] = []
  for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
      if (cellAt(grid, x, y) === FLOOR && !prot.has(`${x},${y}`)) candidates.push({ x, y })
    }
  }
  const target = maxRocks ?? Math.floor(room.rect.w * room.rect.h * density)
  let placed = 0
  for (const p of rng.shuffle(candidates)) {
    if (placed >= target) break
    setCell(grid, p.x, p.y, ROCK)
    if (roomIsConnected(grid, room, doors)) placed++
    else setCell(grid, p.x, p.y, FLOOR)
  }
}

/** Recursive-backtracker maze over the room, doors carved through to the nearest corridor */
function fillMaze(grid: FloorGrid, room: Room, doors: readonly Door[], prot: Set<string>, rng: Rng): boolean {
  const { x: rx, y: ry, w, h } = room.rect
  if (w < 5 || h < 5) return false
  for (let y = ry; y < ry + h; y++) for (let x = rx; x < rx + w; x++) setCell(grid, x, y, ROCK)

  // Maze cells on even local coordinates; walls between them
  const cols = Math.ceil(w / 2)
  const rows = Math.ceil(h / 2)
  const visited = new Set<number>()
  const stack: [number, number][] = [[rng.int(0, cols - 1), rng.int(0, rows - 1)]]
  visited.add(stack[0][1] * cols + stack[0][0])
  setCell(grid, rx + stack[0][0] * 2, ry + stack[0][1] * 2, FLOOR)
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    const options = rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy] as const)
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cols && ny < rows && !visited.has(ny * cols + nx))
    if (!options.length) {
      stack.pop()
      continue
    }
    const [nx, ny, dx, dy] = options[0]
    visited.add(ny * cols + nx)
    setCell(grid, rx + cx * 2 + dx, ry + cy * 2 + dy, FLOOR)
    setCell(grid, rx + nx * 2, ry + ny * 2, FLOOR)
    stack.push([nx, ny])
  }

  // Doors: clear the protected tiles, then dig inward until the maze is reached
  for (const t of prot) {
    const [x, y] = t.split(',').map(Number)
    setCell(grid, x, y, FLOOR)
  }
  for (const d of doors) {
    let x = d.at.x + DIR_OFFSETS[d.inward].x
    let y = d.at.y + DIR_OFFSETS[d.inward].y
    for (let i = 0; i < Math.max(w, h); i++) {
      const nx = x + DIR_OFFSETS[d.inward].x
      const ny = y + DIR_OFFSETS[d.inward].y
      if (!inRoom(room, nx, ny)) break
      if (cellAt(grid, nx, ny) === FLOOR) break
      setCell(grid, nx, ny, FLOOR)
      x = nx
      y = ny
    }
  }
  if (roomIsConnected(grid, room, doors)) return true

  // Couldn't connect: reset to plain floor (caller falls back)
  for (let y = ry; y < ry + h; y++) for (let x = rx; x < rx + w; x++) setCell(grid, x, y, FLOOR)
  return false
}

/** Interior floor tiles of a room that a puzzle may use (not door paths) */
function puzzleTiles(grid: FloorGrid, room: Room, prot: Set<string>): Point[] {
  const tiles: Point[] = []
  for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
      if (cellAt(grid, x, y) === FLOOR && !prot.has(`${x},${y}`)) tiles.push({ x, y })
    }
  }
  return tiles
}

/** Ice rink: every interior tile slippery, a few rocks to stop on (the classic sliding puzzle) */
function fillIce(grid: FloorGrid, room: Room, prot: Set<string>, rng: Rng): RoomKind {
  const tiles = puzzleTiles(grid, room, prot)
  for (const t of tiles) grid.effects.set(key(t), { tileX: t.x, tileY: t.y, effect: 'ice' })
  const rocks = Math.floor(tiles.length * (0.08 + rng.next() * 0.08))
  for (const t of rng.shuffle(tiles).slice(0, rocks)) {
    grid.effects.delete(key(t))
    setCell(grid, t.x, t.y, ROCK)
  }
  return 'ice'
}

/** Conveyor lanes: straight runs of arrows all pointing the same way, plus a few loose arrows */
function fillArrows(grid: FloorGrid, room: Room, prot: Set<string>, rng: Rng): RoomKind {
  const free = new Set(puzzleTiles(grid, room, prot).map(key))
  const place = (x: number, y: number, direction: Direction): void => {
    if (!free.has(`${x},${y}`)) return
    grid.effects.set(`${x},${y}`, { tileX: x, tileY: y, effect: 'redirect', direction })
    free.delete(`${x},${y}`)
  }
  const { x: rx, y: ry, w, h } = room.rect
  const lanes = rng.int(2, 3)
  for (let i = 0; i < lanes; i++) {
    if (rng.chance(0.5)) {
      const y = rng.int(ry + 1, ry + h - 2)
      const direction: Direction = rng.chance(0.5) ? 'left' : 'right'
      const from = rng.int(rx, rx + Math.floor(w / 2))
      const to = Math.min(rx + w - 1, from + rng.int(2, w - 1))
      for (let x = from; x <= to; x++) place(x, y, direction)
    } else {
      const x = rng.int(rx + 1, rx + w - 2)
      const direction: Direction = rng.chance(0.5) ? 'up' : 'down'
      const from = rng.int(ry, ry + Math.floor(h / 2))
      const to = Math.min(ry + h - 1, from + rng.int(2, h - 1))
      for (let y = from; y <= to; y++) place(x, y, direction)
    }
  }
  const loose = rng.shuffle([...free]).slice(0, rng.int(1, 3))
  for (const k of loose) {
    const [x, y] = k.split(',').map(Number)
    place(x, y, rng.pick(['up', 'down', 'left', 'right'] as const))
  }
  return 'arrows'
}

/**
 * A rock wall splits the room in two with doors on both sides; a pair of
 * teleporters (each sending to the other) is the only way across.
 */
function fillTeleport(grid: FloorGrid, room: Room, doors: readonly Door[], prot: Set<string>, rng: Rng): boolean {
  const { x: rx, y: ry, w, h } = room.rect
  // Candidate walls: a full column or row of the room with doors on both sides and no door path on it
  const options: { vertical: boolean; at: number }[] = []
  for (let x = rx + 1; x < rx + w - 1; x++) {
    const sides = new Set(doors.map(d => Math.sign(d.at.x - x)))
    if (sides.has(-1) && sides.has(1) && ![...prot].some(k => Number(k.split(',')[0]) === x)) options.push({ vertical: true, at: x })
  }
  for (let y = ry + 1; y < ry + h - 1; y++) {
    const sides = new Set(doors.map(d => Math.sign(d.at.y - y)))
    if (sides.has(-1) && sides.has(1) && ![...prot].some(k => Number(k.split(',')[1]) === y)) options.push({ vertical: false, at: y })
  }
  if (!options.length) return false
  const { vertical, at } = rng.pick(options)
  const side = (p: Point): number => Math.sign((vertical ? p.x : p.y) - at)
  const length = vertical ? h : w
  for (let i = 0; i < length; i++) {
    if (vertical) setCell(grid, at, ry + i, ROCK)
    else setCell(grid, rx + i, at, ROCK)
  }

  const free = puzzleTiles(grid, room, prot)
  const before = rng.shuffle(free.filter(p => side(p) < 0))
  const after = rng.shuffle(free.filter(p => side(p) > 0))
  if (!before.length || !after.length) {
    for (let i = 0; i < length; i++) {
      if (vertical) setCell(grid, at, ry + i, FLOOR)
      else setCell(grid, rx + i, at, FLOOR)
    }
    return false
  }
  const a = before[0]
  const b = after[0]
  const idA = `tp-${room.id}-a`
  const idB = `tp-${room.id}-b`
  grid.teleports.push(
    { id: idA, tileX: a.x, tileY: a.y, role: 'sender', targetId: idB },
    { id: idB, tileX: b.x, tileY: b.y, role: 'sender', targetId: idA },
  )
  return true
}
