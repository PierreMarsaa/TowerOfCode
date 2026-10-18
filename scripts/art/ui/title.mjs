/**
 * The title screen, drawn at 1× (the game doubles it):
 *   src/assets/ui/ui-title.png  240×160 backdrop: a dithered night sky in Code-Life navy,
 *       stars, a crescent moon, hills, the Tower of Code rising from Bourg-Hello with
 *       lit windows and a cyan beacon on top, the village's roofs in silhouette
 *   src/assets/ui/ui-logo.png   the logo: "TOWER OF" in gold over a big "CODE" (procedural
 *       rounded letters, magenta → purple → cyan with a 3D edge) and a "PYTHON" pill
 */
import { Bitmap, hex } from '../bitmap.mjs'
import { hash } from '../hash.mjs'
import { CL } from './palette.mjs'
import { GLYPHS } from './font.mjs'

const W = 240
const H = 160
const HORIZON = 134

const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

/** Colour at t in [0, 1] along `stops` ([t, colour] sorted), solid bands with dithered seams */
function banded(stops, t, x, y) {
  let i = 0
  while (i < stops.length - 2 && t >= stops[i + 1][0]) i++
  const [t0, c0] = stops[i]
  const [t1, c1] = stops[i + 1]
  const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
  const seam = Math.min(1, Math.max(0, (f - 0.5) * 2.5 + 0.5)) // mostly solid, dithered around the middle
  return seam * 16 > BAYER4[y & 3][x & 3] + 0.5 ? c1 : c0
}

// ── Backdrop ──

const SKY = [
  [0, hex('#03052e')],
  [0.38, hex('#0b0b3a')],
  [0.66, hex('#16134a')],
  [0.86, hex('#251f62')],
  [1, hex('#3a3584')],
]
const STONE = { light: hex('#5a54b0'), mid: hex('#3a3584'), dark: hex('#241f57'), ledge: CL.purple }
const ROOF = { light: hex('#ff7dff'), mid: CL.magenta, dark: hex('#a42cc8') }
const WINDOW_LIT = CL.gold
const WINDOW_TOP = CL.goldLight
const WINDOW_DARK = hex('#120f2e')
const SILHOUETTE = hex('#0b0920')
const HILL_FAR = hex('#17144a')
const HILL_NEAR = hex('#100d33')
const MOON = hex('#fff3c4')
const MOON_SHADE = hex('#e8d49a')

const TOWER_X = 120
const BODY_TOP = 86
const FLOOR_H = 9

function towerWidthAt(floorFromBottom) {
  return 32 - 2 * Math.floor(floorFromBottom / 2)
}

function drawSky(b) {
  for (let y = 0; y < HORIZON; y++) for (let x = 0; x < W; x++) b.put(x, y, banded(SKY, y / HORIZON, x, y))
  for (let y = HORIZON; y < H; y++) for (let x = 0; x < W; x++) b.put(x, y, SKY[SKY.length - 1][1])
  // Stars: fixed positions; a few brighter ones get a little cross
  for (let i = 0; i < 90; i++) {
    const x = hash(i, 11) % W
    const y = hash(i, 23) % 108
    const k = hash(i, 37) % 10
    const c = k < 5 ? CL.dim : k < 8 ? CL.purpleLight : k < 9 ? hex('#8ff4ff') : CL.text
    b.put(x, y, c)
    if (k === 9 && x > 1 && y > 1 && x < W - 2) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.put(x + dx, y + dy, CL.dim)
    }
  }
  // Crescent moon
  const mx = 206, my = 26
  for (let y = my - 10; y <= my + 10; y++) {
    for (let x = mx - 10; x <= mx + 10; x++) {
      const inMoon = Math.hypot(x - mx, y - my) <= 9.2
      const inBite = Math.hypot(x - (mx + 4.5), y - (my - 2.5)) <= 8
      if (inMoon && !inBite) b.put(x, y, Math.hypot(x - (mx + 4.5), y - (my - 2.5)) <= 9.4 ? MOON_SHADE : MOON)
    }
  }
}

