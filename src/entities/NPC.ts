import Phaser from 'phaser'
import type { Direction, NPCData } from '@/data/types'
import { WALK_STEP_MS } from '@/config/game.config'
import { tileToPixel } from '@/utils/helpers'
import { createDirectionalAnimations, DIR_ROW } from '@/utils/AnimationFactory'
import { showEmote } from '@/ui/kit/Emote'

export class NPC {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly data: NPCData
  readonly animPrefix: string
  facing: Direction
  private bubble?: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, npcData: NPCData) {
    this.data = npcData
    // A sheet that doesn't exist (yet) falls back to the default villager instead of breaking the map
    const spriteKey = scene.textures.exists(npcData.spriteKey) ? npcData.spriteKey : 'npc'
    // Animations depend only on the spritesheet, so key them by sprite: two NPCs
    // with the same name but different sprites must not share animations
    this.animPrefix = `npc-${spriteKey}`
    this.facing = npcData.facing

    const row = DIR_ROW[npcData.facing]
    this.sprite = scene.add.sprite(
      tileToPixel(npcData.tileX),
      tileToPixel(npcData.tileY),
      spriteKey,
      row * 4 // idle frame for this direction
    )
    this.sprite.setOrigin(0.5, 0.75)
    if (npcData.tint !== undefined) this.sprite.setTint(npcData.tint)
    createDirectionalAnimations(scene, spriteKey, this.animPrefix)
  }

  /** Script handle: its id, else its name */
  get id(): string {
    return this.data.id ?? this.data.name
  }

  /** A balloon over the head: "!" (spotted you) or "..." */
  showBubble(scene: Phaser.Scene, text: '!' | '...', _animate = true): void {
    this.hideBubble()
    this.bubble = showEmote(scene, this.sprite, text)
  }

  /** Remove the balloon */
  hideBubble(): void {
    if (!this.bubble) return
    this.bubble.destroy()
    this.bubble = undefined
  }

  /** Remove the balloon (kept async for callers that wait on it) */
  popBubble(_scene: Phaser.Scene): Promise<void> {
    this.hideBubble()
    return Promise.resolve()
  }

  faceDirection(dir: Direction): void {
    this.facing = dir
    this.sprite.play(`${this.animPrefix}-idle-${dir}`, true)
  }

  facePlayer(playerTileX: number, playerTileY: number): void {
    const dx = playerTileX - this.data.tileX
    const dy = playerTileY - this.data.tileY

    if (Math.abs(dx) > Math.abs(dy)) {
      this.faceDirection(dx > 0 ? 'right' : 'left')
    } else {
      this.faceDirection(dy > 0 ? 'down' : 'up')
    }
  }

  /** Walk to an adjacent tile (tween). Resolves when the step is done. */
  walkToTile(scene: Phaser.Scene, tileX: number, tileY: number, ms = WALK_STEP_MS): Promise<void> {
    const dx = tileX - this.data.tileX
    const dy = tileY - this.data.tileY
    let dir: Direction
    if (dx > 0) dir = 'right'
    else if (dx < 0) dir = 'left'
    else if (dy > 0) dir = 'down'
    else dir = 'up'

    this.facing = dir
    this.sprite.play(`${this.animPrefix}-${dir}`, true)

    return new Promise(resolve => {
      scene.tweens.add({
        targets: this.sprite,
        x: tileToPixel(tileX),
        y: tileToPixel(tileY),
        duration: ms,
        ease: 'Linear',
        onComplete: () => {
          this.data.tileX = tileX
          this.data.tileY = tileY
          this.faceDirection(dir) // back to idle
          resolve()
        },
      })
    })
  }

  /** Appear on a tile at once (scripts) */
  teleportTo(tileX: number, tileY: number, facing?: Direction): void {
    this.data.tileX = tileX
    this.data.tileY = tileY
    this.sprite.setPosition(tileToPixel(tileX), tileToPixel(tileY))
    this.faceDirection(facing ?? this.facing)
  }
}
