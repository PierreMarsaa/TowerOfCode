/**
 * The hub (the Entrance) and the training hall:
 *   ground/hub/path_0..15     dirt path with grass margins (mask bit = path on that side)
 *   objects/hub/fence_0..15   wooden fence (mask bit = fence on that side)
 *   objects/hub/tree, objects/hub/sign
 *   objects/gate/<world>_<c>_<r> + <world>_door_open / _door_closed   a chapter's tower (3×4 tiles)
 *   objects/hall/entrance_<c>_<r> + entrance_door                     the training hall (3×3 tiles)
 *   objects/hall/wall                                                  the training maze's walls
 */
import { Bitmap, mix } from './bitmap.mjs'
import { hash, rnd } from './hash.mjs'
import { OUTLINE, PAL } from './palettes.mjs'
import { floorTile } from './terrain.mjs'

const T = 16
const N = 1, E = 2, S = 4, W = 8

function tile() {
  return new Bitmap(T, T)
}

/** The shadow a wall casts on the floor just below it */
function shadeTop(b) {
  const out = b.clone()
  out.wrap = false
  for (let y = 0; y < 5; y++) for (let x = 0; x < T; x++) out.put(x, y, mix(out.get(x, y), OUTLINE, [0.55, 0.4, 0.25, 0.14, 0.06][y]))
  return out
}

/** Cut a big drawing into 16×16 tiles named `${prefix}_${col}_${row}` */
function slice(big, prefix) {
  const out = []
  for (let r = 0; r < big.h / T; r++) {
    for (let c = 0; c < big.w / T; c++) out.push({ out: `${prefix}_${c}_${r}`, bitmap: big.crop(c * T, r * T, T, T) })
  }
  return out
}

function pathTile(mask) {
  const D = PAL.sand, G = PAL.grass
  const b = floorTile('forest', 1).clone()
  b.wrap = false
  const inX = x => x >= 3 && x <= 12, inY = y => y >= 3 && y <= 12
  const dirt = (x, y) => (inX(x) && inY(y))
    || (!!(mask & N) && inX(x) && y < 3) || (!!(mask & S) && inX(x) && y > 12)
    || (!!(mask & W) && inY(y) && x < 3) || (!!(mask & E) && inY(y) && x > 12)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!dirt(x, y)) continue
      const edge = !dirt(x - 1, y) || !dirt(x + 1, y) || !dirt(x, y - 1) || !dirt(x, y + 1)
      if (edge && rnd(x, y, mask, 100) < 0.3) continue // ragged border
      let c = D[3]
      const r = rnd(x, y, 101)
      if (r < 0.10) c = D[2]
      else if (r > 0.93) c = D[4]
      if (edge) c = D[2]
      b.put(x, y, c)
    }
  }
  // grass casts a little shadow on the path below it
  for (let y = 1; y < T; y++) for (let x = 0; x < T; x++) if (dirt(x, y) && !dirt(x, y - 1) && b.get(x, y)[1] !== G[3][1]) b.put(x, y, D[1])
  if (mask === 15) { b.put(5, 6, D[4]); b.put(6, 6, D[2]); b.put(11, 11, D[4]) }
  return b
}

function fence(mask) {
  const Wd = PAL.wood
  const b = tile()
  // rails toward connected sides
  if (mask & W) { b.rect(0, 6, 7, 2, Wd[3]); b.rect(0, 10, 7, 2, Wd[3]); b.hline(0, 6, 7, Wd[4]); b.hline(0, 10, 7, Wd[4]) }
  if (mask & E) { b.rect(9, 6, 7, 2, Wd[3]); b.rect(9, 10, 7, 2, Wd[3]); b.hline(9, 6, 7, Wd[4]); b.hline(9, 10, 7, Wd[4]) }
  if (mask & N) b.rect(7, 0, 2, 4, Wd[3])
  if (mask & S) b.rect(7, 12, 2, 4, Wd[3])
  // the post
  b.rect(6, 3, 4, 11, Wd[3])
  b.vline(6, 3, 11, Wd[4]); b.vline(9, 3, 11, Wd[1])
  b.hline(6, 3, 4, Wd[5])
  b.outline(OUTLINE)
  return b
}

