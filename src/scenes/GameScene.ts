import Phaser from 'phaser'
import { Player } from '@/entities/Player'
import { NPC } from '@/entities/NPC'
import { GridMovementSystem } from '@/systems/GridMovementSystem'
import { InteractionSystem } from '@/systems/InteractionSystem'
import { NpcBehaviorSystem, STORY_SIGHT } from '@/systems/NpcBehaviorSystem'
import { MAX_HP, START_MAP, saveManager } from '@/systems/SaveManager'
import { isActOpen, resolveMap } from '@/data/maps/resolveMap'
import { parseTowerMapId } from '@/generation/tower'
import { i18n } from '@/i18n/I18nManager'
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH, TILE_SIZE, VIEW_WIDTH_TILES } from '@/config/game.config'
import type { MapData, SignData, Spot } from '@/data/types'
import { buildTiledMapJson } from '@/utils/buildTiledMapJson'
import { AnimatedTileSystem } from '@/systems/AnimatedTileSystem'
import { HpManager } from '@/systems/HpManager'
import { HeartHud } from '@/ui/HeartHud'
import { BlockManager } from './managers/BlockManager'
import { HeartPickupManager } from './managers/HeartPickupManager'
import { WarpManager } from './managers/WarpManager'
import { Companion } from '@/entities/Companion'
import { SCENE } from '@/utils/constants'
import { mapDisplayName, resolveText } from '@/utils/i18n-helpers'
import { buildBattlePlan, buildLessonPlan, isTrainer, trainerIdOf, type BattlePlan } from '@/systems/TrainerBattle'
import { getChapter } from '@/data/challenges'
import { buildPassableWalls } from '@/systems/movementRules'
import { DIRECTIONS, DIR_OFFSETS, OPPOSITE } from '@/utils/directions'
import type { DialogResult, DialogSceneData } from '@/scenes/DialogScene'
import type { ChallengeResult } from '@/scenes/ChallengeScene'
import { preloadUi, registerUi } from '@/ui/kit/assets'
import { PadInput } from '@/ui/kit/input'
import { fadeIn, fadeOut } from '@/ui/kit/fade'
import { showLocationPopup } from '@/ui/kit/LocationPopup'
import { ScriptRunner } from '@/story/ScriptRunner'
import { GameScriptHost } from '@/story/GameScriptHost'
import { SCRIPTS } from '@/story/scripts'
import { matches } from '@/story/conditions'
import { LAB_RESPAWN } from '@/story/places'

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
  /** Arrive on this tile (story warps, waking up after a blackout, CONTINUE) */
  spawn?: Spot
  /** Fade in from black on arrival */
  fadeIn?: boolean
}

/** The last place whose name was shown: the sign only pops up when the place changes */
let lastLocation: string | null = null

