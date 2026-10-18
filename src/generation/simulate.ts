import type { Direction, MapData } from '@/data/types'
import { TileChecker } from '../systems/TileChecker.ts'
import { buildPassableWalls, forcedMove, stepOutcome, teleportTarget } from '../systems/movementRules.ts'
import { DIRECTIONS } from '../utils/directions.ts'
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from '../config/game.config.ts'

/*
 * Plays the game's movement rules without the game: same TileChecker, same
 * rule functions (src/systems/movementRules.ts) as GridMovementSystem and
 * WarpManager. Used to prove generated floors solvable, and by the browser
 * parity test against the real game.
 * Not modelled: pushable blocks (tower floors have none; an occupied tile is a failed push).
 */

export interface Point { x: number; y: number }

export interface SimWorld {
  tiles: TileChecker
  map: MapData
}

const key = (x: number, y: number): string => `${x},${y}`

/** The map's walls, passable overrides and tile effects, with `occupied` tiles (NPCs) blocked */
export function buildSimWorld(map: MapData, occupied: readonly Point[] = []): SimWorld {
  const width = map.width ?? DEFAULT_MAP_WIDTH
  const height = map.height ?? DEFAULT_MAP_HEIGHT
  const tiles = new TileChecker({ width, height, hasWall: (x, y) => map.wallsLayer[y * width + x] !== '' })
  tiles.setPassableWalls(buildPassableWalls(map, width))
  tiles.setTileEffects(map.tileEffects ?? [])
  for (const o of occupied) tiles.blockTile(o.x, o.y)
  return { tiles, map }
}

/**
 * Where the player comes to rest after pressing `dir` at (x, y): the step, then
 * any ice / arrow chain (with the same loop guard as the game), then a teleport
 * if the chain ends on a sender. Null when the player doesn't move.
 */
export function simulateMove(world: SimWorld, x: number, y: number, dir: Direction): Point | null {
  const first = stepOutcome(world.tiles, x, y, dir)
  if (first.kind !== 'move') return null
  let cx = first.x
  let cy = first.y
  let last = dir
  const visited = new Set<string>()
  for (;;) {
    const next = forcedMove(world.tiles, cx, cy, last)
    if (!next) break
    const state = `${cx},${cy},${next}`
    if (visited.has(state)) break
    visited.add(state)
    const s = stepOutcome(world.tiles, cx, cy, next)
    if (s.kind !== 'move') break
    cx = s.x
    cy = s.y
    last = next
  }
  const tp = teleportTarget(world.map.teleports, cx, cy)
  if (tp) return { x: tp.target.tileX, y: tp.target.tileY }
  return { x: cx, y: cy }
}

/**
 * Every resting tile reachable from `start`. Tiles in `stops` (stairs: stepping
 * on one leaves the map) are reached but not walked through.
 */
export function reachableFrom(world: SimWorld, start: Point, stops: ReadonlySet<string> = new Set()): Set<string> {
  const seen = new Set([key(start.x, start.y)])
  const queue: Point[] = [start]
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]
    if (i > 0 && stops.has(key(p.x, p.y))) continue
    for (const dir of DIRECTIONS) {
      const q = simulateMove(world, p.x, p.y, dir)
      if (!q) continue
      const k = key(q.x, q.y)
      if (seen.has(k)) continue
      seen.add(k)
      queue.push(q)
    }
  }
  return seen
}
