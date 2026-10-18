import Phaser from 'phaser'
import { i18n } from '@/i18n/I18nManager'
import { saveManager } from '@/systems/SaveManager'
import { SCENE } from '@/utils/constants'
import { PIXEL } from '@/config/game.config'
import { registerUi, type IconName } from '@/ui/kit/assets'
import { PadInput } from '@/ui/kit/input'
import { Menu, askYesNo } from '@/ui/kit/Menu'
import { TextBox } from '@/ui/kit/TextBox'
import { openOptions } from '@/ui/kit/OptionsPanel'
import { openCodedex, openTeam } from '@/ui/kit/CodemonScreens'

interface StartMenuData {
  returnScene?: string
}

type Item = 'codedex' | 'team' | 'save' | 'options' | 'exit'

const ICON: Record<Item, IconName> = { codedex: 'dex', team: 'team', save: 'save', options: 'options', exit: 'back' }

/**
 * The START menu at the top right, over the paused map, each line with its icon:
 * CODÉDEX, CODÉMON, SAUVER, OPTIONS, RETOUR (closes, like B).
 */
export class StartMenuScene extends Phaser.Scene {
  private pad!: PadInput
  private returnScene: string = SCENE.GAME
  private lastIndex = 0

  constructor() {
    super({ key: SCENE.START_MENU })
  }

  create(data: StartMenuData): void {
    registerUi(this)
    this.returnScene = data?.returnScene ?? SCENE.GAME
    this.pad = new PadInput(this)
    void this.run()
  }

  private items(): Item[] {
    const save = saveManager.getData()
    const items: Item[] = []
    if (saveManager.hasFlag('has_codedex')) items.push('codedex')
    if (save.team.length) items.push('team')
    items.push('save', 'options', 'exit')
    return items
  }

  private async run(): Promise<void> {
    for (;;) {
      const items = this.items()
      const menu = new Menu(this, this.pad, {
        alignRight: this.scale.width - 4 * PIXEL,
        y: 4 * PIXEL,
        items: items.map(k => ({ label: i18n.t(`start_${k}`), icon: ICON[k] })),
        start: Math.min(this.lastIndex, items.length - 1),
      })
      const choice = await menu.choose()
      this.lastIndex = choice ?? this.lastIndex
      const item = choice === null ? 'exit' : items[choice]
      if (item === 'exit') {
        menu.destroy()
        return this.close()
      }
      menu.setVisibleAll(false)
      if (item === 'save') await this.save()
      else if (item === 'options') await openOptions(this, this.pad)
      else if (item === 'codedex') await openCodedex(this, this.pad)
      else if (item === 'team') await openTeam(this, this.pad)
      menu.destroy()
    }
  }

  private async save(): Promise<void> {
    const box = new TextBox(this, this.pad)
    await box.say([i18n.t('save_ask')], { holdLast: true })
    if (await askYesNo(this, this.pad)) {
      const game = this.scene.get(this.returnScene) as unknown as { savePosition?: () => void } | null
      game?.savePosition?.()
      saveManager.save()
      await box.say([i18n.t('save_done', { player: saveManager.getData().playerName })])
    }
    box.destroy()
  }

  private close(): void {
    this.scene.stop()
    this.scene.resume(this.returnScene)
  }
}