function tree() {
  const L = PAL.leaf, Wd = PAL.wood
  const b = tile()
  b.ellipse(8, 14.5, 6, 1, [0, 0, 0, 80])
  b.rect(6, 11, 4, 4, Wd[2]); b.vline(6, 11, 4, Wd[3]); b.vline(9, 11, 4, Wd[1])
  b.ellipse(7.5, 6.5, 7, 5.5, L[2])
  b.ellipse(6.5, 5.5, 5, 4, L[3])
  b.ellipse(5.5, 4.5, 3, 2, L[4])
  for (const [x, y] of [[4, 3], [6, 2], [9, 4], [11, 6], [3, 6]]) b.px(x, y, L[5])
  for (let x = 2; x <= 13; x++) if (rnd(x, 110) < 0.5) b.px(x, 11, L[1])
  for (const [x, y] of [[12, 8], [10, 10], [3, 9], [13, 5]]) b.px(x, y, L[1])
  return b.outline(OUTLINE)
}

function sign() {
  const Wd = PAL.wood
  const b = tile()
  b.ellipse(8, 14.5, 4, 1, [0, 0, 0, 80])
  b.rect(7, 9, 2, 6, Wd[2]); b.vline(7, 9, 6, Wd[3])
  b.rect(2, 2, 12, 8, Wd[3])
  b.hline(2, 2, 12, Wd[5]); b.vline(2, 2, 8, Wd[4]); b.hline(2, 9, 12, Wd[1]); b.vline(13, 2, 8, Wd[1])
  for (const [x, y, w] of [[4, 4, 7], [4, 6, 5], [10, 6, 2]]) b.hline(x, y, w, Wd[1])
  return b.outline(OUTLINE)
}

// ── Chapter towers (48×64), one per world ──

const TOWER_STYLE = {
  forest: { wall: PAL.wall, roof: PAL.leaf, glow: PAL.gold, accent: PAL.gold },
  caves: { wall: PAL.stone, roof: PAL.crystal, glow: PAL.crystal, accent: PAL.crystal },
  citadel: { wall: PAL.brick, roof: PAL.roofRed, glow: PAL.lava, accent: PAL.lava },
}

export function towerBody(world) {
  const st = TOWER_STYLE[world]
  const Wl = st.wall
  const b = new Bitmap(48, 64)
  const light = world === 'citadel' ? Wl[4] : Wl[4], mid = world === 'citadel' ? Wl[3] : Wl[3], dark = Wl[1]
  // walls: x 6..41, from y 18 to 63
  for (let y = 18; y < 64; y++) {
    for (let x = 6; x <= 41; x++) {
      const row = Math.floor((y - 18) / 4), off = row % 2 ? 4 : 0
      let c = (x - 6 + off) % 8 === 0 || (y - 18) % 4 === 0 ? mix(mid, dark, 0.5) : mid
      if (x <= 8) c = mix(c, light, 0.5)
      if (x >= 39) c = mix(c, dark, 0.6)
      b.px(x, y, c)
    }
  }
  // a band under the roof
  b.rect(4, 18, 40, 3, Wl[2]); b.hline(4, 18, 40, Wl[4])
  // roof
  if (world === 'forest') {
    const R = st.roof
    for (let y = 2; y <= 18; y++) {
      const half = Math.round(4 + (y - 2) * 1.25)
      for (let x = 24 - half; x < 24 + half; x++) {
        let c = (y % 3 === 0) ? R[1] : R[2]
        if (x < 24 - half + 2) c = R[3]
        if (x > 24 + half - 3) c = R[1]
        b.px(x, y, c)
      }
    }
    b.rect(23, 0, 2, 3, PAL.wood[2]) // pole
    b.rect(25, 0, 5, 3, st.accent[3]); b.hline(25, 2, 5, st.accent[2]) // pennant
  } else if (world === 'caves') {
    b.rect(5, 12, 38, 7, Wl[2]); b.hline(5, 12, 38, Wl[4])
    for (let x = 5; x < 43; x += 6) b.rect(x, 9, 4, 4, Wl[3]) // merlons
    const C = st.roof
    // crystals growing on the top
    const shard = (cx, top, h) => {
      for (let y = top; y < top + h; y++) {
        const half = Math.min(Math.floor((y - top) / 2), 2)
        for (let x = cx - half; x <= cx + half; x++) b.px(x, y, x <= cx ? C[2] : C[1])
      }
      b.px(cx, top, C[5])
    }
    shard(16, 0, 11); shard(24, 2, 9); shard(31, 3, 8); shard(11, 5, 6); shard(36, 6, 5)
  } else {
    const R = st.roof
    b.rect(5, 10, 38, 9, Wl[2])
    for (let x = 5; x < 43; x += 6) b.rect(x, 6, 4, 4, Wl[3]) // battlements
    for (let y = 0; y < 8; y++) { const half = 2 + y; b.rect(24 - half, y + 2, half * 2, 1, y < 2 ? R[3] : R[2]) }
    b.rect(10, 12, 3, 5, R[2]); b.rect(35, 12, 3, 5, R[2]) // banners
  }
  // windows: an arch high up, two small ones
  const G = st.glow
  const win = (x, y, w, h) => { b.rect(x, y, w, h, dark); b.rect(x + 1, y + 1, w - 2, h - 1, G[2]); b.px(x + 1, y + 1, G[4]) }
  win(21, 24, 6, 7)
  win(11, 34, 4, 5)
  win(33, 34, 4, 5)
  b.outline(OUTLINE)
  return b
}

