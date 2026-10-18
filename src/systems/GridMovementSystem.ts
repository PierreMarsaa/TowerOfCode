import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { WALK_STEP_MS } from '@/config/game.config'
import { tileToPixel, DIR_OFFSETS } from '@/utils/helpers'
import { TileChecker, type WallGrid } from '@/systems/TileChecker'
import { forcedMove, stepOutcome } from '@/systems/movementRules'
import type { Direction, TileEffectData } from '@/data/types'
import type { PadInput } from '@/ui/kit/input'

type MoveListener = (fromX: number, fromY: number, toX: number, toY: number, dir: Direction) => void

/** A quick tap on a new direction only turns the player (as on the Game Boy) */
const TURN_DELAY_MS = 90

export class GridMovementSystem {
  private player: Player
  private scene: Phaser.Scene
  private input: PadInput
  private isMoving = false
  private isFrozen = false
  readonly tiles: TileChecker
  private lastDirection: Direction = 'down'
  private isSliding = false
  /** "x,y,dir" states already visited during the current ice/arrow chain (loop guard) */
  private slideVisited = new Set<string>()
  private pushBlockCallback: ((blockTileX: number, blockTileY: number, dir: Direction) => boolean) | null = null
  private readonly moveListeners = new Set<MoveListener>()
  /** When the player turned to a new direction without moving (tap to turn) */
  private turnedAt = 0
  /** When the last step ended: changing direction mid-walk doesn't stop to turn */
  private stepEndedAt = -1000
  private bumping = false

  constructor(
    scene: Phaser.Scene,
    player: Player,
    walls: WallGrid,
    input: PadInput,
  ) {
    this.scene = scene
    this.player = player
    this.input = input
    this.tiles = new TileChecker(walls)
  }

  // Delegate tile operations to TileChecker
  blockTile(tileX: number, tileY: number): void { this.tiles.blockTile(tileX, tileY) }
  unblockTile(tileX: number, tileY: number): void { this.tiles.unblockTile(tileX, tileY) }
  setPassableWalls(tiles: Set<string>): void { this.tiles.setPassableWalls(tiles) }
  setTileEffects(effects: TileEffectData[]): void { this.tiles.setTileEffects(effects) }
  removeTileEffect(tileX: number, tileY: number): void { this.tiles.removeTileEffect(tileX, tileY) }
  isWallAt(tileX: number, tileY: number): boolean { return this.tiles.isWallAt(tileX, tileY) }
  isBlocked(tileX: number, tileY: number): boolean { return this.tiles.isTileBlocked(tileX, tileY) }
  get mapWidth(): number { return this.tiles.mapWidth }
  get mapHeight(): number { return this.tiles.mapHeight }

  setPushBlockCallback(cb: (blockTileX: number, blockTileY: number, dir: Direction) => boolean): void {
    this.pushBlockCallback = cb
  }

  /** Called after every tile the player lands on (slides included). Returns an unsubscribe. */
  onMoveComplete(cb: MoveListener): () => void {
    this.moveListeners.add(cb)
    return () => this.moveListeners.delete(cb)
  }

  get moving(): boolean {
    return this.isMoving
  }

  get sliding(): boolean {
    return this.isSliding
  }

  freeze(): void {
    this.isFrozen = true
  }

  unfreeze(): void {
    this.isFrozen = false
  }

  /** Returns a promise that resolves once any in-progress move finishes */
  waitForMove(): Promise<void> {
    if (!this.isMoving) return Promise.resolve()
    return new Promise(resolve => {
      const check = () => {
        if (!this.isMoving) resolve()
        else this.scene.time.delayedCall(16, check)
      }
      check()
    })
  }

  get frozen(): boolean {
    return this.isFrozen
  }

