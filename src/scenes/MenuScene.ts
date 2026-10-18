import Phaser from 'phaser'
import { PIXEL } from '@/config/game.config'
import { i18n } from '@/i18n/I18nManager'
import { saveManager, START_MAP } from '@/systems/SaveManager'
import { SCENE } from '@/utils/constants'
import { LOGO, TITLE, preloadStoryArt, registerUi } from '@/ui/kit/assets'
import { drawBox, uiText } from '@/ui/kit/text'
import { measure } from '@/ui/kit/font'
import { PadInput } from '@/ui/kit/input'
import { Menu, askYesNo } from '@/ui/kit/Menu'
import { TextBox } from '@/ui/kit/TextBox'
import { fadeIn, fadeOut } from '@/ui/kit/fade'
import { openOptions } from '@/ui/kit/OptionsPanel'
import { applyTextSpeed } from '@/ui/kit/settings'
import { createDirectionalAnimations } from '@/utils/AnimationFactory'
import type { GameSceneData } from '@/scenes/GameScene'
import { OPENING_SPAWN } from '@/story/places'
import { hash } from '@/utils/hash'
import { CODEMON } from '@/data/codemon'

const P = PIXEL
const MENU_Y = 72 * P

/** Play time as h:mm */
export function formatPlayTime(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * The title screen (the scene key stays MENU: the editor's test mode stubs it):
 * the Tower of Code under the stars, PRESS START, then CONTINUE / NEW GAME / OPTIONS.
 */
export class MenuScene extends Phaser.Scene {
  private pad!: PadInput
  private busy = false
  private press?: Phaser.GameObjects.BitmapText

  constructor() {
    super({ key: SCENE.MENU })
  }

  preload(): void {
    preloadStoryArt(this)
  }

  create(): void {
    registerUi(this)
    const data = saveManager.getData()
    i18n.setLanguage(data.language)
    applyTextSpeed(data.textSpeed)
    this.pad = new PadInput(this)
    this.busy = false
    this.drawTitle()
    void fadeIn(this, 0x000000, 60)

    // PRESS START (or A, or a tap)
    const start = (): void => {
      if (this.busy) return
      this.busy = true
      off()
      void this.mainMenu()
    }
    const off = this.pad.on(b => { if (b === 'start' || b === 'a') start() })
    this.input.once('pointerup', start)
  }

  private drawTitle(): void {
    const { width } = this.scale
    if (this.textures.exists(TITLE)) this.add.image(0, 0, TITLE).setOrigin(0, 0).setScale(P)
    // A few stars twinkle
    for (let i = 0; i < 7; i++) {
      const x = (12 + (hash(i, 3) % 216)) * P
      const y = (4 + (hash(i, 5) % 100)) * P
      const star = this.add.rectangle(x, y, P, P, i % 3 === 0 ? 0x8ff4ff : 0xfafafe).setOrigin(0, 0)
      this.tweens.add({ targets: star, alpha: 0.15, duration: 700 + (hash(i, 9) % 900), yoyo: true, repeat: -1, delay: hash(i, 11) % 1200, ease: 'Sine.easeInOut' })
    }
    // The logo drops in
    if (this.textures.exists(LOGO)) {
      const logo = this.add.image(width / 2, 2 * P, LOGO).setOrigin(0.5, 0).setScale(P)
      logo.y = -logo.displayHeight
      this.tweens.add({ targets: logo, y: 2 * P, duration: 650, ease: 'Back.easeOut', delay: 150 })
    }
    // Zap, Prof Pi's Codémon, on the hill
    if (this.textures.exists('zap')) {
      createDirectionalAnimations(this, 'zap', 'title-zap')
      this.add.sprite(44 * P, 140 * P, 'zap').setOrigin(0.5, 1).setScale(P).play('title-zap-down')
    }
    const press = i18n.t('title_press_start')
    this.press = uiText(this, Math.round((width - measure(press)) / 2), 141 * P, press)
    this.tweens.add({ targets: this.press, alpha: 0, duration: 450, yoyo: true, repeat: -1, ease: 'Stepped', hold: 400 })
  }

  private async mainMenu(): Promise<void> {
    const { width, height } = this.scale
    this.press?.destroy()
    this.add.rectangle(0, 0, width, height, 0x03052e, 0.55).setOrigin(0, 0).setDepth(500)

    const story = saveManager.hasStory()
    const items = [
      ...(story ? [{ key: 'menu_continue', icon: 'continue' as const }] : []),
      { key: 'menu_new_game', icon: 'new' as const },
      { key: 'menu_options', icon: 'options' as const },
    ]
    for (;;) {
      const menu = new Menu(this, this.pad, {
        items: items.map(i => ({ label: i18n.t(i.key), icon: i.icon })),
        noCancel: true,
        alignCenter: width / 2,
        y: MENU_Y,
      })
      const choice = await menu.choose()
      const key = items[choice ?? 0].key
      if (key === 'menu_continue') {
        menu.setVisibleAll(false)
        const go = await this.confirmContinue()
        menu.destroy()
        if (go) return this.continueGame()
        continue
      }
      if (key === 'menu_new_game') {
        if (story) {
          menu.setVisibleAll(false)
          const box = new TextBox(this, this.pad, 2000)
          await box.say([i18n.t('menu_overwrite')], { holdLast: true })
          const yes = await askYesNo(this, this.pad)
          box.destroy()
          if (!yes) { menu.destroy(); continue }
        }
        menu.destroy()
        return this.newGame()
      }
      // OPTIONS
      menu.setVisibleAll(false)
      await openOptions(this, this.pad)
      menu.destroy()
      this.scene.restart() // texts in the new language
      return
    }
  }

  /** The save's summary (player, badges, Codédex, time): A to continue, B to go back */
  private async confirmContinue(): Promise<boolean> {
    const data = saveManager.getData()
    const rows: [string, string][] = [
      [i18n.t('continue_player'), data.playerName],
      [i18n.t('continue_badges'), String(data.badges.length)],
      [i18n.t('continue_codedex'), String(CODEMON.filter(m => data.seen.includes(m.id)).length)],
      [i18n.t('continue_time'), formatPlayTime(data.playTimeMs)],
    ]
    const w = 150 * P
    const h = (rows.length * 16 + 12) * P
    const box = drawBox(this, Math.round((this.scale.width - w) / 2), MENU_Y, w, h).setDepth(1200)
    rows.forEach(([label, value], i) => {
      box.add(uiText(this, 10 * P, (6 + i * 16) * P, label, 'dim'))
      box.add(uiText(this, w - 10 * P - measure(value), (6 + i * 16) * P, value, 'gold'))
    })
    const b = await this.pad.next(['a', 'start', 'b'])
    box.destroy()
    return b !== 'b'
  }

  private async continueGame(): Promise<void> {
    await fadeOut(this, 0x000000, 60)
    const data = saveManager.getData()
    const spot = data.position
    const next: GameSceneData = spot ? { mapId: spot.mapId, spawn: spot, fadeIn: true } : { mapId: data.currentMap || START_MAP, fadeIn: true }
    this.scene.start(SCENE.GAME, next)
  }

  /** A new adventure starts right in Prof Pi's lab (the opening runs on arrival) */
  private async newGame(): Promise<void> {
    await fadeOut(this, 0x000000, 60)
    saveManager.newGame()
    const next: GameSceneData = { mapId: OPENING_SPAWN.mapId, spawn: OPENING_SPAWN, fadeIn: true }
    this.scene.start(SCENE.GAME, next)
  }
}
