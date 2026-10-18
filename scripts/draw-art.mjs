#!/usr/bin/env node
/**
 * Draws the game's art with code: tiles, character sprites, trainer pics, and the
 * interface (its font as PNG atlases + metrics for Phaser and a TTF for the HTML
 * screens, windows, icons, the title screen).
 *
 *   npm run art            write the files into src/assets/ (and public/)
 *   npm run art:preview    only write previews to design/art-preview/ (gitignored)
 *
 * Deterministic: every pixel comes from code and integer hashes, so running it
 * twice gives identical files. Tiles are 16×16 and sprite sheets 128×128; the
 * game scales both exactly 2× with no smoothing.
 *
 * Game Boy Color rules (scripts/art/gbc/palette.mjs) are checked on the world art:
 * at most 4 colours per 8×8 quarter of a tile, 3 colours + transparency per
 * sprite frame, 4 colours per trainer pic. The interface (scripts/art/ui) has a
 * newer look and is only checked for a complete font.
 * Needs Node 22+ (runs the shared TypeScript glyph list directly).
 */
import { mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WORLDS } from './art/palettes.mjs'
import { encodePng } from './art/png.mjs'
import { terrainAssets } from './art/terrain.mjs'
import { commonAssets } from './art/common.mjs'
import { hubAssets } from './art/hub.mjs'
import { characterAssets as oldCharacterAssets } from './art/characters.mjs'
import { uiAssets as oldUiAssets } from './art/ui.mjs'
import { renderPreviews } from './art/preview.mjs'
import { checkSprite, checkTile, colorsIn } from './art/gbc/palette.mjs'
import { uiAssets } from './art/gbc/ui.mjs'
import { portraitAssets } from './art/gbc/portraits.mjs'
import { characterAssets } from './art/gbc/characters.mjs'
import { townAssets } from './art/gbc/town.mjs'
import { indoorAssets } from './art/gbc/indoor.mjs'
import { towerAssets } from './art/gbc/tower.mjs'
import { checkFont, fontAssets, fontMetrics, fontTtf } from './art/ui/font.mjs'
import { windowAssets } from './art/ui/windows.mjs'
import { iconAssets } from './art/ui/icons.mjs'
import { titleAssets } from './art/ui/title.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PREVIEW = process.argv.includes('--preview')

/** The Game Boy Color art (checked against the hardware limits) */
function gbcAssets() {
  const tiles = [...townAssets(), ...indoorAssets(), ...towerAssets(), ...uiAssets().filter(a => a.kind === 'tile')].map(a => ({ ...a, kind: 'tile', gbc: true }))
  const files = portraitAssets().map(a => ({ ...a, gbc: true }))
  const sprites = characterAssets().map(a => ({ ...a, kind: 'sprite', gbc: true }))
  return [...tiles, ...files, ...sprites]
}

/** The interface: font atlases, windows, icons, title screen */
function interfaceAssets() {
  return [...fontAssets(), ...windowAssets(), ...iconAssets(), ...titleAssets()]
}

/** Step 3 art still used by the old tower and hub (removed at the end of the redo) */
function legacyAssets() {
  const assets = []
  for (const w of WORLDS) for (const a of terrainAssets(w)) assets.push({ ...a, kind: 'tile' })
  for (const a of commonAssets()) assets.push({ ...a, kind: 'tile' })
  for (const a of hubAssets()) assets.push({ ...a, kind: 'tile' })
  assets.push(...oldCharacterAssets(), ...oldUiAssets())
  return assets
}

/** Every asset the script owns: { out: key or path, bitmap, kind }. The Game Boy art wins over old art with the same name. */
function allAssets() {
  const gbc = [...gbcAssets(), ...interfaceAssets()]
  const taken = new Set(gbc.map(a => a.out))
  return [...gbc, ...legacyAssets().filter(a => !taken.has(a.out))]
}