/** Door tile (col 1, row 3 of the tower): an arch, open (lit inside) or closed */
function towerDoor(world, open) {
  const st = TOWER_STYLE[world]
  const body = towerBody(world).crop(16, 48, 16, 16)
  const b = body.clone()
  const Wl = st.wall
  // arch frame
  b.rect(3, 2, 10, 14, Wl[2])
  b.rect(4, 1, 8, 1, Wl[2])
  if (open) {
    b.rect(4, 3, 8, 13, OUTLINE)
    b.rect(5, 4, 6, 12, mix(OUTLINE, st.glow[1], 0.4))
    b.rect(5, 10, 6, 6, mix(OUTLINE, st.glow[2], 0.5))
    b.hline(5, 15, 6, st.glow[3])
  } else if (world === 'citadel') {
    // an iron portcullis
    const I = PAL.iron
    b.rect(4, 3, 8, 13, OUTLINE)
    for (let x = 5; x <= 10; x += 2) b.vline(x, 3, 13, I[3])
    for (let y = 5; y <= 14; y += 3) b.hline(4, y, 8, I[2])
  } else if (world === 'caves') {
    // a stone slab sealed by a glowing rune
    b.rect(4, 3, 8, 13, PAL.stone[3]); b.vline(4, 3, 13, PAL.stone[4]); b.vline(11, 3, 13, PAL.stone[1])
    const C = PAL.crystal
    b.px(7, 7, C[4]); b.px(8, 7, C[4]); b.px(6, 8, C[3]); b.px(9, 8, C[3]); b.px(7, 9, C[4]); b.px(8, 9, C[4]); b.px(7, 8, C[5]); b.px(8, 8, C[5])
  } else {
    // wooden planks with iron bands and a padlock
    const Wd = PAL.wood
    b.rect(4, 3, 8, 13, Wd[3])
    for (let x = 5; x <= 10; x += 2) b.vline(x, 3, 13, Wd[2])
    b.hline(4, 6, 8, PAL.iron[2]); b.hline(4, 12, 8, PAL.iron[2])
    b.rect(7, 8, 2, 3, PAL.gold[3]); b.px(7, 7, PAL.gold[2]); b.px(8, 7, PAL.gold[2])
  }
  b.frame(3, 2, 10, 14, OUTLINE)
  b.hline(4, 1, 8, OUTLINE)
  return b
}

// ── Training hall (48×48) ──

function hallFront() {
  const R = PAL.roofRed, Wd = PAL.wood, Wl = PAL.wall
  const b = new Bitmap(48, 48)
  // walls
  for (let y = 18; y < 48; y++) for (let x = 3; x <= 44; x++) {
    let c = (x - 3) % 6 === 0 ? Wd[2] : Wd[3]
    if (y === 18) c = Wd[1]
    b.px(x, y, c)
  }
  // roof
  for (let y = 2; y <= 18; y++) {
    const inset = Math.max(0, 8 - Math.floor(y / 2))
    for (let x = inset; x < 48 - inset; x++) b.px(x, y, (y % 3 === 0) ? R[1] : R[2])
  }
  b.hline(6, 2, 36, R[3])
  // a sign board over the door
  b.rect(15, 20, 18, 6, Wl[4]); b.frame(15, 20, 18, 6, Wd[1])
  for (const x of [17, 20, 23, 26, 29]) b.vline(x, 22, 2, Wd[1])
  // windows
  for (const x of [6, 36]) { b.rect(x, 28, 6, 6, Wd[1]); b.rect(x + 1, 29, 4, 4, PAL.ice[2]); b.px(x + 1, 29, PAL.ice[4]) }
  b.outline(OUTLINE)
  return b
}

