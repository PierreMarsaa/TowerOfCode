import Phaser from 'phaser'
import fontUrl from '@/assets/ui/ui-font.png?url'
import fontGoldUrl from '@/assets/ui/ui-font-gold.png?url'
import fontDimUrl from '@/assets/ui/ui-font-dim.png?url'
import fontDarkUrl from '@/assets/ui/ui-font-dark.png?url'
import windowUrl from '@/assets/ui/ui-window.png?url'
import tagUrl from '@/assets/ui/ui-tag.png?url'
import barUrl from '@/assets/ui/ui-bar.png?url'
import pillUrl from '@/assets/ui/ui-pill.png?url'
import glowUrl from '@/assets/ui/ui-glow.png?url'
import iconsUrl from '@/assets/ui/ui-icons.png?url'
import titleUrl from '@/assets/ui/ui-title.png?url'
import logoUrl from '@/assets/ui/ui-logo.png?url'
import eggUrl from '@/assets/ui/egg.webp?url'
import eggHatchingUrl from '@/assets/ui/egg_hatching.webp?url'
import { INKS, registerUiFonts } from '@/ui/kit/font'

/**
 * The interface's images (scripts/art/ui): the font's atlases, the nine-slice
 * pieces of windows, name tags, highlight bars and pills, the menu icons, the soft
 * glow behind Codémon. Scenes that may run without BootScene (the editor's test
 * mode boots its own scene) preload them themselves; loading twice is skipped.
 */

/** Nine-slice pieces: texture key and corner size in art pixels */
export const SLICES = {
  window: { key: 'ui-window', corner: 8 },
  tag: { key: 'ui-tag', corner: 3 },
  bar: { key: 'ui-bar', corner: 2 },
  pill: { key: 'ui-pill', corner: 2 },
} as const
export type SliceName = keyof typeof SLICES

export const GLOW = 'ui-glow'
export const ICONS = 'ui-icons'
/** Frames of ui-icons.png, in order (scripts/art/ui/icons.mjs) */
export const ICON_NAMES = ['dex', 'team', 'save', 'options', 'back', 'continue', 'new'] as const
export type IconName = (typeof ICON_NAMES)[number]
const ICON_SIZE = 16

/** The title screen and the egg of the opening (BootScene loads them: story only) */
export const TITLE = 'ui-title'
export const LOGO = 'ui-logo'
export const EGG = 'ui-egg'
export const EGG_HATCHING = 'ui-egg-hatching'

const IMAGES: Record<string, string> = {
  [INKS.light]: fontUrl,
  [INKS.gold]: fontGoldUrl,
  [INKS.dim]: fontDimUrl,
  [INKS.dark]: fontDarkUrl,
  [SLICES.window.key]: windowUrl,
  [SLICES.tag.key]: tagUrl,
  [SLICES.bar.key]: barUrl,
  [SLICES.pill.key]: pillUrl,
  [GLOW]: glowUrl,
  [ICONS]: iconsUrl,
}

const STORY_IMAGES: Record<string, string> = {
  [TITLE]: titleUrl,
  [LOGO]: logoUrl,
  [EGG]: eggUrl,
  [EGG_HATCHING]: eggHatchingUrl,
}

function queue(scene: Phaser.Scene, images: Record<string, string>): void {
  for (const [key, url] of Object.entries(images)) {
    if (!scene.textures.exists(key)) scene.load.image(key, url)
  }
}

/** Queue the interface images this scene's texture manager doesn't have yet (call in preload) */
export function preloadUi(scene: Phaser.Scene): void {
  queue(scene, IMAGES)
}

/** The title screen's and the opening's pictures */
export function preloadStoryArt(scene: Phaser.Scene): void {
  queue(scene, STORY_IMAGES)
}

/** Fonts, nine-slice frames and icon frames, once the images are loaded (safe to call again) */
export function registerUi(scene: Phaser.Scene): void {
  registerUiFonts(scene)
  for (const { key, corner } of Object.values(SLICES)) {
    if (!scene.textures.exists(key)) continue
    const tex = scene.textures.get(key)
    if (tex.has('tl')) continue
    const src = tex.getSourceImage() as { width: number; height: number }
    const xs = [0, corner, src.width - corner]
    const ws = [corner, src.width - 2 * corner, corner]
    const ys = [0, corner, src.height - corner]
    const hs = [corner, src.height - 2 * corner, corner]
    const names = [['tl', 't', 'tr'], ['l', 'c', 'r'], ['bl', 'b', 'br']]
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tex.add(names[r][c], 0, xs[c], ys[r], ws[c], hs[r])
  }
  if (scene.textures.exists(ICONS)) {
    const tex = scene.textures.get(ICONS)
    if (!tex.has(ICON_NAMES[0])) ICON_NAMES.forEach((name, i) => tex.add(name, 0, i * ICON_SIZE, 0, ICON_SIZE, ICON_SIZE))
  }
  // Soft pictures are scaled freely: smooth them instead of pixelating them
  for (const key of [GLOW, EGG, EGG_HATCHING]) {
    if (scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR)
  }
}
