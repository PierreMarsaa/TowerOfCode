import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { NPC } from '@/entities/NPC'
import { GridMovementSystem } from '@/systems/GridMovementSystem'
import { InteractionSystem } from '@/systems/InteractionSystem'
import { NpcBehaviorSystem } from '@/systems/NpcBehaviorSystem'
import { saveManager } from '@/systems/SaveManager'
import { getMapById } from '@/data/maps/MapRegistry'
import { i18n } from '@/i18n/I18nManager'
import { MAP_WIDTH_TILES, MAP_HEIGHT_TILES, TILE_SIZE } from '@/config/game.config'
import type { MapData } from '@/data/types'
import { buildTiledMapJson } from '@/utils/buildTiledMapJson'
import { AnimatedTileSystem } from '@/systems/AnimatedTileSystem'
import { HpManager } from '@/systems/HpManager'
import { HeartHud } from '@/ui/HeartHud'
import { BlockManager } from './managers/BlockManager'
import { HeartPickupManager } from './managers/HeartPickupManager'
import { WarpManager } from './managers/WarpManager'
import { Companion } from '@/entities/Companion'
import { SCENE } from '@/utils/constants'
import { mapDisplayName } from '@/utils/i18n-helpers'
import { buildBattlePlan, isTrainer, trainerIdOf, type BattlePlan } from '@/systems/TrainerBattle'
import type { DialogSceneData } from '@/scenes/DialogScene'
import type { ChallengeResult } from '@/scenes/ChallengeScene'

export interface GameSceneData {
  mapId?: string
  fromDirection?: 'up' | 'down'
  fromMapId?: string
  /** Map built in memory (editor test mode, death restart) */
  mapData?: MapData
  /** Write progress to the save. Defaults to false when mapData is given (editor test mode) */
  persist?: boolean
  /** Trainers beaten this session when not persisting (carried across death restarts) */
  sessionDefeats?: string[]
}

export class GameScene extends Phaser.Scene {
  private player!: Player
  private npcs: NPC[] = []
  private gridMovement!: GridMovementSystem
  private interaction!: InteractionSystem
  private behaviorSystem!: NpcBehaviorSystem
  private wallLayer!: Phaser.Tilemaps.TilemapLayer
  private animatedTiles?: AnimatedTileSystem
  private blockManager!: BlockManager
  public hpManager!: HpManager
  private heartHud?: HeartHud
  private heartPickupManager!: HeartPickupManager
  private warpManager!: WarpManager
  private escKey?: Phaser.Input.Keyboard.Key
  private mapData!: MapData
  private pristineMap!: string  // JSON snapshot for clean restart
  private persist = true
  private sessionDefeats: string[] = []
  private isDead = false
  private talkingNpc?: NPC
  private companion?: Companion
  private deathOverlay?: HTMLDivElement

  // Scene-event handlers are fields so they can be removed by reference on shutdown:
  // scene.events outlives a restart, so anonymous handlers would pile up per map load.
  private readonly onChallengeClosed = (result?: ChallengeResult): void => {
    if (result?.won && result.trainerId) this.recordDefeat(result.trainerId)
    // Sync HUD when returning from challenge (HP may have changed)
    this.heartHud?.update(this.hpManager.hp)
    if (this.hpManager.isDead) {
      this.handleDeath()
    }
  }

  private readonly onNpcInteract = (npc: NPC): void => {
    this.behaviorSystem.markDetected(npc)
    npc.showBubble(this, '...', false)
    this.talkingNpc = npc
    this.handleNPCInteraction(npc)
  }

  // On resume (after dialog/challenge): flush stale keyboard state,
  // briefly block interactions, and re-check gatekeepers
  private readonly onResume = (): void => {
    this.input.keyboard!.resetKeys()
    if (this.talkingNpc) {
      this.talkingNpc.hideBubble()
      this.talkingNpc = undefined
    }
    if (this.hpManager.isDead) return
    this.interaction.setEnabled(false)
    this.time.delayedCall(300, () => this.interaction.setEnabled(true))
    this.updateGatekeepers()
  }

  // Runs on scene shutdown (map change, menu) and on game destroy (editor test mode)
  private readonly onShutdown = (): void => {
    this.events.off('challenge-closed', this.onChallengeClosed)
    this.events.off('npc-interact', this.onNpcInteract)
    this.events.off('resume', this.onResume)
    this.events.off('shutdown', this.onShutdown)
    this.events.off('destroy', this.onShutdown)
    const langBtn = document.getElementById('lang-toggle')
    if (langBtn) langBtn.style.display = ''
    this.deathOverlay?.remove()
    this.deathOverlay = undefined
    this.escKey = undefined // the keyboard plugin destroys its keys on shutdown
  }

