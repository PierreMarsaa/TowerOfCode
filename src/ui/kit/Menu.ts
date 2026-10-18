import type Phaser from 'phaser'
import { PIXEL } from '@/config/game.config'
import { ICONS, type IconName } from '@/ui/kit/assets'
import { drawBox, nineSlice, setInk, uiText } from '@/ui/kit/text'
import { measure } from '@/ui/kit/font'
import { TEXT_BOX } from '@/ui/kit/TextBox'
import type { PadInput } from '@/ui/kit/input'
import { popWidget, pushWidget, type Widget, type WidgetState } from '@/ui/kit/registry'
import { sanitize } from '@/ui/kit/glyphs'
import { i18n } from '@/i18n/I18nManager'

const P = PIXEL
const ROW_H = 16 * P
const ICON_ROW_H = 18 * P
/** Inside the window: space above the first row and below the last */
const PAD_Y = 6 * P
/** Highlight bar inset from the window's sides */
const INSET = 5 * P
const CURSOR_X = INSET + 3 * P
const CONTENT_X = CURSOR_X + 7 * P
const ICON_W = 20 * P

export interface MenuItem {
  label: string
  icon?: IconName
  /** Shown in dim ink; picking it still returns its index */
  dim?: boolean
}

export interface MenuOptions {
  /** Top-left corner in canvas pixels (see alignRight / alignBottom) */
  x?: number
  y?: number
  /** Put the right edge here instead of using x */
  alignRight?: number
  /** Centre the menu on this x instead of using x */
  alignCenter?: number
  /** Put the bottom edge here instead of using y */
  alignBottom?: number
  items: readonly (string | MenuItem)[]
  /** Width in canvas pixels (default: fits the longest item) */
  width?: number
  /** Rows shown at once; longer lists scroll */
  visibleRows?: number
  start?: number
  /** What B returns: an item index, or null (default) */
  cancel?: number | null
  /** B does nothing (a choice is required) */
  noCancel?: boolean
  depth?: number
}

interface Row {
  label: Phaser.GameObjects.BitmapText
  icon: Phaser.GameObjects.Image | null
}

/**
 * A menu window: rows of text (with icons when given), the selected one on a
 * highlight bar in gold ink with a ▶ cursor; the cursor wraps around and long lists
 * scroll. A (or START) picks, B cancels. The pointer works too: hovering a row
 * moves the cursor, clicking picks it.
 */
export class Menu implements Widget {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  private readonly objects: Phaser.GameObjects.GameObject[] = []
  private readonly rows: Row[] = []
  private readonly bar: Phaser.GameObjects.Container
  private readonly cursor: Phaser.GameObjects.BitmapText
  private readonly moreUp: Phaser.GameObjects.BitmapText
  private readonly moreDown: Phaser.GameObjects.BitmapText
  private readonly items: MenuItem[]
  private readonly rowH: number
  private readonly visible: number
  private index: number
  private top = 0
  private resolve?: (choice: number | null) => void
  private offInput?: () => void
  private destroyed = false
  private readonly input: PadInput
  private readonly opts: MenuOptions

