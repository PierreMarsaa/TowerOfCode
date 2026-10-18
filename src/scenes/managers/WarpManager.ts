import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { i18n } from '@/i18n/I18nManager'
import { actEntryMapId, actOfMap, resolveMap } from '@/data/maps/resolveMap'
import { tileToPixel } from '@/utils/helpers'
import { ensureSparkleTexture } from '@/utils/AnimationFactory'
import { mapDisplayName, resolveText } from '@/utils/i18n-helpers'
import { ACTS } from '@/generation/acts'
import { teleportTarget } from '@/systems/movementRules'
import type { GridMovementSystem } from '@/systems/GridMovementSystem'
import type { Direction, MapData } from '@/data/types'
import { SCENE } from '@/utils/constants'
import { showLocationPopup } from '@/ui/kit/LocationPopup'

export class WarpManager {
  private scene: Phaser.Scene
  private gridMovement: GridMovementSystem
  private mapData: MapData
  private player: Player
  private sparkleEmitter: Phaser.GameObjects.Particles.ParticleEmitter
  isTransitioning = false
  private lastTeleportId: string | null = null
  private toastStairKey: string | null = null // the warp whose message is showing (once per step onto it)
  /** Called after the player is teleported within the map (e.g. to move the companion) */
  onTeleport?: () => void
  /** Whether a game chapter's hub gate is open (set by the scene, which knows the defeats) */
  isActOpen: (act: number) => boolean = () => true

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

      const target = teleportTarget(this.mapData.teleports, playerTile.x, playerTile.y)?.target
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

    // A hub gate leads to its chapter's first floor, once the previous chapter's boss is beaten
    if (stair.act && !this.isActOpen(stair.act)) {
      const boss = ACTS[stair.act - 2]?.boss.name ?? ''
      this.toastOnce(stair.tileX, stair.tileY, i18n.t('gate_locked', { boss, n: stair.act - 1 }))
      return
    }
    const target = stair.act ? actEntryMapId(stair.act) : stair.targetMapId
    if (target === null) {
      this.toastOnce(stair.tileX, stair.tileY, i18n.t('stairs_coming_soon'))
      return
    }

    // Generated maps say which way a stair goes; hand-made ones infer it from its position
    const fromDirection = stair.direction ?? (stair.tileY < this.mapData.playerStart.tileY ? 'up' : 'down')

    this.isTransitioning = true
    this.gridMovement.freeze()
    this.sparkleEmitter.emitParticleAt(this.player.sprite.x, this.player.sprite.y)
    const targetMap = resolveMap(target)
    const act = stair.act ? ACTS[stair.act - 1] : undefined
    this.scene.scene.launch(SCENE.TRANSITION, {
      mapId: target,
      // Entering a chapter shows its title card
      mapName: act ? i18n.t('act_name', { n: stair.act!, title: resolveText(act.title) }) : targetMap ? mapDisplayName(targetMap) : target,
      fromDirection,
      fromMapId: this.mapData.id,
    })
  }

  /** A message under the player, once per step onto that warp (not every frame) */
  private toastOnce(tileX: number, tileY: number, message: string): void {
    const key = `${tileX},${tileY}`
    if (this.toastStairKey === key) return
    this.toastStairKey = key
    this.showToast(message)
  }

  private showToast(message: string): void {
    showLocationPopup(this.scene, message)
  }

  /**
   * Where the player appears on a map: coming back from a chapter → in front of
   * its hub gate; through a door or stairs → next to the way back to where we came
   * from (its `arrival` if set); otherwise the map's start
   */
  static resolveSpawn(
    mapData: MapData,
    _fromDirection?: 'up' | 'down',
    fromMapId?: string,
  ): { tileX: number; tileY: number; facing: Direction } {
    const act = fromMapId ? actOfMap(fromMapId) : null
    const gate = act !== null ? mapData.stairs.find(s => s.act === act) : undefined
    if (gate) return gate.arrival ?? { tileX: gate.tileX, tileY: gate.tileY + 1, facing: 'down' }
    if (fromMapId) {
      const stair = mapData.stairs.find(s => s.targetMapId === fromMapId)
      if (stair) {
        return stair.arrival ?? { tileX: stair.tileX, tileY: stair.tileY + 1, facing: 'down' }
      }
    }
    return mapData.playerStart
  }
}