  constructor() {
    super({ key: SCENE.GAME })
  }

  create(data?: GameSceneData): void {
    this.isDead = false
    // Editor test mode passes a map in memory: keep its progress out of the real save
    this.persist = data?.persist ?? !data?.mapData
    this.sessionDefeats = [...(data?.sessionDefeats ?? [])]

    // Resolve map: from direct data (test mode), then registry, then save, fallback
    const save = saveManager
    const mapId = data?.mapId ?? save.getData().currentMap
    const resolved = data?.mapData ?? getMapById(mapId)
    if (!resolved) console.warn(`Map "${mapId}" not found, falling back to map-01`)
    const rawMap = resolved ?? getMapById('map-01')!
    this.pristineMap = JSON.stringify(rawMap)
    const mapData: MapData = JSON.parse(this.pristineMap)
    this.mapData = mapData

    // Persist current map (skip in test mode)
    if (this.persist) save.setCurrentMap(mapData.id)

    const mapW = mapData.width ?? MAP_WIDTH_TILES
    const mapH = mapData.height ?? MAP_HEIGHT_TILES

    const map = this.buildTilemap(mapData, mapW, mapH)
    this.setupPlayer(mapData, data?.fromDirection, data?.fromMapId)
    this.setupCompanion()
    this.setupMovement(mapData, mapW)
    this.setupEntities(mapData)
    this.setupEventHandlers()
    this.setupCamera(map)
    this.showMapName(mapData)
    this.setupInputAndLifecycle()
  }

  private buildTilemap(mapData: MapData, mapW: number, mapH: number): Phaser.Tilemaps.Tilemap {
    const { json: mapJson, keyToGid } = buildTiledMapJson(mapData.groundLayer, mapData.wallsLayer, mapW, mapH)
    this.cache.tilemap.add(mapData.id, {
      data: mapJson,
      format: Phaser.Tilemaps.Formats.TILED_JSON,
    })

    const map = this.make.tilemap({ key: mapData.id })
    const tilesets: Phaser.Tilemaps.Tileset[] = []
    for (const tsData of map.tilesets) {
      const ts = map.addTilesetImage(tsData.name, tsData.name)
      if (ts) tilesets.push(ts)
    }

    const groundTileLayer = map.createLayer('Ground', tilesets, 0, 0)!
    this.wallLayer = map.createLayer('Walls', tilesets, 0, 0)!

    // Animated tiles (cycles frames for tiles with _f1/_f2/... naming)
    this.animatedTiles = new AnimatedTileSystem([groundTileLayer, this.wallLayer], keyToGid)

    return map
  }

  private setupPlayer(mapData: MapData, fromDirection?: 'up' | 'down', fromMapId?: string): void {
    const spawn = WarpManager.resolveSpawn(mapData, fromDirection, fromMapId)
    this.player = new Player(this, spawn.tileX, spawn.tileY)
    this.player.facing = spawn.facing
  }

  private setupCompanion(): void {
    const spriteKey = saveManager.getCompanion()
    if (!spriteKey) {
      this.companion = undefined
      return
    }

    const behind = Companion.behindPosition(this.player.tileX, this.player.tileY, this.player.facing)
    this.companion = new Companion(this, spriteKey, behind.x, behind.y, this.player.facing)
  }

  private setupMovement(mapData: MapData, mapW: number): void {
    this.gridMovement = new GridMovementSystem(this, this.player, this.wallLayer)

    // Companion follows player 1 tile behind
    if (this.companion) {
      this.gridMovement.onMoveComplete((fromX, fromY, _toX, _toY, _dir) => {
        this.companion?.walkToTile(this, fromX, fromY)
      })
    }

    if (mapData.tileEffects?.length) {
      this.gridMovement.setTileEffects(mapData.tileEffects)

      // Render ledge indicators
      const ledgeEffects = mapData.tileEffects.filter(e => e.effect === 'ledge')
      if (ledgeEffects.length > 0) {
        const ledgeGfx = this.add.graphics()
        ledgeGfx.setDepth(-1)
        for (const l of ledgeEffects) {
          const px = l.tileX * TILE_SIZE
          const py = l.tileY * TILE_SIZE
          ledgeGfx.fillStyle(0xddaa28, 0.2)
          ledgeGfx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        }
      }
    }

    // Non-collision wall tiles (passable overrides)
    const passableWalls = new Set<string>()
    if (mapData.wallsCollision) {
      for (let i = 0; i < mapData.wallsLayer.length; i++) {
        if (mapData.wallsLayer[i] !== '' && !mapData.wallsCollision[i]) {
          passableWalls.add(`${i % mapW},${Math.floor(i / mapW)}`)
        }
      }
    }
    if (mapData.noCollision) {
      for (const nc of mapData.noCollision) {
        passableWalls.add(`${nc.tileX},${nc.tileY}`)
      }
    }
    if (passableWalls.size > 0) this.gridMovement.setPassableWalls(passableWalls)
  }

