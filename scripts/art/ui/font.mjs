/**
 * The interface font: proportional, 1-px strokes with a baked 1-px shadow (right,
 * below and below-right), drawn at 1× in 16×16 cells (the game doubles it).
 *
 * Vertical layout of a cell (rows 0–15):
 *   0–1   accents on capitals          3–11  capitals, digits, ascenders (9 rows)
 *   3–4   accents on lowercase         6–11  lowercase x-height (6 rows)
 *   12–14 descenders                   15    the descenders' shadow
 * The baseline is under row 11. Glyphs are listed as [top row, rows joined by "/",
 * advance?]: '#' = ink. The advance defaults to ink width + 2 (the shadow column,
 * then a 1-px gap). Accented letters are built from their base and a mark.
 *
 * Outputs (scripts/draw-art.mjs writes them):
 *   src/assets/ui/ui-font.png       light ink (most text)
 *   src/assets/ui/ui-font-gold.png  gold ink (selected menu rows, highlights)
 *   src/assets/ui/ui-font-dim.png   muted ink (unknown entries, hints)
 *   src/assets/ui/ui-font-dark.png  dark ink, no shadow (on light tags and pills)
 *   src/assets/ui/ui-font.json      metrics: { cell, lineHeight, glyphs: { ch: [x, y, w, advance] } }
 *   src/assets/ui/ui-font.ttf       the same glyphs for the HTML screens (ink only)
 */
import { Bitmap } from '../bitmap.mjs'
import { UI_CHARS, UI_COLUMNS } from '../../../src/ui/kit/glyphs.ts'
import { CL } from './palette.mjs'
import { buildTtf } from './ttf.mjs'

export const CELL = 16
const BASELINE_ROW = 11

