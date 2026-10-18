/**
 * The Tower of Code, Game Boy Color style: its base on Bourg-Hello's north edge
 * and its hall (floor 0).
 *
 *   objects/town/tower_<c>_<r>        the facade, 8×6 tiles: stone blocks between two
 *                                     pilasters, two ledges, arched windows, a "</>"
 *                                     plaque over the great door (bottom row, columns 3–4)
 *   objects/town/brazier_f1, _f2      a lit brazier on a stone foot (the flame flickers)
 *   ground/town/plaza                 stone paving in front of the tower
 *   ground/tower/floor_1, floor_2     the hall's big stone tiles (and a variant)
 *   ground/tower/carpet               a purple runner with light edges
 *   objects/tower/wall, wall_window, wall_banner   the hall's back row (opaque)
 *   objects/tower/elevator_l, _r      the elevator's closed doors, in the back row
 *   objects/tower/stairs              stone steps climbing toward the back wall
 *   objects/tower/pillar_top, pillar_bottom   a free-standing column (1×2)
 *   objects/tower/desk_l, desk_m, desk_r      the reception counter
 *
 * GBC rule: at most 4 colours per 8×8 quarter. Windows, the plaque and the door
 * cover whole quarters, so they never share one with the bricks.
 */
import { Bitmap, hex } from '../bitmap.mjs'
import { fromAscii, tileColors } from './palette.mjs'

const T = 16
const pal = (...cs) => cs.map(hex)

export const towerPalettes = {
  stone: pal('#ece8f4', '#b4acc8', '#746c94', '#282038'),
  glass: pal('#f8f8f8', '#a8e0f8', '#5898d8', '#282038'),
  gold: pal('#fff4b0', '#f8d048', '#b07818', '#282038'),
  flame: pal('#fff4b0', '#f8b830', '#e05820', '#282038'),
  floor: pal('#f4f0fa', '#d0c8e0', '#a098bc', '#4c4466'),
  carpet: pal('#e0c8f8', '#a070e0', '#6838a8', '#281848'),
  wood: pal('#f8e0b0', '#d8a060', '#985830', '#402010'),
  metal: pal('#f4f4fa', '#bcc4d4', '#747c94', '#202838'),
}
const P = towerPalettes

function art(rows, colors, w = T, h = T) {
  if (rows.length !== h || rows.some(r => r.length !== w)) {
    const bad = rows.findIndex(r => r.length !== w)
    throw new Error(`art: expected ${w}×${h}, got ${rows.length} rows (row ${bad}: ${rows[bad]?.length})`)
  }
  return fromAscii(rows, colors)
}

function slice(bitmap, prefix) {
  const out = []
  for (let r = 0; r < bitmap.h / T; r++) {
    for (let c = 0; c < bitmap.w / T; c++) out.push({ out: `${prefix}_${c}_${r}`, bitmap: bitmap.crop(c * T, r * T, T, T), kind: 'tile' })
  }
  return out
}

// ── The facade ──

/** A tall window, 8×16: frame, sky glass with a glint (opaque: it fills its quarters) */
const FACADE_WINDOW = [
  '33333333',
  '32222223',
  '32111123',
  '32011123',
  '32011123',
  '32111123',
  '33333333',
  '32111123',
  '32011123',
  '32111123',
  '32111123',
  '32111123',
  '32111123',
  '33333333',
  '30000003',
  '33333333',
]

/** The plaque over the door, 32×16: "</>" in gold on dark stone */
const PLAQUE = [
  '33333333333333333333333333333333',
  '30000000000000000000000000000003',
  '30333333333333333333333333333303',
  '30322222222222222222222222222303',
  '30322222111222222122221112222303',
  '30322221122222221122222112222303',
  '30322211222222211222222211222303',
  '30322112222222112222222221122303',
  '30322211222221122222222211222303',
  '30322221122211222222222112222303',
  '30322222111222222222221112222303',
  '30322222222222222222222222222303',
  '30333333333333333333333333333303',
  '30000000000000000000000000000003',
  '33333333333333333333333333333333',
  '33333333333333333333333333333333',
]