function drawHills(b) {
  for (let x = 0; x < W; x++) {
    const far = Math.round(114 + 5 * Math.sin(x / 21) + 3 * Math.sin(x / 8 + 1.3))
    for (let y = far; y < H; y++) b.put(x, y, HILL_FAR)
    const near = Math.round(126 + 4 * Math.sin(x / 15 + 2) + 2 * Math.sin(x / 6))
    for (let y = near; y < H; y++) b.put(x, y, HILL_NEAR)
  }
}

function drawTower(b) {
  const floors = Math.ceil((HORIZON + 4 - BODY_TOP) / FLOOR_H)
  for (let f = 0; f < floors; f++) {
    const w = towerWidthAt(f)
    const x0 = TOWER_X - w / 2
    const y1 = HORIZON + 4 - f * FLOOR_H // bottom of this floor (exclusive)
    const y0 = Math.max(BODY_TOP, y1 - FLOOR_H)
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const u = (x - x0) / (w - 1)
        const c = x === x0 || x === x0 + w - 1 ? SILHOUETTE : u < 0.3 ? STONE.light : u < 0.72 ? STONE.mid : STONE.dark
        b.put(x, y, c)
      }
    }
    // Ledge on top of the floor, sticking out by a pixel
    for (let x = x0 - 1; x <= x0 + w; x++) {
      b.put(x, y0, x === x0 - 1 || x === x0 + w ? SILHOUETTE : STONE.ledge)
      b.put(x, y0 + 1, SILHOUETTE)
    }
    // Windows (the ground floor has the door instead)
    if (f === 0) continue
    const slots = w >= 28 ? [-9, -1, 7] : w >= 24 ? [-6, 4] : [-1]
    slots.forEach((dx, k) => {
      const lit = hash(f, k, 5) % 5 !== 0
      for (let y = y0 + 3; y < y0 + 7; y++) {
        for (let x = TOWER_X + dx; x < TOWER_X + dx + 2; x++) {
          b.put(x, y, !lit ? WINDOW_DARK : y === y0 + 3 ? WINDOW_TOP : WINDOW_LIT)
        }
      }
    })
  }
  // The great door, lit from inside
  for (let y = HORIZON - 5; y < HORIZON + 4; y++) {
    for (let x = TOWER_X - 3; x < TOWER_X + 3; x++) {
      const arch = y === HORIZON - 5 && (x === TOWER_X - 3 || x === TOWER_X + 2)
      if (!arch) b.put(x, y, y === HORIZON - 5 || y === HORIZON - 4 ? WINDOW_TOP : WINDOW_LIT)
    }
  }
  // Pointed roof
  const roofTop = BODY_TOP - 16
  const roofBase = towerWidthAt(floors - 1) + 4
  for (let y = roofTop; y < BODY_TOP; y++) {
    const t = (y - roofTop) / (BODY_TOP - roofTop)
    const half = Math.max(1, Math.round((roofBase / 2) * t))
    for (let x = TOWER_X - half; x < TOWER_X + half; x++) {
      const u = (x - (TOWER_X - half)) / Math.max(1, 2 * half - 1)
      const edge = x === TOWER_X - half || x === TOWER_X + half - 1
      b.put(x, y, edge ? SILHOUETTE : u < 0.35 ? ROOF.light : u < 0.75 ? ROOF.mid : ROOF.dark)
    }
  }
  for (let x = TOWER_X - roofBase / 2 - 1; x <= TOWER_X + roofBase / 2; x++) b.put(x, BODY_TOP, SILHOUETTE)
  // The beacon: a cyan orb with a dithered halo and a little cross of light
  const by = roofTop - 5
  for (let y = by - 10; y <= by + 10; y++) {
    for (let x = TOWER_X - 10; x <= TOWER_X + 10; x++) {
      const d = Math.hypot(x + 0.5 - TOWER_X, y - by)
      if (d <= 2.2) b.put(x, y, d <= 1 ? CL.text : CL.cyan)
      else if (d <= 5 && (x + y) % 2 === 0) b.put(x, y, hex('#1b6fa8'))
      else if (d <= 8 && (x % 2 === 0 && y % 2 === 0)) b.put(x, y, hex('#174d86'))
    }
  }
  for (let k = 3; k <= 8; k++) {
    const c = k <= 5 ? hex('#8ff4ff') : hex('#1b6fa8')
    b.put(TOWER_X, by - k, c)
    b.put(TOWER_X - 1, by - k, c)
    b.put(TOWER_X + k, by, c)
    b.put(TOWER_X - 1 - k, by, c)
  }
}

