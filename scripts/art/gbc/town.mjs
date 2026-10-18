/**
 * Bourg-Hello, the starting town, and the routes after it: Game Boy Color tiles in
 * the Gold/Silver/Crystal style.
 *
 *   ground/town/grass_1, grass_2        short grass (pale field, sparse tufts)
 *   ground/town/tallgrass               tall grass, where wild Codémon hide
 *   ground/town/flowers_f1, _f2         red and white flowers swaying
 *   ground/town/path_<mask>             dirt path; grass laps over the sides that aren't path
 *   ground/town/sand                    beach sand
 *   ground/town/water_<mask>_f1, _f2    sea and ponds; sand rim and foam on the land sides
 *   objects/town/tree, tree_2           opaque, the field behind: rows and columns of
 *                                       trees tile into a forest wall
 *   objects/town/fence_<mask>           white picket fence
 *   objects/town/sign, mailbox, bush, rock
 *   objects/town/house_red_<c>_<r>      4×3, door at (1, 2)
 *   objects/town/house_blue_<c>_<r>     4×3, door at (2, 2), mirrored layout
 *   objects/town/lab_<c>_<r>            Prof Pi's lab, 6×4, double door at (3, 3)
 *
 * Masks follow mask4 in src/generation/autotile.ts: bit set = that neighbour is the
 * same kind (N=1 E=2 S=4 W=8). Buildings are placed with stamp(); the door tile is
 * the walkable one. GBC rule: at most 4 colours per 8×8 quarter. Grass, tall grass,
 * trees and bushes share one green palette, like GSC, so a tree's background is
 * the field itself.
 */
import { Bitmap, CLEAR, hex } from '../bitmap.mjs'
import { BG, fromAscii, tileColors } from './palette.mjs'

const T = 16
const N = 1, E = 2, S = 4, W = 8
const pal = (...cs) => cs.map(hex)

export const townPalettes = {
  green: pal('#c0e890', '#78c050', '#307830', '#102810'),
  flower: pal('#f8f8f8', '#c0e890', '#e04830', '#307830'),
  path: BG.path,
  sand: BG.sand,
  water: pal('#e8f8f8', '#68a0f0', '#3868c8', '#183870'),
  fence: pal('#f8f8f8', '#c8c8c8', '#888888', '#303030'),
  wood: BG.wood,
  stone: BG.stone,
  roofRed: BG.roofRed,
  roofBlue: BG.roofBlue,
  wall: pal('#f8f8e8', '#d8d0b0', '#a87840', '#302820'),
  glass: hex('#90c8f0'),
  labRoof: pal('#e8f8f8', '#a8d0d0', '#609090', '#203838'),
  labWall: pal('#f8f8f8', '#c8d0d8', '#90c8f0', '#283038'),
}
const P = townPalettes
const G = P.green

function art(rows, colors, w = T, h = T) {
  if (rows.length !== h || rows.some(r => r.length !== w)) throw new Error(`art: expected ${w}×${h}`)
  return fromAscii(rows, colors)
}

function tile(fill) {
  const b = new Bitmap(T, T)
  if (fill) b.fill(fill)
  return b
}

// ── Grass ──

/** A "v" tuft: two blade tips and a darker root */
function tuft(b, x, y) {
  b.px(x - 1, y - 1, G[1]); b.px(x + 1, y - 1, G[1]); b.px(x, y, G[2])
}

function grass(v) {
  const b = tile(G[0])
  const spots = v === 1 ? [[4, 5], [12, 13]] : [[11, 4], [3, 12], [8, 9]]
  for (const [x, y] of spots) tuft(b, x, y)
  return b
}

const TALL_GRASS = [
  '2202220222022202',
  '2010201020102010',
  '0111011101110111',
  '1101110111011101',
  '1121112111211121',
  '2122212221222122',
  '3212321232123212',
  '3332333233323332',
  '0222022202220222',
  '1020102010201020',
  '1101110111011101',
  '0111011101110111',
  '2111211121112111',
  '2221222122212221',
  '1232123212321232',
  '3233323332333233',
]

// ── Flowers: red and white blossoms; frame 2 sways the heads one pixel ──