function facade() {
  const W = 128
  const H = 96
  const b = new Bitmap(W, H)
  const [s0, s1, s2, s3] = P.stone
  // Stone blocks: 16×8, every other course shifted by 8; a light top line, dark joints
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const course = Math.floor(y / 8)
      const shift = course % 2 ? 8 : 0
      const inCourse = y % 8
      const joint = inCourse === 7 || (x + shift) % 16 === 15
      b.put(x, y, joint ? s2 : inCourse === 0 ? s0 : s1)
    }
  }
  // Ledges at y = 32 and 64: an outline, a lit top, a shaded underside
  for (const ly of [32, 64]) {
    for (let x = 0; x < W; x++) {
      b.put(x, ly, s3)
      b.put(x, ly + 1, s0)
      b.put(x, ly + 2, s1)
      b.put(x, ly + 3, s2)
    }
  }
  // Pilasters on both edges
  for (let y = 0; y < H; y++) {
    for (const x0 of [0, W - 8]) {
      for (let i = 0; i < 8; i++) b.put(x0 + i, y, i === 0 || i === 7 ? s3 : i === 1 ? s0 : i === 6 ? s2 : s1)
    }
  }
  // Windows: two upper rows, two windows each, plus one each side of the plaque
  const win = fromAscii(FACADE_WINDOW, tileColors(P.glass))
  for (const wx of [24, 48, 72, 96]) b.blit(win, wx, 8)
  for (const wx of [24, 96]) b.blit(win, wx, 40)
  b.blit(fromAscii(PLAQUE, tileColors(P.gold)), 48, 40)
  // The great door (bottom row, columns 3–4): an arch of light voussoirs around a dark way in
  for (let y = 64; y < H; y++) {
    for (let x = 48; x < 80; x++) {
      const dx = x - 63.5
      const dy = y - 76
      const r = Math.hypot(dx, Math.max(0, -dy) * 1.25)
      const inside = Math.abs(dx) < 12 && (dy >= 0 || r < 12)
      const frame = Math.abs(dx) < 16 && (dy >= 0 || r < 16)
      if (inside) b.put(x, y, y >= 92 ? s2 : y >= 88 ? s3 : s3)
      else if (frame) b.put(x, y, (Math.floor((Math.atan2(dy, dx) + Math.PI) * 4) + (dy >= 0 ? Math.floor(y / 4) : 0)) % 2 ? s0 : s1)
    }
  }
  // The way in: a lighter floor at the threshold so it reads as walkable
  for (let y = 90; y < H; y++) for (let x = 52; x < 76; x++) b.put(x, y, y === 90 ? s3 : s2)
  // Plinth along the bottom (not under the door)
  for (let x = 0; x < W; x++) {
    if (x >= 48 && x < 80) continue
    b.put(x, 92, s3)
    b.put(x, 93, s1)
    b.put(x, 94, s2)
    b.put(x, 95, s3)
  }
  return b
}

// ── Brazier: stone foot, iron bowl, flickering flame ──

const BRAZIER = [
  [
    '......1.........',
    '.....121........',
    '.....1221.1.....',
    '....12221121....',
    '....122221221...',
    '...1222232221...',
    '...1223333221...',
    '..333333333333..',
    '...3........3...',
    '....33333333....',
    '.....300003.....',
    '.....311113.....',
    '.....322223.....',
    '.....311113.....',
    '....30000003....',
    '....33333333....',
  ],
  [
    '........1.......',
    '.......121......',
    '.....1.1221.....',
    '....121122221...',
    '...1221222221...',
    '...1222322221...',
    '...1223333221...',
    '..333333333333..',
    '...3........3...',
    '....33333333....',
    '.....300003.....',
    '.....311113.....',
    '.....322223.....',
    '.....311113.....',
    '....30000003....',
    '....33333333....',
  ],
]

