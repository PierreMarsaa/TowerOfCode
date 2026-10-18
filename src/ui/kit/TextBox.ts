import type Phaser from 'phaser'
import { PIXEL } from '@/config/game.config'
import { drawBox, nineSlice, uiText } from '@/ui/kit/text'
import { measure, wrapText } from '@/ui/kit/font'
import { uiSettings } from '@/ui/kit/settings'
import type { PadInput } from '@/ui/kit/input'
import { popWidget, pushWidget, type Widget, type WidgetState } from '@/ui/kit/registry'

const P = PIXEL

/** The text box along the bottom of the screen (canvas pixels): 2 lines of text */
export const TEXT_BOX = { margin: 4 * P, height: 48 * P }
const PAD_X = 9 * P
const LINE_Y = [6 * P, 22 * P] as const
/** Room kept at the end of a line for the blinking cursor */
const CURSOR_ROOM = 6 * P
const TAG = { x: 6 * P, y: -10 * P, h: 13 * P, padX: 4 * P }

/** A line that starts with "NAME : " is spoken by NAME (shown in the name tag) */
export function splitSpeaker(line: string): { speaker: string | null; text: string } {
  const m = /^([A-ZÀ-ÖØ-ÞŒ0-9][A-ZÀ-ÖØ-ÞŒ0-9 .'’-]{0,15}?)\s?: (.+)$/s.exec(line)
  return m ? { speaker: m[1].trim(), text: m[2] } : { speaker: null, text: line }
}

export interface SayOptions {
  /** Resolve as soon as the last paragraph is written, without waiting for A (a prompt follows) */
  holdLast?: boolean
}

/**
 * The text box: 2 lines typed one character at a time. When a paragraph has more
 * lines, a cursor blinks and A scrolls up by one line; each paragraph starts a fresh
 * box. Pressing A while text is typing finishes the visible lines at once. The
 * speaker's name sits in a tag on the box's top edge.
 */
export class TextBox implements Widget {
  private readonly box: Phaser.GameObjects.Container
  private tag: Phaser.GameObjects.Container | null = null
  private speaker: string | null = null
  private readonly slots: [Phaser.GameObjects.BitmapText, Phaser.GameObjects.BitmapText]
  private readonly cursor: Phaser.GameObjects.BitmapText
  private cursorTween?: Phaser.Tweens.Tween
  private shown: [string, string] = ['', '']
  private waiting = false
  private rush = false // A pressed while typing: finish this page now
  private visible = true
  private destroyed = false
  private cancelWait?: () => void
  private readonly scene: Phaser.Scene
  private readonly input: PadInput
  private readonly x: number
  private readonly y: number
  private readonly depth: number
  /** Widest line, in canvas pixels */
  readonly maxWidth: number

  constructor(scene: Phaser.Scene, input: PadInput, depth = 1000) {
    this.scene = scene
    this.input = input
    this.depth = depth
    const { width, height } = scene.scale
    const w = width - 2 * TEXT_BOX.margin
    this.x = TEXT_BOX.margin
    this.y = height - TEXT_BOX.margin - TEXT_BOX.height
    this.maxWidth = w - 2 * PAD_X - CURSOR_ROOM
    this.box = drawBox(scene, this.x, this.y, w, TEXT_BOX.height).setDepth(depth).setScrollFactor(0)
    this.slots = [
      uiText(scene, this.x + PAD_X, this.y + LINE_Y[0], '').setDepth(depth + 1).setScrollFactor(0),
      uiText(scene, this.x + PAD_X, this.y + LINE_Y[1], '').setDepth(depth + 1).setScrollFactor(0),
    ]
    this.cursor = uiText(scene, 0, 0, '▌').setDepth(depth + 2).setScrollFactor(0).setVisible(false)
    pushWidget(this)
    scene.events.once('shutdown', () => this.destroy())
  }

  /** Write paragraphs one after another; resolves when the player has read the last one */
  async say(paragraphs: readonly string[], opts: SayOptions = {}): Promise<void> {
    for (let k = 0; k < paragraphs.length && !this.destroyed; k++) {
      const { speaker, text } = splitSpeaker(paragraphs[k])
      this.setSpeaker(speaker)
      const lines = wrapText(text, this.maxWidth)
      this.setShown('', '')
      this.rush = false
      await this.type(0, lines[0] ?? '')
      if (lines.length > 1) await this.type(1, lines[1])
      for (let i = 2; i < lines.length && !this.destroyed; i++) {
        await this.waitForA()
        this.setShown(this.shown[1], '')
        this.rush = false
        await this.type(1, lines[i])
      }
      const last = k === paragraphs.length - 1
      if (!(last && opts.holdLast)) await this.waitForA()
    }
  }

  clear(): void {
    this.setShown('', '')
    this.setSpeaker(null)
  }

  setVisible(visible: boolean): this {
    this.visible = visible
    this.box.setVisible(visible)
    this.tag?.setVisible(visible)
    this.slots.forEach(s => s.setVisible(visible))
    if (!visible) this.cursor.setVisible(false)
    return this
  }

  state(): WidgetState {
    return { kind: 'text', text: this.shown.filter(Boolean).join('\n'), speaker: this.speaker, waiting: this.waiting }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.cancelWait?.()
    this.cursorTween?.remove()
    this.box.destroy()
    this.tag?.destroy()
    this.slots.forEach(s => s.destroy())
    this.cursor.destroy()
    popWidget(this)
  }

  /** The name tag on the box's top edge (none for narration and signs) */
  private setSpeaker(speaker: string | null): void {
    if (speaker === this.speaker) return
    this.speaker = speaker
    this.tag?.destroy()
    this.tag = null
    if (!speaker) return
    const w = measure(speaker) + 2 * TAG.padX
    const pill = nineSlice(this.scene, 'tag', 0, 0, w, TAG.h)
    const label = uiText(this.scene, TAG.padX, -P, speaker, 'dark')
    this.tag = this.scene.add.container(this.x + TAG.x, this.y + TAG.y, [pill, label])
      .setDepth(this.depth + 3).setScrollFactor(0).setVisible(this.visible)
  }

  private setShown(a: string, b: string): void {
    this.shown = [a, b]
    this.slots[0].setText(a)
    this.slots[1].setText(b)
  }

  /** Type `text` into a line slot, one character per tick (instant when rushed or speed 0) */
  private type(slot: 0 | 1, text: string): Promise<void> {
    return new Promise(resolve => {
      const speed = uiSettings.speedMs
      if (this.destroyed || speed <= 0 || this.rush || !text) {
        this.setSlot(slot, text)
        resolve()
        return
      }
      let n = 0
      const off = this.input.on(b => {
        if (b === 'a' || b === 'b' || b === 'start') this.rush = true
      })
      const timer = this.scene.time.addEvent({
        delay: speed,
        loop: true,
        callback: () => {
          if (this.destroyed) { timer.remove(); off(); resolve(); return }
          n = this.rush ? text.length : n + 1
          this.setSlot(slot, text.slice(0, n))
          if (n >= text.length) {
            timer.remove()
            off()
            resolve()
          }
        },
      })
    })
  }

  private setSlot(slot: 0 | 1, text: string): void {
    this.shown[slot] = text
    this.slots[slot].setText(text)
  }

  /** Blink the cursor after the last line until A (or B) is pressed */
  private waitForA(): Promise<void> {
    if (this.destroyed) return Promise.resolve()
    this.waiting = true
    const slot = this.shown[1] ? 1 : 0
    this.cursor.setPosition(this.x + PAD_X + measure(this.shown[slot]), this.y + LINE_Y[slot])
    this.cursor.setVisible(this.visible).setAlpha(1)
    this.cursorTween = this.scene.tweens.add({ targets: this.cursor, alpha: 0, duration: 300, yoyo: true, repeat: -1, ease: 'Stepped', hold: 150 })
    return new Promise(resolve => {
      const done = (): void => {
        this.waiting = false
        off()
        this.cancelWait = undefined
        this.cursorTween?.remove()
        this.cursorTween = undefined
        if (!this.destroyed) this.cursor.setVisible(false)
        resolve()
      }
      const off = this.input.on(b => {
        if (b === 'a' || b === 'b' || b === 'start') done()
      })
      this.cancelWait = done
    })
  }
}
