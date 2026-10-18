import Phaser from 'phaser'
import type { Direction, MapData, NPCData, Spot } from '@/data/types'
import type { NPC } from '@/entities/NPC'
import type { Player } from '@/entities/Player'
import type { GridMovementSystem } from '@/systems/GridMovementSystem'
import type { HpManager } from '@/systems/HpManager'
import type { DialogResult, DialogSceneData } from '@/scenes/DialogScene'
import { saveManager } from '@/systems/SaveManager'
import { i18n } from '@/i18n/I18nManager'
import { buildBattlePlan, buildLessonPlan } from '@/systems/TrainerBattle'
import { getCodemon } from '@/data/codemon'
import { PIXEL } from '@/config/game.config'
import { EGG, EGG_HATCHING } from '@/ui/kit/assets'
import { drawBox, drawPill } from '@/ui/kit/text'
import { measure } from '@/ui/kit/font'
import { codemonPortrait } from '@/ui/kit/CodemonScreens'
import { popEmote } from '@/ui/kit/Emote'
import { fadeIn, fadeOut } from '@/ui/kit/fade'
import type { ActorHandle, ScriptHost } from '@/story/ScriptRunner'
import type { Step } from '@/story/types'

const P = PIXEL

/** Names offered by the name entry */
const PLAYER_NAMES = ['LÉO', 'NOA', 'ALEX']

/** What the host needs from the map scene (GameScene builds it from its own fields) */
export interface StoryContext {
  scene: Phaser.Scene
  player: Player
  grid: GridMovementSystem
  /** The map's characters (the scene's live list) */
  npcs: NPC[]
  mapData: MapData
  hp: HpManager
  /** Pause the map, show a dialog, resume: resolves once the map runs again */
  talk(data: DialogSceneData): Promise<DialogResult>
  /** Same, for a dialog that hands over to a battle or a lesson; resolves with "won" */
  fight(data: DialogSceneData, blackout: boolean): Promise<boolean>
  warp(spot: Spot): void
}

/** The story's side of the map: what scripts can do */
export class GameScriptHost implements ScriptHost {
  private readonly ctx: StoryContext
  private picture$?: Phaser.GameObjects.Container
  private cover?: Phaser.GameObjects.Rectangle

  constructor(ctx: StoryContext) {
    this.ctx = ctx
  }

  has(flag: string): boolean { return saveManager.hasFlag(flag) }
  setFlag(flag: string): void { saveManager.setFlag(flag) }
  clearFlag(flag: string): void { saveManager.clearFlag(flag) }

  lines(key: string, params?: Record<string, string>): string[] {
    return i18n.getDialog(key, undefined, this.withNames(params)).map(l => l.text)
  }

  async say(lines: string[]): Promise<void> {
    if (lines.length) await this.ctx.talk({ lines })
  }

  async ask(lines: string[], choices: 'yesno' | string[], required = false): Promise<number | null> {
    const result = await this.ctx.talk({ lines, choices, required })
    return result.choice ?? null
  }