  private setupEntities(mapData: MapData): void {
    // NPCs
    this.npcs = mapData.npcs.map(npcData => {
      const npc = new NPC(this, npcData)
      this.gridMovement.blockTile(npcData.tileX, npcData.tileY)
      return npc
    })

    // Pushable blocks
    this.blockManager = new BlockManager(this, this.gridMovement, mapData)
    this.blockManager.init()

    // HP system
    this.hpManager = new HpManager(mapData.startingHp)
    this.heartHud = new HeartHud(this, this.hpManager.maxHp, this.hpManager.isInfinite)
    this.heartHud.update(this.hpManager.hp)

    // Heart pickups
    this.heartPickupManager = new HeartPickupManager(this, this.gridMovement, this.hpManager, this.heartHud)
    this.heartPickupManager.init(mapData.hearts ?? [])

    // Warp system (stairs, teleports)
    this.warpManager = new WarpManager(this, this.gridMovement, mapData, this.player)
    this.warpManager.onTeleport = () => this.placeCompanionBehindPlayer()
  }

  /** After a teleport, put the companion right behind the player (or on the player's tile if that's blocked) */
  private placeCompanionBehindPlayer(): void {
    if (!this.companion) return
    const behind = Companion.behindPosition(this.player.tileX, this.player.tileY, this.player.facing)
    const spot = this.gridMovement.isBlocked(behind.x, behind.y)
      ? { x: this.player.tileX, y: this.player.tileY }
      : behind
    this.companion.teleportTo(this, spot.x, spot.y, this.player.facing)
  }

  private setupEventHandlers(): void {
    this.events.on('challenge-closed', this.onChallengeClosed)

    // Behavior system (detect, lookout, patrol)
    this.behaviorSystem = new NpcBehaviorSystem(this, this.npcs, this.gridMovement, this.player)

    // Interaction system
    this.interaction = new InteractionSystem(this, this.npcs, this.gridMovement, this.player)

    // Beaten trainers no longer spot the player (they stay put; talk to them for a rematch)
    for (const npc of this.npcs) {
      if (isTrainer(npc.data) && this.isDefeated(trainerIdOf(this.mapData.id, npc.data))) {
        this.behaviorSystem.markDetected(npc)
      }
    }

    // Hide gatekeepers if map is already complete
    this.updateGatekeepers()

    this.events.on('npc-interact', this.onNpcInteract)
    this.events.on('resume', this.onResume)
  }

  private setupCamera(map: Phaser.Tilemaps.Tilemap): void {
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
    this.cameras.main.startFollow(this.player.sprite, true)
    this.cameras.main.setRoundPixels(true)
  }

