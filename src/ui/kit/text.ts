import type Phaser from 'phaser'
import { PIXEL } from '@/config/game.config'
import { INKS, measure, type Ink } from '@/ui/kit/font'
import { sanitize } from '@/ui/kit/glyphs'
import { SLICES, type SliceName } from '@/ui/kit/assets'

/** Text in the interface font, drawn 2× from the top-left corner of its line */
export function uiText(scene: Phaser.Scene, x: number, y: number, text: string, ink: Ink = 'light'): Phaser.GameObjects.BitmapText {
  return scene.add.bitmapText(x, y, INKS[ink], sanitize(text)).setScale(PIXEL).setOrigin(0, 0)
}

/** Change a text's ink (its font) */
export function setInk(text: Phaser.GameObjects.BitmapText, ink: Ink): Phaser.GameObjects.BitmapText {
  return text.setFont(INKS[ink])
}

/**
 * A nine-slice piece (window, name tag, highlight bar, pill) at a position and
 * size in canvas pixels: corners drawn as they are (2×), edges and fill stretched
 * (they are uniform, so they stay crisp). Returns a container to move, hide or
 * destroy as one.
 */
export function nineSlice(scene: Phaser.Scene, slice: SliceName, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  const { key, corner } = SLICES[slice]
  const c = corner * PIXEL
  const parts: Phaser.GameObjects.Image[] = []
  const piece = (px: number, py: number, pw: number, ph: number, frame: string): void => {
    if (pw <= 0 || ph <= 0) return
    parts.push(scene.add.image(px, py, key, frame).setOrigin(0, 0).setDisplaySize(pw, ph))
  }
  piece(c, c, w - 2 * c, h - 2 * c, 'c')
  piece(c, 0, w - 2 * c, c, 't')
  piece(c, h - c, w - 2 * c, c, 'b')
  piece(0, c, c, h - 2 * c, 'l')
  piece(w - c, c, c, h - 2 * c, 'r')
  piece(0, 0, c, c, 'tl')
  piece(w - c, 0, c, c, 'tr')
  piece(0, h - c, c, c, 'bl')
  piece(w - c, h - c, c, c, 'br')
  return scene.add.container(x, y, parts)
}

/** A window: indigo, purple border, rounded corners */
export function drawBox(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
  return nineSlice(scene, 'window', x, y, w, h)
}

/** A window covering the whole screen, over night navy so its rounded corners don't show the map behind */
export function drawScreenBox(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const { width, height } = scene.scale
  const box = drawBox(scene, 0, 0, width, height)
  box.addAt(scene.add.rectangle(0, 0, width, height, 0x03052e).setOrigin(0, 0), 0)
  return box
}

/** Whether dark ink reads better than light ink on this colour */
function isLight(color: number): boolean {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}

/** A small rounded label in a colour (a Codémon's type): 13 art pixels tall, text in the ink that reads best */
export function drawPill(scene: Phaser.Scene, x: number, y: number, label: string, color: number): Phaser.GameObjects.Container {
  const h = 13 * PIXEL
  const w = measure(label) + 6 * PIXEL
  const pill = nineSlice(scene, 'pill', 0, 0, w, h)
  pill.each((part: Phaser.GameObjects.Image) => part.setTint(color))
  const text = uiText(scene, 4 * PIXEL, -1 * PIXEL, label, isLight(color) ? 'dark' : 'light')
  return scene.add.container(x, y, [pill, text])
}

/** '#rrggbb' → 0xrrggbb */
export function colorNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}