/** Bourg-Hello in front: roofs and round trees in silhouette, a few lit windows */
function drawVillage(b) {
  const houses = [[6, 18, 10], [30, 22, 13], [58, 16, 9], [150, 20, 12], [178, 24, 14], [212, 18, 10]]
  for (let x = 0; x < W; x++) {
    // Trees: a wavy band of round crowns
    const crown = Math.round(142 + 3 * Math.sin(x / 5) + 2 * Math.sin(x / 2.3 + 1))
    for (let y = crown; y < H; y++) b.put(x, y, SILHOUETTE)
  }
  for (const [hx, hw, hh] of houses) {
    const wallTop = H - hh + 4
    for (let y = wallTop; y < H; y++) for (let x = hx; x < hx + hw; x++) b.put(x, y, SILHOUETTE)
    // Roof: a triangle over the walls
    for (let k = 0; k <= Math.ceil(hw / 2) + 1; k++) {
      const y = wallTop - Math.min(k, 6)
      for (let x = hx - 1 + k; x < hx + hw + 1 - k; x++) if (y >= 0) b.put(x, wallTop - Math.min(k, 6), SILHOUETTE)
    }
    // Lit windows
    for (let k = 0; k < Math.floor(hw / 6); k++) {
      if (hash(hx, k, 9) % 3 === 0) continue
      const wx = hx + 3 + k * 6
      b.put(wx, wallTop + 3, WINDOW_TOP)
      b.put(wx + 1, wallTop + 3, WINDOW_TOP)
      b.put(wx, wallTop + 4, WINDOW_LIT)
      b.put(wx + 1, wallTop + 4, WINDOW_LIT)
    }
  }
}

function backdrop() {
  const b = new Bitmap(W, H)
  drawSky(b)
  drawHills(b)
  drawTower(b)
  drawVillage(b)
  return b
}

// ── Logo ──

/** Pixel inside a rounded square ("squircle") of half-sizes a, b centred on (cx, cy) */
function squircle(px, py, cx, cy, a, b, n = 3.2) {
  return Math.abs(px - cx) ** n / a ** n + Math.abs(py - cy) ** n / b ** n <= 1
}

/** A bold rounded capital as a mask: C, O, D or E */
function letterMask(ch, w, h, s) {
  const m = Array.from({ length: h }, () => new Array(w).fill(false))
  const cx = w / 2
  const cy = h / 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const ring = squircle(px, py, cx, cy, w / 2, h / 2) && !squircle(px, py, cx, cy, w / 2 - s, h / 2 - s * 0.9)
      let on = false
      if (ch === 'O') on = ring
      else if (ch === 'C') on = ring && !(px > cx + 1 && Math.abs(py - cy) < h * 0.17)
      else if (ch === 'D') on = px >= w * 0.45 ? ring : x < s || y < s * 0.9 || y >= h - s * 0.9
      else if (ch === 'E') on = x < s || y < s * 0.9 || y >= h - s * 0.9 || (Math.abs(py - cy) < s * 0.45 && x < w - 3)
      m[y][x] = on
    }
  }
  return m
}

const FACE = [
  [0, hex('#ffa6ff')],
  [0.28, CL.magenta],
  [0.62, CL.purple],
  [1, CL.cyan],
]
const DEPTH = hex('#4a1f7a')
const DEPTH_LOW = hex('#2a1048')

