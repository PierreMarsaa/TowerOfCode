/**
 * Tower terrain, one set per world. Every floor has the same grid (rooms, rocks,
 * void between rooms); src/generation/skin.ts draws it three different ways:
 *
 *   forest   ground/forest/floor_1..4, shade (grass in the trees' shadow)
 *            objects/forest/tree_0..14: the woods' edge (mask bit set = trees on that
 *            side, N=1 E=2 S=4 W=8; trunks show where a clearing lies below),
 *            canopy_1..3: deep woods
 *   caves    ground/caves/floor_1..4, shade (floor under a rock face)
 *            objects/caves/wall_0..15: the rock's top; face_{mid,left,right,single}:
 *            the rock face above a floor tile
 *   citadel  ground/citadel/floor_1..4, edge_0..14 (platform borders; masks 5 and 10
 *            are bridges), void_f1..3 (lava), cliff_{mid,left,right,single}_f1..3,
 *            carpet_0..15
 *   each     objects/<world>/obstacle, obstacle_2
 */
import { Bitmap, CLEAR, mix } from './bitmap.mjs'
import { hash, rnd } from './hash.mjs'
import { OUTLINE, PAL, WORLD_PAL } from './palettes.mjs'

export const N = 1, E = 2, S = 4, W = 8
const T = 16
const FRAMES = [0, 1, 2]
const BUMP = [1, 0, 0, 1, 2, 2, 1, 0, 1, 2, 1, 0, 0, 1, 2, 1]

function tile(wrap) {
  const b = new Bitmap(T, T)
  b.wrap = wrap
  return b
}

function speckle(b, salt, dark, light, pDark, pLight) {
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const r = rnd(x, y, salt)
      if (r < pDark) b.px(x, y, dark)
      else if (r > 1 - pLight) b.px(x, y, light)
    }
  }
}

function hexish(s) {
  const n = s.replace('#', '')
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), 255]
}

/** Darken the top rows of a floor tile: the shadow cast by trees / a rock face above */
function shaded(b, tone) {
  const out = b.clone()
  out.wrap = false
  for (let y = 0; y < 5; y++) for (let x = 0; x < T; x++) out.put(x, y, mix(out.get(x, y), tone, [0.6, 0.45, 0.3, 0.18, 0.08][y]))
  return out
}

// ── Forest ──

function tuft(b, x, y) {
  const G = PAL.grass
  b.px(x, y - 3, G[5])
  b.px(x - 1, y - 2, G[5]); b.px(x, y - 2, G[4]); b.px(x + 1, y - 2, G[5])
  b.px(x - 1, y - 1, G[4]); b.px(x, y - 1, G[3]); b.px(x + 1, y - 1, G[4])
  b.px(x - 1, y, G[1]); b.px(x, y, G[1]); b.px(x + 1, y, G[1])
}

function flower(b, x, y, petal) {
  b.px(x, y - 1, petal); b.px(x - 1, y, petal); b.px(x + 1, y, petal); b.px(x, y + 1, petal)
  b.px(x, y, PAL.gold[3])
  b.px(x + 1, y + 1, PAL.grass[1])
}

function forestFloor(v) {
  const G = PAL.grass
  const b = tile(true)
  b.fill(G[3])
  speckle(b, 10 + v, G[2], G[4], 0.12, 0.05)
  for (let i = 0; i < 6; i++) {
    const x = hash(i, v, 1) % T, y = hash(i, v, 2) % T
    b.px(x, y, G[4]); b.px(x, y + 1, G[2])
  }
  if (v === 2) { tuft(b, 4, 6); tuft(b, 11, 13); tuft(b, 13, 4) }
  if (v === 3) { flower(b, 4, 4, PAL.wall[5]); flower(b, 11, 7, hexish('#ee5a6a')); flower(b, 6, 12, hexish('#f6d24a')) }
  if (v === 4) {
    // a red-capped mushroom and a pebble
    const R = hexish('#d8404a'), Rd = hexish('#9a2630'), Wt = PAL.wall[5]
    b.px(5, 6, OUTLINE); b.px(6, 6, OUTLINE); b.px(7, 6, OUTLINE)
    b.px(4, 7, OUTLINE); b.px(5, 7, R); b.px(6, 7, Wt); b.px(7, 7, R); b.px(8, 7, OUTLINE)
    b.px(4, 8, OUTLINE); b.px(5, 8, Rd); b.px(6, 8, R); b.px(7, 8, Rd); b.px(8, 8, OUTLINE)
    b.px(5, 9, OUTLINE); b.px(6, 9, Wt); b.px(7, 9, OUTLINE)
    b.px(6, 10, PAL.grass[1])
    const P = PAL.boulder
    b.px(11, 12, P[4]); b.px(12, 12, P[3]); b.px(11, 13, P[2]); b.px(12, 13, P[2]); b.px(13, 13, PAL.grass[1])
  }
  return b
}