const FLOWERS = [
  [
    '1111111111111111',
    '1112111111111111',
    '1122211111110111',
    '1220221111100011',
    '1122211111002001',
    '1112111111100011',
    '1113311111110111',
    '1113111111133111',
    '1111111111112111',
    '1111011111122211',
    '1110001111220221',
    '1100200111122211',
    '1110001111112111',
    '1111011111133111',
    '1111331111113111',
    '1111311111111111',
  ],
  [
    '1111111111111111',
    '1111211111111111',
    '1112221111111011',
    '1122022111110001',
    '1112221111100200',
    '1111211111110001',
    '1113311111111011',
    '1113111111133111',
    '1111111111111211',
    '1111101111112221',
    '1111000111122022',
    '1110020011112221',
    '1111000111111211',
    '1111101111133111',
    '1111331111113111',
    '1111311111111111',
  ],
]

// ── Autotile helpers (mask bit set = that neighbour is the same kind) ──

/** Depth of (x, y) from each side whose neighbour is NOT the same kind */
function openSides(mask, x, y) {
  const d = []
  if (!(mask & N)) d.push({ depth: y, along: x })
  if (!(mask & S)) d.push({ depth: T - 1 - y, along: x })
  if (!(mask & W)) d.push({ depth: x, along: y })
  if (!(mask & E)) d.push({ depth: T - 1 - x, along: y })
  return d
}

/** Manhattan distance to the nearest outer corner (both sides open), for rounding */
function cornerDepth(mask, x, y) {
  let best = Infinity
  const c = (a, b, dx, dy) => { if (!(mask & a) && !(mask & b)) best = Math.min(best, dx + dy) }
  c(N, W, x, y); c(N, E, T - 1 - x, y); c(S, W, x, T - 1 - y); c(S, E, T - 1 - x, T - 1 - y)
  return best
}

// ── Dirt path: grass laps over the sides that are not path ──

const PATH_EDGE = [1, 1, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1]
const PEBBLES = [[5, 6], [11, 3], [12, 11], [3, 12], [9, 9]]

function pathTile(mask) {
  const p1 = P.path[1], p2 = P.path[2]
  const grassAt = (x, y) => {
    if (x < 0) return !(mask & W)
    if (x >= T) return !(mask & E)
    if (y < 0) return !(mask & N)
    if (y >= T) return !(mask & S)
    for (const e of openSides(mask, x, y)) if (e.depth < PATH_EDGE[e.along]) return true
    return cornerDepth(mask, x, y) < 4
  }
  const inTile = (x, y) => x >= 0 && y >= 0 && x < T && y < T
  const b = tile(p1)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (grassAt(x, y)) {
        const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inTile(x + dx, y + dy) && !grassAt(x + dx, y + dy))
        b.put(x, y, rim ? G[1] : G[0])
      } else if (y > 0 && grassAt(x, y - 1)) b.put(x, y, p2)
    }
  }
  for (const [x, y] of PEBBLES) {
    const clear = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, -2]].every(([dx, dy]) => !grassAt(x + dx, y + dy))
    if (clear) b.put(x, y, p2)
  }
  return b
}

// ── Sand ──

function sand() {
  const [s0, s1, s2] = P.sand
  const b = tile(s1)
  const dots = [[1, 1], [9, 2], [5, 5], [13, 6], [2, 9], [10, 10], [6, 13], [14, 14]]
  for (const [x, y] of dots) { b.put(x, y, s2); b.put(x + 1, y, s2) }
  for (const [x, y] of [[3, 2], [11, 4], [7, 8], [15, 9], [4, 12], [12, 13]]) b.put(x, y, s0)
  return b
}

// ── Water: arched ripples; a sand rim, a foam line and a deeper band on the land sides ──

const RIPPLE = ['.000.', '0...0']
const RIPPLES = [
  [[1, 2], [9, 6], [4, 10], [12, 13]],
  [[2, 3], [10, 5], [5, 11], [13, 12]],
]
const SHORE = [
  [1, 1, 2, 2, 1, 1, 1, 2, 2, 2, 1, 1, 2, 1, 1, 1],
  [2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 1, 2, 2],
]

function waterTile(mask, f) {
  const [w0, w1, w2] = P.water
  const rim = P.sand[1]
  const b = tile(w1)
  b.wrap = true
  for (const [x, y] of RIPPLES[f]) b.ascii(RIPPLE, { 0: w0 }, x, y)
  b.wrap = false
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let depth = Infinity
      for (const e of openSides(mask, x, y)) depth = Math.min(depth, e.depth - SHORE[f][e.along])
      depth = Math.min(depth, cornerDepth(mask, x, y) - 3)
      if (depth < 0) b.put(x, y, rim)
      else if (depth < 1) b.put(x, y, w0)
      else if (depth < 2) b.put(x, y, w2)
    }
  }
  return b
}