/** Text in the interface font at 1×: `ink` letters with a 1-px dark outline */
function drawFontText(b, text, x, y, ink, spacing = 1) {
  const mask = new Set()
  let cx = x
  for (const ch of text) {
    const g = GLYPHS[ch]
    if (!g) continue
    g.rows.forEach((row, gy) => [...row].forEach((c, gx) => { if (c === '#') mask.add(`${cx + gx},${y + gy}`) }))
    cx += g.adv + spacing
  }
  for (const key of mask) {
    const [px, py] = key.split(',').map(Number)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      if (!mask.has(`${px + dx},${py + dy}`)) b.put(px + dx, py + dy, CL.shadow)
    }
  }
  for (const key of mask) {
    const [px, py] = key.split(',').map(Number)
    b.put(px, py, ink)
  }
  return cx - x - spacing
}

function textWidth(text, spacing = 1) {
  let w = 0
  for (const ch of text) w += (GLYPHS[ch]?.adv ?? 4) + spacing
  return w - spacing
}

function logo() {
  const letters = [['C', 30], ['O', 30], ['D', 30], ['E', 24]]
  const h = 36
  const s = 8
  const gap = 5
  const wordW = letters.reduce((sum, [, w]) => sum + w, 0) + gap * (letters.length - 1)
  const LW = wordW + 8
  const LH = 65 // "TOWER OF", the word with its 3D edge, the pill overlapping that edge
  const b = new Bitmap(LW, LH)
  const top = 14
  // The word's mask
  const face = new Set()
  let x0 = 4
  for (const [ch, w] of letters) {
    const m = letterMask(ch, w, h, s)
    m.forEach((row, y) => row.forEach((on, x) => { if (on) face.add(`${x0 + x},${top + y}`) }))
    x0 += w + gap
  }
  const has = (x, y) => face.has(`${x},${y}`)
  // 3D edge: the face pushed down 4 px
  const depth = new Set()
  for (const key of face) {
    const [x, y] = key.split(',').map(Number)
    for (let k = 1; k <= 4; k++) if (!has(x, y + k)) depth.add(`${x},${y + k}`)
  }
  // Dark outline around face + edge
  const solid = new Set([...face, ...depth])
  for (const key of solid) {
    const [x, y] = key.split(',').map(Number)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!solid.has(`${x + dx},${y + dy}`)) b.put(x + dx, y + dy, CL.shadow)
    }
  }
  for (const key of depth) {
    const [x, y] = key.split(',').map(Number)
    b.put(x, y, depth.has(`${x},${y + 1}`) ? DEPTH : DEPTH_LOW)
  }
  for (const key of face) {
    const [x, y] = key.split(',').map(Number)
    let c = banded(FACE, (y - top) / (h - 1), x, y)
    if (!has(x, y - 1)) c = CL.text // lit top edge
    else if (!has(x - 1, y) || !has(x, y - 2)) c = banded([[0, hex('#ffd2ff')], [1, hex('#a8f4ff')]], (y - top) / (h - 1), x, y)
    b.put(x, y, c)
  }
  // "TOWER OF" above, in gold
  const tw = textWidth('TOWER OF')
  drawFontText(b, 'TOWER OF', Math.round((LW - tw) / 2), 0, CL.gold)
  // "PYTHON" pill under the end of the word, like a version banner
  const label = 'PYTHON'
  const lw = textWidth(label)
  const pw = lw + 10
  const px0 = LW - 2 - pw
  const py0 = top + h + 1
  const ph = 13
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const corner = (y === 0 || y === ph - 1) && (x === 0 || x === pw - 1)
      if (corner) continue
      const edge = y === 0 || y === ph - 1 || x === 0 || x === pw - 1
      b.put(px0 + x, py0 + y, edge ? CL.shadow : y === 1 ? CL.goldLight : y === ph - 2 ? CL.goldDark : CL.gold)
    }
  }
  // Capitals on rows 2–10 of the pill
  let lx = px0 + 5
  for (const ch of label) {
    const g = GLYPHS[ch]
    g.rows.forEach((row, gy) => [...row].forEach((c, gx) => { if (c === '#') b.put(lx + gx, py0 - 1 + gy, CL.ink) }))
    lx += g.adv + 1
  }
  return b
}

export function titleAssets() {
  return [
    { out: 'src/assets/ui/ui-title.png', bitmap: backdrop(), kind: 'file' },
    { out: 'src/assets/ui/ui-logo.png', bitmap: logo(), kind: 'file' },
  ]
}