// prettier-ignore
const BASE = {
  ' ': [0, '', 4],
  '!': [3, '#/#/#/#/#/#/#/./#'],
  '"': [3, '#.#/#.#/#.#'],
  '#': [4, '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.'],
  '$': [2, '..#../.###./#.#.#/#.#../#.#../.###./..#.#/..#.#/#.#.#/.###./..#..'],
  '%': [3, '##..#/##..#/...#./...#./..#../.#.../.#.../#..##/#..##'],
  '&': [3, '.##../#..#./#..#./.##../.#.../#.#.#/#..#./#..#./.##.#'],
  "'": [3, '#/#/#'],
  '(': [3, '..#/.#./.#./#../#../#../#../#../.#./.#./..#'],
  ')': [3, '#../.#./.#./..#/..#/..#/..#/..#/.#./.#./#..'],
  '*': [4, '..#../#.#.#/.###./#.#.#/..#..'],
  '+': [5, '..#../..#../#####/..#../..#..'],
  ',': [10, '.#/.#/#.'],
  '-': [8, '####'],
  '.': [11, '#'],
  '/': [3, '....#/....#/...#./...#./..#../.#.../.#.../#..../#....'],
  '0': [3, '.###./#...#/#...#/#..##/#.#.#/##..#/#...#/#...#/.###.'],
  '1': [3, '..#../.##../#.#../..#../..#../..#../..#../..#../#####'],
  '2': [3, '.###./#...#/....#/....#/...#./..#../.#.../#..../#####'],
  '3': [3, '.###./#...#/....#/....#/..##./....#/....#/#...#/.###.'],
  '4': [3, '...#./..##./.#.#./#..#./#..#./#####/...#./...#./...#.'],
  '5': [3, '#####/#..../#..../####./....#/....#/....#/#...#/.###.'],
  '6': [3, '.###./#...#/#..../#..../####./#...#/#...#/#...#/.###.'],
  '7': [3, '#####/....#/....#/...#./...#./..#../..#../..#../..#..'],
  '8': [3, '.###./#...#/#...#/#...#/.###./#...#/#...#/#...#/.###.'],
  '9': [3, '.###./#...#/#...#/#...#/.####/....#/....#/#...#/.###.'],
  ':': [7, '#/./././#'],
  ';': [7, '.#/../../../.#/#.'],
  '<': [4, '...#/..#./.#../#.../.#../..#./...#'],
  '=': [6, '#####/...../#####'],
  '>': [4, '#.../.#../..#./...#/..#./.#../#...'],
  '?': [3, '.###./#...#/....#/....#/...#./..#../..#../...../..#..'],
  '@': [3, '..###../.#...#./#..##.#/#.#.#.#/#.#.#.#/#.#.#.#/#..##../.#...../..####.'],
  'A': [3, '.###./#...#/#...#/#...#/#####/#...#/#...#/#...#/#...#'],
  'B': [3, '####./#...#/#...#/#...#/####./#...#/#...#/#...#/####.'],
  'C': [3, '.###./#...#/#..../#..../#..../#..../#..../#...#/.###.'],
  'D': [3, '###../#..#./#...#/#...#/#...#/#...#/#...#/#..#./###..'],
  'E': [3, '#####/#..../#..../#..../####./#..../#..../#..../#####'],
  'F': [3, '#####/#..../#..../#..../####./#..../#..../#..../#....'],
  'G': [3, '.###./#...#/#..../#..../#.###/#...#/#...#/#...#/.####'],
  'H': [3, '#...#/#...#/#...#/#...#/#####/#...#/#...#/#...#/#...#'],
  'I': [3, '###/.#./.#./.#./.#./.#./.#./.#./###'],
  'J': [3, '....#/....#/....#/....#/....#/....#/#...#/#...#/.###.'],
  'K': [3, '#...#/#...#/#..#./#.#../##.../#.#../#..#./#...#/#...#'],
  'L': [3, '#..../#..../#..../#..../#..../#..../#..../#..../#####'],
  'M': [3, '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#/#...#/#...#'],
  'N': [3, '#...#/##..#/##..#/#.#.#/#.#.#/#.#.#/#..##/#..##/#...#'],
  'O': [3, '.###./#...#/#...#/#...#/#...#/#...#/#...#/#...#/.###.'],
  'P': [3, '####./#...#/#...#/#...#/####./#..../#..../#..../#....'],
  'Q': [3, '.###./#...#/#...#/#...#/#...#/#...#/#.#.#/#..#./.##.#'],
  'R': [3, '####./#...#/#...#/#...#/####./#.#../#..#./#...#/#...#'],
  'S': [3, '.###./#...#/#..../#..../.###./....#/....#/#...#/.###.'],
  'T': [3, '#####/..#../..#../..#../..#../..#../..#../..#../..#..'],
  'U': [3, '#...#/#...#/#...#/#...#/#...#/#...#/#...#/#...#/.###.'],
  'V': [3, '#...#/#...#/#...#/#...#/#...#/.#.#./.#.#./.#.#./..#..'],
  'W': [3, '#...#/#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/##.##/#...#'],
  'X': [3, '#...#/#...#/.#.#./.#.#./..#../.#.#./.#.#./#...#/#...#'],
  'Y': [3, '#...#/#...#/.#.#./.#.#./..#../..#../..#../..#../..#..'],
  'Z': [3, '#####/....#/...#./...#./..#../.#.../.#.../#..../#####'],
  '[': [3, '###/#../#../#../#../#../#../#../#../#../###'],
  '\\': [3, '#..../#..../.#.../.#.../..#../...#./...#./....#/....#'],
  ']': [3, '###/..#/..#/..#/..#/..#/..#/..#/..#/..#/###'],
  '^': [3, '..#../.#.#./#...#'],
  '_': [12, '######', 6],
  '`': [3, '#./.#'],
  'a': [6, '.##./...#/.###/#..#/#..#/.###'],
  'b': [3, '#.../#.../#.../###./#..#/#..#/#..#/#..#/###.'],
  'c': [6, '.##./#..#/#.../#.../#..#/.##.'],
  'd': [3, '...#/...#/...#/.###/#..#/#..#/#..#/#..#/.###'],
  'e': [6, '.##./#..#/####/#.../#..#/.##.'],
  'f': [3, '.##/#../#../###/#../#../#../#../#..'],
  'g': [6, '.###/#..#/#..#/#..#/#..#/.###/...#/#..#/.##.'],
  'h': [3, '#.../#.../#.../###./#..#/#..#/#..#/#..#/#..#'],
  'i': [4, '#/./#/#/#/#/#/#'],
  'j': [4, '.#/../.#/.#/.#/.#/.#/.#/.#/.#/#.'],
  'k': [3, '#.../#.../#.../#..#/#.#./##../##../#.#./#..#'],
  'l': [3, '#./#./#./#./#./#./#./#./.#'],
  'm': [6, '##.#./#.#.#/#.#.#/#.#.#/#.#.#/#.#.#'],
  'n': [6, '###./#..#/#..#/#..#/#..#/#..#'],
  'o': [6, '.##./#..#/#..#/#..#/#..#/.##.'],
  'p': [6, '###./#..#/#..#/#..#/#..#/###./#.../#.../#...'],
  'q': [6, '.###/#..#/#..#/#..#/#..#/.###/...#/...#/...#'],
  'r': [6, '#.##/##../#.../#.../#.../#...'],
  's': [6, '.###/#.../.##./...#/...#/###.'],
  't': [4, '.#./.#./###/.#./.#./.#./.#./..#'],
  'u': [6, '#..#/#..#/#..#/#..#/#..#/.###'],
  'v': [6, '#...#/#...#/#...#/.#.#./.#.#./..#..'],
  'w': [6, '#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.'],
  'x': [6, '#..#/#..#/.##./.##./#..#/#..#'],
  'y': [6, '#..#/#..#/#..#/#..#/#..#/.###/...#/#..#/.##.'],
  'z': [6, '####/...#/..#./.#../#.../####'],
  '{': [3, '..##/.#../.#../.#../.#../#.../.#../.#../.#../.#../..##'],
  '|': [3, '#/#/#/#/#/#/#/#/#/#/#'],
  '}': [3, '##../..#./..#./..#./..#./...#/..#./..#./..#./..#./##..'],
  '~': [7, '.#.../#.#.#/...#.'],
  '’': [3, '.#/.#/#.'],
  'œ': [6, '.##.##./#..#..#/#..####/#..#.../#..#..#/.##.##.'],
  'Œ': [3, '.######/#..#.../#..#.../#..#.../#..####/#..#.../#..#.../#..#.../.######'],
  'æ': [6, '.##.##./...#..#/.######/#..#.../#..#..#/.##.##.'],
  'Æ': [3, '.######/#..#.../#..#.../#..#.../######./#..#.../#..#.../#..#.../#..####'],
  '«': [6, '..#.#/.#.#./#.#../.#.#./..#.#'],
  '»': [6, '#.#../.#.#./..#.#/.#.#./#.#..'],
  '…': [11, '#.#.#'],
  '·': [8, '#'],
  '°': [3, '.#./#.#/.#.'],
  '×': [6, '#...#/.#.#./..#../.#.#./#...#'],
  '♥': [5, '.##.##./#######/#######/.#####./..###../...#...'],
  '★': [4, '...#.../..###../#######/.#####./..###../.##.##./.#...#.'],
  '▶': [4, '#.../##../###./####/###./##../#...'],
  '◀': [4, '...#/..##/.###/####/.###/..##/...#'],
  '▲': [7, '...#.../..###../.#####./#######'],
  '▼': [7, '#######/.#####./..###../...#...'],
  '▷': [4, '#.../##../#.#./#..#/#.#./##../#...'],
  '▌': [3, '####/####/####/####/####/####/####/####/####'],
  '→': [6, '....#../.....#./#######/.....#./....#..'],
  '←': [6, '..#..../.#...../#######/.#...../..#....'],
  '©': [3, '..###../.#...#./#..##.#/#.#...#/#.#...#/#..##.#/.#...#./..###..'],
  '–': [8, '#####'],
  '—': [8, '#######'],
}