// ── Trees (opaque, the field behind), bush, rock ──

const TREE = [
  '0000333333330000',
  '0033000111113300',
  '0300011111111130',
  '3000111112211213',
  '3011111121111213',
  '3111221111122213',
  '3112111111222223',
  '3211111122112223',
  '3221111221122223',
  '3112222221111223',
  '3111222211122223',
  '0322222222222230',
  '0033322222233300',
  '0000033223300000',
  '0000003223000000',
  '0000033333300000',
]

const TREE_2 = [
  '0000333333330000',
  '0033001111113300',
  '0300111112211130',
  '3001111121111213',
  '3011221111112213',
  '3112111111122213',
  '3111111112222223',
  '3111112211222223',
  '3211122111122223',
  '3221111222211223',
  '3112222211112223',
  '0322222222222230',
  '0033322222233300',
  '0000033223300000',
  '0000003223000000',
  '0000033333300000',
]

const BUSH = [
  '................',
  '................',
  '................',
  '.....333333.....',
  '...3300011133...',
  '..300111121113..',
  '..301111211213..',
  '.30111111112213.',
  '.31122111122213.',
  '.31211112211223.',
  '.31111122112223.',
  '..322222222223..',
  '..332222222233..',
  '....33333333....',
  '................',
  '................',
]

const ROCK = [
  '................',
  '................',
  '................',
  '.....3333333....',
  '....300011123...',
  '...30001111123..',
  '..3001111112123.',
  '..3011111121123.',
  '.30111111211223.',
  '.31111112112223.',
  '.31111121122223.',
  '.32111111222223.',
  '..322222222233..',
  '...3333333333...',
  '................',
  '................',
]

// ── Sign, mailbox ──

const SIGN = [
  '................',
  '................',
  '..333333333333..',
  '.30000000000003.',
  '.31111111111113.',
  '.31222222222213.',
  '.31111111111113.',
  '.31222222222213.',
  '.31111111111113.',
  '.32222222222223.',
  '..333333333333..',
  '......3123......',
  '......3123......',
  '......3123......',
  '.....332233.....',
  '................',
]

const MAILBOX = [
  '................',
  '................',
  '.....333333.....',
  '....30000003.r..',
  '...300000000rr..',
  '...30111111033..',
  '...3011111103...',
  '...3011111103...',
  '...3111111113...',
  '...3333333333...',
  '......3ab3......',
  '......3ab3......',
  '......3ab3......',
  '......3ab3......',
  '.....333333.....',
  '................',
]

// ── Fence: pickets every 8 px, rails toward the connected sides ──

const PICKET = [
  '.33.',
  '3003',
  '3001',
  '3001',
  '3001',
  '3001',
  '3001',
  '3001',
  '3011',
  '3333',
]

function fenceTile(mask) {
  const [f0, f1, , f3] = P.fence
  const b = tile(CLEAR)
  const picket = fromAscii(PICKET, tileColors(P.fence))
  const rail = (x0, x1, y) => {
    b.hline(x0, y - 1, x1 - x0 + 1, f3)
    b.hline(x0, y, x1 - x0 + 1, f0)
    b.hline(x0, y + 1, x1 - x0 + 1, f1)
    b.hline(x0, y + 2, x1 - x0 + 1, f3)
  }
  const vrail = (y0, y1) => {
    b.vline(6, y0, y1 - y0 + 1, f3)
    b.vline(7, y0, y1 - y0 + 1, f0)
    b.vline(8, y0, y1 - y0 + 1, f1)
    b.vline(9, y0, y1 - y0 + 1, f3)
  }
  if (mask & N) vrail(0, 4)
  if (mask & S) vrail(10, 15)
  if (mask & W) { rail(0, 7, 6); rail(0, 7, 10) }
  if (mask & E) { rail(8, 15, 6); rail(8, 15, 10) }
  b.blit(picket, 6, 3)
  if (mask & W) b.blit(picket, -2, 3)
  if (mask & E) b.blit(picket, 14, 3)
  return b
}

// ── Buildings: drawn whole, then sliced into `${prefix}_${col}_${row}` ──

const WINDOW = [
  '3333333333',
  '30BB330BB3',
  '3BBB33BBB3',
  '3BBB33BBB3',
  '3333333333',
  '30BB330BB3',
  '3BBB33BBB3',
  '3333333333',
]