  actor(id: string): ActorHandle | null {
    const { scene, player, grid } = this.ctx
    if (id === 'player') {
      return {
        get tileX() { return player.tileX },
        get tileY() { return player.tileY },
        get facing() { return player.facing },
        step: (dir, ms) => grid.scriptedStep(dir, ms),
        face: dir => { player.facing = dir; player.playIdle() },
        teleport: (x, y, facing) => {
          player.sprite.setPosition(x * 32 + 16, y * 32 + 16)
          if (facing) player.facing = facing
          player.playIdle()
        },
      }
    }
    const npc = this.npc(id)
    if (!npc) {
      console.warn(`[story] no character "${id}" on ${this.ctx.mapData.id}`)
      return null
    }
    return {
      get tileX() { return npc.data.tileX },
      get tileY() { return npc.data.tileY },
      get facing() { return npc.facing },
      step: async (dir, ms) => {
        const off = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]
        const toX = npc.data.tileX + off[0]
        const toY = npc.data.tileY + off[1]
        if (npc.sprite.visible) {
          grid.unblockTile(npc.data.tileX, npc.data.tileY)
          grid.blockTile(toX, toY)
        }
        await npc.walkToTile(scene, toX, toY, ms)
      },
      face: dir => npc.faceDirection(dir),
      teleport: (x, y, facing) => {
        if (npc.sprite.visible) grid.unblockTile(npc.data.tileX, npc.data.tileY)
        npc.teleportTo(x, y, facing)
        if (npc.sprite.visible) grid.blockTile(x, y)
      },
    }
  }

  isBlocked(x: number, y: number): boolean {
    const { grid, player } = this.ctx
    return grid.isBlocked(x, y) || (player.tileX === x && player.tileY === y)
  }

  mapSize(): { width: number; height: number } {
    return { width: this.ctx.grid.mapWidth, height: this.ctx.grid.mapHeight }
  }

  show(id: string, at?: { x: number; y: number; facing?: Direction }): void {
    const npc = this.npc(id)
    if (!npc) return
    if (at) npc.teleportTo(at.x, at.y, at.facing)
    if (!npc.sprite.visible) {
      npc.sprite.setVisible(true)
      this.ctx.grid.blockTile(npc.data.tileX, npc.data.tileY)
    }
  }

  hide(id: string): void {
    const npc = this.npc(id)
    if (!npc || !npc.sprite.visible) return
    npc.sprite.setVisible(false)
    this.ctx.grid.unblockTile(npc.data.tileX, npc.data.tileY)
  }

  async emote(id: string, kind: '!' | '?' | '...'): Promise<void> {
    const sprite = id === 'player' ? this.ctx.player.sprite : this.npc(id)?.sprite
    if (sprite) await popEmote(this.ctx.scene, sprite, kind, 700)
  }

  async give(codemon: string): Promise<void> {
    const id = this.resolveCodemon(codemon)
    if (id) saveManager.giveCodemon(id)
  }

  chooseStarter(codemon: string): void {
    const id = this.resolveCodemon(codemon)
    if (!id) return
    saveManager.setStarter(id)
    saveManager.giveCodemon(id)
  }

  async askName(lines: string[]): Promise<void> {
    const result = await this.ctx.talk({ lines, askName: { presets: PLAYER_NAMES, title: i18n.t('name_title_player') } })
    if (result.name) saveManager.setPlayerName(result.name)
  }

  /**
   * The egg (Code-Life's) wobbles, cracks and bursts in a flash; the Codémon springs
   * out on a glow in its type colour with a NEW tag. It stays on screen (under the
   * text box) until a `picture: null` step.
   */
  async hatch(codemon: string): Promise<void> {
    const id = this.resolveCodemon(codemon)
    const mon = id ? getCodemon(id) : undefined
    if (!mon) return
    const { scene } = this.ctx
    const { width, height } = scene.scale
    const tween = (config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> =>
      new Promise(resolve => scene.tweens.add({ ...config, onComplete: () => resolve() }))
    this.picture$?.destroy()
    const cx = width / 2
    const cy = Math.round(height * 0.36)
    const layer = scene.add.container(0, 0).setDepth(30000).setScrollFactor(0)
    this.picture$ = layer
    const dim = scene.add.rectangle(0, 0, width, height, 0x03052e, 1).setOrigin(0, 0).setAlpha(0)
    layer.add(dim)
    await tween({ targets: dim, alpha: 0.8, duration: 250 })
    if (scene.textures.exists(EGG)) {
      const egg = scene.add.image(cx, cy + 24 * P, EGG).setAlpha(0)
      egg.setScale((64 * P) / Math.max(egg.width, egg.height))
      layer.add(egg)
      await tween({ targets: egg, alpha: 1, y: cy, duration: 350, ease: 'Cubic.easeOut' })
      for (const [angle, ms] of [[7, 240], [10, 180], [13, 130]] as const) {
        await tween({ targets: egg, angle, duration: ms, yoyo: true, ease: 'Sine.easeInOut' })
        await tween({ targets: egg, angle: -angle, duration: ms, yoyo: true, ease: 'Sine.easeInOut' })
        await this.wait(120)
      }
      if (scene.textures.exists(EGG_HATCHING)) egg.setTexture(EGG_HATCHING)
      for (let i = 0; i < 3; i++) await tween({ targets: egg, angle: i % 2 ? -15 : 15, duration: 70, yoyo: true })
      const flash = scene.add.rectangle(0, 0, width, height, 0xffffff, 1).setOrigin(0, 0).setAlpha(0)
      layer.add(flash)
      await tween({ targets: flash, alpha: 1, duration: 140 })
      egg.destroy()
      this.showHatched(layer, mon, cx, cy)
      await tween({ targets: flash, alpha: 0, duration: 380 })
      flash.destroy()
    } else {
      this.showHatched(layer, mon, cx, cy)
    }
  }

  /** The new Codémon: springs up on its glow, the glow breathes, a NEW tag pops above */
  private showHatched(layer: Phaser.GameObjects.Container, mon: NonNullable<ReturnType<typeof getCodemon>>, cx: number, cy: number): void {
    const { scene } = this.ctx
    const size = 84 * P
    const { glow, image: img, parts } = codemonPortrait(scene, mon, cx, cy, size, 30001)
    layer.add(parts)
    if (img) {
      const scale = img.scale
      img.setScale(scale * 0.2)
      scene.tweens.add({ targets: img, scale, duration: 520, ease: 'Back.easeOut' })
    }
    if (glow) {
      glow.setDisplaySize(size * 1.9, size * 1.9).setAlpha(1)
      scene.tweens.add({ targets: glow, alpha: 0.6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    const label = i18n.t('hatch_new')
    const tag = drawPill(scene, Math.round(cx - (measure(label) + 6 * P) / 2), cy - size / 2 - 10 * P, label, 0xffc94a)
    tag.setScale(0)
    layer.add(tag)
    scene.tweens.add({ targets: tag, scale: 1, duration: 300, delay: 350, ease: 'Back.easeOut' })
  }

  async heal(respawn: boolean): Promise<void> {
    const { hp, player, scene } = this.ctx
    hp.refill()
    saveManager.setHp(null)
    if (respawn) saveManager.setLastHeal({ mapId: this.ctx.mapData.id, tileX: player.tileX, tileY: player.tileY, facing: player.facing })
    // The Game Boy's healing flash
    const flash = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0xf8f8f8, 1)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(40000).setAlpha(0)
    for (let i = 0; i < 2; i++) {
      flash.setAlpha(0.8)
      await this.wait(120)
      flash.setAlpha(0)
      await this.wait(120)
    }
    flash.destroy()
  }

  async lesson(chapters: string[]): Promise<void> {
    const teacher: NPCData = { name: 'lesson', tileX: 0, tileY: 0, facing: 'down', spriteKey: 'npc', behavior: 'static', lesson: chapters }
    const plan = buildLessonPlan(this.ctx.mapData.id, teacher)
    if (plan) await this.ctx.fight({ plan }, false)
  }

  async battle(step: Extract<Step, { op: 'battle' }>): Promise<boolean> {
    const codemon = this.resolveCodemon(step.codemon) ?? undefined
    const trainer: NPCData = {
      name: step.trainer,
      tileX: 0, tileY: 0, facing: 'down', spriteKey: 'npc', behavior: 'static',
      battle: { chapter: step.chapter, questions: step.questions, code: step.code },
      codemon,
    }
    const plan = buildBattlePlan(this.ctx.mapData.id, trainer)
    if (typeof plan === 'string') {
      console.error(`[story] ${plan}`)
      return true // fail open: a content problem never blocks the story
    }
    plan.trainerName = i18n.format(step.name ?? step.trainer)
    return this.ctx.fight({ plan }, step.blackout ?? false)
  }

  picture(codemon: string | null): void {
    this.picture$?.destroy()
    this.picture$ = undefined
    const id = codemon ? this.resolveCodemon(codemon) : null
    const mon = id ? getCodemon(id) : undefined
    if (!mon) return
    const { scene } = this.ctx
    const size = 88 * P
    const x = Math.round((scene.scale.width - size) / 2)
    const box = drawBox(scene, 0, 0, size, size)
    box.add(codemonPortrait(scene, mon, size / 2, size / 2, 64 * P, 0).parts)
    this.picture$ = box.setPosition(x, 6 * P).setDepth(30000).setScrollFactor(0)
  }

  async fade(to: 'black' | 'clear'): Promise<void> {
    const { scene } = this.ctx
    if (to === 'black') {
      this.cover?.destroy()
      this.cover = await fadeOut(scene)
    } else {
      this.cover?.destroy()
      this.cover = undefined
      await fadeIn(scene)
    }
  }

  save(): void {
    const { player } = this.ctx
    saveManager.setPosition({ mapId: this.ctx.mapData.id, tileX: player.tileX, tileY: player.tileY, facing: player.facing })
  }

  warp(map: string, x: number, y: number, facing: Direction): void {
    this.ctx.warp({ mapId: map, tileX: x, tileY: y, facing })
  }

  wait(ms: number): Promise<void> {
    return new Promise(resolve => this.ctx.scene.time.delayedCall(ms, resolve))
  }

  /** Clean up what a script left on screen (map change) */
  destroy(): void {
    this.picture$?.destroy()
    this.cover?.destroy()
  }

  private npc(id: string): NPC | undefined {
    return this.ctx.npcs.find(n => n.id === id) ?? this.ctx.npcs.find(n => n.data.name === id)
  }

  /** '$starter' / a Codémon id → an existing Codémon id */
  private resolveCodemon(ref: string): string | null {
    const id = ref === '$starter' ? saveManager.getData().starter : ref
    return id && getCodemon(id) ? id : null
  }

  /** Names available to every script line: {starter} */
  private withNames(params?: Record<string, string>): Record<string, string> {
    const starter = saveManager.getData().starter
    const names: Record<string, string> = {}
    if (starter) names.starter = (getCodemon(starter)?.name ?? starter).toUpperCase()
    return { ...names, ...params }
  }
}