/** Accent marks: [row, pattern] pairs for a base of the given width (lowercase rows 3–4, capitals rows 0–1, cedilla below) */
const MARKS = {
  lower: {
    grave: [[3, '.#..'], [4, '..#.']],
    acute: [[3, '..#.'], [4, '.#..']],
    circ: [[3, '.##.'], [4, '#..#']],
    diaer: [[4, '#..#']],
    cedilla: [[12, '..#.'], [13, '.#..']],
  },
  upper: {
    grave: [[0, '.#...'], [1, '..#..']],
    acute: [[0, '...#.'], [1, '..#..']],
    circ: [[0, '..#..'], [1, '.#.#.']],
    diaer: [[1, '.#.#.']],
    cedilla: [[12, '..#..'], [13, '.#...']],
  },
  /** On a 3-wide I, and on the dotless i (its stem moved to the middle of 3 columns) */
  narrow: {
    circ: { upper: [[0, '.#.'], [1, '#.#']], lower: [[3, '.#.'], [4, '#.#']] },
    diaer: { upper: [[1, '#.#']], lower: [[4, '#.#']] },
  },
}

// prettier-ignore
const ACCENTED = {
  'à': ['a', 'grave'], 'â': ['a', 'circ'], 'ä': ['a', 'diaer'], 'ç': ['c', 'cedilla'],
  'é': ['e', 'acute'], 'è': ['e', 'grave'], 'ê': ['e', 'circ'], 'ë': ['e', 'diaer'],
  'ô': ['o', 'circ'], 'ö': ['o', 'diaer'], 'ù': ['u', 'grave'], 'û': ['u', 'circ'], 'ü': ['u', 'diaer'],
  'ÿ': ['y', 'diaer'],
  'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ä': ['A', 'diaer'], 'Ç': ['C', 'cedilla'],
  'É': ['E', 'acute'], 'È': ['E', 'grave'], 'Ê': ['E', 'circ'], 'Ë': ['E', 'diaer'],
  'Ô': ['O', 'circ'], 'Ö': ['O', 'diaer'], 'Ù': ['U', 'grave'], 'Û': ['U', 'circ'], 'Ü': ['U', 'diaer'],
  'Ÿ': ['Y', 'diaer'],
}

