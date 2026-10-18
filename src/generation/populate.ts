import type { Direction } from '@/data/types'
import type { Rng } from './rng.ts'
import type { Layout, Point, Room } from './layout.ts'
import { FLOOR, cellAt, doorsOf, protectedTiles, type FloorGrid } from './rooms.ts'
import { DIR_OFFSETS, DIRECTIONS, OPPOSITE } from '../utils/directions.ts'

/*
 * Who and what stands where on a floor: the stairs (down at the entrance; up
 * and a return stairs down in the stairs room), the spawn, Prof Pi, the guards
 * on the critical bridges (the guardian on the last one) and the hearts.
 * Only plain floor tiles are used, never door paths.
 */

export interface StairSpot {
  x: number
  y: number
  /** Where the player appears when arriving through this stair */
  arrival: { tileX: number; tileY: number; facing: Direction }
}

export interface GuardSpot {
  x: number
  y: number
  facing: Direction
  /** Index into the floor's fights (the last one is the guardian) */
  fight: number
}

export interface Placement {
  spawn: { tileX: number; tileY: number; facing: Direction }
  down: StairSpot
  up: StairSpot
  back: StairSpot
  prof: { x: number; y: number; facing: Direction }
  guards: GuardSpot[]
  hearts: Point[]
}

const key = (p: Point): string => `${p.x},${p.y}`
const step = (p: Point, d: Direction): Point => ({ x: p.x + DIR_OFFSETS[d].x, y: p.y + DIR_OFFSETS[d].y })

/** Free plain floor tiles of a room: not on door paths, ice, arrows or teleporters, not already taken */
function freeTiles(grid: FloorGrid, layout: Layout, room: Room, taken: Set<string>): Point[] {
  const prot = protectedTiles(doorsOf(layout, room.id))
  const teleporters = new Set(grid.teleports.map(t => `${t.tileX},${t.tileY}`))
  const tiles: Point[] = []
  for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
      const k = `${x},${y}`
      if (cellAt(grid, x, y) !== FLOOR || prot.has(k) || taken.has(k)) continue
      if (grid.effects.has(k) || teleporters.has(k)) continue
      tiles.push({ x, y })
    }
  }
  return tiles
}

/** A stair tile with a free neighbour to arrive on; marks both as taken */
function placeStair(grid: FloorGrid, layout: Layout, room: Room, taken: Set<string>, rng: Rng): StairSpot | null {
  const free = freeTiles(grid, layout, room, taken)
  const freeKeys = new Set(free.map(key))
  for (const tile of rng.shuffle(free)) {
    for (const d of rng.shuffle(DIRECTIONS)) {
      const a = step(tile, d)
      if (!freeKeys.has(key(a))) continue
      taken.add(key(tile))
      taken.add(key(a))
      return { x: tile.x, y: tile.y, arrival: { tileX: a.x, tileY: a.y, facing: d } }
    }
  }
  return null
}

export function populate(grid: FloorGrid, layout: Layout, fightCount: number, rng: Rng): Placement | null {
  const taken = new Set<string>()
  const roomById = new Map(layout.rooms.map(r => [r.id, r]))
  const entrance = roomById.get(layout.path[0])!
  const stairsRoom = roomById.get(layout.path[layout.path.length - 1])!

  const down = placeStair(grid, layout, entrance, taken, rng)
  if (!down) return null
  const spawn = down.arrival

  // Prof Pi right next to the spawn, facing the player (no room for him: try another layout)
  let prof: Placement['prof'] | undefined
  const free = new Set(freeTiles(grid, layout, entrance, taken).map(key))
  for (const d of rng.shuffle(DIRECTIONS)) {
    const p = step({ x: spawn.tileX, y: spawn.tileY }, d)
    if (!free.has(key(p))) continue
    prof = { x: p.x, y: p.y, facing: OPPOSITE[d] }
    taken.add(key(p))
    break
  }
  if (!prof) return null

  const up = placeStair(grid, layout, stairsRoom, taken, rng)
  const back = up && placeStair(grid, layout, stairsRoom, taken, rng)
  if (!up || !back) return null

  // Guards: the guardian on the bridge into the stairs room, trainers spread over the earlier bridges
  const critical = layout.path.slice(0, -1).map((id, i) =>
    layout.bridges.find(b => b.critical && b.from === id && b.to === layout.path[i + 1])!)
  if (fightCount > critical.length) return null
  const earlier = critical.length - 1
  const slots = fightCount > 1
    ? Array.from({ length: fightCount - 1 }, (_, k) => Math.floor((k * earlier) / (fightCount - 1)))
    : []
  const guards: GuardSpot[] = [...slots, critical.length - 1].map((bridgeIndex, fight) => {
    const bridge = critical[bridgeIndex]
    const tile = bridge.tiles[Math.floor((bridge.tiles.length - 1) / 2)]
    return { x: tile.x, y: tile.y, facing: OPPOSITE[bridge.dir], fight }
  })

  // A heart in each side room
  const hearts: Point[] = []
  for (const room of layout.rooms.filter(r => r.role === 'side')) {
    const spots = freeTiles(grid, layout, room, taken)
    if (!spots.length) continue
    const h = rng.pick(spots)
    taken.add(key(h))
    hearts.push(h)
  }

  return { spawn, down, up, back, prof, guards, hearts }
}
