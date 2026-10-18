/**
 * Interiors, Game Boy Color style (Gold/Silver/Crystal): the player's house (2
 * floors), the rival's house and Prof Pi's lab.
 *
 *   ground/indoor/wood, wood_2          plank floor (and a variant)
 *   ground/indoor/mat                   the exit mat, on the planks
 *   ground/indoor/rug_<c>_<r>           a 2×2 rug
 *   ground/lab/floor_1, floor_2, mat    white tiles (and a variant), the lab's exit mat
 *   objects/indoor/wall, wall_window, wall_poster, objects/lab/wall, wall_window
 *                                       the room's back row (opaque)
 *   objects/indoor/bed_top + bed_bottom, shelf_top + shelf_bottom, fridge_top +
 *   fridge_bottom, objects/lab/shelf_top + shelf_bottom
 *                                       1×2 pieces: the top tile stands in the wall
 *                                       row and is opaque (fridge, shelves)
 *   objects/indoor/pc, tv, console, plant, chair, table_<c>_<r> (2×2), stairs_up,
 *   stairs_down, sink, stove, counter
 *   objects/lab/machine_<c>_<r> (2×2, its top row in the wall row), table_0..2 (the
 *   Codé-Balls are sprites on it), desk, plant
 *
 * Free-standing furniture is transparent around its outline, so the floor shows.
 * GBC rule: at most 4 colours per 8×8 quarter, planned per piece (e.g. the window
 * and poster frames span x = 1..14 so the wallpaper stripes never sit beside them).
 */
import { Bitmap, hex } from '../bitmap.mjs'
import { BG, fromAscii, tileColors } from './palette.mjs'

const T = 16
const pal = (...cs) => cs.map(hex)

export const indoorPalettes = {
  floor: pal('#f8f0d0', '#e8d098', '#d0a868', '#987040'),
  wall: pal('#f0f0e8', '#d0d8e0', '#b08048', '#584028'),
  mat: pal('#f8b890', '#e86840', '#b03020', '#581810'),
  rug: BG.carpetBlue,
  labFloor: pal('#f8f8f8', '#d0d8e8', '#a0a8c0', '#687080'),
  labWall: pal('#f8f8f8', '#d0d8e0', '#58a0a0', '#203838'),
  glass: hex('#a8d8f8'),
  white: pal('#f8f8f8', '#d0d0d8', '#9098a8', '#283038'),
  wood: BG.wood,
  metal: pal('#f0f0f0', '#b8c0c8', '#788088', '#202830'),
  screen: pal('#b0f8d8', '#48c890', '#106040', '#082818'),
  leaf: pal('#a8e070', '#58b048', '#286828', '#183018'),
  pot: pal('#f0a070', '#c86040', '#803020', '#183018'),
  blanket: pal('#b0c8f8', '#6080e0', '#3048a8', '#182050'),
  tv: pal('#e8f0f8', '#a0c0e0', '#585870', '#181820'),
  books: { r: hex('#e05040'), b: hex('#5080d8'), g: hex('#48a048'), y: hex('#e8c040'), p: hex('#a060c0') },
}
const P = indoorPalettes

function art(rows, colors, w = T, h = T) {
  if (rows.length !== h || rows.some(r => r.length !== w)) {
    const bad = rows.findIndex(r => r.length !== w)
    throw new Error(`art: expected ${w}×${h}, got ${rows.length} rows (row ${bad}: ${rows[bad]?.length})`)
  }
  return fromAscii(rows, colors)
}

function slice(bitmap, name) {
  const out = []
  for (let r = 0; r < bitmap.h / T; r++) {
    for (let c = 0; c < bitmap.w / T; c++) out.push({ out: name(c, r), bitmap: bitmap.crop(c * T, r * T, T, T), kind: 'tile' })
  }
  return out
}

const rep = (s, n) => s.repeat(n)

// ── Floors ──

