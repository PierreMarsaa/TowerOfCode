import Phaser from 'phaser'
import { TILE_SIZE, WALK_STEP_MS } from '@/config/game.config'
import { tileToPixel } from '@/utils/helpers'
import type { GridMovementSystem } from '@/systems/GridMovementSystem'
import type { Direction, MapData } from '@/data/types'
import { pushOutcome } from '@/systems/movementRules'

export class BlockManager {
  private scene: Phaser.Scene
  private gridMovement: GridMovementSystem
  private mapData: MapData
  private blockSprites: Map<string, Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image> = new Map()

  constructor(scene: Phaser.Scene, gridMovement: GridMovementSystem, mapData: MapData) {
    this.scene = scene
    this.gridMovement = gridMovement
    this.mapData = mapData
  }

  init(): void {
    this.blockSprites.clear()
    if (this.mapData.blocks?.length) {
      for (const b of this.mapData.blocks) {
        this.createBlock(b.tileX, b.tileY, b.spriteKey)
      }
    }
    this.gridMovement.setPushBlockCallback((bx, by, dir) => this.tryPush(bx, by, dir))
  }

  depthSort(): void {
    for (const sprite of this.blockSprites.values()) {
      sprite.setDepth(sprite.y)
    }
  }

  private createBlock(tileX: number, tileY: number, spriteKey?: string): void {
    const px = tileToPixel(tileX)
    const py = tileToPixel(tileY)
    let sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image
    if (spriteKey && this.scene.textures.exists(spriteKey)) {
      sprite = this.scene.add.image(px, py, spriteKey).setDepth(py)
    } else {
      sprite = this.scene.add.rectangle(px, py, 28, 28, 0x8B6914)
        .setStrokeStyle(2, 0x5a4510)
        .setDepth(py)
    }
    this.blockSprites.set(`${tileX},${tileY}`, sprite)
    this.gridMovement.blockTile(tileX, tileY)
  }

  tryPush(blockX: number, blockY: number, dir: Direction): boolean {
    const blockKey = `${blockX},${blockY}`
    const sprite = this.blockSprites.get(blockKey)
    if (!sprite) return false

    const outcome = pushOutcome(this.gridMovement.tiles, blockX, blockY, dir)
    if (outcome.kind === 'blocked') return false
    const destX = outcome.x
    const destY = outcome.y
    const destEffect = outcome.kind === 'fall'

    this.gridMovement.unblockTile(blockX, blockY)
    this.blockSprites.delete(blockKey)

    const duration = WALK_STEP_MS

    if (destEffect) {
      const destPx = tileToPixel(destX)
      const destPy = tileToPixel(destY)
      this.scene.tweens.add({
        targets: sprite,
        x: destPx,
        y: destPy,
        duration,
        ease: 'Linear',
        onComplete: () => {
          this.scene.tweens.add({
            targets: sprite,
            scaleX: 0.3,
            scaleY: 0.3,
            y: destPy + TILE_SIZE * 0.25,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
              sprite.destroy()
              this.gridMovement.removeTileEffect(destX, destY)
              if (this.mapData.tileEffects) {
                const idx = this.mapData.tileEffects.findIndex(
                  e => e.tileX === destX && e.tileY === destY && e.effect === 'hole'
                )
                if (idx >= 0) this.mapData.tileEffects.splice(idx, 1)
              }
            },
          })
        },
      })
    } else {
      const destKey = `${destX},${destY}`
      this.blockSprites.set(destKey, sprite)
      this.gridMovement.blockTile(destX, destY)

      this.scene.tweens.add({
        targets: sprite,
        x: tileToPixel(destX),
        y: tileToPixel(destY),
        duration,
        ease: 'Linear',
      })
    }

    return true
  }
}
