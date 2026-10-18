/**
 * Contact sheets for checking the art tile by tile (design/art-preview/, gitignored).
 * The real check is the game itself. Labels are drawn here only, so the game's PNGs
 * stay byte-identical.
 */
import { createCanvas, ImageData } from 'canvas'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { Bitmap } from './bitmap.mjs'
import { WORLDS } from './palettes.mjs'

const BG = '#14141f'

function toCanvasImage(bitmap) {
  return new ImageData(bitmap.data, bitmap.w, bitmap.h)
}

/** A grid of labelled thumbnails (scaled by k) */
function sheet(items, k, columns, title) {
  const cellW = Math.max(...items.map(i => i.bitmap.w)) * k + 16
  const cellH = Math.max(...items.map(i => i.bitmap.h)) * k + 30
  const rows = Math.ceil(items.length / columns)
  const canvas = createCanvas(columns * cellW + 16, rows * cellH + 48)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffdd44'
  ctx.font = 'bold 18px monospace'
  ctx.fillText(title, 12, 26)
  ctx.font = '11px monospace'
  items.forEach((item, i) => {
    const x = 12 + (i % columns) * cellW, y = 40 + Math.floor(i / columns) * cellH
    const scaled = item.bitmap.scale(k)
    // checkerboard behind transparent pieces
    for (let cy = 0; cy < scaled.h; cy += 8) for (let cx = 0; cx < scaled.w; cx += 8) {
      ctx.fillStyle = ((cx + cy) / 8) % 2 ? '#2a2a3a' : '#22222f'
      ctx.fillRect(x + cx, y + cy, 8, 8)
    }
    const tmp = createCanvas(scaled.w, scaled.h)
    tmp.getContext('2d').putImageData(toCanvasImage(scaled), 0, 0)
    ctx.drawImage(tmp, x, y)
    ctx.fillStyle = '#c8c8dc'
    ctx.fillText(item.label, x, y + scaled.h + 13)
  })
  return canvas
}

/** Draw a map (layers of tile keys) into one bitmap */
export function composeMap(width, height, layers, byKey) {
  const scene = new Bitmap(width * 16, height * 16)
  for (const layer of layers) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = layer[y * width + x]
        const tile = key && byKey.get(key)
        if (tile) scene.blit(tile, x * 16, y * 16)
      }
    }
  }
  return scene
}

function save(canvas, dir, name, files) {
  writeFileSync(path.join(dir, name), canvas.toBuffer('image/png'))
  files.push(name)
}

function bitmapCanvas(bitmap) {
  const c = createCanvas(bitmap.w, bitmap.h)
  c.getContext('2d').putImageData(toCanvasImage(bitmap), 0, 0)
  return c
}

// ── Characters ──

const ROW = { down: 0, left: 1, right: 2, up: 3 }

/** One frame (32×32) of a sprite sheet */
function spriteFrame(sheetBitmap, facing, col = 0) {
  return sheetBitmap.crop(col * 32, ROW[facing] * 32, 32, 32)
}

/** Draw a character on a scene like the game does: frame bottom on the tile's bottom, centred */
function placeCharacter(scene, sheetBitmap, tileX, tileY, facing) {
  scene.blit(spriteFrame(sheetBitmap, facing), tileX * 16 - 8, tileY * 16 - 16)
}

function lineUp(sprites) {
  const names = Object.keys(sprites)
  const k = 4
  const cols = [['down', 0], ['left', 0], ['right', 0], ['up', 0], ['down', 1], ['down', 3], ['left', 1], ['left', 3]]
  const canvas = createCanvas(cols.length * 32 * k + 40 + 120, names.length * (32 * k + 8) + 50)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffdd44'
  ctx.font = 'bold 18px monospace'
  ctx.fillText('Characters: down / left / right / up (idle), then walk steps', 12, 26)
  ctx.font = '13px monospace'
  names.forEach((name, i) => {
    const y = 44 + i * (32 * k + 8)
    ctx.fillStyle = '#c8c8dc'
    ctx.fillText(name, 12, y + 60)
    cols.forEach(([facing, col], j) => {
      const img = bitmapCanvas(spriteFrame(sprites[name], facing, col).scale(k))
      ctx.fillStyle = (i + j) % 2 ? '#1e3a26' : '#24442c'
      ctx.fillRect(130 + j * 32 * k, y, 32 * k, 32 * k)
      ctx.drawImage(img, 130 + j * 32 * k, y)
    })
  })
  return canvas
}

function assembled(byKey, prefix, cols, rows, door) {
  const b = new Bitmap(cols * 16, rows * 16)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const key = door && door.col === c && door.row === r ? door.key : `${prefix}_${c}_${r}`
    b.blit(byKey.get(key), c * 16, r * 16)
  }
  return b
}

export async function renderPreviews(assets, dir) {
  const files = []
  const byKey = new Map(assets.map(a => [a.out, a.bitmap]))
  const sprites = Object.fromEntries(assets.filter(a => a.kind === 'sprite').map(a => [a.out, a.bitmap]))
  for (const w of WORLDS) {
    const items = assets.filter(a => a.out.includes(`/${w}/`)).map(a => ({ bitmap: a.bitmap, label: a.out.split('/').pop() }))
    save(sheet(items, 4, 10, `World: ${w}`), dir, `terrain-${w}.png`, files)
  }
  const common = ['ground/ice/1', 'ground/arrows/up', 'ground/arrows/down', 'ground/arrows/left', 'ground/arrows/right', 'objects/portal/warp',
    'objects/portal/teleporter_purple', 'objects/portal/teleporter_green', 'objects/portal/teleporter_gold', 'objects/portal/teleporter_red',
    'objects/rock', 'ground/basic/2', 'objects/stairs/up', 'objects/stairs/down', 'objects/hub/tree', 'objects/hub/sign']
  save(sheet(common.filter(k => byKey.has(k)).map(k => ({ bitmap: byKey.get(k), label: k.split('/').pop() })), 4, 9, 'Common pieces'), dir, 'common.png', files)
  const hubPieces = assets.filter(a => a.out.startsWith('ground/hub/') || a.out.startsWith('objects/hub/') || a.out.startsWith('ground/village/') || a.out.startsWith('objects/village/'))
    .map(a => ({ bitmap: a.bitmap, label: a.out.split('/').pop() }))
  save(sheet(hubPieces, 4, 10, 'Hub pieces'), dir, 'hub-pieces.png', files)
  const buildings = []
  for (const w of WORLDS) {
    if (!byKey.has(`objects/gate/${w}_0_0`)) continue
    buildings.push({ bitmap: assembled(byKey, `objects/gate/${w}`, 3, 4, { col: 1, row: 3, key: `objects/gate/${w}_door_open` }), label: `${w} (open)` })
    buildings.push({ bitmap: assembled(byKey, `objects/gate/${w}`, 3, 4, { col: 1, row: 3, key: `objects/gate/${w}_door_closed` }), label: `${w} (closed)` })
  }
  if (byKey.has('objects/hall/entrance_0_0')) buildings.push({ bitmap: assembled(byKey, 'objects/hall/entrance', 3, 3, { col: 1, row: 2, key: 'objects/hall/entrance_door' }), label: 'training hall' })
  if (buildings.length) save(sheet(buildings, 3, 7, 'Buildings'), dir, 'buildings.png', files)
  save(lineUp(sprites), dir, 'characters.png', files)
  save(bitmapCanvas(byKey.get('public/assets/ui/dialog-box.png')), dir, 'dialog-box.png', files)
  return files
}