/** Deep woods: leaf clumps lit from the top-left, seamless */
function canopy(v) {
  const L = PAL.leaf
  const b = tile(true)
  b.fill(L[1])
  speckle(b, 300 + v, L[0], L[2], 0.10, 0.08)
  for (let i = 0; i < 7; i++) {
    const cx = hash(i, v, 301) % T, cy = hash(i, v, 302) % T
    const r = 2 + (hash(i, v, 303) % 2)
    b.disc(cx, cy, r, L[2])
    b.disc(cx - 0.6, cy - 0.6, r - 1, L[3])
    b.px(cx - 1, cy - 1, L[4]); b.px(cx - 2, cy, L[4])
    b.px(cx + r - 1, cy + 1, L[0]); b.px(cx + 1, cy + r - 1, L[0])
  }
  return b
}

/** The woods' edge: a bumpy outlined canopy, trunks where a clearing lies below */
function forestTree(mask) {
  const L = PAL.leaf, Wd = PAL.wood
  const open = { n: !(mask & N), e: !(mask & E), s: !(mask & S), w: !(mask & W) }
  const top = canopy(1).clone()
  top.wrap = false
  const bottom = open.s ? 10 : 15
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const cut = (open.n && y < 1 + BUMP[(x + 3) % 16])
        || (open.w && x < 1 + BUMP[(y + 7) % 16])
        || (open.e && x > 14 - BUMP[(y + 11) % 16])
        || (open.s && y > bottom - BUMP[(x + 5) % 16])
      if (cut) top.put(x, y, CLEAR)
    }
  }
  // sunlit rim along the open top and left edges
  const lit = top.clone()
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!top.alphaAt(x, y)) continue
      if ((open.n && y > 0 && !top.alphaAt(x, y - 1)) || (open.w && x > 0 && !top.alphaAt(x - 1, y))) lit.put(x, y, L[4])
    }
  }
  lit.outline(OUTLINE)
  const out = tile(false)
  if (open.s) {
    for (const tx of [2, 10]) {
      out.rect(tx, 8, 4, 7, Wd[2]); out.vline(tx, 8, 7, Wd[3]); out.vline(tx + 3, 8, 7, Wd[1])
      out.px(tx - 1, 14, Wd[2]); out.px(tx + 4, 14, Wd[2])
    }
    out.outline(OUTLINE)
    for (let y = 13; y < T; y++) for (let x = 0; x < T; x++) if (!out.alphaAt(x, y)) out.put(x, y, [0, 0, 0, 55])
  }
  out.blit(lit, 0, 0)
  return out
}

function bush() {
  const L = PAL.leaf
  const b = tile(false)
  b.ellipse(8, 14, 6, 1, [0, 0, 0, 70])
  b.ellipse(8, 9, 6, 5, L[2])
  b.ellipse(6, 8, 4, 3, L[3])
  b.ellipse(10, 7, 3, 3, L[3])
  for (const [x, y] of [[4, 6], [5, 5], [9, 5], [10, 4], [7, 7], [12, 7]]) b.px(x, y, L[4])
  for (const [x, y] of [[5, 4], [10, 3]]) b.px(x, y, L[5])
  for (let x = 3; x <= 13; x++) b.px(x, 13, L[1])
  for (const [x, y] of [[4, 11], [11, 10], [8, 12]]) b.px(x, y, L[1])
  for (const [x, y] of [[6, 10], [11, 8]]) { b.px(x, y, hexish('#d8404a')); b.px(x + 1, y, hexish('#9a2630')) }
  return b.outline(OUTLINE)
}