function brazier(frame) {
  const rows = BRAZIER[frame]
  const b = new Bitmap(T, T)
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '.') return
    // Flame on top (rows 0–6: red outside, yellow core, dark coals), stone foot below
    const colors = y < 7 ? { 1: P.flame[2], 2: P.flame[1], 3: P.flame[3] } : tileColors(P.stone)
    b.put(x, y, colors[c])
  }))
  return b
}

const PLAZA = [
  '2222222222222222',
  '2000000020000000',
  '2011111120111111',
  '2011111120111111',
  '2011111120111111',
  '2011111120111111',
  '2011111120111111',
  '2222222222222222',
  '0000200000002000',
  '1111201111112011',
  '1111201111112011',
  '1111201111112011',
  '1111201111112011',
  '1111201111112011',
  '1111201111112011',
  '2222222222222222',
]

// ── The hall ──

const FLOOR = [
  '0000000300000003',
  '0111111301111113',
  '0111111301111113',
  '0111111301111113',
  '0111111301111113',
  '0111111301111113',
  '0111111301111113',
  '3333333333333333',
  '0000000300000003',
  '0111111301111113',
  '0111111301111113',
  '0111111301111113',
  '0111111301111113',
  '0111111301111113',
  '0111111301111113',
  '3333333333333333',
]

const FLOOR_2 = [
  '0000000300000003',
  '0111111301111113',
  '0110111301111113',
  '0100011301111113',
  '0110111301111113',
  '0111111301111113',
  '0111111301111113',
  '3333333333333333',
  '0000000300000003',
  '0111111301111123',
  '0111111301111213',
  '0111111301112113',
  '0111111301121113',
  '0111111301111113',
  '0111111301111113',
  '3333333333333333',
]

const CARPET = [
  '0012222222222100',
  '0121111111111210',
  '0121111111111210',
  '0121112222111210',
  '0121121111211210',
  '0121211111121210',
  '0121121111211210',
  '0121112222111210',
  '0121111111111210',
  '0121111111111210',
  '0121112222111210',
  '0121121111211210',
  '0121211111121210',
  '0121121111211210',
  '0121112222111210',
  '0121111111111210',
]

/** The back row: stone with a dark frieze and a lit band */
const WALL = [
  '3333333333333333',
  '2222222222222222',
  '0000000000000000',
  '1111111211111112',
  '1111111211111112',
  '2222222222222222',
  '1112111111121111',
  '1112111111121111',
  '2222222222222222',
  '1111111211111112',
  '1111111211111112',
  '2222222222222222',
  '3333333333333333',
  '0000000000000000',
  '2222222222222222',
  '3333333333333333',
]

const WALL_WINDOW = [
  '3333333333333333',
  '2222222222222222',
  '0333333333333330',
  '03BBBBBBBBBBBB30',
  '03B00BBBBBBBBB30',
  '03B0BBBBBBBBBB30',
  '03BBBBBBBBBBBB30',
  '0333333333333330',
  '03BBBBBBBBBBBB30',
  '03BBBBBBBBBBBB30',
  '0333333333333330',
  '2222222222222222',
  '3333333333333333',
  '0000000000000000',
  '2222222222222222',
  '3333333333333333',
]

const WALL_BANNER = [
  '3333333333333333',
  '3333333333333333',
  '2223PPPPPPPP3222',
  '2223PPPPPPPP3222',
  '2223PPGGGGPP3222',
  '2223PGPPPPGP3222',
  '2223PGPPPPGP3222',
  '2223PPGGGGPP3222',
  '2223PPPPPPPP3222',
  '2223PPPPPPPP3222',
  '2223PPPPPPPP3222',
  '22223PP33PP32222',
  '222223P33P322222',
  '2222223223222222',
  '2222222222222222',
  '3333333333333333',
]