function hallDoor() {
  const Wd = PAL.wood
  const b = hallFront().crop(16, 32, 16, 16)
  b.rect(3, 2, 10, 14, OUTLINE)
  b.rect(4, 3, 8, 13, mix(OUTLINE, PAL.gold[1], 0.35))
  b.rect(4, 10, 8, 6, mix(OUTLINE, PAL.gold[2], 0.45))
  b.vline(3, 2, 14, Wd[2]); b.vline(12, 2, 14, Wd[2])
  b.hline(3, 2, 10, Wd[1])
  return b
}

// ── Inside the training hall: plank floors and dojo partitions (autotiled like the cave rock) ──

function hallFloor(v) {
  const P = PAL.plank
  const b = new Bitmap(T, T)
  b.wrap = true
  for (let row = 0; row < 4; row++) {
    const y0 = row * 4
    const off = hash(row, v, 130) % 8
    for (let y = y0; y < y0 + 4; y++) {
      for (let x = 0; x < T; x++) {
        let c = (hash(row, Math.floor((x + off) / 8), v, 131) % 3 === 0) ? P[2] : P[3]
        if (y === y0) c = P[4]
        if (y === y0 + 3) c = P[1]
        if ((x + off) % 8 === 0 && y !== y0 + 3) c = P[1]
        if (rnd(x, y, v, 132) < 0.06 && y !== y0 + 3) c = mix(c, P[1], 0.4)
        b.put(x, y, c)
      }
    }
  }
  if (v === 3) { b.px(5, 6, P[0]); b.px(6, 6, P[0]); b.px(11, 10, P[0]) } // knots
  return b
}

/** The partition's top: plaster, framed where it meets the floor (mask bit set = wall on that side) */
function partitionTop(mask) {
  const Wl = PAL.wall
  const b = new Bitmap(T, T)
  b.fill(Wl[4])
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (rnd(x, y, 140) < 0.06) b.px(x, y, Wl[3])
  if (!(mask & N)) { b.hline(0, 1, T, Wl[5]); b.hline(0, 0, T, OUTLINE) }
  if (!(mask & W)) { b.vline(1, 0, T, Wl[5]); b.vline(0, 0, T, OUTLINE) }
  if (!(mask & E)) { b.vline(14, 0, T, Wl[2]); b.vline(15, 0, T, OUTLINE) }
  if (!(mask & S)) { b.hline(0, 14, T, Wl[2]); b.hline(0, 15, T, OUTLINE) }
  return b
}

/** The partition's front, above a floor tile: a strip of plaster top, wooden panels, a rail */
function partitionFace(end) {
  const Wl = PAL.wall, P = PAL.plank
  const b = new Bitmap(T, T)
  b.rect(0, 0, T, 3, Wl[4])
  b.hline(0, 3, T, Wl[5])
  for (let y = 4; y < 15; y++) for (let x = 0; x < T; x++) b.put(x, y, x % 8 === 0 ? P[1] : y < 9 ? P[3] : P[2])
  b.hline(0, 9, T, P[4]); b.hline(0, 10, T, P[1]) // a rail
  b.hline(0, 15, T, OUTLINE)
  if (end === 'left' || end === 'single') { b.vline(0, 0, T, OUTLINE); b.vline(1, 3, 12, Wl[5]) }
  if (end === 'right' || end === 'single') { b.vline(15, 0, T, OUTLINE); b.vline(14, 3, 12, P[1]) }
  return b
}

// ── The village ──