function stump() {
  const Wd = PAL.wood
  const b = tile(false)
  b.ellipse(8, 14, 6, 1, [0, 0, 0, 70])
  b.rect(3, 8, 11, 5, Wd[2])
  b.ellipse(8, 12.5, 5, 1.5, Wd[2])
  for (const x of [4, 7, 10, 12]) b.vline(x, 9, 4, Wd[1])
  b.vline(3, 8, 5, Wd[3])
  b.ellipse(8, 7.5, 5, 2, Wd[4])
  b.ellipse(8, 7.5, 3, 1, Wd[3])
  b.px(8, 7, Wd[2]); b.px(8, 8, Wd[5])
  b.px(1, 12, Wd[2]); b.px(2, 12, Wd[1]); b.px(14, 12, Wd[1]) // roots
  return b.outline(OUTLINE)
}

// ── Caves ──

function cavesFloor(v) {
  const S = PAL.stone
  const b = tile(true)
  b.fill(S[3])
  for (let i = 0; i < 5; i++) {
    const cx = hash(i, v, 23) % T, cy = hash(i, v, 24) % T
    b.ellipse(cx, cy, 2, 1, i % 2 ? S[2] : mix(S[3], S[4], 0.5))
  }
  speckle(b, 20 + v, S[2], S[4], 0.07, 0.03)
  const cx = 3 + (hash(v, 25) % 9), cy = 3 + (hash(v, 26) % 9)
  b.px(cx, cy, S[1]); b.px(cx + 1, cy, S[1]); b.px(cx + 2, cy + 1, S[1]); b.px(cx + 1, cy + 1, S[4])
  if (v === 3) {
    // a small pool of still water
    const Wt = PAL.water
    b.ellipse(8, 9, 4, 2, Wt[1]); b.ellipse(8, 9, 3, 1, Wt[2]); b.px(6, 9, Wt[4]); b.px(7, 8, Wt[3])
    b.hline(5, 11, 7, S[2])
  }
  if (v === 2) {
    const M = PAL.moss
    for (const [x, y, c] of [[1, 10, 1], [2, 10, 2], [3, 11, 2], [2, 11, 3], [1, 11, 1], [3, 10, 1], [2, 12, 1], [4, 11, 1], [10, 2, 2], [11, 2, 1], [11, 3, 2], [10, 3, 1]]) b.px(x, y, M[c])
  }
  if (v === 4) {
    // a glowing crystal shard
    const C = PAL.crystal
    b.ellipse(8.5, 12, 3, 1, mix(S[3], C[3], 0.35))
    b.px(8, 9, OUTLINE); b.px(8, 10, C[4]); b.px(9, 10, OUTLINE)
    b.px(7, 10, OUTLINE); b.px(7, 11, C[3]); b.px(8, 11, C[2]); b.px(9, 11, C[1]); b.px(10, 11, OUTLINE)
    b.px(7, 12, OUTLINE); b.px(8, 12, C[2]); b.px(9, 12, C[1]); b.px(10, 12, OUTLINE)
    b.px(9, 9, C[5])
  }
  return b
}

/** The rock's top: dark mass, lit border wherever the floor is beside it */
function rockTop(mask) {
  const R = PAL.caveRock
  const b = tile(true)
  b.fill(R[2])
  speckle(b, 310, R[1], R[3], 0.14, 0.07)
  for (let i = 0; i < 3; i++) {
    const x = hash(i, 311) % T, y = hash(i, 312) % T
    b.px(x, y, R[0]); b.px(x + 1, y + 1, R[0]); b.px(x + 1, y, R[4])
  }
  b.wrap = false
  const open = { n: !(mask & N), e: !(mask & E), s: !(mask & S), w: !(mask & W) }
  if (open.n) { b.hline(0, 1, T, R[4]); b.hline(0, 0, T, OUTLINE) }
  if (open.w) { b.vline(1, 0, T, R[4]); b.vline(0, 0, T, OUTLINE) }
  if (open.e) { b.vline(14, 0, T, R[1]); b.vline(15, 0, T, OUTLINE) }
  if (open.s) { b.hline(0, 14, T, R[1]); b.hline(0, 15, T, OUTLINE) }
  return b
}