  private showMapName(mapData: MapData): void {
    const banner = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 40,
      mapDisplayName(mapData),
      { fontSize: '18px', color: '#ffffff', fontFamily: 'monospace', backgroundColor: '#000000aa', padding: { x: 12, y: 6 } }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100)

    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: banner,
        alpha: 0,
        duration: 500,
        onComplete: () => banner.destroy(),
      })
    })
  }

  private setupInputAndLifecycle(): void {
    // ESC to return to menu
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.escKey.on('down', () => this.scene.start(SCENE.MENU))

    // Hide language toggle during gameplay
    const langBtn = document.getElementById('lang-toggle')
    if (langBtn) langBtn.style.display = 'none'

    this.events.once('shutdown', this.onShutdown)
    this.events.once('destroy', this.onShutdown)
  }

  update(_time: number, delta: number): void {
    // Freeze everything on death
    if (this.isDead) return

    // Check warps/hearts BEFORE movement so walking through a teleport
    // tile triggers it (otherwise gridMovement.update() starts the next
    // move and the check never sees moving=false on that tile)
    if (!this.warpManager.isTransitioning && !this.gridMovement.moving) {
      this.heartPickupManager.check()
      this.warpManager.check()
    }

    if (this.gridMovement) {
      this.gridMovement.update()
    }
    if (this.interaction) {
      this.interaction.update()
    }
    if (this.behaviorSystem) {
      this.behaviorSystem.update(delta)
    }
    if (this.animatedTiles) {
      this.animatedTiles.update(delta)
    }

    // Y-sort: sprites lower on screen render on top
    this.player.sprite.setDepth(this.player.sprite.y)
    if (this.companion) {
      this.companion.sprite.setDepth(this.companion.sprite.y)
    }
    for (const npc of this.npcs) {
      npc.sprite.setDepth(npc.sprite.y)
    }
    this.blockManager.depthSort()
  }

  private updateGatekeepers(): void {
    const save = saveManager
    const allDone = this.mapData.requiredChallenges.length > 0
      && this.mapData.requiredChallenges.every(id => save.isChallengeCompleted(id))

    for (const npc of this.npcs) {
      if (npc.data.behavior !== 'gatekeeper') continue
      if (allDone && npc.sprite.visible) {
        npc.sprite.setVisible(false)
        this.gridMovement.unblockTile(npc.data.tileX, npc.data.tileY)
      }
    }
  }


  private isDefeated(trainerId: string): boolean {
    return this.persist ? saveManager.isTrainerDefeated(trainerId) : this.sessionDefeats.includes(trainerId)
  }

  private recordDefeat(trainerId: string): void {
    if (this.persist) saveManager.defeatTrainer(trainerId)
    else if (!this.sessionDefeats.includes(trainerId)) this.sessionDefeats.push(trainerId)
  }

  private handleNPCInteraction(npc: NPC): void {
    let plan: BattlePlan | undefined
    let contentError = false
    if (isTrainer(npc.data)) {
      // A fresh draw of questions on every battle
      const result = buildBattlePlan(this.mapData.id, npc.data)
      if (typeof result === 'string') {
        console.error(`[content] ${result}`)
        contentError = true // the trainer says so instead of silently becoming a plain NPC
      } else {
        plan = result
      }
    }

    const defeated = !!plan && this.isDefeated(plan.trainerId)

    // Gatekeepers use a fixed dialog key; beaten trainers say a post-defeat line
    // (then offer a rematch); trainers without lines get a generic one
    let dialogKey = npc.data.dialogKey
    if (npc.data.behavior === 'gatekeeper') dialogKey = 'gatekeeper_blocked'
    else if (contentError) dialogKey = 'trainer_content_missing'
    else if (defeated) dialogKey = 'trainer_defeated'
    else if (plan) dialogKey ??= 'trainer_battle_intro'

    const data: DialogSceneData = { dialogKey, npcName: npc.data.name, plan, defeated }
    this.scene.pause()
    this.scene.launch(SCENE.DIALOG, data)
  }


  // ── Damage & Death ──

  private handleDeath(): void {
    this.isDead = true
    this.gridMovement.freeze()
    this.interaction.setEnabled(false)
    this.behaviorSystem.freeze()

    // DOM overlay so it renders above everything (including challenge DOM elements)
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10010;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0);pointer-events:none;font-family:monospace;transition:background 0.5s;'
    document.body.appendChild(overlay)
    this.deathOverlay = overlay

    const title = document.createElement('div')
    title.style.cssText =
      'font-size:28px;color:#ff4444;opacity:0;transform:scale(0.8);transition:opacity 0.4s,transform 0.4s;'
    title.textContent = i18n.t('death_message')
    overlay.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.style.cssText =
      'font-size:14px;color:#888;margin-top:10px;opacity:0;transition:opacity 0.6s 0.3s;'
    subtitle.textContent = i18n.t('death_restart')
    overlay.appendChild(subtitle)

    // Animate in
    requestAnimationFrame(() => {
      overlay.style.background = 'rgba(0,0,0,0.75)'
      title.style.opacity = '1'
      title.style.transform = 'scale(1)'
      subtitle.style.opacity = '1'
    })

    // Restart the map with full hearts. Progress is kept ("not hurt"): completed
    // exercises and beaten trainers stay; only the trainer you lost to fights again.
    this.time.delayedCall(2000, () => {
      overlay.remove()
      this.deathOverlay = undefined
      // Use pristine snapshot so NPCs/blocks/hearts are in original positions
      const cleanMap: MapData = JSON.parse(this.pristineMap)
      const restart: GameSceneData = {
        mapId: cleanMap.id,
        mapData: cleanMap,
        persist: this.persist,
        sessionDefeats: this.sessionDefeats,
      }
      this.scene.start(SCENE.GAME, restart)
    })
  }
}