const DOOR = [
  '.222222222.',
  '20000000002',
  '23333333332',
  '23333333332',
  '23333333332',
  '23333333332',
  '23333333332',
  '23333333332',
  '23333333332',
  '23333333332',
  '11111111111',
  '33333333333',
]

const CHIMNEY = [
  '33333333',
  '30000003',
  '32222223',
  '31111123',
  '31111123',
  '32222223',
  '31111123',
  '31111123',
  '32222223',
  '.333333.',
]

/** A 4×3 house: roof (2 rows) and a wall row with the door at `doorCol` */
function house(roof, doorCol) {
  const b = new Bitmap(64, 48)
  const [r0, r1, r2, r3] = roof
  const [w0, w1, w2, w3] = P.wall
  const inset = [3, 1]
  for (let y = 0; y < 32; y++) {
    const i = inset[y] ?? 0
    for (let x = i; x < 64 - i; x++) {
      const cy = (y - 4) % 4
      const end = x < i + 3 || x > 60 - i
      let c = r1
      if (y === 0 || x === i || x === 63 - i) c = r3
      else if (y === 1) c = r0
      else if (y === 2) c = r1
      else if (y === 3) c = r3
      else if (y === 28) c = r0
      else if (y === 29) c = r1
      else if (y >= 30) c = r3
      else if (cy === 2) c = end ? r3 : r2
      else if (cy === 3) c = r3
      else if (end) c = r2
      b.put(x, y, c)
    }
  }
  const mirror = doorCol >= 2
  const at = (x, w) => (mirror ? 64 - x - w : x)
  b.ascii(CHIMNEY, tileColors(roof), at(44, 8), 2)
  for (let y = 32; y < 48; y++) {
    for (let x = 2; x < 62; x++) {
      let c = w0
      if (x === 2 || x === 61 || y === 47 || y === 32) c = w3
      else if (y === 33 || y >= 45 || x === 3 || x === 60) c = w1
      else if ((y - 34) % 3 === 2) c = w1
      b.put(x, y, c)
    }
  }
  const colors = { 0: w0, 1: w1, 2: w2, 3: w3, B: P.glass }
  b.ascii(DOOR, colors, at(18, 11), 35)
  b.ascii(WINDOW, colors, at(5, 10), 35)
  b.ascii(WINDOW, colors, at(39, 10), 35)
  return b
}

/** "LAB" in 3×5 pixel letters on a dark plaque ('o' frame, 'b' plaque, 'L' letters) */
const LAB_PLAQUE = [
  'ooooooooooooooo',
  'obbbbbbbbbbbbbo',
  'obLbbbbLbLLbbbo',
  'obLbbbLbLbLbLbo',
  'obLbbbLLLbLLbbo',
  'obLbbbLbLbLbLbo',
  'obLLLbLbLbLLbbo',
  'obbbbbbbbbbbbbo',
  'ooooooooooooooo',
]