const WOOD = [
  '0000020000000000',
  '1111121111111111',
  '1111121111111111',
  '2222222222222222',
  '0000000000000200',
  '1111111111111201',
  '1111111111111211',
  '2222222222222222',
  '0000000002000000',
  '1111111112011111',
  '1111111112111111',
  '2222222222222222',
  '0200000000000000',
  '1201111111111111',
  '1211111111111111',
  '2222222222222222',
]

const WOOD_2 = [
  '0000000000200000',
  '1111111111201111',
  '1111111111211111',
  '2222222222222222',
  '0020000000000000',
  '1120111111111111',
  '1121111111111111',
  '2222222222222222',
  '0000000000000020',
  '1111211111111120',
  '1112321111111121',
  '2222222222222222',
  '0000002000000000',
  '1111112011111111',
  '1111112111111111',
  '2222222222222222',
]

/** The exit mat: a ribbed red mat lying on the planks (2 reds + 2 floor tones per 8×8) */
function mat() {
  const [, f1, f2] = P.floor
  const [, r, d] = P.mat
  const b = art(WOOD.map(row => row.replace(/0/g, '1')), { 1: f1, 2: f2 })
  for (let y = 1; y <= 13; y++) {
    for (let x = 1; x <= 14; x++) {
      const ring = Math.min(x - 1, y - 1, 14 - x, 13 - y)
      b.put(x, y, ring === 0 ? d : ring === 1 ? r : y % 2 ? d : r)
    }
  }
  return b
}

/** The lab's exit mat: the same ribbed mat filling the whole tile (it sits on white tiles) */
const LAB_MAT = [
  '3333333333333333',
  '3000000000000003',
  '3011111111111103',
  '3012222222222103',
  '3011111111111103',
  '3012222222222103',
  '3011111111111103',
  '3012222222222103',
  '3011111111111103',
  '3012222222222103',
  '3011111111111103',
  '3012222222222103',
  '3011111111111103',
  '3000000000000003',
  '3222222222222223',
  '3333333333333333',
]

/** A 2×2 rug: a dark edge, a dotted border and a medallion in the middle */
function rug() {
  const b = new Bitmap(32, 32)
  const [r0, r1, r2, r3] = P.rug
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const ring = Math.min(x, y, 31 - x, 31 - y)
      let c = ring === 0 ? r3 : r1
      if (ring === 7) c = r2
      if (ring > 7) {
        const d = Math.abs(x - 15.5) + Math.abs(y - 15.5)
        c = d < 3 ? r0 : d < 4 ? r2 : d < 6 ? r1 : d < 7 ? r0 : r1
      }
      if (ring === 3 && (x + y) % 4 === 0) c = r3
      b.put(x, y, c)
    }
  }
  return b
}

const LAB_FLOOR = [
  '0000000211111112',
  '0000000210011112',
  '0000000210111112',
  '0000000211111112',
  '0000000211111112',
  '0000000211111112',
  '0000001211111112',
  '2222222222222222',
  '1111111200000002',
  '1001111200000002',
  '1011111200000002',
  '1111111200000002',
  '1111111200000002',
  '1111111200000002',
  '1111111200000012',
  '2222222222222222',
]

const LAB_FLOOR_2 = [
  '0000000211111112',
  '0000000210011112',
  '0000000210111112',
  '0000000211111112',
  '0000000211111112',
  '0000000211111112',
  '0000001211111112',
  '2222222222222222',
  '1111111200000002',
  '1001111200000002',
  '1011111200000002',
  '1111111200001002',
  '1111111200010002',
  '1111111200100002',
  '1111111200000012',
  '2222222222222222',
]

// ── Walls (the room's back row): striped wallpaper over a wooden skirting ──
// Window and poster frames span x = 1..14, so the stripes (x = 1, 5, 9, 13) never
// show beside them: that keeps those tiles within 4 colours per 8×8.