  constructor(scene: Phaser.Scene, input: PadInput, opts: MenuOptions) {
    this.input = input
    this.opts = opts
    this.items = opts.items.map(i => (typeof i === 'string' ? { label: sanitize(i) } : { ...i, label: sanitize(i.label) }))
    const hasIcons = this.items.some(i => i.icon)
    this.rowH = hasIcons ? ICON_ROW_H : ROW_H
    this.visible = Math.max(1, Math.min(opts.visibleRows ?? this.items.length, this.items.length))
    const textX = CONTENT_X + (hasIcons ? ICON_W : 0)
    const longest = Math.max(0, ...this.items.map(i => measure(i.label)))
    this.width = opts.width ?? textX + longest + INSET + 3 * P
    this.height = 2 * PAD_Y + this.visible * this.rowH
    this.x = opts.alignRight !== undefined ? opts.alignRight - this.width
      : opts.alignCenter !== undefined ? Math.round(opts.alignCenter - this.width / 2)
      : opts.x ?? 0
    this.y = opts.alignBottom !== undefined ? opts.alignBottom - this.height : opts.y ?? 0
    const depth = opts.depth ?? 1100
    const fixed = <T extends Phaser.GameObjects.GameObject>(o: T, d: number): T => {
      (o as unknown as { setScrollFactor(n: number): void; setDepth(n: number): void }).setScrollFactor(0)
      ;(o as unknown as { setDepth(n: number): void }).setDepth(depth + d)
      this.objects.push(o)
      return o
    }

    fixed(drawBox(scene, this.x, this.y, this.width, this.height), 0)
    this.bar = fixed(nineSlice(scene, 'bar', this.x + INSET, this.y + PAD_Y, this.width - 2 * INSET, this.rowH), 1)
    for (let k = 0; k < this.visible; k++) {
      const rowY = this.y + PAD_Y + k * this.rowH
      const textY = rowY + (this.rowH - ROW_H) / 2
      const icon = hasIcons ? fixed(scene.add.image(this.x + CONTENT_X, rowY + (this.rowH - 16 * P) / 2, ICONS, 'dex').setOrigin(0, 0).setScale(P), 2) : null
      const label = fixed(uiText(scene, this.x + textX, textY, ''), 2)
      this.rows.push({ label, icon })
      const zone = fixed(scene.add.zone(this.x, rowY, this.width, this.rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true }), 4)
      zone.on('pointerover', () => this.moveTo(this.top + k))
      zone.on('pointerup', () => { this.moveTo(this.top + k); this.finish(this.top + k) })
    }
    this.cursor = fixed(uiText(scene, this.x + CURSOR_X, 0, '▶', 'gold'), 3)
    this.moreUp = fixed(uiText(scene, this.x + this.width - 11 * P, this.y - 2 * P, '▲', 'gold'), 3)
    this.moreDown = fixed(uiText(scene, this.x + this.width - 11 * P, this.y + this.height - 12 * P, '▼', 'gold'), 3)
    this.index = Math.min(Math.max(opts.start ?? 0, 0), this.items.length - 1)
    this.moveTo(this.index)
    pushWidget(this)
    scene.events.once('shutdown', () => this.destroy())
  }

  /** Wait for a pick: the item's index, or the cancel value when B is pressed */
  choose(): Promise<number | null> {
    return new Promise(resolve => {
      this.resolve = resolve
      this.offInput = this.input.on(b => {
        const n = this.items.length
        if (b === 'up') this.moveTo((this.index + n - 1) % n)
        else if (b === 'down') this.moveTo((this.index + 1) % n)
        else if (b === 'a' || b === 'start') this.finish(this.index)
        else if (b === 'b' && !this.opts.noCancel) this.finish(this.opts.cancel ?? null)
      })
    })
  }

  get selected(): number {
    return this.index
  }

  /** Hide the menu while a sub-screen is open (it keeps its cursor) */
  setVisibleAll(visible: boolean): void {
    for (const o of this.objects) (o as unknown as { setVisible(v: boolean): void }).setVisible(visible)
    if (visible) this.render()
  }

  state(): WidgetState {
    return { kind: 'menu', items: this.items.map(i => i.label), cursor: this.index }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.offInput?.()
    this.objects.forEach(o => o.destroy())
    popWidget(this)
    this.resolve?.(null)
    this.resolve = undefined
  }

  private moveTo(i: number): void {
    if (this.destroyed) return
    this.index = i
    if (i < this.top) this.top = i
    if (i >= this.top + this.visible) this.top = i - this.visible + 1
    this.render()
  }

  private render(): void {
    this.rows.forEach((row, k) => {
      const item = this.items[this.top + k]
      const selected = this.top + k === this.index
      row.label.setText(item?.label ?? '')
      setInk(row.label, selected ? 'gold' : item?.dim ? 'dim' : 'light')
      if (row.icon) {
        row.icon.setVisible(!!item?.icon && this.bar.visible)
        if (item?.icon) row.icon.setFrame(item.icon)
      }
    })
    const k = this.index - this.top
    const rowY = this.y + PAD_Y + k * this.rowH
    this.bar.setY(rowY)
    this.cursor.setY(rowY + (this.rowH - ROW_H) / 2)
    this.moreUp.setVisible(this.top > 0)
    this.moreDown.setVisible(this.top + this.visible < this.items.length)
  }

  private finish(choice: number | null): void {
    if (!this.resolve) return
    const resolve = this.resolve
    this.resolve = undefined
    this.offInput?.()
    this.offInput = undefined
    resolve(choice)
  }
}

/** A choice window at the right, just above the text box */
export async function askChoice(
  scene: Phaser.Scene,
  input: PadInput,
  items: readonly (string | MenuItem)[],
  opts: { cancel?: number | null; start?: number; noCancel?: boolean } = {},
): Promise<number | null> {
  const { width, height } = scene.scale
  const menu = new Menu(scene, input, {
    alignRight: width - TEXT_BOX.margin,
    alignBottom: height - TEXT_BOX.margin - TEXT_BOX.height - 3 * P,
    items,
    cancel: opts.cancel ?? null,
    noCancel: opts.noCancel,
    start: opts.start,
    depth: 1100,
  })
  const choice = await menu.choose()
  menu.destroy()
  return choice
}

/** OUI / NON; B answers NON */
export async function askYesNo(scene: Phaser.Scene, input: PadInput): Promise<boolean> {
  const choice = await askChoice(scene, input, [i18n.t('yes').toUpperCase(), i18n.t('no').toUpperCase()], { cancel: 1 })
  return choice === 0
}