/** The rock face above a floor tile: a strip of the top, a lit edge, the face, its foot */
function rockFace(end) {
  const R = PAL.caveRock
  const b = tile(false)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let c
      if (y <= 2) c = rnd(x, y, 320) < 0.14 ? R[1] : R[2]
      else if (y === 3) c = R[5]
      else if (y === 15) c = OUTLINE
      else {
        c = y < 8 ? R[4] : y < 12 ? R[3] : R[2]
        if (hash(x, 321) % 4 === 0) c = y < 8 ? R[3] : R[2]
        if (rnd(x, y, 322) < 0.05) c = R[5]
      }
      b.put(x, y, c)
    }
  }
  for (let x = 0; x < T; x++) if (rnd(x, 323) < 0.6) b.put(x, 9, R[1])
  for (const [sx, sy] of [[3, 6], [11, 11]]) { b.put(sx, sy, R[5]); b.put(sx + 1, sy, R[4]); b.put(sx + 1, sy + 1, R[1]) }
  if (end === 'left' || end === 'single') { b.vline(0, 0, T, OUTLINE); b.vline(1, 3, 12, R[5]) }
  if (end === 'right' || end === 'single') { b.vline(15, 0, T, OUTLINE); b.vline(14, 3, 12, R[1]) }
  return b
}

function crystals() {
  const C = PAL.crystal, R = PAL.caveRock
  const b = tile(false)
  b.ellipse(8, 14, 6, 1, [0, 0, 0, 90])
  const shard = (x0, x1, top, bottom) => {
    const mid = Math.floor((x0 + x1) / 2)
    for (let y = top; y <= bottom; y++) {
      const half = Math.min(Math.floor((y - top) / 2), Math.floor((x1 - x0) / 2))
      for (let x = mid - half; x <= mid + half; x++) b.px(x, y, x <= mid ? C[2] : C[1])
      b.px(mid - half, y, C[3])
    }
    b.px(mid, top, C[5])
  }
  shard(5, 10, 2, 13)
  shard(9, 13, 6, 13)
  shard(2, 6, 8, 13)
  for (let x = 3; x <= 12; x++) b.px(x, 13, R[3])
  b.px(6, 6, C[4]); b.px(6, 7, C[4])
  return b.outline(OUTLINE)
}

function stalagmite() {
  const R = PAL.caveRock
  const b = tile(false)
  b.ellipse(8, 14, 6, 1, [0, 0, 0, 90])
  const cone = (cx, top, bottom, w) => {
    for (let y = top; y <= bottom; y++) {
      const half = Math.round(((y - top) / (bottom - top)) * w)
      for (let x = cx - half; x <= cx + half; x++) b.px(x, y, x < cx ? R[4] : x === cx ? R[3] : R[2])
    }
    b.px(cx, top, R[5])
  }
  cone(7, 1, 13, 4)
  cone(12, 7, 13, 2)
  cone(3, 9, 13, 2)
  for (const y of [5, 9]) b.hline(5, y, 5, R[1])
  return b.outline(OUTLINE)
}

// ── Citadel ──

function citadelFloor(v) {
  const B = PAL.brick
  const b = tile(true)
  b.fill(B[1])
  for (let row = 0; row < 4; row++) {
    const y0 = row * 4, off = (row % 2) * 4
    for (let k = 0; k < 2; k++) {
      const x0 = off + k * 8
      const worn = v === 3 && hash(row, k, 3) % 2 === 0
      const base = worn ? B[2] : hash(row, k, 30 + v) % 3 === 0 ? B[3] : B[4]
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 7; i++) {
          let c = base
          if (j === 0) c = worn ? B[3] : B[5]
          if (j === 2) c = worn ? B[1] : B[3]
          if (i === 0 && j > 0) c = mix(c, B[5], 0.3)
          b.px(x0 + i, y0 + j, c)
        }
      }
    }
  }
  speckle(b, 40 + v, B[2], B[5], 0.05, 0.02)
  if (v === 2) { b.px(3, 5, B[1]); b.px(4, 6, B[1]); b.px(5, 6, B[1]); b.px(10, 13, B[1]); b.px(11, 14, B[1]) }
  if (v === 4) {
    const L = PAL.lava
    for (const [x, y, c] of [[7, 3, 4], [8, 3, 5], [9, 3, 4], [3, 11, 3], [4, 11, 5], [5, 11, 4], [12, 7, 3]]) b.px(x, y, L[c])
  }
  return b
}