/** Cobblestones with a grass margin where the square ends (mask bit set = cobbles on that side) */
function cobble(mask) {
  const C = PAL.slab, G = PAL.grass
  const b = floorTile('forest', 1).clone()
  b.wrap = false
  const inside = (x, y) => (x >= 1 || mask & W) && (x <= 14 || mask & E) && (y >= 1 || mask & N) && (y <= 14 || mask & S)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!inside(x, y)) continue
      // stones on a 4×4 grid, offset every other row, with dark joints
      const row = Math.floor(y / 4), off = row % 2 ? 2 : 0
      const sx = (x + off) % 4, sy = y % 4
      let c = sx === 3 || sy === 3 ? C[1] : (hash(Math.floor((x + off) / 4), row, 120) % 3 === 0 ? C[3] : C[4])
      if (sx === 0 && sy === 0 && c !== C[1]) c = C[5]
      b.put(x, y, c)
    }
  }
  // round the outer corners into the grass
  if (!(mask & N) && !(mask & W)) b.put(1, 1, G[3])
  if (!(mask & N) && !(mask & E)) b.put(14, 1, G[3])
  if (!(mask & S) && !(mask & W)) b.put(1, 14, G[3])
  if (!(mask & S) && !(mask & E)) b.put(14, 14, G[3])
  return b
}

const HOUSE_ROOFS = { a: PAL.roofRed, b: ['#1c2a4e', '#2a4278', '#3c5ea6', '#5a82cc', '#86aaea'].map(hexColor) }

function hexColor(h) {
  const n = h.replace('#', '')
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), 255]
}

/** A house front (64×64): roof, chimney, walls, windows, a door */
function house(style) {
  const R = HOUSE_ROOFS[style], Wl = PAL.wall, Wd = PAL.wood
  const b = new Bitmap(64, 64)
  // walls
  for (let y = 30; y < 64; y++) for (let x = 4; x <= 59; x++) b.px(x, y, (x - 4) % 8 === 0 ? Wl[3] : Wl[4])
  b.hline(4, 63, 56, Wl[2])
  // roof with rows of shingles
  for (let y = 4; y <= 31; y++) {
    const inset = Math.max(0, 10 - Math.floor(y / 2))
    for (let x = inset; x < 64 - inset; x++) {
      let c = (y % 4 === 3) ? R[1] : R[2]
      if (((x + (Math.floor(y / 4) % 2) * 3) % 6) === 0 && y % 4 !== 3) c = R[1]
      if (x < inset + 2) c = R[3]
      b.px(x, y, c)
    }
  }
  b.hline(10, 4, 44, R[3])
  b.rect(44, 0, 6, 10, PAL.brick[3]); b.hline(43, 0, 8, PAL.brick[4]) // chimney
  // windows
  for (const x of [10, 44]) {
    b.rect(x, 38, 10, 10, Wd[1]); b.rect(x + 1, 39, 8, 8, PAL.ice[2]); b.vline(x + 5, 39, 8, Wd[1]); b.hline(x + 1, 43, 8, Wd[1])
    b.px(x + 2, 40, PAL.ice[4]); b.px(x + 3, 40, PAL.ice[4])
    b.hline(x - 1, 48, 12, Wd[2]) // sill
  }
  // the door
  b.rect(26, 40, 12, 24, Wd[2]); b.vline(26, 40, 24, Wd[3]); b.vline(37, 40, 24, Wd[1])
  b.hline(26, 40, 12, Wd[1]); b.px(35, 52, PAL.gold[3])
  b.outline(OUTLINE)
  return b
}

/** The fountain (48×48), 3 frames of moving water */
function fountain(f) {
  const S = PAL.slab, Wt = PAL.water
  const b = new Bitmap(48, 48)
  b.ellipse(23.5, 30, 22, 14, S[2])
  b.ellipse(23.5, 29, 21, 13, S[4])
  b.ellipse(23.5, 30, 18, 10, S[1])
  b.ellipse(23.5, 30, 17, 9, Wt[2])
  // ripples that move outward over the 3 frames
  for (let k = 0; k < 2; k++) {
    const r = 5 + ((k * 6 + f * 2) % 12)
    for (let a = 0; a < 64; a++) {
      const t = (a / 64) * Math.PI * 2
      b.px(Math.round(23.5 + Math.cos(t) * r * 1.6), Math.round(30 + Math.sin(t) * r * 0.85), Wt[3])
    }
  }
  // central column and its spout
  b.rect(21, 12, 6, 18, S[3]); b.vline(21, 12, 18, S[4]); b.vline(26, 12, 18, S[1])
  b.ellipse(23.5, 12, 6, 2, S[4])
  for (const [dx, dy] of [[-4, 0], [4, 0], [-6, 3], [6, 3]]) b.px(23 + dx, 10 + dy + (f % 2), Wt[5])
  b.rect(23, 5 + f, 2, 6, Wt[4])
  b.outline(OUTLINE)
  return b
}

