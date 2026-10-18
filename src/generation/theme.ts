import { ACTS, type WorldId } from './acts.ts'
import { ARROW_TILE, ICE_TILE, SOLID_TILE, worldTileKeys } from './skin.ts'

/*
 * Tiles shared by every world, and which world each act is drawn in (each
 * world's own tiles are listed by src/generation/skin.ts). Keys are paths under
 * src/assets/tilesets/, drawn by scripts/draw-art.mjs.
 */

export { ARROW_TILE, ICE_TILE, SOLID_TILE }
export const STAIRS_UP_TILE = 'objects/stairs/up'
export const STAIRS_DOWN_TILE = 'objects/stairs/down'
/** The way out of an act's last floor, back to the hub */
export const EXIT_TILE = 'objects/portal/warp'
/** One colour per teleporter pair */
export const TELEPORTER_TILES = ['objects/portal/teleporter_purple', 'objects/portal/teleporter_green', 'objects/portal/teleporter_gold', 'objects/portal/teleporter_red']

export function worldForAct(act: number): WorldId {
  return ACTS[act - 1]?.world ?? ACTS[0].world
}

/** Every tile key a tower floor can use (checked against the tile files by QA and in dev) */
export const TOWER_TILE_KEYS: readonly string[] = [...new Set([
  STAIRS_UP_TILE, STAIRS_DOWN_TILE, EXIT_TILE, ICE_TILE,
  ...['up', 'down', 'left', 'right'].map(ARROW_TILE),
  ...TELEPORTER_TILES,
  ...ACTS.flatMap(a => worldTileKeys(a.world)),
])]
