import type { Direction, MapData, TeleportData } from '@/data/types'
import type { TileChecker } from './TileChecker.ts'
import { DIR_OFFSETS } from '../utils/directions.ts'

/*
 * The movement decisions of the game, as pure functions. GridMovementSystem,
 * BlockManager, WarpManager and GameScene use them, and so does the tower
 * generator's simulator (src/generation/simulate.ts): one set of rules, so a
 * floor proven solvable by the generator is solvable in the game.
 * Pure: relative imports only, so it also runs in Node for QA.
 */

export type StepOutcome =
  | { kind: 'blocked' }
  | { kind: 'move'; x: number; y: number }
  /** An NPC or a block stands there: the caller tries to push it (an NPC is a failed push) */
  | { kind: 'push'; x: number; y: number }

/** What happens when the mover at (x, y) steps in `dir` (before any ice / arrow effect) */
export function stepOutcome(tiles: TileChecker, x: number, y: number, dir: Direction): StepOutcome {
  const tx = x + DIR_OFFSETS[dir].x
  const ty = y + DIR_OFFSETS[dir].y
  if (tiles.isBlockedTile(`${tx},${ty}`)) return { kind: 'push', x: tx, y: ty }
  if (tiles.getEffect(tx, ty)?.effect === 'hole' || tiles.isTileBlocked(tx, ty, dir)) return { kind: 'blocked' }
  return { kind: 'move', x: tx, y: ty }
}

export type PushOutcome =
  | { kind: 'blocked' }
  | { kind: 'move'; x: number; y: number }
  /** The block drops into a hole and fills it */
  | { kind: 'fall'; x: number; y: number }

/** What happens to a block at (x, y) pushed in `dir` (ledges stop blocks: no move direction given) */
export function pushOutcome(tiles: TileChecker, x: number, y: number, dir: Direction): PushOutcome {
  const dx = x + DIR_OFFSETS[dir].x
  const dy = y + DIR_OFFSETS[dir].y
  if (tiles.getEffect(dx, dy)?.effect === 'hole') return { kind: 'fall', x: dx, y: dy }
  if (tiles.isTileBlocked(dx, dy)) return { kind: 'blocked' }
  return { kind: 'move', x: dx, y: dy }
}

/** After landing on (x, y) having moved `lastDir`: the move ice or an arrow forces next, if any */
export function forcedMove(tiles: TileChecker, x: number, y: number, lastDir: Direction): Direction | null {
  const effect = tiles.getEffect(x, y)
  if (effect?.effect === 'ice') return lastDir
  if (effect?.effect === 'redirect' && effect.direction) return effect.direction
  return null
}

/** Wall tiles the player may walk through (portals, warps…): "x,y" keys */
export function buildPassableWalls(mapData: Pick<MapData, 'wallsLayer' | 'wallsCollision' | 'noCollision'>, mapWidth: number): Set<string> {
  const passable = new Set<string>()
  if (mapData.wallsCollision) {
    for (let i = 0; i < mapData.wallsLayer.length; i++) {
      if (mapData.wallsLayer[i] !== '' && !mapData.wallsCollision[i]) {
        passable.add(`${i % mapWidth},${Math.floor(i / mapWidth)}`)
      }
    }
  }
  for (const nc of mapData.noCollision ?? []) passable.add(`${nc.tileX},${nc.tileY}`)
  return passable
}

/** Standing (at rest) on a sender teleport at (x, y): where it sends you */
export function teleportTarget(
  teleports: readonly TeleportData[] | undefined,
  x: number,
  y: number,
): { sender: TeleportData; target: TeleportData } | undefined {
  const sender = teleports?.find(t => t.role === 'sender' && t.tileX === x && t.tileY === y)
  if (!sender?.targetId) return undefined
  const target = teleports!.find(t => t.id === sender.targetId)
  return target ? { sender, target } : undefined
}
