/**
 * Pieces shared by every world, redrawn under their existing keys (the
 * hand-made training map, the frozen editor and the generator use them):
 * ice, arrows, warp portal, teleporters, rock, the hall planks (ground/basic/2);
 * plus new stairs up / down.
 */
import { Bitmap, mix } from './bitmap.mjs'
import { hash, rnd } from './hash.mjs'
import { OUTLINE, PAL } from './palettes.mjs'

const T = 16

function tile(wrap = false) {
  const b = new Bitmap(T, T)
  b.wrap = wrap
  return b
}

function ice() {
  const I = PAL.ice
  const b = tile(true)
  b.fill(I[2])
  for (let i = 0; i < 3; i++) {
    const x0 = hash(i, 80) % T, y0 = hash(i, 81) % T
    for (let k = 0; k < 4; k++) b.px(x0 + k, y0 - k, I[3]) // diagonal glints
  }
  b.px(4, 4, I[4]); b.px(11, 10, I[4]); b.px(12, 9, I[4])
  for (const [x, y] of [[7, 12], [8, 12], [9, 13], [2, 9]]) b.px(x, y, I[1]) // hairline cracks
  b.wrap = false
  // a slab outline so ice rooms still show an edge against the void
  b.hline(0, 0, T, I[3]); b.vline(0, 0, T, I[3])
  b.hline(0, 15, T, I[1]); b.vline(15, 0, T, I[1])
  return b
}

function arrow(dir) {
  const S = PAL.slab, G = PAL.gold
  const b = tile(false)
  b.fill(S[2])
  b.frame(0, 0, T, T, S[1])
  b.hline(1, 1, 14, S[3]); b.vline(1, 1, 14, S[3])
  // an arrow pointing up, rotated to `dir`
  const up = [
    '.......o........',
    '......oYo.......',
    '.....oYYYo......',
    '....oYYYYYo.....',
    '...oYYYYYYYo....',
    '..ooooYYYoooo...',
    '.....oYYYo......',
    '.....oYYYo......',
    '.....oYYYo......',
    '.....ooooo......',
  ]
  const pal = { o: OUTLINE, Y: G[3] }
  const shape = new Bitmap(16, 16)
  shape.ascii(up, pal, 1, 3)
  shape.px(8, 5, G[4]); shape.px(8, 6, G[4])
  const rot = (x, y) => dir === 'up' ? [x, y] : dir === 'down' ? [15 - x, 15 - y] : dir === 'left' ? [y, 15 - x] : [15 - y, x]
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const c = shape.get(x, y)
    if (c[3]) { const [nx, ny] = rot(x, y); b.px(nx, ny, c) }
  }
  return b
}

function warp() {
  const W = PAL.water
  const b = tile(false)
  b.ellipse(7.5, 8, 7, 5, mix(W[0], OUTLINE, 0.4))
  b.ellipse(7.5, 8, 6, 4, W[2])
  b.ellipse(7.5, 8, 4, 3, W[3])
  b.ellipse(7.5, 8, 2, 1, W[5])
  // a swirl
  for (const [x, y] of [[3, 7], [4, 6], [6, 5], [9, 5], [11, 6], [12, 8], [11, 10], [8, 11], [5, 10]]) b.px(x, y, W[4])
  b.px(7, 8, PAL.wall[5]); b.px(8, 8, PAL.wall[5])
  return b
}

const RUNE_COLORS = {
  purple: ['#3c1f6e', '#7a46d8', '#c8a2ff', '#f0e2ff'],
  green: ['#14482a', '#2fa060', '#7fe8a8', '#e2ffee'],
  gold: ['#5a3a06', '#c48e1c', '#ffd85a', '#fff4c8'],
  red: ['#5c1414', '#c83838', '#ff8a7a', '#ffe0da'],
}
const GLYPHS = {
  purple: ['.o.o.', 'ooooo', '.o.o.', 'ooooo', '.o.o.'],
  green: ['..o..', '.ooo.', 'o.o.o', '..o..', '..o..'],
  gold: ['ooooo', 'o...o', 'o.o.o', 'o...o', 'ooooo'],
  red: ['o...o', '.o.o.', '..o..', '.o.o.', 'o...o'],
}