const WALL = [
  '3333333333333333',
  '2222222222222222',
  ...Array(9).fill('0100010001000100'),
  '3333333333333333',
  '2222222222222222',
  '2222222222222222',
  '2222222222222222',
  '3333333333333333',
]

const WALL_WINDOW = [
  '3333333333333333',
  '2222222222222222',
  '0333333333333330',
  '03B0BBB33B0BBB30',
  '030BBBB330BBBB30',
  '03BBBBB33BBBBB30',
  '03BBBBB33BBBBB30',
  '0333333333333330',
  '03BBBBB33BBBBB30',
  '03BBBBB33BBBBB30',
  '0333333333333330',
  '3333333333333333',
  '2222222222222222',
  '2222222222222222',
  '2222222222222222',
  '3333333333333333',
]

/** A poster of a little Codémon */
const WALL_POSTER = [
  '3333333333333333',
  '2222222222222222',
  '0333333333333330',
  '0300000000000030',
  '0300X000000X0030',
  '0300XX0000XX0030',
  '0300XXXXXXXX0030',
  '030XX3XXXX3XX030',
  '030XXXXXXXXXX030',
  '0300XXX33XXX0030',
  '0333333333333330',
  '3333333333333333',
  '2222222222222222',
  '2222222222222222',
  '2222222222222222',
  '3333333333333333',
]

const LAB_WALL = [
  '3333333333333333',
  '1111111111111111',
  ...Array(9).fill('0001000000010000'),
  '3333333333333333',
  '2222222222222222',
  '2222222222222222',
  '2222222222222222',
  '3333333333333333',
]

const LAB_WALL_WINDOW = [
  '3333333333333333',
  '1111111111111111',
  '0333333333333330',
  '03B00BBBBBB00B30',
  '030BBBBBBBB0BB30',
  ...Array(5).fill('03BBBBBBBBBBBB30'),
  '0333333333333330',
  '3333333333333333',
  '2222222222222222',
  '2222222222222222',
  '2222222222222222',
  '3333333333333333',
]

// ── Bedroom ──

const BED_TOP = [
  '..333333333333..',
  '.32222222222223.',
  '.32323232323223.',
  '.33333333333333.',
  '.3wwwwwwwwwwww3.',
  '.3wggggggggggw3.',
  '.3gwwwwwwwwwwg3.',
  '.3gwwwwwwwwwwg3.',
  '.3gwwwwwwwwwwg3.',
  '.3wggggggggggw3.',
  '.3wwwwwwwwwwww3.',
  '.3wwwwwwwwwwww3.',
  '.3gggggggggggg3.',
  '.3BBBBBBBBBBBB3.',
  '.3BBBBBBBBBBBB3.',
  '.3BBBBBBBBBBBB3.',
]

const BED_BOTTOM = [
  '.3bbbbBBBBbbbb3.',
  '.3bbbbBBBBbbbb3.',
  '.3bbbbBBBBbbbb3.',
  '.3BBBBbbbbBBBB3.',
  '.3BBBBbbbbBBBB3.',
  '.3BBBBbbbbBBBB3.',
  '.3bbbbBBBBbbbb3.',
  '.3bbbbBBBBbbbb3.',
  '.3DBBBBBBBBBBD3.',
  '.3DBBBBBBBBBBD3.',
  '.3DDDDDDDDDDDD3.',
  '.33333333333333.',
  '.32222222222223.',
  '.32323232323223.',
  '.33333333333333.',
  '..3..........3..',
]

/** Desk with a CRT monitor showing lines of code */
const PC = [
  '..333333333333..',
  '..311111111113..',
  '..31ssssssss13..',
  '..31sggggsss13..',
  '..31ssssggsg13..',
  '..31sgggssss13..',
  '..31ssssssss13..',
  '..311111111113..',
  '..3333311333333.',
  '3333333113333333',
  '3000000000000003',
  '3222222222222223',
  '3233333333333323',
  '3232222322222323',
  '3233333333333323',
  '33.3........3.33',
]