function check(assets) {
  const problems = []
  const seen = new Set()
  for (const a of assets) {
    if (seen.has(a.out)) problems.push(`duplicate ${a.out}`)
    seen.add(a.out)
    if (a.kind === 'tile') {
      if (a.bitmap.w !== 16 || a.bitmap.h !== 16) problems.push(`${a.out}: tiles are 16×16`)
      if (a.out.startsWith('ground/') && !a.bitmap.isOpaque()) problems.push(`${a.out}: ground tiles must be fully opaque`)
      if (a.gbc) problems.push(...checkTile(a.bitmap, a.out))
    }
    if (a.kind === 'sprite') {
      if (a.bitmap.w !== 128 || a.bitmap.h !== 128) problems.push(`${a.out}: sprite sheets are 128×128`)
      if (a.gbc) {
        for (let f = 0; f < 16; f++) {
          const frame = a.bitmap.crop((f % 4) * 32, Math.floor(f / 4) * 32, 32, 32)
          problems.push(...checkSprite(frame, `${a.out} frame ${f}`))
        }
      }
    }
    if (a.gbc && a.out.includes('/portraits/')) {
      if (a.bitmap.w !== 56 || a.bitmap.h !== 56) problems.push(`${a.out}: trainer pics are 56×56`)
      if (colorsIn(a.bitmap) > 4) problems.push(`${a.out}: ${colorsIn(a.bitmap)} colours (max 4)`)
    }
    if (a.out.endsWith('dialog-box.png') && (a.bitmap.w !== 608 || a.bitmap.h !== 96)) problems.push(`${a.out}: the editor expects 608×96`)
  }
  // Animated families: 2 or more frames each (the game advances them all on one clock)
  const families = new Map()
  for (const a of assets) {
    const m = a.out.match(/^(.+)_f(\d+)$/)
    if (m) families.set(m[1], (families.get(m[1]) ?? 0) + 1)
  }
  for (const [family, n] of families) if (n < 2) problems.push(`${family}: ${n} frame, expected at least 2`)
  // Every character the game can print has a glyph that fits its cell
  problems.push(...checkFont())
  return problems
}

const assets = allAssets()
const problems = check(assets)
if (problems.length) {
  console.error(`Art checks failed (${problems.length}):\n  ` + problems.slice(0, 60).join('\n  '))
  process.exit(1)
}

if (PREVIEW) {
  const dir = path.join(ROOT, 'design/art-preview')
  mkdirSync(dir, { recursive: true })
  const files = await renderPreviews(assets.filter(a => a.kind === 'tile' || a.kind === 'sprite'), dir)
  console.log(`Previews (${files.length}) in design/art-preview/:\n  ${files.join('\n  ')}`)
} else {
  let written = 0
  for (const a of assets) {
    const file = a.kind === 'tile' ? path.join(ROOT, 'src/assets/tilesets', `${a.out}.png`)
      : a.kind === 'sprite' ? path.join(ROOT, 'src/assets/sprites', `${a.out}.png`)
      : path.join(ROOT, a.out)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, encodePng(a.bitmap))
    written++
  }
  // The font's metrics (one glyph per line) and the TTF for the HTML screens
  const metrics = fontMetrics()
  const glyphLines = Object.entries(metrics.glyphs).map(([ch, m]) => `    ${JSON.stringify(ch)}: ${JSON.stringify(m)}`)
  const json = `{\n  "cell": ${metrics.cell},\n  "lineHeight": ${metrics.lineHeight},\n  "baseline": ${metrics.baseline},\n  "glyphs": {\n${glyphLines.join(',\n')}\n  }\n}\n`
  writeFileSync(path.join(ROOT, 'src/assets/ui/ui-font.json'), json)
  writeFileSync(path.join(ROOT, 'src/assets/ui/ui-font.ttf'), fontTtf())
  written += 2
  console.log(`Wrote ${written} files.`)
  // Tile files this script doesn't draw (old art to delete, or hand-made pieces it must leave alone)
  const owned = new Set(assets.filter(a => a.kind === 'tile').map(a => a.out))
  const walk = (dir, base = '') => readdirSync(dir).flatMap(f => {
    const full = path.join(dir, f)
    return statSync(full).isDirectory() ? walk(full, `${base}${f}/`) : f.endsWith('.png') ? [`${base}${f.slice(0, -4)}`] : []
  })
  const others = walk(path.join(ROOT, 'src/assets/tilesets')).filter(k => !owned.has(k))
  if (others.length) console.log(`Tiles not drawn by this script (${others.length}): ${others.join(', ')}`)
}
