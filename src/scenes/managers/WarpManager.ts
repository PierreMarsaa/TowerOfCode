import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { i18n } from '@/i18n/I18nManager'
import { getMapById } from '@/data/maps/MapRegistry'
import { tileToPixel } from '@/utils/helpers'
import { ensureSparkleTexture } from '@/utils/AnimationFactory'
import { mapDisplayName } from '@/utils/i18n-helpers'
import type { GridMovementSystem } from '@/systems/GridMovementSystem'
import type { Direction, MapData } from '@/data/types'
import { SCENE } from '@/utils/constants'

export class WarpManager {
  private scene: Phaser.Scene
  private gridMovement: GridMovementSystem
  private mapData: MapData
  private player: Player
  private sparkleEmitter: Phaser.GameObjects.Particles.ParticleEmitter
  isTransitioning = false
  private lastTeleportId: string | null = null
  private toastStairKey: string | null = null // "coming soon" warp the player is standing on
  /** Called after the player is teleported within the map (e.g. to move the companion) */
  onTeleport?: () => void

  constructor(
    scene: Phaser.Scene,
    gridMovement: GridMovementSystem,
    mapData: MapData,
    player: Player,
  ) {
    this.scene = scene
    this.gridMovement = gridMovement
    this.mapData = mapData
    this.player = player

    ensureSparkleTexture(scene)

    this.sparkleEmitter = scene.add.particles(0, 0, 'sparkle', {
      speed: { min: 30, max: 80 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      tint: [0xaa66ff, 0xcc88ff, 0xeeddff],
      emitting: false,
      quantity: 12,
    })
    this.sparkleEmitter.setDepth(9999)
  }

  check(): void {
    const playerTile = this.gridMovement.getPlayerTile()

    // Intra-map teleport (senders only)
    const teleport = this.mapData.teleports?.find(
      t => t.role === 'sender' && t.tileX === playerTile.x && t.tileY === playerTile.y
    )
    if (teleport) {
      if (this.lastTeleportId === teleport.id) return

      const target = teleport.targetId
        ? this.mapData.teleports?.find(t => t.id === teleport.targetId)
        : undefined
      if (target) {
        this.isTransitioning = true
        this.gridMovement.freeze()
        // Sparkle burst at departure
        this.sparkleEmitter.emitParticleAt(this.player.sprite.x, this.player.sprite.y)
        this.player.sprite.x = tileToPixel(target.tileX)
        this.player.sprite.y = tileToPixel(target.tileY)
        // Sparkle burst at arrival
        this.sparkleEmitter.emitParticleAt(this.player.sprite.x, this.player.sprite.y)
        this.lastTeleportId = target.id
        this.isTransitioning = false
        this.gridMovement.unfreeze()
        this.onTeleport?.()
      }
      return
    }

    // Clear step-off guard when player leaves any teleport tile
    if (this.lastTeleportId) {
      const stillOnTeleport = this.mapData.teleports?.some(
        t => t.tileX === playerTile.x && t.tileY === playerTile.y
      )
      if (!stillOnTeleport) this.lastTeleportId = null
    }

    // Map warp
    const stair = this.mapData.stairs.find(
      s => s.tileX === playerTile.x && s.tileY === playerTile.y
    )
    if (!stair) {
      this.toastStairKey = null
      return
    }

    if (stair.targetMapId === null) {
      // Show "coming soon" once per step onto the warp, not every frame/second
      const key = `${stair.tileX},${stair.tileY}`
      if (this.toastStairKey === key) return
      this.toastStairKey = key
      this.showToast(i18n.t('stairs_coming_soon'))
      return
    }

    const fromDirection = stair.tileY < this.mapData.playerStart.tileY ? 'up' : 'down'

    this.isTransitioning = true
    this.gridMovement.freeze()
    this.sparkleEmitter.emitParticleAt(this.player.sprite.x, this.player.sprite.y)
    const targetMap = getMapById(stair.targetMapId)
    this.scene.scene.launch(SCENE.TRANSITION, {
      mapId: stair.targetMapId,
      mapName: targetMap ? mapDisplayName(targetMap) : stair.targetMapId,
      fromDirection,
      fromMapId: this.mapData.id,
    })
  }

  private showToast(message: string): void {
    const toast = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.height - 40,
      message,
      {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 6 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200)

    this.scene.time.delayedCall(2000, () => {
      this.scene.tweens.add({
        targets: toast,
        alpha: 0,
        duration: 500,
        onComplete: () => toast.destroy(),
      })
    })
  }

  static resolveSpawn(
    mapData: MapData,
    fromDirection?: 'up' | 'down',
    fromMapId?: string,
  ): { tileX: number; tileY: number; facing: Direction } {
    if (fromDirection === 'down' && fromMapId) {
      const stair = mapData.stairs.find(s => s.targetMapId === fromMapId)
      if (stair) {
        return { tileX: stair.tileX, tileY: stair.tileY + 1, facing: 'down' }
      }
    }
    return mapData.playerStart
  }
}
