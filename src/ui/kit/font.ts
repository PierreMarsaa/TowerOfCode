import type Phaser from 'phaser'
import metrics from '@/assets/ui/ui-font.json'
import { PIXEL } from '@/config/game.config'
import { sanitize } from '@/ui/kit/glyphs'
import { measureWith, wrapWith, type Glyphs } from '@/ui/kit/textLayout'

/**
 * The interface font: proportional pixel glyphs with a baked shadow, one atlas per
 * ink (scripts/art/ui/font.mjs). Sizes here are canvas pixels: the art is drawn 2×.
 */

export type Ink = 'light' | 'gold' | 'dim' | 'dark'

/** Bitmap font (and texture) key of each ink */
export const INKS: Record<Ink, string> = {
  light: 'ui-font',
  gold: 'ui-font-gold',
  dim: 'ui-font-dim',
  dark: 'ui-font-dark',
}

const GLYPHS = metrics.glyphs as unknown as Glyphs

/** One line of text, in canvas pixels */
export const LINE_H = metrics.lineHeight * PIXEL

/** Width of one line of text in canvas pixels */
export function measure(text: string): number {
  return measureWith(GLYPHS, sanitize(text)) * PIXEL
}

/** Word-wrap to lines at most `maxWidth` canvas pixels wide */
export function wrapText(text: string, maxWidth: number): string[] {
  return wrapWith(GLYPHS, sanitize(text), Math.floor(maxWidth / PIXEL))
}

/** One bitmap font per ink, built from the metrics once the atlases are loaded (safe to call again) */
export function registerUiFonts(scene: Phaser.Scene): void {
  for (const key of Object.values(INKS)) {
    if (scene.cache.bitmapFont.exists(key) || !scene.textures.exists(key)) continue
    const source = scene.textures.get(key).getSourceImage() as { width: number; height: number }
    const tw = source.width
    const th = source.height
    const cell = metrics.cell
    const chars: Record<number, unknown> = {}
    const add = (code: number, [x, y, w, advance]: readonly number[]): void => {
      chars[code] = {
        x, y, width: w, height: cell,
        centerX: Math.floor(w / 2), centerY: Math.floor(cell / 2),
        xOffset: 0, yOffset: 0, xAdvance: advance,
        data: {}, kerning: {},
        u0: x / tw, v0: y / th, u1: (x + w) / tw, v1: (y + cell) / th,
      }
    }
    for (const [ch, m] of Object.entries(GLYPHS)) add(ch.charCodeAt(0), m)
    add(0xa0, GLYPHS[' ']) // the no-break space draws like a space
    const data = { font: key, size: cell, lineHeight: metrics.lineHeight, chars }
    scene.cache.bitmapFont.add(key, { data, texture: key, frame: null })
  }
}