const TV = [
  '................',
  '....3......3....',
  '.....3....3.....',
  '.33333333333333.',
  '.32222222222223.',
  '.32333333332223.',
  '.323l0000032l23.',
  '.3230l000032223.',
  '.32300000032l23.',
  '.32300000032223.',
  '.32333333332223.',
  '.32222222222223.',
  '.33333333333333.',
  '..322222222223..',
  '..323333333323..',
  '..33........33..',
]

const CONSOLE = [
  '................',
  '................',
  '................',
  '..33333333333...',
  '..30003330003...',
  '..30000000003...',
  '..3r000000113...',
  '..31111111113...',
  '...333333333....',
  '.......3........',
  '........3.......',
  '.....333333.....',
  '....30000003....',
  '....3r0000b3....',
  '....33333333....',
  '................',
]

const PLANT = [
  '.......33.......',
  '......3013......',
  '..33..3013..33..',
  '.3013.3113.3103.',
  '.30113311331123.',
  '..3011312131123.',
  '..31121311312113',
  '.3111223111223..',
  '..3332222222333.',
  '.....3322233....',
  '....3pppppp3....',
  '....3pqqqqq3....',
  '.....3pqqqp3....',
  '.....3pqqqq3....',
  '.....3pqqqq3....',
  '......333333....',
]

// ── Bookshelf, table, stool, stairs ──

const SHELF_TOP = [
  '3333333333333333',
  '3222222222222223',
  '3233333333333323',
  '32rr33rrgg33gg23',
  '32rrbbrrggyygg23',
  '32rrbbrrggyygg23',
  '32rrbbrrggyygg23',
  '32rrbbrrggyygg23',
  '3222222222222223',
  '3233333333333323',
  '32yy33yypp33pp23',
  '32yybbyypprrpp23',
  '32yybbyypprrpp23',
  '32yybbyypprrpp23',
  '32yybbyypprrpp23',
  '3222222222222223',
]

const SHELF_BOTTOM = [
  '3233333333333323',
  '32gg33ggbb33bb23',
  '32ggrrggbbyybb23',
  '32ggrrggbbyybb23',
  '32ggrrggbbyybb23',
  '32ggrrggbbyybb23',
  '3222222222222223',
  '3222222222222223',
  '3233333333333323',
  '3232222332222323',
  '3232112332112323',
  '3232222332222323',
  '3233333333333323',
  '3222222222222223',
  '3333333333333333',
  '.3............3.',
]

const TABLE = [
  rep('.', 32),
  rep('.', 32),
  rep('.', 32),
  '..' + rep('3', 28) + '..',
  '.3' + rep('0', 28) + '3.',
  ...[0, 1, 2, 3].flatMap(() => ['.3' + rep('1', 28) + '3.', '.3' + rep('1', 28) + '3.', '.3' + rep('1', 28) + '3.', '.3' + rep('2', 28) + '3.']).slice(0, 15),
  '.' + rep('3', 30) + '.',
  '.3' + rep('2', 28) + '3.',
  '.' + rep('3', 30) + '.',
  ...Array(4).fill('..3223' + rep('.', 20) + '3223..'),
  '..3333' + rep('.', 20) + '3333..',
  rep('.', 32),
  rep('.', 32),
  rep('.', 32),
  rep('.', 32),
]

const STOOL = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....33333333....',
  '...3000000003...',
  '...3011111103...',
  '...3111111113...',
  '...3222222223...',
  '....33333333....',
  '....32....23....',
  '....32....23....',
  '....32333323....',
  '....32....23....',
  '....33....33....',
]

/** Steps climbing toward the wall: lit treads, shaded risers, a dark landing at the top */
const STAIRS_UP = [
  '3333333333333333',
  '3233333333333323',
  '3200000000000023',
  '3222222222222223',
  '3233333333333323',
  '3200000000000023',
  '3211111111111123',
  '3222222222222223',
  '3233333333333323',
  '3200000000000023',
  '3211111111111123',
  '3222222222222223',
  '3233333333333323',
  '3200000000000023',
  '3211111111111123',
  '3222222222222223',
]