/** Prof Pi's lab, 6×4: flat roof (2 rows) with a vent and an antenna, white walls (2 rows) */
function lab() {
  const b = new Bitmap(96, 64)
  const [r0, r1, r2, r3] = P.labRoof
  const [w0, w1, wg, w3] = P.labWall
  for (let y = 4; y < 32; y++) {
    const i = y === 4 ? 1 : 0
    for (let x = i; x < 96 - i; x++) {
      let c = r1
      if (y === 4 || x === i || x === 95 - i) c = r3
      else if (y === 5) c = r0
      else if (y === 7 || y === 23) c = r2
      else if (y === 24) c = r3
      else if (y === 25) c = r0
      else if (y === 28) c = r2
      else if (y >= 29) c = r3
      else if (y > 7 && y < 23 && x % 16 === 8) c = r2
      if ((x === i + 1 || x === 94 - i) && y > 4 && y < 29) c = r2
      b.put(x, y, c)
    }
  }
  // skylight
  b.frame(26, 10, 22, 10, r3)
  b.rect(27, 11, 20, 8, r0)
  b.vline(36, 11, 8, r3)
  for (let k = 0; k < 4; k++) { b.put(29 + k, 17 - k, r2); b.put(39 + k, 17 - k, r2) }
  b.hline(27, 20, 21, r2)
  // vent unit
  for (let y = 9; y < 20; y++) {
    for (let x = 62; x < 80; x++) {
      let c = (y - 10) % 2 === 0 ? r0 : r2
      if (y === 9 || y === 19 || x === 62 || x === 79) c = r3
      b.put(x, y, c)
    }
  }
  b.hline(63, 20, 17, r2)
  // antenna mast with a dish
  b.ascii([
    '....3....',
    '....3....',
    '.3333333.',
    '.3000003.',
    '..30023..',
    '...333...',
    '....3....',
    '....3....',
    '....3....',
    '....3....',
    '....3....',
    '...333...',
    '..32223..',
  ], { 0: r0, 2: r2, 3: r3 }, 9, 0)
  // walls: cornice shadow, pilasters, sill band, base
  for (let y = 32; y < 64; y++) {
    for (let x = 2; x < 94; x++) {
      let c = w0
      if (x === 2 || x === 93 || y === 63 || y === 32) c = w3
      else if (y === 33 || y >= 60 || y === 50) c = w1
      else if (x === 4 || x === 91 || x === 40 || x === 41) c = w1
      b.put(x, y, c)
    }
  }
  const win = (x0, y0, w, h) => {
    b.frame(x0, y0, w, h, w3)
    b.rect(x0 + 1, y0 + 1, w - 2, h - 2, wg)
    b.hline(x0 + 1, y0 + 4, w - 2, w3)
    for (let x = x0 + 8; x < x0 + w - 1; x += 8) b.vline(x, y0 + 1, h - 2, w3)
    for (let x = x0 + 1; x < x0 + w - 1; x += 8) { b.put(x + 1, y0 + 5, w0); b.put(x + 2, y0 + 5, w0); b.put(x + 1, y0 + 6, w0) }
  }
  win(8, 36, 25, 13)
  win(64, 36, 25, 13)
  // double door with glass leaves
  b.frame(49, 48, 14, 16, w3)
  b.rect(50, 49, 12, 13, wg)
  b.vline(55, 49, 13, w3)
  b.vline(56, 49, 13, w3)
  b.put(51, 50, w0); b.put(51, 51, w0); b.put(58, 50, w0); b.put(58, 51, w0)
  b.hline(49, 62, 14, w1)
  b.hline(49, 63, 14, w3)
  b.ascii(LAB_PLAQUE, { o: w1, b: w3, L: w0 }, 48, 37)
  return b
}

function slice(bitmap, prefix) {
  const out = []
  for (let r = 0; r < bitmap.h / T; r++) {
    for (let c = 0; c < bitmap.w / T; c++) {
      out.push({ out: `${prefix}_${c}_${r}`, bitmap: bitmap.crop(c * T, r * T, T, T), kind: 'tile' })
    }
  }
  return out
}

export function townAssets() {
  const t = (out, bitmap) => ({ out, bitmap, kind: 'tile' })
  const gc = tileColors(G)
  const assets = [
    t('ground/town/grass_1', grass(1)),
    t('ground/town/grass_2', grass(2)),
    t('ground/town/tallgrass', art(TALL_GRASS, gc)),
    t('ground/town/flowers_f1', art(FLOWERS[0], tileColors(P.flower))),
    t('ground/town/flowers_f2', art(FLOWERS[1], tileColors(P.flower))),
    t('ground/town/sand', sand()),
  ]
  for (let m = 0; m < 16; m++) assets.push(t(`ground/town/path_${m}`, pathTile(m)))
  for (let m = 0; m < 16; m++) {
    assets.push(t(`ground/town/water_${m}_f1`, waterTile(m, 0)))
    assets.push(t(`ground/town/water_${m}_f2`, waterTile(m, 1)))
  }
  assets.push(
    t('objects/town/tree', art(TREE, gc)),
    t('objects/town/tree_2', art(TREE_2, gc)),
    t('objects/town/bush', art(BUSH, gc)),
    t('objects/town/rock', art(ROCK, tileColors(P.stone))),
    t('objects/town/sign', art(SIGN, tileColors(P.wood))),
    t('objects/town/mailbox', art(MAILBOX, { ...tileColors(P.fence), r: P.roofRed[2], a: P.wood[1], b: P.wood[2] })),
  )
  for (let m = 0; m < 16; m++) assets.push(t(`objects/town/fence_${m}`, fenceTile(m)))
  assets.push(...slice(house(P.roofRed, 1), 'objects/town/house_red'))
  assets.push(...slice(house(P.roofBlue, 2), 'objects/town/house_blue'))
  assets.push(...slice(lab(), 'objects/town/lab'))
  return assets
}