/** A wavy row that loops over 3 frames (phase moves a third of a period per frame) */
function wave(x, f, row, amp = 1) {
  return row + Math.round(Math.sin((x / T) * Math.PI * 2 + (f * Math.PI * 2) / 3) * amp)
}

function lavaFrame(f) {
  const L = PAL.lava
  const b = tile(true)
  b.fill(L[3])
  for (let i = 0; i < 3; i++) {
    const cx = hash(i, 60) % T, cy = hash(i, 61) % T
    b.ellipse(cx, cy, 3, 1, L[2])
    b.px(cx, cy, L[1]); b.px(cx + 1, cy, L[1])
  }
  for (let x = 0; x < T; x++) {
    b.px(x, wave(x, f, 7), L[4])
    if (x % 4 === 0) b.px(x, wave(x, f, 7), L[5])
    b.px(x, wave(x + 5, f, 14), L[4])
  }
  if (f === 1) { b.px(11, 3, L[6]); b.px(12, 3, L[5]); b.px(11, 2, L[5]) }
  if (f === 2) { b.px(4, 11, L[6]); b.px(5, 11, L[5]) }
  return b
}

function bridgeHorizontal() {
  const Bd = WORLD_PAL.citadel.bridge
  const b = tile(false)
  b.hline(0, 0, T, OUTLINE)
  b.hline(0, 1, T, Bd[4])
  for (let x = 0; x < T; x++) {
    const seam = x % 4 === 3
    for (let y = 2; y <= 11; y++) {
      let c = seam ? Bd[1] : (x % 4 === 0 ? Bd[4] : Bd[3])
      if (!seam && y === 2) c = Bd[5]
      if (!seam && y % 3 === 1) c = Bd[1] // iron grate
      b.px(x, y, c)
    }
  }
  b.hline(0, 12, T, Bd[2])
  b.hline(0, 13, T, Bd[1])
  b.hline(0, 14, T, Bd[0])
  b.hline(0, 15, T, OUTLINE)
  return b
}

function bridgeVertical() {
  const Bd = WORLD_PAL.citadel.bridge
  const b = tile(false)
  for (let y = 0; y < T; y++) {
    const seam = y % 4 === 3
    for (let x = 2; x <= 13; x++) {
      let c = seam ? Bd[1] : (y % 4 === 0 ? Bd[4] : Bd[3])
      if (!seam && x === 2) c = Bd[5]
      if (!seam && x % 3 === 1) c = Bd[1]
      b.px(x, y, c)
    }
  }
  b.vline(0, 0, T, OUTLINE); b.vline(1, 0, T, Bd[4])
  b.vline(14, 0, T, Bd[1]); b.vline(15, 0, T, OUTLINE)
  return b
}

function edgeTile(mask) {
  if (mask === (N | S)) return bridgeVertical()
  if (mask === (E | W)) return bridgeHorizontal()
  const F = PAL.brick
  const b = citadelFloor(1).clone()
  b.wrap = false
  const open = { n: !(mask & N), e: !(mask & E), s: !(mask & S), w: !(mask & W) }
  if (open.s) { b.hline(0, 13, T, F[2]); b.hline(0, 14, T, F[1]) }
  if (open.n) b.hline(0, 1, T, F[6])
  if (open.w) b.vline(1, 0, open.s ? 13 : T, F[6])
  if (open.e) b.vline(14, 0, open.s ? 13 : T, F[2])
  if (open.n) b.hline(0, 0, T, OUTLINE)
  if (open.s) b.hline(0, 15, T, OUTLINE)
  if (open.w) b.vline(0, 0, T, OUTLINE)
  if (open.e) b.vline(15, 0, T, OUTLINE)
  const lava = lavaFrame(0).get(0, 0)
  if (open.n && open.w) { b.put(0, 0, lava); b.put(1, 1, OUTLINE) }
  if (open.n && open.e) { b.put(15, 0, lava); b.put(14, 1, OUTLINE) }
  return b
}