/** Steps going down into the dark: each one lower and darker than the one before */
const STAIRS_DOWN = [
  '3333333333333333',
  '3333333333333333',
  '3333322222233333',
  '3333333333333333',
  '3333111111113333',
  '3333222222223333',
  '3333333333333333',
  '3330000000000333',
  '3331111111111333',
  '3332222222222333',
  '3333333333333333',
  '2300000000000032',
  '2300000000000032',
  '2311111111111132',
  '2322222222222232',
  '2333333333333332',
]

// ── Kitchen ──

const COUNTER = [
  '3333333333333333',
  '0000000000000000',
  '0000000000000000',
  '1111111111111111',
  '3333333333333333',
  '2222222222222222',
  '2333333333333332',
  '2322222232222232',
  '2322222232222232',
  '2322223232322232',
  '2322222232222232',
  '2322222232222232',
  '2333333333333332',
  '2222222222222222',
  '3333333333333333',
  '3333333333333333',
]

const SINK = [
  '3333333333333333',
  '0000000330000000',
  '0003333333333000',
  '1131111111111311',
  '3332222222222333',
  '2222222222222222',
  '2333333333333332',
  '2322222232222232',
  '2322222232222232',
  '2322223232322232',
  '2322222232222232',
  '2322222232222232',
  '2333333333333332',
  '2222222222222222',
  '3333333333333333',
  '3333333333333333',
]

const STOVE = [
  '3333333333333333',
  '0033300000333000',
  '0300030003000300',
  '1033301110333011',
  '3333333333333333',
  '2222222222222222',
  '2303030303030302',
  '2222222222222222',
  '2333333333333332',
  '2311111111111132',
  '2313333333333132',
  '2313333333333132',
  '2311111111111132',
  '2333333333333332',
  '3333333333333333',
  '3333333333333333',
]

const FRIDGE_TOP = [
  '3333333333333333',
  '3000000000000013',
  '3000000000000113',
  '3000000000000113',
  '3000000000000113',
  '3000000000030113',
  '3000000000030113',
  '3000000000030113',
  '3000000000000113',
  '3111111111111113',
  '3333333333333333',
  '3000000000000013',
  '3000000000000113',
  '3000000000030113',
  '3000000000030113',
  '3000000000030113',
]

const FRIDGE_BOTTOM = [
  '3000000000030113',
  '3000000000030113',
  '3000000000030113',
  '3000000000000113',
  '3000000000000113',
  '3000000000000113',
  '3000000000000113',
  '3000000000000113',
  '3000000000000113',
  '3111111111111113',
  '3222222222222223',
  '3333333333333333',
  '.3............3.',
  '................',
  '................',
  '................',
]

// ── Lab ──

/** The big research computer, 2×2: a screen of graphs, red and green lamps, a control panel, vents */
function machineRows() {
  const screen = ['sssssssssssssssss', 'sggggggsssggggsss', 'sssssssssssssssss', 'sggggssggggggssss', 'sssssssssssssssss', 'sgggggggssgggssss', 'sssssssssssssssss', 'sggssggggggssssss', 'sssssssssssssssss']
  const lamps = ['rr1rr', 'rr1rr', '11111', '11111', 'gg1gg', 'gg1gg', '11111', 'gg1gg', 'gg1gg']
  const casing = '3' + rep('1', 30) + '3'
  const frame = '31' + rep('3', 19) + rep('1', 10) + '3'
  return [
    rep('3', 32), casing, casing, frame,
    ...screen.map((s, i) => `313${s}3111${lamps[i]}113`),
    frame, casing, casing, casing,
    '31' + rep('3', 12) + '1' + '3333' + rep('1', 5) + '333333' + '13',
    '313rr3rr3yy3y3' + '1' + '3003' + rep('1', 5) + '3g3g3g' + '13',
    '31' + rep('3', 12) + '1' + '3333' + rep('1', 5) + '333333' + '13',
    casing,
    ...[3, 2, 3, 2, 3].map(c => '31' + rep(String(c), 28) + '13'),
    casing, '3' + rep('2', 30) + '3', rep('3', 32),
    '.3333' + rep('.', 22) + '3333.',
    rep('.', 32), rep('.', 32),
  ]
}