/** A glyph as 16 rows of its ink width ('#' / '.') and its advance */
function fromSpec([top, spec, adv]) {
  const body = spec ? spec.split('/') : []
  const w = body.length ? body[0].length : 0
  body.forEach((r, i) => { if (r.length !== w) throw new Error(`glyph row ${i} is ${r.length} wide, expected ${w}: ${spec}`) })
  const rows = Array.from({ length: CELL }, (_, y) => (y >= top && y < top + body.length ? body[y - top] : '.'.repeat(w)))
  return { w, rows, adv: adv ?? (w ? w + 2 : 4) }
}

function stamp(rows, marks, dx = 0) {
  const out = [...rows]
  for (const [y, pattern] of marks) {
    const r = [...out[y]]
    ;[...pattern].forEach((c, x) => { if (c === '#') r[x + dx] = '#' })
    out[y] = r.join('')
  }
  return out
}

function accented(base, mark) {
  if (base === 'I' || base === 'i') {
    // 3 columns, stem in the middle: I already is 3 wide; i loses its dot
    const upper = base === 'I'
    const g = fromSpec(upper ? BASE.I : [6, '.#./.#./.#./.#./.#./.#.'])
    return { ...g, rows: stamp(g.rows, MARKS.narrow[mark][upper ? 'upper' : 'lower']) }
  }
  const g = fromSpec(BASE[base])
  const set = base === base.toUpperCase() ? MARKS.upper : MARKS.lower
  const marks = set[mark]
  // Marks are drawn for the usual widths (4 lowercase, 5 capitals); center them otherwise
  const dx = Math.max(0, Math.floor((g.w - marks[0][1].length) / 2))
  return { ...g, rows: stamp(g.rows, marks, dx) }
}