function lamp() {
  const I = PAL.iron, G = PAL.gold
  const b = tile()
  b.ellipse(8, 14.5, 3, 1, [0, 0, 0, 80])
  b.rect(7, 6, 2, 9, I[2]); b.vline(7, 6, 9, I[3])
  b.rect(5, 1, 6, 6, I[1]); b.rect(6, 2, 4, 4, G[3]); b.px(6, 2, G[4])
  b.hline(4, 1, 8, I[2])
  b.outline(OUTLINE)
  return b
}

function planter() {
  const Wd = PAL.wood
  const b = tile()
  b.rect(2, 8, 12, 6, Wd[2]); b.hline(2, 8, 12, Wd[4]); b.vline(2, 8, 6, Wd[3]); b.vline(13, 8, 6, Wd[1])
  b.rect(3, 6, 10, 3, PAL.leaf[2])
  for (const [x, y, c] of [[4, 5, '#ee5a6a'], [7, 4, '#f6d24a'], [10, 5, '#ee5a6a'], [12, 6, '#ffffff'], [5, 6, '#ffffff']]) b.px(x, y, hexColor(c))
  b.outline(OUTLINE)
  return b
}

function crate() {
  const Wd = PAL.wood
  const b = tile()
  b.ellipse(8, 14.5, 6, 1, [0, 0, 0, 80])
  b.rect(2, 3, 12, 11, Wd[3]); b.frame(2, 3, 12, 11, Wd[1])
  b.line(3, 4, 12, 12, Wd[1]); b.line(12, 4, 3, 12, Wd[1])
  b.hline(3, 4, 10, Wd[5])
  b.outline(OUTLINE)
  return b
}

export function hubAssets() {
  const out = []
  for (let m = 0; m < 16; m++) out.push({ out: `ground/hub/path_${m}`, bitmap: pathTile(m) })
  for (let m = 0; m < 16; m++) out.push({ out: `objects/hub/fence_${m}`, bitmap: fence(m) })
  out.push({ out: 'objects/hub/tree', bitmap: tree() })
  out.push({ out: 'objects/hub/sign', bitmap: sign() })
  for (const world of Object.keys(TOWER_STYLE)) {
    out.push(...slice(towerBody(world), `objects/gate/${world}`))
    out.push({ out: `objects/gate/${world}_door_open`, bitmap: towerDoor(world, true) })
    out.push({ out: `objects/gate/${world}_door_closed`, bitmap: towerDoor(world, false) })
  }
  out.push(...slice(hallFront(), 'objects/hall/entrance'))
  out.push({ out: 'objects/hall/entrance_door', bitmap: hallDoor() })
  for (let v = 1; v <= 3; v++) out.push({ out: `ground/hall/floor_${v}`, bitmap: hallFloor(v) })
  out.push({ out: 'ground/hall/shade', bitmap: shadeTop(hallFloor(1)) })
  for (let m = 0; m < 16; m++) out.push({ out: `objects/hall/wall_${m}`, bitmap: partitionTop(m) })
  for (const end of ['mid', 'left', 'right', 'single']) out.push({ out: `objects/hall/face_${end}`, bitmap: partitionFace(end) })
  for (let m = 0; m < 16; m++) out.push({ out: `ground/village/cobble_${m}`, bitmap: cobble(m) })
  for (const style of ['a', 'b']) out.push(...slice(house(style), `objects/village/house_${style}`))
  for (let f = 0; f < 3; f++) {
    for (const t of slice(fountain(f), 'objects/village/fountain')) out.push({ out: `${t.out}_f${f + 1}`, bitmap: t.bitmap })
  }
  out.push({ out: 'objects/village/lamp', bitmap: lamp() }, { out: 'objects/village/planter', bitmap: planter() }, { out: 'objects/village/crate', bitmap: crate() })
  return out
}
