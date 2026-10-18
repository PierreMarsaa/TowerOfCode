import type Phaser from 'phaser'
import { PIXEL } from '@/config/game.config'
import { drawScreenBox, nineSlice, setInk, uiText } from '@/ui/kit/text'
import { measure } from '@/ui/kit/font'
import type { PadInput } from '@/ui/kit/input'
import { applyTextSpeed } from '@/ui/kit/settings'
import { popWidget, pushWidget, type Widget, type WidgetState } from '@/ui/kit/registry'
import { saveManager } from '@/systems/SaveManager'
import { i18n } from '@/i18n/I18nManager'
import type { SaveData } from '@/data/types'

const P = PIXEL
const SPEEDS: SaveData['textSpeed'][] = ['fast', 'mid', 'slow']
const LANGS: SaveData['language'][] = ['fr', 'en']
const ROW_Y = [28 * P, 48 * P, 68 * P]
const ROW_H = 16 * P

/**
 * OPTIONS: a full-screen window where ◀ ▶ (or A) changes the value of the selected
 * line. Text speed and language are saved at once. Resolves when the player
 * leaves (B, or A on RETOUR).
 */
export function openOptions(scene: Phaser.Scene, input: PadInput, depth = 3000): Promise<void> {
  return new Promise(resolve => {
    const { width } = scene.scale
    const objects: Phaser.GameObjects.GameObject[] = []
    const add = <T extends Phaser.GameObjects.GameObject>(o: T, d = 1): T => {
      (o as unknown as { setScrollFactor(n: number): void }).setScrollFactor(0)
      ;(o as unknown as { setDepth(n: number): void }).setDepth(depth + d)
      objects.push(o)
      return o
    }
    let row = 0
    add(drawScreenBox(scene), 0)
    const title = add(uiText(scene, 12 * P, 6 * P, '', 'gold'))
    const bar = add(nineSlice(scene, 'bar', 8 * P, 0, width - 16 * P, ROW_H), 0)
    const labels = ROW_Y.map(y => add(uiText(scene, 16 * P, y, '')))
    const values = ROW_Y.slice(0, 2).map(y => add(uiText(scene, 0, y, '')))

    const render = (): void => {
      const data = saveManager.getData()
      title.setText(i18n.t('options_title'))
      labels[0].setText(i18n.t('options_text_speed'))
      labels[1].setText(i18n.t('options_language'))
      labels[2].setText(i18n.t('options_back'))
      values[0].setText(`◀ ${i18n.t(`options_speed_${data.textSpeed}`)} ▶`)
      values[1].setText(`◀ ${data.language === 'fr' ? 'FRANÇAIS' : 'ENGLISH'} ▶`)
      values.forEach((v, i) => {
        v.setX(width - 16 * P - measure(v.text))
        setInk(v, i === row ? 'gold' : 'light')
      })
      labels.forEach((l, i) => setInk(l, i === row ? 'gold' : 'light'))
      bar.setY(ROW_Y[row])
    }

    const change = (step: number): void => {
      const data = saveManager.getData()
      if (row === 0) {
        const next = SPEEDS[(SPEEDS.indexOf(data.textSpeed) + step + SPEEDS.length) % SPEEDS.length]
        saveManager.setTextSpeed(next)
        applyTextSpeed(next)
      } else if (row === 1) {
        const next = LANGS[(LANGS.indexOf(data.language) + 1) % LANGS.length]
        saveManager.setLanguage(next)
        i18n.setLanguage(next)
      }
      render()
    }

    const widget: Widget = { state: (): WidgetState => ({ kind: 'menu', items: labels.map(l => l.text), cursor: row }) }
    pushWidget(widget)
    const close = (): void => {
      off()
      objects.forEach(o => o.destroy())
      popWidget(widget)
      resolve()
    }
    const off = input.on(b => {
      if (b === 'up') row = (row + 2) % 3
      else if (b === 'down') row = (row + 1) % 3
      else if (b === 'left') return change(-1)
      else if (b === 'right') return change(1)
      else if (b === 'a' || b === 'start') {
        if (row === 2) return close()
        return change(1)
      } else if (b === 'b') return close()
      render()
    })
    render()
  })
}