  update(): void {
    if (this.isMoving || this.isFrozen || this.bumping) return

    const dir = this.input.heldDir()
    if (dir === null) {
      this.player.playIdle()
      return
    }

    // Tap to turn: a new direction first turns the player; holding it walks
    const now = this.scene.time.now
    if (dir !== this.player.facing && now - this.stepEndedAt > 50) {
      this.player.facing = dir
      this.player.playIdle()
      this.turnedAt = now
      return
    }
    if (now - this.turnedAt < TURN_DELAY_MS) return

    this.slideVisited.clear() // a player-initiated move starts a fresh chain
    this.executeMove(dir)
  }

  /**
   * Cutscenes: walk the player one tile, ignoring input and collisions, without
   * tile effects or move callbacks. Resolves when the step is done.
   */
  scriptedStep(dir: Direction, ms = WALK_STEP_MS): Promise<void> {
    const off = DIR_OFFSETS[dir]
    const toX = this.player.tileX + off.x
    const toY = this.player.tileY + off.y
    this.player.facing = dir
    this.player.playWalk(dir)
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.player.sprite,
        x: tileToPixel(toX),
        y: tileToPixel(toY),
        duration: ms,
        ease: 'Linear',
        onComplete: () => {
          this.player.playIdle()
          resolve()
        },
      })
    })
  }

  private executeMove(dir: Direction): void {
    // Same decision as the generator's simulator (src/systems/movementRules.ts)
    const outcome = stepOutcome(this.tiles, this.player.tileX, this.player.tileY, dir)
    // An occupied tile is a push attempt: blocks move, NPCs don't (BlockManager decides)
    const blocked = outcome.kind === 'blocked'
      || (outcome.kind === 'push' && !(this.pushBlockCallback?.(outcome.x, outcome.y, dir) ?? false))
    if (blocked) {
      this.isSliding = false
      this.isMoving = false
      this.bump(dir)
      return
    }
    const targetTileX = outcome.x
    const targetTileY = outcome.y

    const fromX = this.player.tileX
    const fromY = this.player.tileY

    this.isMoving = true
    this.lastDirection = dir
    this.player.facing = dir
    if (!this.isSliding) this.player.playWalk(dir)
    else this.player.playIdle()

    this.scene.tweens.add({
      targets: this.player.sprite,
      x: tileToPixel(targetTileX),
      y: tileToPixel(targetTileY),
      duration: WALK_STEP_MS,
      ease: 'Linear',
      onComplete: () => {
        for (const fn of [...this.moveListeners]) fn(fromX, fromY, targetTileX, targetTileY, dir)
        this.processLandingEffect()
      },
    })
  }

  /** Walking into a wall: the player keeps stepping in place, as on the Game Boy */
  private bump(dir: Direction): void {
    this.bumping = true
    this.player.playWalk(dir)
    this.scene.time.delayedCall(WALK_STEP_MS, () => {
      this.bumping = false
      if (this.input.heldDir() !== dir) this.player.playIdle()
    })
  }

  private processLandingEffect(): void {
    if (this.isFrozen) {
      this.isSliding = false
      this.isMoving = false
      return
    }

    const nextDir = forcedMove(this.tiles, this.player.tileX, this.player.tileY, this.lastDirection)

    if (nextDir) {
      // Arrows pointing at each other would bounce the player forever: stop
      // the chain as soon as it repeats a tile + direction
      const state = `${this.player.tileX},${this.player.tileY},${nextDir}`
      if (!this.slideVisited.has(state)) {
        this.slideVisited.add(state)
        this.isSliding = true
        this.executeMove(nextDir)
        return
      }
    }

    this.isSliding = false
    this.isMoving = false
    this.stepEndedAt = this.scene.time.now
  }

  getPlayerTile(): { x: number; y: number } {
    return { x: this.player.tileX, y: this.player.tileY }
  }

  getFacingTile(): { x: number; y: number } {
    const off = DIR_OFFSETS[this.player.facing]
    return {
      x: this.player.tileX + off.x,
      y: this.player.tileY + off.y,
    }
  }
}