/** The elevator's doors (left half; the right half is its mirror): brushed metal, a gold arrow lamp */
const ELEVATOR_L = [
  '3333333333333333',
  '3222222222222222',
  '3233333333333333',
  '3231111111111111',
  '323111111111111G',
  '32311111111111GG',
  '323111111111111G',
  '3231111111111111',
  '3230000000000003',
  '3231111111111113',
  '3231111111111113',
  '3231111111111113',
  '3231111111111113',
  '3231111111111113',
  '3233333333333333',
  '3333333333333333',
]

const STAIRS = [
  '3333333333333333',
  '3222222222222223',
  '3200000000000023',
  '3233333333333323',
  '3211111111111123',
  '3200000000000023',
  '3233333333333323',
  '3211111111111123',
  '3200000000000023',
  '3233333333333323',
  '3211111111111123',
  '3200000000000023',
  '3233333333333323',
  '3211111111111123',
  '3200000000000023',
  '3233333333333323',
]

const PILLAR_TOP = [
  '..333333333333..',
  '..300000000003..',
  '..322222222223..',
  '...3333333333...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
]

const PILLAR_BOTTOM = [
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '...3011111223...',
  '..333333333333..',
  '..300000000003..',
  '..311111111223..',
  '..322222222223..',
  '..333333333333..',
  '................',
  '................',
]

/** The reception counter: a wooden top (upper half), a purple front with a gold edge (lower half) */
function deskRows(part) {
  const left = part === 'l'
  const right = part === 'r'
  const rows = []
  for (let y = 0; y < T; y++) {
    let row = ''
    for (let x = 0; x < T; x++) {
      let c
      if (y === 0 || y === 7 || y === T - 1 || (left && x === 0) || (right && x === T - 1)) c = '3'
      else if (y <= 4) c = '0'
      else if (y === 5) c = '1'
      else if (y === 6) c = '2'
      else if (y === 8) c = 'g'
      else if (y === 9 || y === 14) c = 'q'
      else c = 'P'
      row += c
    }
    rows.push(row)
  }
  return rows
}

export function towerAssets() {
  const t = (out, bitmap) => ({ out, bitmap, kind: 'tile' })
  const stone = tileColors(P.stone)
  const deskColors = { ...tileColors(P.wood), g: P.gold[1], P: P.carpet[1], q: P.carpet[2] }
  const elevatorL = art(ELEVATOR_L, { ...tileColors(P.metal), G: P.gold[1] })
  return [
    ...slice(facade(), 'objects/town/tower'),
    t('objects/town/brazier_f1', brazier(0)),
    t('objects/town/brazier_f2', brazier(1)),
    t('ground/town/plaza', art(PLAZA, stone)),
    t('ground/tower/floor_1', art(FLOOR, tileColors(P.floor))),
    t('ground/tower/floor_2', art(FLOOR_2, tileColors(P.floor))),
    t('ground/tower/carpet', art(CARPET, { ...tileColors(P.carpet), 0: P.floor[1] })),
    t('objects/tower/wall', art(WALL, stone)),
    t('objects/tower/wall_window', art(WALL_WINDOW, { ...stone, B: P.glass[1] })),
    t('objects/tower/wall_banner', art(WALL_BANNER, { ...stone, P: P.carpet[1], G: P.gold[1] })),
    t('objects/tower/elevator_l', elevatorL),
    t('objects/tower/elevator_r', elevatorL.mirrorX()),
    t('objects/tower/stairs', art(STAIRS, stone)),
    t('objects/tower/pillar_top', art(PILLAR_TOP, stone)),
    t('objects/tower/pillar_bottom', art(PILLAR_BOTTOM, stone)),
    t('objects/tower/desk_l', art(deskRows('l'), deskColors)),
    t('objects/tower/desk_m', art(deskRows('m'), deskColors)),
    t('objects/tower/desk_r', art(deskRows('r'), deskColors)),
  ]
}