function cliffTile(end, f) {
  const C = WORLD_PAL.citadel.cliff, L = PAL.lava
  const b = lavaFrame(f).clone()
  b.wrap = false
  for (let y = 0; y <= 10; y++) {
    for (let x = 0; x < T; x++) {
      let c = y <= 1 ? C[3] : y >= 9 ? C[1] : C[2]
      if (y >= 2 && y <= 8 && rnd(x, y, 70, 7) < 0.12) c = C[1]
      if (y >= 2 && rnd(x, y, 71) < 0.06) c = C[3]
      b.put(x, y, c)
    }
  }
  for (let x = 0; x < T; x++) if (rnd(x, 72, 7) < 0.55) b.put(x, 6, C[1])
  for (const [sx, sy] of [[4, 3], [11, 7]]) {
    b.put(sx, sy, C[4]); b.put(sx + 1, sy, C[3]); b.put(sx, sy + 1, C[3]); b.put(sx + 1, sy + 1, C[1])
  }
  // the lava glows on the foot of the face
  for (let x = 0; x < T; x++) { b.put(x, 10, mix(C[1], L[2], 0.5)); if ((x + f) % 3 === 0) b.put(x, 9, mix(C[1], L[2], 0.3)) }
  for (let x = 0; x < T; x++) b.put(x, 11, mix(b.get(x, 11), OUTLINE, 0.65))
  for (let x = 0; x < T; x++) if ((x + f * 2) % 5 < 2) b.put(x, 12, mix(b.get(x, 12), L[5], 0.75))
  if (end === 'left' || end === 'single') {
    for (let y = 0; y <= 11; y++) { b.put(0, y, OUTLINE); if (y <= 10) b.put(1, y, mix(b.get(1, y), C[4], 0.5)) }
  }
  if (end === 'right' || end === 'single') {
    for (let y = 0; y <= 11; y++) { b.put(15, y, OUTLINE); if (y <= 10) b.put(14, y, mix(b.get(14, y), C[0], 0.5)) }
  }
  return b
}

/** A red carpet with a gold trim along its outer edges (mask bit set = carpet on that side) */
function carpet(mask) {
  const R = PAL.roofRed, G = PAL.gold
  const b = citadelFloor(1).clone()
  b.wrap = false
  const open = { n: !(mask & N), e: !(mask & E), s: !(mask & S), w: !(mask & W) }
  const x0 = open.w ? 2 : 0, x1 = open.e ? 13 : 15, y0 = open.n ? 2 : 0, y1 = open.s ? 13 : 15
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let c = R[2]
      if ((x + y) % 8 === 0 || (x - y + 64) % 8 === 0) c = R[1] // diamond weave
      if ((x + y) % 8 === 4 && (x - y + 64) % 8 === 4) c = G[2]
      b.put(x, y, c)
    }
  }
  if (open.n) { b.hline(x0, y0, x1 - x0 + 1, G[3]); b.hline(x0, y0 - 1, x1 - x0 + 1, OUTLINE) }
  if (open.s) { b.hline(x0, y1, x1 - x0 + 1, G[2]); b.hline(x0, y1 + 1, x1 - x0 + 1, OUTLINE) }
  if (open.w) { b.vline(x0, y0, y1 - y0 + 1, G[3]); b.vline(x0 - 1, y0, y1 - y0 + 1, OUTLINE) }
  if (open.e) { b.vline(x1, y0, y1 - y0 + 1, G[2]); b.vline(x1 + 1, y0, y1 - y0 + 1, OUTLINE) }
  return b
}

function pillar() {
  const P = PAL.pillar
  const b = tile(false)
  b.ellipse(8, 14, 6, 1, [0, 0, 0, 90])
  b.rect(4, 3, 8, 2, P[4]); b.hline(4, 3, 8, P[5])
  b.rect(5, 5, 6, 8, P[3])
  b.vline(5, 5, 8, P[4]); b.vline(10, 5, 8, P[1]); b.vline(8, 5, 8, P[2])
  b.rect(4, 12, 8, 2, P[2]); b.hline(4, 12, 8, P[3])
  b.px(7, 8, P[1]); b.px(8, 9, P[1])
  return b.outline(OUTLINE)
}

