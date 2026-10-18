import type { Direction, TileEffectData } from '@/data/types'

/** Solid tiles of the map's walls layer, before passable overrides */
export interface WallGrid {
  width: number
  height: number
  hasWall(tileX: number, tileY: number): boolean
}

/**
 * Handles tile-level collision queries: wall checks, blocked tiles,
 * passable walls, and tile effects. No scene dependency — pure data
 * (the tower generator's simulator uses it too, also in Node).
 */
export class TileChecker {
  private walls: WallGrid
  private blockedTiles = new Set<string>()
  private passableWalls = new Set<string>()
  private tileEffects = new Map<string, TileEffectData>()

  constructor(walls: WallGrid) {
    this.walls = walls
  }

  get mapWidth(): number {
    return this.walls.width
  }

  get mapHeight(): number {
    return this.walls.height
  }

  blockTile(tileX: number, tileY: number): void {
    this.blockedTiles.add(`${tileX},${tileY}`)
  }

  unblockTile(tileX: number, tileY: number): void {
    this.blockedTiles.delete(`${tileX},${tileY}`)
  }

  setPassableWalls(tiles: Set<string>): void {
    this.passableWalls = tiles
  }

  setTileEffects(effects: TileEffectData[]): void {
    this.tileEffects.clear()
    for (const e of effects) {
      this.tileEffects.set(`${e.tileX},${e.tileY}`, e)
    }
  }

  removeTileEffect(tileX: number, tileY: number): void {
    this.tileEffects.delete(`${tileX},${tileY}`)
  }

  getEffect(tileX: number, tileY: number): TileEffectData | undefined {
    return this.tileEffects.get(`${tileX},${tileY}`)
  }

  isBlockedTile(key: string): boolean {
    return this.blockedTiles.has(key)
  }

  private outOfBounds(tileX: number, tileY: number): boolean {
    return tileX < 0 || tileX >= this.walls.width || tileY < 0 || tileY >= this.walls.height
  }

  /** Check if a tile has a wall (non-empty tile on wall layer, respects passable overrides) */
  isWallAt(tileX: number, tileY: number): boolean {
    if (this.outOfBounds(tileX, tileY)) return true
    if (this.passableWalls.has(`${tileX},${tileY}`)) return false
    return this.walls.hasWall(tileX, tileY)
  }

  /** Full blocked check: wall, NPC, block, out of bounds, ledge effect */
  isTileBlocked(tileX: number, tileY: number, moveDir?: Direction): boolean {
    const effect = this.tileEffects.get(`${tileX},${tileY}`)
    if (effect?.effect === 'ledge') {
      return moveDir !== effect.direction
    }

    if (this.blockedTiles.has(`${tileX},${tileY}`)) return true
    if (this.outOfBounds(tileX, tileY)) return true
    if (this.passableWalls.has(`${tileX},${tileY}`)) return false
    return this.walls.hasWall(tileX, tileY)
  }
}