/** The 3-tile table the Codé-Balls rest on (only the surface: the balls are sprites) */
function labTableRows() {
  return [
    rep('.', 48), rep('.', 48), rep('.', 48),
    '.' + rep('3', 46) + '.',
    '3' + rep('0', 46) + '3',
    ...Array(5).fill('3' + rep('1', 46) + '3'),
    '3' + rep('0', 46) + '3',
    rep('3', 48),
    '3' + rep('t', 46) + '3',
    '3' + rep('t', 46) + '3',
    rep('3', 48),
    '.3t3' + rep('.', 40) + '3t3.',
  ]
}

const DESK = [
  '................',
  '...3333.........',
  '..3wwww3..3333..',
  '..3w333w3.3rr3..',
  '..3wwwww3.3rr3..',
  '3333333333333333',
  '3000000000000003',
  '3111111111111113',
  '3333333333333333',
  '3222222322222223',
  '3233332323333323',
  '3222222322222223',
  '3233332323333323',
  '3222222322222223',
  '3333333333333333',
  '33............33',
]

const LAB_SHELF_TOP = [
  '3333333333333333',
  '3111111111111113',
  '3133333333333313',
  '31bb3bb3rr3rr313',
  '31bb3bb3rr3rr313',
  '31wb3wb3wr3wr313',
  '31bb3bb3rr3rr313',
  '31bb3bb3rr3rr313',
  '3111111111111113',
  '3133333333333313',
  '31yy3yy3gg3gg313',
  '31wy3wy3wg3wg313',
  '31yy3yy3gg3gg313',
  '31yy3yy3gg3gg313',
  '31yy3yy3gg3gg313',
  '3111111111111113',
]

const LAB_SHELF_BOTTOM = [
  '3133333333333313',
  '31gg3gg3bb3bb313',
  '31wg3wg3wb3wb313',
  '31gg3gg3bb3bb313',
  '31gg3gg3bb3bb313',
  '31gg3gg3bb3bb313',
  '3111111111111113',
  '3333333333333333',
  '3122222232222213',
  '3121111232111213',
  '3121111232111213',
  '3122222232222213',
  '3111111111111113',
  '3333333333333333',
  '.3............3.',
  '................',
]

const LAB_PLANT = [
  '.......3........',
  '......303.......',
  '...33.3013.33...',
  '..3013.313.3103.',
  '..30113.3.31103.',
  '...30113311103..',
  '.33.3112112113..',
  '3013.31121123.33',
  '3223322222233223',
  '.322232222232223',
  '..33322222233333',
  '....3wwwwwwww3..',
  '....3wkkkkkkw3..',
  '.....3wkkkkw3...',
  '.....3wkkkkw3...',
  '......333333....',
]