/**
 * The map. Two modes:
 * - story (the real game, `persist`): a following camera, story scripts and triggers,
 *   the START menu, PV kept in the save, blacking out sends you to the last Center;
 * - editor test mode (a map in memory): today's behaviour (hearts, restart on death,
 *   ESC back to the editor), nothing written to the save.
 */
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
  private gbInput!: PadInput
  private mapData!: MapData
  private pristineMap!: string  // JSON snapshot for clean restart
  private persist = true
  private sessionDefeats: string[] = []
  private isDead = false
  private talkingNpc?: NPC
  private companion?: Companion
  private deathOverlay?: HTMLDivElement
  private pendingGuardRemoval?: NPC // a broken guard steps aside once its dialog closes
  private pendingEnding?: NPC // a beaten boss says their last words (Prof Pi: the course's ending) before stepping aside
  // Story
  private story?: ScriptRunner
  private storyHost?: GameScriptHost
  private lastTriggerTile = ''
  private scriptBattle?: { blackout: boolean }
  private pendingBlackout = false
  private startPressed = false
  private leaving = false

  // Scene-event handlers are fields so they can be removed by reference on shutdown:
  // scene.events outlives a restart, so anonymous handlers would pile up per map load.
  private readonly onChallengeClosed = (result?: ChallengeResult): void => {
    if (result?.won && result.trainerId) {
      this.recordDefeat(result.trainerId)
      const npc = this.npcs.find(n => trainerIdOf(this.mapData.id, n.data) === result.trainerId)
      // The lesson can only start once this scene is back (see onResume)
      if (npc?.data.guard && (npc.data.beatenDialogKey || npc.data.lesson?.length)) this.pendingEnding = npc
      else if (npc?.data.guard) this.removeGuard(npc)
    }
    // Sync HUD when returning from challenge (HP may have changed)
    this.heartHud?.update(this.hpManager.hp)
    if (this.hpManager.isDead) {
      if (this.scriptBattle && !this.scriptBattle.blackout) {
        // A story battle you may lose (the first rival battle): no blackout
        this.hpManager.refill()
      } else if (this.persist) {
        this.pendingBlackout = true // handled once this scene runs again
      } else {
        this.handleDeath()
      }
    }
  }

  /** A sign: its text */
  private readonly onSignRead = (sign: SignData): void => {
    const data: DialogSceneData = { dialogKey: sign.textKey }
    this.scene.pause()
    this.scene.launch(SCENE.DIALOG, data)
  }

  private readonly onNpcInteract = (npc: NPC): void => {
    this.behaviorSystem.markDetected(npc)
    this.talkingNpc = npc
    this.handleNPCInteraction(npc)
  }

  // On resume (after dialog/challenge): flush stale input, briefly block
  // interactions, and re-check gatekeepers
  private readonly onResume = (): void => {
    this.input.keyboard?.resetKeys()
    this.startPressed = false
    if (this.talkingNpc) {
      this.talkingNpc.hideBubble()
      this.talkingNpc = undefined
    }
    if (this.pendingBlackout) {
      this.pendingBlackout = false
      void this.blackout()
      return
    }
    if (this.pendingEnding) {
      const npc = this.pendingEnding
      this.pendingEnding = undefined
      this.pendingGuardRemoval = npc // steps aside once the lesson closes (or right away without one)
      const plan = buildLessonPlan(this.mapData.id, npc.data)
      const dialogKey = npc.data.beatenDialogKey ?? 'tower_ending'
      if (plan || npc.data.beatenDialogKey) {
        const data: DialogSceneData = { dialogKey, npcName: npc.data.name, plan, dialogParams: this.dialogParamsFor(npc) }
        this.scene.pause()
        this.scene.launch(SCENE.DIALOG, data)
        return
      }
    }
    if (this.pendingGuardRemoval) {
      this.removeGuard(this.pendingGuardRemoval)
      this.pendingGuardRemoval = undefined
    }
    if (this.hpManager.isDead) return
    this.interaction.setEnabled(false)
    this.time.delayedCall(250, () => this.interaction.setEnabled(true))
    this.updateGatekeepers()
  }

  // Runs on scene shutdown (map change, menu) and on game destroy (editor test mode)
  private readonly onShutdown = (): void => {
    this.events.off('challenge-closed', this.onChallengeClosed)
    this.events.off('npc-interact', this.onNpcInteract)
    this.events.off('sign-read', this.onSignRead)
    this.events.off('resume', this.onResume)
    this.events.off('shutdown', this.onShutdown)
    this.events.off('destroy', this.onShutdown)
    this.story?.cancel()
    this.storyHost?.destroy()
    this.story = undefined
    this.storyHost = undefined
    this.deathOverlay?.remove()
    this.deathOverlay = undefined
  }

  constructor() {
    super({ key: SCENE.GAME })
  }

  preload(): void {
    preloadUi(this) // the editor's test mode boots without BootScene
  }

  create(data?: GameSceneData): void {
    registerUi(this)
    this.isDead = false
    this.leaving = false
    this.pendingBlackout = false
    this.pendingEnding = undefined
    this.pendingGuardRemoval = undefined
    this.scriptBattle = undefined
    this.startPressed = false
    // Editor test mode passes a map in memory: keep its progress out of the real save
    this.persist = data?.persist ?? !data?.mapData
    this.sessionDefeats = [...(data?.sessionDefeats ?? [])]
    this.gbInput = new PadInput(this)

    // Resolve map: from direct data (test mode), then registry, then save, fallback
    const save = saveManager
    const mapId = data?.mapId ?? save.getData().position?.mapId ?? save.getData().currentMap
    const resolved = data?.mapData ?? resolveMap(mapId)
    if (!resolved) console.warn(`Map "${mapId}" not found, falling back to ${START_MAP}`)
    const rawMap = resolved ?? resolveMap(START_MAP) ?? resolveMap('map-01')!
    this.pristineMap = JSON.stringify(rawMap)
    const mapData: MapData = JSON.parse(this.pristineMap)
    this.mapData = mapData
    // Beaten guards left for good, and story characters not present yet: drop them
    // before any entity exists (no invisible wall, nothing to talk to)
    mapData.npcs = mapData.npcs.filter(npc =>
      !(npc.guard && this.isDefeated(trainerIdOf(mapData.id, npc)))
      && (!this.persist || matches(npc.visibleWhen, f => save.hasFlag(f))))
    // Hub gates of chapters not open yet show a closed door (still walkable: stepping on says why)
    const width = mapData.width ?? DEFAULT_MAP_WIDTH
    for (const gate of mapData.stairs) {
      if (!gate.act || this.actOpen(gate.act)) continue
      const i = gate.tileY * width + gate.tileX
      mapData.wallsLayer[i] = mapData.wallsLayer[i].replace('_door_open', '_door_closed')
    }

    // Persist current map (skip in test mode)
    if (this.persist) save.setCurrentMap(mapData.id)

    const mapW = mapData.width ?? DEFAULT_MAP_WIDTH
    const mapH = mapData.height ?? DEFAULT_MAP_HEIGHT

    this.buildTilemap(mapData, mapW, mapH)
    this.setupPlayer(mapData, data)
    if (!this.persist) this.setupCompanion() // the story has no follower: Zap walks with Prof Pi
    this.setupMovement(mapData, mapW)
    this.setupEntities(mapData)
    this.setupEventHandlers()
    this.setupCamera(mapW, mapH)
    this.showPlaceName(mapData)
    this.setupInputAndLifecycle()
    this.setupStory(data)
  }

  /** Tiles of border drawn around story maps: enough to fill the view when you stand at an edge */
  private static readonly BORDER_RING = Math.ceil(VIEW_WIDTH_TILES / 2) + 1

  private buildTilemap(mapData: MapData, mapW: number, mapH: number): Phaser.Tilemaps.Tilemap {
    // Story maps show their border tile (trees, sea…) beyond their edges, as on the Game Boy:
    // the layers get a ring of it, and are drawn shifted back so map coordinates don't change
    const border = this.persist && !mapData.indoor && mapData.border && this.textures.exists(mapData.border) ? mapData.border : null
    const ring = border ? GameScene.BORDER_RING : 0
    const w = mapW + 2 * ring
    const h = mapH + 2 * ring
    let ground = mapData.groundLayer
    let walls = mapData.wallsLayer
    if (border) {
      ground = new Array(w * h).fill(border)
      walls = new Array(w * h).fill('')
      for (let y = 0; y < mapH; y++) {
        for (let x = 0; x < mapW; x++) {
          ground[(y + ring) * w + x + ring] = mapData.groundLayer[y * mapW + x]
          walls[(y + ring) * w + x + ring] = mapData.wallsLayer[y * mapW + x]
        }
      }
    }
    const { json: mapJson, keyToGid } = buildTiledMapJson(ground, walls, w, h)
    this.cache.tilemap.remove(mapData.id)
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

    const offset = -ring * TILE_SIZE
    const groundTileLayer = map.createLayer('Ground', tilesets, offset, offset)!
    this.wallLayer = map.createLayer('Walls', tilesets, offset, offset)!

    // Animated tiles (cycles frames for tiles with _f1/_f2/... naming)
    this.animatedTiles = new AnimatedTileSystem([groundTileLayer, this.wallLayer], keyToGid)

    return map
  }

  private setupPlayer(mapData: MapData, data?: GameSceneData): void {
    const spawn = data?.spawn && data.spawn.mapId === mapData.id
      ? data.spawn
      : WarpManager.resolveSpawn(mapData, data?.fromDirection, data?.fromMapId)
    this.player = new Player(this, spawn.tileX, spawn.tileY)
    this.player.facing = spawn.facing
    this.player.playIdle()
  }

  private setupCompanion(): void {
    const spriteKey = saveManager.getCompanion()
    if (!spriteKey || !this.textures.exists(spriteKey)) {
      this.companion = undefined
      return
    }

    const behind = Companion.behindPosition(this.player.tileX, this.player.tileY, this.player.facing)
    this.companion = new Companion(this, spriteKey, behind.x, behind.y, this.player.facing)
  }

  private setupMovement(mapData: MapData, mapW: number): void {
    // Collision reads the map data directly (same grid as the generator's simulator)
    const mapH = mapData.height ?? DEFAULT_MAP_HEIGHT
    this.gridMovement = new GridMovementSystem(this, this.player, {
      width: mapW,
      height: mapH,
      hasWall: (x, y) => mapData.wallsLayer[y * mapW + x] !== '',
    }, this.gbInput)

    // Companion follows player 1 tile behind
    if (this.companion) {
      this.gridMovement.onMoveComplete((fromX, fromY) => {
        this.companion?.walkToTile(this, fromX, fromY)
      })
    }

    if (mapData.tileEffects?.length) {
      this.gridMovement.setTileEffects(mapData.tileEffects)

      // Render ledge indicators (editor maps; story maps draw ledges as tiles)
      const ledgeEffects = mapData.tileEffects.filter(e => e.effect === 'ledge')
      if (ledgeEffects.length > 0 && !this.persist) {
        const ledgeGfx = this.add.graphics()
        ledgeGfx.setDepth(-1)
        for (const l of ledgeEffects) {
          ledgeGfx.fillStyle(0xddaa28, 0.2)
          ledgeGfx.fillRect(l.tileX * TILE_SIZE, l.tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        }
      }
    }

    // Non-collision wall tiles (passable overrides)
    const passableWalls = buildPassableWalls(mapData, mapW)
    if (passableWalls.size > 0) this.gridMovement.setPassableWalls(passableWalls)
  }

  private setupEntities(mapData: MapData): void {
    // NPCs (hidden ones wait for a script to show them: invisible, not blocking)
    this.npcs = mapData.npcs.map(npcData => {
      const npc = new NPC(this, npcData)
      if (npcData.hidden && this.persist) npc.sprite.setVisible(false)
      else this.gridMovement.blockTile(npcData.tileX, npcData.tileY)
      return npc
    })

    // Pushable blocks
    this.blockManager = new BlockManager(this, this.gridMovement, mapData)
    this.blockManager.init()

    // PV: the story keeps the lead's PV in the save; editor maps use their own hearts
    if (this.persist) {
      this.hpManager = new HpManager(MAX_HP, { current: saveManager.getHp(), damagePerHit: 2, bar: true })
      this.hpManager.onChange(() => saveManager.setHp(this.hpManager.hp))
      this.heartHud = undefined
    } else {
      this.hpManager = new HpManager(mapData.startingHp)
      this.heartHud = new HeartHud(this, this.hpManager.maxHp, this.hpManager.isInfinite)
      this.heartHud.update(this.hpManager.hp)
    }

    // Heart pickups
    this.heartPickupManager = new HeartPickupManager(this, this.gridMovement, this.hpManager, this.heartHud)
    this.heartPickupManager.init(mapData.hearts ?? [])

    // Warp system (stairs, teleports)
    this.warpManager = new WarpManager(this, this.gridMovement, mapData, this.player)
    this.warpManager.isActOpen = act => this.actOpen(act)
    this.warpManager.onTeleport = () => this.placeCompanionBehindPlayer()

    // Now that walls and NPCs are known, put the companion on a free tile behind the player
    this.placeCompanionBehindPlayer()
  }

  /**
   * After an arrival or a teleport, put the companion right behind the player, else beside or in
   * front of them (it has no collision), else on the player's tile: never on a wall, an NPC, stairs
   * or a teleporter
   */
  private placeCompanionBehindPlayer(): void {
    if (!this.companion) return
    const { tileX, tileY, facing } = this.player
    const warps = new Set([...this.mapData.stairs, ...(this.mapData.teleports ?? [])].map(t => `${t.tileX},${t.tileY}`))
    const sides = DIRECTIONS.filter(d => d !== facing && d !== OPPOSITE[facing])
    const spot = [OPPOSITE[facing], ...sides, facing]
      .map(d => ({ x: tileX + DIR_OFFSETS[d].x, y: tileY + DIR_OFFSETS[d].y }))
      .find(p => !this.gridMovement.isBlocked(p.x, p.y) && !warps.has(`${p.x},${p.y}`))
      ?? { x: tileX, y: tileY }
    this.companion.teleportTo(this, spot.x, spot.y, facing)
  }

  private setupEventHandlers(): void {
    this.events.on('challenge-closed', this.onChallengeClosed)

    // Behavior system (detect, lookout, patrol)
    this.behaviorSystem = new NpcBehaviorSystem(this, this.npcs, this.gridMovement, this.player, this.persist ? STORY_SIGHT : Infinity)

    // Interaction system
    this.interaction = new InteractionSystem(this, this.npcs, this.gridMovement, this.player, this.gbInput, this.mapData.signs ?? [])

    // Beaten trainers no longer spot the player (they stay put; talk to them for a rematch)
    for (const npc of this.npcs) {
      if (isTrainer(npc.data) && this.isDefeated(trainerIdOf(this.mapData.id, npc.data))) {
        this.behaviorSystem.markDetected(npc)
      }
    }

    // Hide gatekeepers if map is already complete
    this.updateGatekeepers()

    this.events.on('npc-interact', this.onNpcInteract)
    this.events.on('sign-read', this.onSignRead)
    this.events.on('resume', this.onResume)
  }

  /**
   * Outdoor story maps: the camera follows the player, never clamped, the map's
   * border tile (trees, sea…) all around. Insides and editor maps: clamped to the
   * map, centred when the map is smaller than the screen.
   */
  private setupCamera(mapW: number, mapH: number): void {
    const cam = this.cameras.main
    const mapPxW = mapW * TILE_SIZE
    const mapPxH = mapH * TILE_SIZE
    const offX = (cam.width / TILE_SIZE) % 2 === 0 ? -TILE_SIZE / 2 : 0
    const offY = (cam.height / TILE_SIZE) % 2 === 0 ? -TILE_SIZE / 2 : 0
    if (this.persist && !this.mapData.indoor) {
      // Never clamped; beyond the map: its border ring (buildTilemap), then black
      cam.removeBounds()
      cam.setBackgroundColor(0x000000)
      cam.startFollow(this.player.sprite, true, 1, 1, offX, offY)
    } else {
      const bw = Math.max(mapPxW, cam.width)
      const bh = Math.max(mapPxH, cam.height)
      cam.setBackgroundColor(0x000000)
      cam.setBounds((mapPxW - bw) / 2, (mapPxH - bh) / 2, bw, bh)
      cam.startFollow(this.player.sprite, true)
    }
    cam.setRoundPixels(true)
  }

  /** The place's name pops up when it changes (the town, the hall, each tower floor) */
  private showPlaceName(mapData: MapData): void {
    if (this.persist) {
      // The town and the hall have a place name; tower floors show their number and chapter
      const place = mapData.location ? i18n.t(mapData.location) : mapData.title ? mapDisplayName(mapData) : null
      if (!place || place === lastLocation) return
      lastLocation = place
      showLocationPopup(this, place)
    } else {
      // Under the editor's hearts
      showLocationPopup(this, mapDisplayName(mapData), 32)
    }
  }

  private setupInputAndLifecycle(): void {
    this.gbInput.on(b => {
      if (b === 'start') this.startPressed = true
      // Editor test mode: B / ESC goes back to the editor (its menu scene stops the test)
      if (b === 'b' && !this.persist) this.scene.start(SCENE.MENU)
    })
    this.events.once('shutdown', this.onShutdown)
    this.events.once('destroy', this.onShutdown)
  }

  /** Story mode: scripts, triggers, the arrival saved, the fade from black */
  private setupStory(data?: GameSceneData): void {
    if (!this.persist) {
      if (data?.fadeIn) void fadeIn(this)
      return
    }
    this.storyHost = new GameScriptHost({
      scene: this,
      player: this.player,
      grid: this.gridMovement,
      npcs: this.npcs,
      mapData: this.mapData,
      hp: this.hpManager,
      talk: d => this.talk(d),
      fight: (d, blackout) => this.fight(d, blackout),
      warp: spot => this.goTo(spot),
    })
    this.story = new ScriptRunner(this.storyHost, SCRIPTS)
    this.lastTriggerTile = `${this.player.tileX},${this.player.tileY}`
    saveManager.setPosition(this.here())
    // A tower floor's entrance is a checkpoint: arriving by the stairs heals your Codémon,
    // and a blackout on this floor wakes you up here (not back at the lab, floors below)
    if (data?.fromMapId && parseTowerMapId(this.mapData.id) !== null) {
      this.hpManager.refill()
      saveManager.setHp(null)
      saveManager.setLastHeal(this.here())
    }

    const enter = this.mapData.triggers?.find(t => t.on === 'enter' && matches(t.when, f => saveManager.hasFlag(f)))
    if (enter) this.story.busy = true // hold the player until the fade is done and the script starts
    void (async () => {
      if (data?.fadeIn) await fadeIn(this)
      if (enter && this.story) {
        this.story.busy = false
        await this.runScript(enter.script)
      }
    })()
  }

  /** SAUVER in the START menu: remember where you stand */
  savePosition(): void {
    saveManager.setPosition(this.here())
  }

  /** The player's tile, as a save spot */
  private here(): Spot {
    return { mapId: this.mapData.id, tileX: this.player.tileX, tileY: this.player.tileY, facing: this.player.facing }
  }

  private async runScript(id: string): Promise<void> {
    if (!this.story || this.story.busy) return
    this.player.playIdle()
    await this.story.run(id)
    if (!this.leaving && this.story) saveManager.setPosition(this.here())
  }

  /** Step triggers, once per tile the player lands on */
  private checkStepTriggers(): boolean {
    if (!this.story || !this.mapData.triggers) return false
    const { tileX: x, tileY: y } = this.player
    const key = `${x},${y}`
    if (key === this.lastTriggerTile) return false
    this.lastTriggerTile = key
    const trigger = this.mapData.triggers.find(t => t.on === 'step' && t.area
      && x >= t.area.x && x < t.area.x + (t.area.w ?? 1) && y >= t.area.y && y < t.area.y + (t.area.h ?? 1)
      && matches(t.when, f => saveManager.hasFlag(f)))
    if (!trigger) return false
    void this.runScript(trigger.script)
    return true
  }

  update(_time: number, delta: number): void {
    // Freeze everything on death
    if (this.isDead) return
    if (this.persist) saveManager.addPlayTime(delta)
    this.animatedTiles?.update(delta)
    this.depthSort()
    if (this.story?.busy || this.leaving) {
      this.startPressed = false
      return
    }

    // Check triggers/warps/hearts BEFORE movement so walking through a tile
    // triggers it (otherwise gridMovement.update() starts the next move and
    // the check never sees moving=false on that tile)
    if (!this.warpManager.isTransitioning && !this.gridMovement.moving && !this.gridMovement.frozen) {
      if (this.checkStepTriggers()) return
      this.heartPickupManager.check()
      this.warpManager.check()
      if (this.warpManager.isTransitioning) {
        this.leaving = true
        return
      }
    }

    if (this.startPressed) {
      this.startPressed = false
      if (this.persist && !this.gridMovement.moving && !this.gridMovement.frozen) {
        this.openStartMenu()
        return
      }
    }

    this.gridMovement.update()
    this.interaction.update()
    this.behaviorSystem.update(delta)
  }

  private depthSort(): void {
    // Y-sort: sprites lower on screen render on top
    this.player.sprite.setDepth(this.player.sprite.y)
    if (this.companion) this.companion.sprite.setDepth(this.companion.sprite.y)
    for (const npc of this.npcs) npc.sprite.setDepth(npc.sprite.y)
    this.blockManager.depthSort()
  }

  private openStartMenu(): void {
    if (!this.scene.get(SCENE.START_MENU)) return
    this.player.playIdle()
    saveManager.setPosition(this.here())
    this.scene.pause()
    this.scene.launch(SCENE.START_MENU, { returnScene: SCENE.GAME })
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


  /** A beaten guard leaves: sprite gone, tile freed, no longer talkable or watching */
  private removeGuard(npc: NPC): void {
    const index = this.npcs.indexOf(npc)
    if (index < 0) return
    this.npcs.splice(index, 1) // the interaction system shares this array
    this.behaviorSystem.remove(npc)
    this.gridMovement.unblockTile(npc.data.tileX, npc.data.tileY)
    npc.hideBubble()
    npc.sprite.destroy()
    if (this.talkingNpc === npc) this.talkingNpc = undefined
  }

  /** Values dialog lines can use: {map} = this map's name, {chapter} = the chapter this NPC fights or teaches */
  private dialogParamsFor(npc: NPC): Record<string, string> {
    const params: Record<string, string> = { map: mapDisplayName(this.mapData) }
    const key = npc.data.battle?.chapter ?? npc.data.lesson?.[npc.data.lesson.length - 1]
    const chapter = key ? getChapter(key) : undefined
    if (chapter) params.chapter = resolveText(chapter.title)
    return params
  }

  /** Whether a game chapter is open (its hub gate unlocked) */
  private actOpen(act: number): boolean {
    return isActOpen(act, this.persist ? saveManager.getData().defeatedTrainers : this.sessionDefeats)
  }

  private isDefeated(trainerId: string): boolean {
    return this.persist ? saveManager.isTrainerDefeated(trainerId) : this.sessionDefeats.includes(trainerId)
  }

  private recordDefeat(trainerId: string): void {
    if (this.persist) saveManager.defeatTrainer(trainerId)
    else if (!this.sessionDefeats.includes(trainerId)) this.sessionDefeats.push(trainerId)
  }

  private handleNPCInteraction(npc: NPC): void {
    // Story characters with a script: the script takes over
    if (npc.data.talkScript && this.story?.has(npc.data.talkScript)) {
      void this.runScript(npc.data.talkScript)
      return
    }

    let plan: BattlePlan | undefined
    let contentError = false
    if (isTrainer(npc.data)) {
      // A fresh draw of questions on every battle
      const result = buildBattlePlan(this.mapData.id, npc.data)
      if (typeof result === 'string') {
        console.error(`[content] ${result}`)
        contentError = true // the trainer says so instead of silently becoming a plain NPC
        if (npc.data.guard) {
          // Fail open: a broken guard must never lock the way — it counts as beaten and steps aside
          this.recordDefeat(trainerIdOf(this.mapData.id, npc.data))
          this.pendingGuardRemoval = npc
        }
      } else {
        plan = result
      }
    } else if (npc.data.lesson?.length) {
      plan = buildLessonPlan(this.mapData.id, npc.data)
    }

    const defeated = !!plan && this.isDefeated(plan.trainerId)

    // Gatekeepers use a fixed dialog key; beaten trainers say a post-defeat line
    // (then offer a rematch); trainers without lines get a generic one
    let dialogKey = npc.data.dialogKey
    if (npc.data.behavior === 'gatekeeper') dialogKey = 'gatekeeper_blocked'
    else if (contentError) dialogKey = 'trainer_content_missing'
    else if (defeated) dialogKey = 'trainer_defeated'
    else if (plan) dialogKey ??= 'trainer_battle_intro'

    const data: DialogSceneData = { dialogKey, npcName: npc.data.name, plan, defeated, dialogParams: this.dialogParamsFor(npc) }
    this.scene.pause()
    this.scene.launch(SCENE.DIALOG, data)
  }

  // ── Story helpers (used by the script host) ──

  /** Pause, run an overlay scene, resolve with what it reported once this scene runs again */
  private pauseFor(sceneKey: string, data: object): Promise<{ dialog?: DialogResult; challenge?: ChallengeResult }> {
    return new Promise(resolve => {
      const out: { dialog?: DialogResult; challenge?: ChallengeResult } = {}
      const onDialog = (r: DialogResult): void => { out.dialog = r }
      const onChallenge = (r: ChallengeResult): void => { out.challenge = r }
      const onResume = (): void => {
        this.events.off('dialog-closed', onDialog)
        this.events.off('challenge-closed', onChallenge)
        resolve(out)
      }
      this.events.on('dialog-closed', onDialog)
      this.events.on('challenge-closed', onChallenge)
      this.events.once('resume', onResume)
      this.scene.pause()
      this.scene.launch(sceneKey, data)
    })
  }

  private async talk(data: DialogSceneData): Promise<DialogResult> {
    return (await this.pauseFor(SCENE.DIALOG, data)).dialog ?? {}
  }

  private async fight(data: DialogSceneData, blackout: boolean): Promise<boolean> {
    this.scriptBattle = { blackout }
    try {
      return (await this.pauseFor(SCENE.DIALOG, data)).challenge?.won ?? false
    } finally {
      this.scriptBattle = undefined
    }
  }

  /** Leave for another map through the quick fade */
  private goTo(spot: Spot): void {
    if (this.leaving) return
    this.leaving = true
    this.gridMovement.freeze()
    this.scene.launch(SCENE.TRANSITION, { mapId: spot.mapId, spawn: spot })
  }

  // ── Damage & Death ──

  /** Story: out of PV → back to the last healer (or Prof Pi's lab), healed, progress kept */
  private async blackout(): Promise<void> {
    this.story?.cancel()
    this.gridMovement.freeze()
    this.behaviorSystem.freeze()
    this.interaction.setEnabled(false)
    this.leaving = true
    await this.talk({ dialogKey: 'blackout' })
    this.isDead = true
    await fadeOut(this)
    saveManager.setHp(null)
    const spot = saveManager.getData().lastHeal ?? LAB_RESPAWN
    this.scene.start(SCENE.GAME, { mapId: spot.mapId, spawn: spot, fadeIn: true } satisfies GameSceneData)
  }

  /** Editor maps: "You died", then the map restarts with full hearts */
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
      'font-size:clamp(28px,7vmin,64px);color:#ff4444;opacity:0;transform:scale(0.8);transition:opacity 0.4s,transform 0.4s;'
    title.textContent = i18n.t('death_message')
    overlay.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.style.cssText =
      'font-size:clamp(14px,2.6vmin,22px);color:#888;margin-top:10px;opacity:0;transition:opacity 0.6s 0.3s;'
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