function brazier() {
  const I = PAL.iron, L = PAL.lava
  const b = tile(false)
  b.ellipse(8, 14, 5, 1, [0, 0, 0, 90])
  b.line(5, 14, 7, 10, I[2]); b.line(11, 14, 9, 10, I[2]); b.line(8, 14, 8, 10, I[1])
  b.ellipse(8, 9, 5, 2, I[2]); b.hline(4, 8, 9, I[4]); b.hline(5, 10, 7, I[1])
  b.outline(OUTLINE)
  // the fire
  for (const [x, y, c] of [[8, 1, 5], [7, 2, 5], [8, 2, 6], [9, 3, 5], [6, 3, 4], [7, 3, 6], [8, 3, 6], [5, 4, 4], [6, 4, 5], [7, 4, 6], [8, 4, 6], [9, 4, 5], [10, 4, 4],
    [5, 5, 3], [6, 5, 4], [7, 5, 5], [8, 5, 5], [9, 5, 4], [10, 5, 3], [11, 5, 3], [5, 6, 3], [6, 6, 4], [7, 6, 4], [8, 6, 4], [9, 6, 4], [10, 6, 3], [6, 7, 3], [7, 7, 3], [8, 7, 3], [9, 7, 3], [10, 7, 3]]) b.px(x, y, L[c])
  return b
}

// ── Export ──

const FLOOR_PAINTERS = { forest: forestFloor, caves: cavesFloor, citadel: citadelFloor }
const OBSTACLES = { forest: [bush, stump], caves: [crystals, stalagmite], citadel: [pillar, brazier] }
export const CLIFF_ENDS = ['mid', 'left', 'right', 'single']

/** Deep-woods canopy (the title screen reuses it) */
export function forestCanopy(v) {
  return canopy(v)
}

/** A world's floor variant (the hub and the paths reuse the forest grass) */
export function floorTile(world, v) {
  return FLOOR_PAINTERS[world](v)
}

export function terrainAssets(world) {
  const out = []
  for (let v = 1; v <= 4; v++) out.push({ out: `ground/${world}/floor_${v}`, bitmap: FLOOR_PAINTERS[world](v) })
  const [o1, o2] = OBSTACLES[world]
  out.push({ out: `objects/${world}/obstacle`, bitmap: o1() }, { out: `objects/${world}/obstacle_2`, bitmap: o2() })
  if (world === 'forest') {
    out.push({ out: 'ground/forest/shade', bitmap: shaded(forestFloor(1), PAL.leaf[0]) })
    for (let m = 0; m < 15; m++) out.push({ out: `objects/forest/tree_${m}`, bitmap: forestTree(m) })
    for (let v = 1; v <= 3; v++) out.push({ out: `objects/forest/canopy_${v}`, bitmap: canopy(v) })
  } else if (world === 'caves') {
    out.push({ out: 'ground/caves/shade', bitmap: shaded(cavesFloor(1), PAL.caveRock[0]) })
    for (let m = 0; m < 16; m++) out.push({ out: `objects/caves/wall_${m}`, bitmap: rockTop(m) })
    for (const end of CLIFF_ENDS) out.push({ out: `objects/caves/face_${end}`, bitmap: rockFace(end) })
  } else {
    for (let m = 0; m < 15; m++) out.push({ out: `ground/citadel/edge_${m}`, bitmap: edgeTile(m) })
    for (const f of FRAMES) out.push({ out: `ground/citadel/void_f${f + 1}`, bitmap: lavaFrame(f) })
    for (const end of CLIFF_ENDS) {
      for (const f of FRAMES) out.push({ out: `ground/citadel/cliff_${end}_f${f + 1}`, bitmap: cliffTile(end, f) })
    }
    for (let m = 0; m < 16; m++) out.push({ out: `ground/citadel/carpet_${m}`, bitmap: carpet(m) })
  }
  return out
}