/** Every glyph: char → { w, rows, adv } */
export const GLYPHS = (() => {
  const out = {}
  for (const [ch, spec] of Object.entries(BASE)) out[ch] = fromSpec(spec)
  for (const [ch, [base, mark]] of Object.entries(ACCENTED)) out[ch] = accented(base, mark)
  out['î'] = accented('i', 'circ')
  out['ï'] = accented('i', 'diaer')
  out['Î'] = accented('I', 'circ')
  out['Ï'] = accented('I', 'diaer')
  return out
})()

/** Problems with the glyph set: missing characters, ink outside the cell or where the shadow can't fit */
export function checkFont() {
  const problems = []
  for (const ch of UI_CHARS) {
    const g = GLYPHS[ch]
    if (!g) { problems.push(`font: no glyph for ${JSON.stringify(ch)}`); continue }
    if (g.w + 1 > CELL) problems.push(`font: ${JSON.stringify(ch)} is too wide for its cell`)
    g.rows.forEach((r, y) => { if (y === CELL - 1 && r.includes('#')) problems.push(`font: ${JSON.stringify(ch)} has ink on the last row (no room for its shadow)`) })
  }
  return problems
}

/** An atlas of every glyph in `ink`, with `shadow` (null = none) */
function atlas(ink, shadow) {
  const rowsCount = Math.ceil(UI_CHARS.length / UI_COLUMNS)
  const b = new Bitmap(UI_COLUMNS * CELL, rowsCount * CELL)
  ;[...UI_CHARS].forEach((ch, i) => {
    const g = GLYPHS[ch]
    if (!g) return
    const ox = (i % UI_COLUMNS) * CELL
    const oy = Math.floor(i / UI_COLUMNS) * CELL
    const isInk = (x, y) => x >= 0 && y >= 0 && x < g.w && y < CELL && g.rows[y][x] === '#'
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x <= g.w; x++) {
        if (isInk(x, y)) b.put(ox + x, oy + y, ink)
        else if (shadow && (isInk(x - 1, y) || isInk(x, y - 1) || isInk(x - 1, y - 1))) b.put(ox + x, oy + y, shadow)
      }
    }
  })
  return b
}

export function fontAssets() {
  return [
    { out: 'src/assets/ui/ui-font.png', bitmap: atlas(CL.text, CL.shadow), kind: 'file' },
    { out: 'src/assets/ui/ui-font-gold.png', bitmap: atlas(CL.gold, CL.shadow), kind: 'file' },
    { out: 'src/assets/ui/ui-font-dim.png', bitmap: atlas(CL.dim, CL.shadow), kind: 'file' },
    { out: 'src/assets/ui/ui-font-dark.png', bitmap: atlas(CL.ink, null), kind: 'file' },
  ]
}

/** Metrics for the game: position in the atlas, drawn width (ink + shadow column) and advance */
export function fontMetrics() {
  const glyphs = {}
  ;[...UI_CHARS].forEach((ch, i) => {
    const g = GLYPHS[ch]
    if (!g) return
    glyphs[ch] = [(i % UI_COLUMNS) * CELL, Math.floor(i / UI_COLUMNS) * CELL, g.w ? g.w + 1 : 0, g.adv]
  })
  return { cell: CELL, lineHeight: CELL, baseline: BASELINE_ROW + 1, glyphs }
}

/** The TTF for the HTML screens (ink only: CSS draws the shadow) */
export function fontTtf() {
  return buildTtf({
    family: 'TowerUI',
    rows: CELL,
    baselineRow: BASELINE_ROW,
    glyphs: [...UI_CHARS].filter(ch => GLYPHS[ch]).map(ch => ({ ch, rows: GLYPHS[ch].rows, adv: GLYPHS[ch].adv })),
  })
}
