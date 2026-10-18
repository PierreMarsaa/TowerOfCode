import type Phaser from 'phaser'
import { PIXEL } from '@/config/game.config'
import { drawScreenBox, nineSlice, setInk, uiText } from '@/ui/kit/text'
import { measure } from '@/ui/kit/font'
import type { PadInput } from '@/ui/kit/input'
import { askChoice } from '@/ui/kit/Menu'
import { UI_CHARS } from '@/ui/kit/glyphs'
import { popWidget, pushWidget, type Widget, type WidgetState } from '@/ui/kit/registry'
import { i18n } from '@/i18n/I18nManager'

export const NAME_MAX = 7

const P = PIXEL
const PAGES = [
  ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ-', 'ÉÈÀÇÙ\'.  '],
  ['abcdefghi', 'jklmnopqr', 'stuvwxyz-', 'éèêàâçùô '],
]
const COLS = 9
const ROWS = 5 // 4 letter rows + the controls row
const CELL_W = 18 * P
const CELL_H = 16 * P
const SLOT_W = 10 * P

/**
 * Choosing a name: AUTRE NOM and three suggestions in a choice window above the
 * text box; AUTRE NOM opens the letter grid (arrows + A, B deletes, START ends).
 * On a keyboard you can also just type the name. Resolves with the name (never empty).
 */
export async function pickName(
  scene: Phaser.Scene,
  input: PadInput,
  opts: { presets: string[]; title: string },
): Promise<string> {
  const choice = await askChoice(scene, input, [i18n.t('name_new'), ...opts.presets], { start: 1, noCancel: true })
  if (choice && choice > 0) return opts.presets[choice - 1]
  const typed = await letterGrid(scene, opts.title)
  return typed || opts.presets[0]
}

/** The full-screen letter grid */
function letterGrid(scene: Phaser.Scene, title: string): Promise<string> {
  return new Promise(resolve => {
    const { width } = scene.scale
    const depth = 4000
    const objects: Phaser.GameObjects.GameObject[] = []
    const add = <T extends Phaser.GameObjects.GameObject>(o: T, d = 1): T => {
      (o as unknown as { setScrollFactor(n: number): void }).setScrollFactor(0)
      ;(o as unknown as { setDepth(n: number): void }).setDepth(depth + d)
      objects.push(o)
      return o
    }
    add(drawScreenBox(scene), 0)
    add(uiText(scene, 12 * P, 6 * P, title, 'gold'))
    // The name: one slot per letter, underscores for the rest
    const fieldW = NAME_MAX * SLOT_W + 8 * P
    const fieldX = Math.round((width - fieldW) / 2)
    add(nineSlice(scene, 'bar', fieldX, 24 * P, fieldW, 18 * P), 0)
    const slots = Array.from({ length: NAME_MAX }, (_, i) => add(uiText(scene, fieldX + 4 * P + i * SLOT_W, 25 * P, '')))
    // The grid
    const gridX = Math.round((width - COLS * CELL_W) / 2)
    const gridY = 50 * P
    const letterBar = add(nineSlice(scene, 'bar', 0, 0, CELL_W, CELL_H), 0)
    const controlBar = add(nineSlice(scene, 'bar', 0, 0, 3 * CELL_W, CELL_H), 0)
    const letters: Phaser.GameObjects.BitmapText[][] = []
    for (let r = 0; r < 4; r++) {
      letters.push([])
      for (let c = 0; c < COLS; c++) letters[r].push(add(uiText(scene, 0, gridY + r * CELL_H, '')))
    }
    const controls = [0, 1, 2].map(() => add(uiText(scene, 0, gridY + 4 * CELL_H + 4 * P, '')))

    let page = 0
    let col = 0
    let row = 0
    let name = ''
    const known = new Set(UI_CHARS)

    const controlX = (k: number): number => gridX + k * 3 * CELL_W
    const render = (): void => {
      ;[...name.padEnd(NAME_MAX, '_')].forEach((ch, i) => {
        const text = slots[i]
        text.setText(ch)
        text.setX(fieldX + 4 * P + i * SLOT_W + Math.round((SLOT_W - measure(ch)) / 2))
        setInk(text, i < name.length ? 'light' : 'dim')
      })
      PAGES[page].forEach((line, r) => [...line].forEach((ch, c) => {
        const text = letters[r][c]
        text.setText(ch === ' ' ? '' : ch)
        text.setX(gridX + c * CELL_W + Math.round((CELL_W - measure(ch)) / 2) + P)
        setInk(text, r === row && c === col ? 'gold' : 'light')
      }))
      const labels = [page === 0 ? 'min' : 'MAJ', i18n.t('name_del'), i18n.t('name_end')]
      labels.forEach((label, k) => {
        controls[k].setText(label)
        controls[k].setX(controlX(k) + Math.round((3 * CELL_W - measure(label)) / 2))
        setInk(controls[k], row === 4 && Math.floor(col / 3) === k ? 'gold' : 'light')
      })
      letterBar.setVisible(row < 4).setPosition(gridX + col * CELL_W, gridY + row * CELL_H)
      controlBar.setVisible(row === 4).setPosition(controlX(Math.floor(col / 3)), gridY + 4 * CELL_H + 4 * P)
    }

    const type = (ch: string): void => {
      if (name.length >= NAME_MAX || !known.has(ch)) return
      name += ch
      if (name.length >= NAME_MAX) { row = 4; col = 6 } // full: jump to FIN
      render()
    }
    const erase = (): void => { name = name.slice(0, -1); render() }
    const finish = (): void => {
      cleanup()
      resolve(name.trim())
    }
    const pick = (): void => {
      if (row < 4) {
        const ch = PAGES[page][row][col]
        if (ch && ch !== ' ') type(ch)
        return
      }
      const control = Math.floor(col / 3)
      if (control === 0) { page = 1 - page; render() }
      else if (control === 1) erase()
      else finish()
    }

    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat && !e.key.startsWith('Arrow')) return
      switch (e.key) {
        case 'ArrowUp': row = (row + ROWS - 1) % ROWS; break
        case 'ArrowDown': row = (row + 1) % ROWS; break
        case 'ArrowLeft': col = (col + COLS - 1) % COLS; break
        case 'ArrowRight': col = (col + 1) % COLS; break
        case ' ': pick(); break
        case 'Enter': finish(); return
        case 'Backspace': case 'Escape': erase(); break
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && e.key.toUpperCase().length === 1) type(e.key.toUpperCase())
          else return
      }
      e.preventDefault()
      render()
    }
    window.addEventListener('keydown', onKey)

    // Tap a letter or a control
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < COLS; c++) {
        const zone = add(scene.add.zone(gridX + c * CELL_W, gridY + r * CELL_H, CELL_W, CELL_H).setOrigin(0, 0), 5)
        zone.setInteractive({ useHandCursor: true }).on('pointerup', () => { row = r; col = c; pick(); render() })
      }
    }
    for (let k = 0; k < 3; k++) {
      const zone = add(scene.add.zone(controlX(k), gridY + 4 * CELL_H + 4 * P, 3 * CELL_W, CELL_H).setOrigin(0, 0), 5)
      zone.setInteractive({ useHandCursor: true }).on('pointerup', () => { row = 4; col = k * 3; pick(); render() })
    }

    const widget: Widget = { state: (): WidgetState => ({ kind: 'name', buffer: name, page, row, col }) }
    pushWidget(widget)
    const cleanup = (): void => {
      window.removeEventListener('keydown', onKey)
      objects.forEach(o => o.destroy())
      popWidget(widget)
    }
    render()
  })
}