export function indoorAssets() {
  const t = (out, bitmap) => ({ out, bitmap, kind: 'tile' })
  const floor = tileColors(P.floor)
  const wood = tileColors(P.wood)
  const B = P.books
  const assets = [
    t('ground/indoor/wood', art(WOOD, floor)),
    t('ground/indoor/wood_2', art(WOOD_2, floor)),
    t('ground/indoor/mat', mat()),
    ...slice(rug(), (c, r) => `ground/indoor/rug_${c}_${r}`),
    t('ground/lab/floor_1', art(LAB_FLOOR, tileColors(P.labFloor))),
    t('ground/lab/floor_2', art(LAB_FLOOR_2, tileColors(P.labFloor))),
    t('ground/lab/mat', art(LAB_MAT, tileColors(P.mat))),
    t('objects/indoor/wall', art(WALL, tileColors(P.wall))),
    t('objects/indoor/wall_window', art(WALL_WINDOW, { ...tileColors(P.wall), B: P.glass })),
    t('objects/indoor/wall_poster', art(WALL_POSTER, { ...tileColors(P.wall), X: hex('#e86838') })),
    t('objects/lab/wall', art(LAB_WALL, tileColors(P.labWall))),
    t('objects/lab/wall_window', art(LAB_WALL_WINDOW, { ...tileColors(P.labWall), B: P.glass })),
  ]
  const bedColors = { ...wood, w: P.white[0], g: P.white[1], b: P.blanket[0], B: P.blanket[1], D: P.blanket[2] }
  assets.push(
    t('objects/indoor/bed_top', art(BED_TOP, bedColors)),
    t('objects/indoor/bed_bottom', art(BED_BOTTOM, bedColors)),
    t('objects/indoor/pc', art(PC, { ...wood, 1: P.white[1], s: P.screen[2], g: P.screen[0] })),
    t('objects/indoor/tv', art(TV, { 0: P.tv[1], 2: P.tv[2], 3: P.tv[3], l: P.tv[0] })),
    t('objects/indoor/console', art(CONSOLE, { 0: P.white[1], 1: P.white[2], 3: P.white[3], r: B.r, b: B.b })),
    t('objects/indoor/plant', art(PLANT, { ...tileColors(P.leaf), p: P.pot[1], q: P.pot[2] })),
    t('objects/indoor/shelf_top', art(SHELF_TOP, { ...wood, ...B })),
    t('objects/indoor/shelf_bottom', art(SHELF_BOTTOM, { ...wood, ...B })),
    ...slice(art(TABLE, wood, 32, 32), (c, r) => `objects/indoor/table_${c}_${r}`),
    t('objects/indoor/chair', art(STOOL, wood)),
    t('objects/indoor/stairs_up', art(STAIRS_UP, wood)),
    t('objects/indoor/stairs_down', art(STAIRS_DOWN, wood)),
    t('objects/indoor/counter', art(COUNTER, { 0: P.white[0], 1: P.white[1], 2: P.wood[1], 3: P.wood[3] })),
    t('objects/indoor/sink', art(SINK, { 0: P.white[0], 1: P.white[1], 2: P.wood[1], 3: P.wood[3] })),
    t('objects/indoor/stove', art(STOVE, { 0: P.white[0], 1: P.white[1], 2: P.white[0], 3: P.white[3] })),
    t('objects/indoor/fridge_top', art(FRIDGE_TOP, tileColors(P.white))),
    t('objects/indoor/fridge_bottom', art(FRIDGE_BOTTOM, tileColors(P.white))),
  )
  const machine = art(machineRows(), { ...tileColors(P.metal), s: P.screen[2], g: P.screen[0], r: B.r, y: B.y }, 32, 32)
  assets.push(
    ...slice(machine, (c, r) => `objects/lab/machine_${c}_${r}`),
    ...slice(art(labTableRows(), { ...tileColors(P.white), t: P.labWall[2] }, 48, 16), c => `objects/lab/table_${c}`),
    t('objects/lab/desk', art(DESK, { ...wood, w: P.white[0], r: B.r })),
    t('objects/lab/shelf_top', art(LAB_SHELF_TOP, { ...tileColors(P.metal), ...B, w: P.white[0] })),
    t('objects/lab/shelf_bottom', art(LAB_SHELF_BOTTOM, { ...tileColors(P.metal), ...B, w: P.white[0] })),
    t('objects/lab/plant', art(LAB_PLANT, { ...tileColors(P.leaf), w: P.white[0], k: P.white[1] })),
  )
  return assets
}