function teleporter(color) {
  const S = PAL.slab
  const [dark, mid, light, white] = RUNE_COLORS[color].map(h => {
    const n = h.replace('#', '')
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), 255]
  })
  const b = tile(false)
  b.ellipse(7.5, 8.5, 7, 6, OUTLINE)
  b.ellipse(7.5, 8.5, 6, 5, S[3])
  b.ellipse(7.5, 8, 6, 4.5, S[4])
  b.ellipse(7.5, 8.5, 4.5, 3.5, dark)
  b.ellipse(7.5, 8.5, 3.5, 2.5, mid)
  b.ascii(GLYPHS[color], { o: light }, 5, 6)
  b.px(7, 8, white)
  return b
}

function rock() {
  const B = PAL.boulder
  const b = tile(false)
  b.ellipse(8, 14, 6, 1, [0, 0, 0, 80])
  b.ellipse(8, 9, 6, 5, B[2])
  b.ellipse(7, 8, 5, 4, B[3])
  b.ellipse(6, 7, 3, 2, B[4])
  b.px(5, 6, B[5]); b.px(6, 5, B[5])
  for (let x = 3; x <= 13; x++) b.px(x, 13, B[1])
  b.px(10, 9, B[1]); b.px(11, 10, B[1]); b.px(9, 11, B[1])
  return b.outline(OUTLINE)
}

/** Wooden planks: the training hall's floor (and the frozen editor's default floor) */
function planks() {
  const P = PAL.plank
  const b = tile(true)
  for (let row = 0; row < 4; row++) {
    const y0 = row * 4
    const off = hash(row, 90) % 8
    for (let y = y0; y < y0 + 4; y++) {
      for (let x = 0; x < T; x++) {
        let c = (hash(row, Math.floor((x + off) / 8), 91) % 3 === 0) ? P[2] : P[3]
        if (y === y0) c = P[4]
        if (y === y0 + 3) c = P[1]
        if ((x + off) % 8 === 0 && y !== y0 + 3) c = P[1] // board ends
        if (rnd(x, y, 92) < 0.06 && y !== y0 + 3) c = mix(c, P[1], 0.4) // grain
        b.put(x, y, c)
      }
    }
  }
  return b
}

function stairs(dir) {
  const S = PAL.slab
  const b = tile(false)
  b.frame(1, 1, 14, 14, OUTLINE)
  if (dir === 'up') {
    // light treads, dark risers, side walls: clearly a flight of steps
    b.rect(2, 2, 2, 12, S[2]); b.rect(12, 2, 2, 12, S[1]); b.vline(2, 2, 12, S[3])
    for (let i = 0; i < 4; i++) {
      const y = 2 + i * 3
      b.hline(4, y, 8, S[5]); b.hline(4, y + 1, 8, S[4]); b.hline(4, y + 2, 8, S[1])
    }
  } else {
    // a framed opening, steps going down into the dark
    b.rect(2, 2, 12, 12, OUTLINE)
    b.hline(2, 2, 12, S[4]); b.vline(2, 2, 12, S[4]); b.vline(13, 2, 12, S[2])
    for (let i = 0; i < 3; i++) {
      const y = 3 + i * 3, inset = 3 + i
      b.hline(inset, y, 16 - inset * 2, S[4 - i]); b.hline(inset, y + 1, 16 - inset * 2, S[3 - i])
    }
  }
  return b
}

export function commonAssets() {
  return [
    { out: 'ground/ice/1', bitmap: ice() },
    ...['up', 'down', 'left', 'right'].map(d => ({ out: `ground/arrows/${d}`, bitmap: arrow(d) })),
    { out: 'objects/portal/warp', bitmap: warp() },
    ...Object.keys(RUNE_COLORS).map(c => ({ out: `objects/portal/teleporter_${c}`, bitmap: teleporter(c) })),
    { out: 'objects/rock', bitmap: rock() },
    { out: 'ground/basic/2', bitmap: planks() },
    { out: 'objects/stairs/up', bitmap: stairs('up') },
    { out: 'objects/stairs/down', bitmap: stairs('down') },
  ]
}
