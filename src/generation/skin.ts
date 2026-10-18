import type { TileEffectData } from '@/data/types'
import type { WorldId } from './acts.ts'
import { N, E, S, W, cellHash, mask4, pickWeighted, platformGround, type CliffEnd } from './autotile.ts'

/*
 * How each world draws a floor's grid. The grid is the same for every world
 * (floor, rock obstacles, void between rooms); the skin gives it its look:
 *   forest   the void is woods: a canopy with trunks along its front edge,
 *            the paths between rooms are dirt tracks
 *   caves    the void is solid rock with wall faces, the paths are tunnels
 *   citadel  rooms are platforms over lava (cliffs, bridges), halls get carpets
 * Collision is unchanged: every void cell gets a blocking tile in the walls layer
 * (visible trees and rock, or the invisible collision tile over lava).
 */

export type CellType = 'void' | 'floor' | 'rock'

export interface Rect { x: number; y: number; w: number; h: number }

export interface SkinInput {
  world: WorldId
  width: number
  height: number
  cell: (x: number, y: number) => CellType
  /** Bridge tiles and the room tiles they land on (forest: dirt tracks) */
  corridor: (x: number, y: number) => boolean
  /** Floor areas that get a carpet (citadel halls) */
  carpets: readonly Rect[]
  effects: ReadonlyMap<string, TileEffectData>
  salt: number
}

export interface Skin {
  ground: string[]
  walls: string[]
}

export const SOLID_TILE = 'objects/collision_invisible'
export const ICE_TILE = 'ground/ice/1'
export const ARROW_TILE = (dir: string): string => `ground/arrows/${dir}`
export const PATH_TILE = (mask: number): string => `ground/hub/path_${mask}`
const FLOOR_WEIGHTS = [60, 20, 13, 7]

const floorTiles = (world: WorldId): string[] => [1, 2, 3, 4].map(v => `ground/${world}/floor_${v}`)
const obstacleTiles = (world: WorldId): string[] => [`objects/${world}/obstacle`, `objects/${world}/obstacle_2`]

/** Every tile a world can use (checked against the tile files by QA and in dev) */
export function worldTileKeys(world: WorldId): string[] {
  const keys = [...floorTiles(world), ...obstacleTiles(world)]
  const masks = Array.from({ length: 16 }, (_, m) => m)
  if (world === 'forest') {
    keys.push('ground/forest/shade', ...masks.slice(0, 15).map(m => `objects/forest/tree_${m}`), ...[1, 2, 3].map(v => `objects/forest/canopy_${v}`), ...masks.map(PATH_TILE))
  } else if (world === 'caves') {
    keys.push('ground/caves/shade', ...masks.map(m => `objects/caves/wall_${m}`), ...(['mid', 'left', 'right', 'single'] as const).map(e => `objects/caves/face_${e}`))
  } else {
    keys.push(...masks.slice(0, 15).map(m => `ground/citadel/edge_${m}`), 'ground/citadel/void_f1', SOLID_TILE,
      ...(['mid', 'left', 'right', 'single'] as const).map(e => `ground/citadel/cliff_${e}_f1`), ...masks.map(m => `ground/citadel/carpet_${m}`))
  }
  return keys
}

export function skinFloor(input: SkinInput): Skin {
  const { world, width, height, salt } = input
  const at = (x: number, y: number): CellType => x < 0 || y < 0 || x >= width || y >= height ? 'void' : input.cell(x, y)
  const isVoid = (x: number, y: number): boolean => at(x, y) === 'void'
  const ground: string[] = []
  const walls: string[] = []
  const floors = floorTiles(world)
  const obstacles = obstacleTiles(world)
  const pickFloor = (x: number, y: number): string => floors[pickWeighted(cellHash(x, y, salt), FLOOR_WEIGHTS)]
  const pickObstacle = (x: number, y: number): string => obstacles[cellHash(x, y, salt + 7) < 0.7 ? 0 : 1]

  if (world === 'citadel') {
    const solid = platformGround(width, height, (x, y) => !isVoid(x, y), {
      floors, weights: FLOOR_WEIGHTS,
      edge: m => `ground/citadel/edge_${m}`,
      void: 'ground/citadel/void_f1',
      cliff: (end: CliffEnd) => `ground/citadel/cliff_${end}_f1`,
    }, salt)
    const carpet = (x: number, y: number): boolean => at(x, y) !== 'void' && input.carpets.some(r => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = at(x, y)
        ground.push(carpet(x, y) ? `ground/citadel/carpet_${mask4(carpet, x, y)}` : solid[y * width + x])
        walls.push(c === 'void' ? SOLID_TILE : c === 'rock' ? pickObstacle(x, y) : '')
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = at(x, y)
        if (c === 'void') {
          ground.push(floors[0])
          walls.push(world === 'forest' ? forestTree(isVoid, x, y, salt) : caveWall(isVoid, x, y))
          continue
        }
        walls.push(c === 'rock' ? pickObstacle(x, y) : '')
        if (world === 'forest' && input.corridor(x, y)) ground.push(PATH_TILE(mask4(input.corridor, x, y)))
        else if (isVoid(x, y - 1)) ground.push(`ground/${world}/shade`) // in the shadow of the trees / the rock face
        else ground.push(pickFloor(x, y))
      }
    }
  }

  // Ice and arrows replace the ground under them
  for (const e of input.effects.values()) {
    ground[e.tileY * width + e.tileX] = e.effect === 'ice' ? ICE_TILE : ARROW_TILE(e.direction ?? 'up')
  }
  return { ground, walls }
}

/** The woods: canopy tiles by which neighbours are trees too; dense ones vary by hash */
function forestTree(isVoid: (x: number, y: number) => boolean, x: number, y: number, salt: number): string {
  const m = mask4(isVoid, x, y)
  if (m === (N | E | S | W)) return `objects/forest/canopy_${1 + Math.floor(cellHash(x, y, salt + 3) * 3)}`
  return `objects/forest/tree_${m}`
}

/** Rock: a wall face where floor lies just below, otherwise the rock's top */
function caveWall(isVoid: (x: number, y: number) => boolean, x: number, y: number): string {
  const face = (fx: number, fy: number): boolean => isVoid(fx, fy) && !isVoid(fx, fy + 1)
  if (face(x, y)) {
    const left = face(x - 1, y), right = face(x + 1, y)
    return `objects/caves/face_${left && right ? 'mid' : left ? 'right' : right ? 'left' : 'single'}`
  }
  return `objects/caves/wall_${mask4(isVoid, x, y)}`
}
