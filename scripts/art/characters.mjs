/**
 * Character sprite sheets (128×128 = 4×4 frames of 32×32, scaled 2× by the game).
 * Rows: down, left, right, up (src/utils/AnimationFactory.ts). Columns: idle,
 * step A, idle, step B (the walk plays columns 1, 0, 3, 0).
 * Each character is a paper doll: a shared body drawn per view, plus hair, hats,
 * clothes and accessories, then a 1-px outline around the whole figure.
 * Figures stand on row 29 of the frame (the game anchors frames at their bottom).
 */
import { Bitmap, hex } from './bitmap.mjs'
import { OUTLINE } from './palettes.mjs'

const C = hex
const ramp = (...cs) => cs.map(hex)
const EYE = C('#1b1626')
const WHITE = C('#ffffff')
const BLUSH = C('#f0a090')

const SKIN = {
  light: ramp('#d0906c', '#f4c8a2', '#ffe2c8'),
  tan: ramp('#a8704c', '#d8a07a', '#f0c49e'),
  dark: ramp('#5a3622', '#8a5a3c', '#a87452'),
}

/** A rectangle without its 4 corner pixels */
function rrect(b, x, y, w, h, c) {
  b.rect(x + 1, y, w - 2, h, c)
  b.rect(x, y + 1, w, h - 2, c)
}

// ── Body ──

function leg(b, x, y, len, s, far = false) {
  const P = s.pants
  b.rect(x, y, 3, len, far ? P[0] : P[1])
  if (!far) b.vline(x + 2, y, len, P[0])
  b.rect(x, y + len, 3, 2, s.shoes[0])
  if (!far) b.hline(x, y + len, 3, s.shoes[1])
}

function sideLeg(b, x, y, len, s, far) {
  const P = s.pants
  b.rect(x, y, 3, len, far ? P[0] : P[1])
  b.rect(x - 1, y + len, 4, 2, s.shoes[0])
  if (!far) b.hline(x - 1, y + len, 3, s.shoes[1])
}

/** Torso and arms seen from the front (back = true: from behind) */
function torsoFront(b, s, ty, phase, back) {
  const top = s.top
  const coat = s.coat
  const skin = s.skin
  // arm lengths swing with the steps (the arm opposite the forward leg comes forward)
  const lArm = phase === 2 ? 6 : phase === 1 ? 4 : 5
  const rArm = phase === 1 ? 6 : phase === 2 ? 4 : 5
  const sleeve = s.body === 'tank' ? skin : (coat ?? top)
  b.rect(11, ty, 1, lArm - 1, sleeve[1]); b.px(11, ty + lArm - 1, skin[1])
  b.rect(20, ty, 1, rArm - 1, sleeve[0]); b.px(20, ty + rArm - 1, skin[0])

  const main = coat ?? top
  b.rect(12, ty, 8, 6, main[1])
  b.vline(12, ty, 6, main[2]); b.vline(19, ty, 6, main[0]); b.hline(12, ty + 5, 8, main[0])
  if (back) {
    if (coat) b.vline(15, ty + 1, 5, coat[0]) // coat seam
    return
  }
  if (s.body === 'labcoat') {
    b.rect(15, ty, 2, 5, top[1]); b.px(15, ty, top[2]) // turtleneck between the lapels
    b.vline(14, ty, 6, coat[0]); b.vline(17, ty, 6, coat[0])
    // bag strap across, the bag on the hip
    const st = s.strap
    for (let i = 0; i < 5; i++) b.px(13 + i, ty + i, st[1])
    b.rect(18, ty + 4, 2, 2, st[0])
  } else if (s.body === 'frock') {
    b.rect(14, ty, 4, 5, s.vest[1]); b.vline(14, ty, 5, s.vest[0])
    b.px(15, ty, WHITE); b.px(16, ty, WHITE) // collar
  } else if (s.body === 'vest') {
    b.rect(12, ty, 2, 6, s.vest[1]); b.rect(18, ty, 2, 6, s.vest[0])
  } else if (s.body === 'overalls') {
    b.rect(13, ty + 2, 6, 4, s.pants[1]); b.vline(13, ty, 2, s.pants[1]); b.vline(18, ty, 2, s.pants[1])
    b.px(14, ty + 3, s.pants[0]); b.px(17, ty + 3, s.pants[0])
  } else if (s.body === 'tank') {
    b.px(12, ty, skin[1]); b.px(19, ty, skin[0])
  } else {
    b.vline(15, ty + 1, 4, top[0]) // jacket zip
  }
}

/** Coat tails / skirt hanging over the legs (front and back) */
function lowerFront(b, s, ty, phase) {
  if (s.body === 'labcoat' || s.body === 'frock') {
    const coat = s.coat
    b.rect(11, ty + 6, 3, 3, coat[1]); b.rect(18, ty + 6, 3, 3, coat[0])
    b.vline(11, ty + 6, 3, coat[2])
  }
  if (s.body === 'gown') {
    const G = s.top
    for (let k = 0; k <= 29 - (ty + 4); k++) {
      const y = ty + 4 + k
      const hw = Math.min(4 + Math.floor(k / 2), 7)
      b.rect(16 - hw, y, hw * 2, 1, G[1])
      b.px(16 - hw, y, G[2]); b.px(15 + hw, y, G[0])
    }
    b.hline(9, 29, 14, G[0])
    if (phase === 1) b.rect(12, 29, 3, 1, s.shoes[0])
    if (phase === 2) b.rect(17, 29, 3, 1, s.shoes[0])
  }
}

function face(b, s, hy) {
  const sk = s.skin
  rrect(b, 10, hy, 12, 11, sk[1])
  b.vline(21, hy + 1, 9, sk[0]); b.hline(11, hy + 10, 10, sk[0])
}

function drawFront(b, s, phase, back) {
  const bob = phase === 0 ? 0 : -1
  const hy = 7 + bob, ty = 18 + bob, ly = 24 + bob
  if (s.body !== 'gown') {
    leg(b, 12, ly, phase === 1 ? 5 : phase === 2 ? 3 : 4, s)
    leg(b, 17, ly, phase === 2 ? 5 : phase === 1 ? 3 : 4, s)
  }
  torsoFront(b, s, ty, phase, back)
  lowerFront(b, s, ty, phase)
  face(b, s, hy)
  if (!back) {
    b.vline(13, hy + 5, 2, EYE); b.vline(18, hy + 5, 2, EYE)
    b.px(12, hy + 7, BLUSH); b.px(19, hy + 7, BLUSH)
  }
  const view = back ? 'back' : 'front'
  for (const extra of s.extras ?? []) EXTRAS[extra]?.(b, s, view, hy, ty, 'under')
  HAIR[s.hair](b, s, view, hy)
  for (const extra of s.extras ?? []) EXTRAS[extra]?.(b, s, view, hy, ty, 'over')
}

function drawSide(b, s, phase) {
  const bob = phase === 0 ? 0 : -1
  const hy = 7 + bob, ty = 18 + bob, ly = 24 + bob
  const coat = s.coat, top = s.top, skin = s.skin
  if (s.body !== 'gown') {
    // far leg first (darker), near leg in front
    const farX = phase === 1 ? 17 : phase === 2 ? 12 : 15
    const nearX = phase === 1 ? 12 : phase === 2 ? 17 : 14
    sideLeg(b, farX, ly, phase === 1 ? 3 : 4, s, true)
    sideLeg(b, nearX, ly, phase === 2 ? 3 : 4, s, false)
  }
  for (const extra of s.extras ?? []) EXTRAS[extra]?.(b, s, 'side', hy, ty, 'behind')
  const main = coat ?? top
  b.rect(13, ty, 6, 6, main[1])
  b.vline(13, ty, 6, main[2]); b.vline(18, ty, 6, main[0]); b.hline(13, ty + 5, 6, main[0])
  if (s.body === 'labcoat') { b.vline(13, ty, 5, top[1]); b.px(13, ty, top[2]) }
  if (s.body === 'frock') b.vline(13, ty, 5, s.vest[1])
  if (s.body === 'overalls') b.rect(13, ty + 2, 6, 4, s.pants[1])
  if (s.body === 'labcoat' || s.body === 'frock') { b.rect(14, ty + 6, 5, 3, coat[1]); b.vline(18, ty + 6, 3, coat[0]) }
  if (s.body === 'gown') {
    for (let k = 0; k <= 29 - (ty + 4); k++) {
      const y = ty + 4 + k
      const w = Math.min(6 + Math.floor(k / 2), 11)
      b.rect(13 - Math.floor((w - 6) / 3), y, w, 1, top[1])
      b.px(13 - Math.floor((w - 6) / 3), y, top[2])
    }
    b.hline(11, 29, 11, top[0])
    if (phase !== 0) b.rect(phase === 1 ? 11 : 16, 29, 3, 1, s.shoes[0])
  }
  // the near arm swings against the near leg
  const ax = phase === 1 ? 16 : phase === 2 ? 13 : 15
  const sleeve = s.body === 'tank' ? skin : main
  b.rect(ax, ty + 1, 2, 4, sleeve[1]); b.vline(ax + 1, ty + 1, 4, sleeve[0])
  b.rect(ax, ty + 5, 2, 1, skin[1])
  // head facing left
  rrect(b, 11, hy, 10, 11, skin[1])
  b.vline(20, hy + 1, 9, skin[0]); b.hline(12, hy + 10, 8, skin[0])
  b.px(10, hy + 6, skin[1]) // nose
  b.vline(13, hy + 5, 2, EYE)
  b.px(13, hy + 7, BLUSH)
  b.px(17, hy + 6, skin[0]) // ear
  for (const extra of s.extras ?? []) EXTRAS[extra]?.(b, s, 'side', hy, ty, 'under')
  HAIR[s.hair](b, s, 'side', hy)
  for (const extra of s.extras ?? []) EXTRAS[extra]?.(b, s, 'side', hy, ty, 'over')
}

// ── Hair and hats ──

const HAIR = {
  cap(b, s, view, hy) {
    const H = s.hat, Hr = s.hairColors
    if (view === 'front') {
      b.vline(10, hy + 3, 3, Hr[1]); b.vline(21, hy + 3, 3, Hr[0])
      rrect(b, 10, hy - 2, 12, 6, H[1]); b.hline(12, hy - 2, 7, H[2]); b.vline(11, hy - 1, 3, H[2]); b.vline(20, hy - 1, 4, H[0])
      b.hline(9, hy + 3, 14, s.visor)
      b.rect(15, hy - 1, 2, 2, s.logo)
    } else if (view === 'back') {
      rrect(b, 10, hy + 2, 12, 6, Hr[1]); b.hline(11, hy + 7, 10, Hr[0])
      rrect(b, 10, hy - 2, 12, 7, H[1]); b.hline(12, hy - 2, 7, H[2]); b.vline(20, hy - 1, 5, H[0])
      b.hline(13, hy + 3, 6, H[0])
    } else {
      b.rect(17, hy + 3, 4, 4, Hr[1]); b.vline(20, hy + 3, 4, Hr[0])
      rrect(b, 11, hy - 2, 10, 6, H[1]); b.hline(13, hy - 2, 6, H[2]); b.vline(20, hy - 1, 4, H[0])
      b.hline(8, hy + 3, 6, s.visor)
    }
  },
  beanie(b, s, view, hy) {
    const H = s.hat, Hr = s.hairColors
    if (view === 'side') {
      b.rect(16, hy + 3, 5, 3, Hr[1])
      rrect(b, 11, hy - 3, 10, 7, H[1]); b.hline(11, hy + 3, 10, H[0]); b.hline(13, hy - 3, 6, H[2])
      b.rect(16, hy - 5, 2, 2, H[2])
      return
    }
    if (view === 'back') { rrect(b, 10, hy + 3, 12, 5, Hr[1]); b.hline(11, hy + 7, 10, Hr[0]) }
    rrect(b, 10, hy - 3, 12, 7, H[1]); b.hline(12, hy - 3, 7, H[2]); b.vline(20, hy - 2, 5, H[0])
    b.hline(10, hy + 2, 12, H[0]); b.hline(10, hy + 3, 12, H[1])
    b.rect(15, hy - 5, 2, 2, H[2])
    if (view === 'front') { b.px(11, hy + 4, Hr[1]); b.px(20, hy + 4, Hr[0]) }
  },
  ponytail(b, s, view, hy) {
    const Hr = s.hairColors
    if (view === 'front') {
      rrect(b, 10, hy - 2, 12, 5, Hr[1]); b.hline(12, hy - 2, 7, Hr[2])
      for (let x = 11; x <= 20; x++) if (x % 3 !== 1) b.px(x, hy + 3, Hr[1])
      b.vline(10, hy + 3, 5, Hr[1]); b.vline(21, hy + 3, 4, Hr[0])
      b.rect(22, hy + 1, 2, 8, Hr[1]); b.vline(23, hy + 1, 8, Hr[0]); b.px(22, hy + 1, s.accent)
    } else if (view === 'back') {
      rrect(b, 10, hy - 2, 12, 11, Hr[1]); b.hline(12, hy - 2, 7, Hr[2]); b.vline(21, hy - 1, 9, Hr[0])
      b.rect(19, hy + 4, 3, 8, Hr[1]); b.vline(21, hy + 4, 8, Hr[0]); b.hline(19, hy + 4, 3, s.accent)
    } else {
      rrect(b, 11, hy - 2, 10, 5, Hr[1]); b.hline(13, hy - 2, 6, Hr[2])
      b.rect(16, hy, 5, 7, Hr[1]); b.vline(20, hy, 7, Hr[0])
      b.rect(21, hy + 1, 2, 8, Hr[1]); b.px(21, hy + 1, s.accent)
      b.px(12, hy + 3, Hr[1]); b.px(14, hy + 3, Hr[1])
    }
  },
  headband(b, s, view, hy) {
    const Hr = s.hairColors
    if (view === 'side') {
      rrect(b, 11, hy - 2, 10, 4, Hr[1]); b.rect(17, hy + 1, 4, 4, Hr[1])
      b.hline(11, hy + 1, 10, s.accent); b.px(21, hy + 2, s.accent); b.px(22, hy + 3, s.accent)
      return
    }
    rrect(b, 10, hy - 2, 12, view === 'back' ? 8 : 4, Hr[1]); b.hline(12, hy - 2, 7, Hr[2])
    b.hline(10, hy + 1, 12, s.accent)
    if (view === 'back') { b.px(15, hy + 2, s.accent); b.px(16, hy + 2, s.accent); b.px(15, hy + 3, s.accent) }
  },
  bob(b, s, view, hy) {
    const Hr = s.hairColors
    if (view === 'front') {
      rrect(b, 10, hy - 2, 12, 6, Hr[1]); b.hline(12, hy - 2, 7, Hr[2])
      b.rect(9, hy + 2, 2, 7, Hr[1]); b.rect(21, hy + 2, 2, 7, Hr[0])
      b.hline(11, hy + 3, 10, Hr[1])
    } else if (view === 'back') {
      rrect(b, 9, hy - 2, 14, 11, Hr[1]); b.hline(12, hy - 2, 8, Hr[2]); b.vline(22, hy - 1, 9, Hr[0])
    } else {
      rrect(b, 11, hy - 2, 10, 6, Hr[1]); b.hline(13, hy - 2, 6, Hr[2])
      b.rect(15, hy + 1, 6, 8, Hr[1]); b.vline(20, hy + 1, 8, Hr[0])
      b.hline(11, hy + 3, 3, Hr[1])
    }
  },
  curls(b, s, view, hy) {
    const Hr = s.hairColors
    const curl = (cx, cy, c) => { b.disc(cx, cy, 1.5, c); b.px(Math.round(cx - 0.5), Math.round(cy - 1), Hr[2]) }
    if (view === 'side') {
      rrect(b, 11, hy - 1, 10, 5, Hr[1])
      ;[[12, -2], [14.5, -4], [17, -3], [19.5, -1]].forEach(([cx, dy]) => curl(cx, hy + dy, Hr[1]))
      b.rect(16, hy + 2, 5, 5, Hr[1]); curl(19.5, hy + 6, Hr[0]); curl(17.5, hy + 7, Hr[1])
      return
    }
    rrect(b, 10, hy - 1, 12, view === 'back' ? 9 : 5, Hr[1])
    ;[[10.5, -1], [12.5, -3], [15, -4], [17.5, -3], [20, -2], [21.5, 0]].forEach(([cx, dy]) => curl(cx, hy + dy, Hr[1]))
    if (view === 'front') { curl(9.5, hy + 4, Hr[1]); curl(22.5, hy + 4, Hr[0]); b.px(11, hy + 3, Hr[1]); b.px(20, hy + 3, Hr[0]) }
    else for (const cx of [11.5, 14.5, 17.5, 20.5]) curl(cx, hy + 8, Hr[0])
  },
  strawhat(b, s, view, hy) {
    const H = s.hat, Hr = s.hairColors
    if (view !== 'front') b.rect(view === 'side' ? 16 : 10, hy + 3, view === 'side' ? 5 : 12, 4, Hr[1])
    else { b.vline(10, hy + 3, 3, Hr[1]); b.vline(21, hy + 3, 3, Hr[0]) }
    const cx = view === 'side' ? 12 : 11
    rrect(b, cx, hy - 4, view === 'side' ? 8 : 10, 6, H[1]); b.hline(cx + 1, hy - 4, view === 'side' ? 6 : 8, H[2])
    b.hline(cx, hy, view === 'side' ? 8 : 10, s.accent)
    b.rect(7, hy + 1, 18, 2, H[1]); b.hline(7, hy + 2, 18, H[0]); b.hline(8, hy + 1, 7, H[2])
  },
  bun(b, s, view, hy) {
    const Hr = s.hairColors
    const bun = (x) => {
      rrect(b, x, hy - 6, 6, 5, Hr[1]); b.hline(x + 1, hy - 6, 3, Hr[2])
      b.px(x + 1, hy - 4, Hr[0]); b.px(x + 3, hy - 3, Hr[0]); b.px(x + 4, hy - 5, Hr[0])
    }
    if (view === 'front') {
      bun(13)
      rrect(b, 10, hy - 2, 12, 5, Hr[1]); b.hline(12, hy - 2, 7, Hr[2])
      b.vline(10, hy + 3, 3, Hr[1]); b.vline(21, hy + 3, 3, Hr[0])
      b.px(13, hy + 2, Hr[0]); b.px(17, hy + 1, Hr[0])
    } else if (view === 'back') {
      rrect(b, 10, hy - 2, 12, 10, Hr[1]); b.hline(12, hy - 2, 7, Hr[2]); b.vline(21, hy - 1, 8, Hr[0])
      bun(13)
      for (const x of [12, 15, 18]) b.vline(x, hy + 3, 4, Hr[0]) // locks
    } else {
      rrect(b, 11, hy - 2, 10, 5, Hr[1]); b.hline(13, hy - 2, 6, Hr[2])
      b.rect(17, hy, 4, 7, Hr[1]); b.vline(20, hy, 7, Hr[0])
      bun(15)
    }
  },
  whiskers(b, s, view, hy) {
    const Hr = s.hairColors, sk = s.skin
    if (view === 'front') {
      b.rect(10, hy + 1, 2, 5, Hr[1]); b.rect(20, hy + 1, 2, 5, Hr[0])
      b.rect(9, hy + 5, 3, 4, Hr[1]); b.rect(20, hy + 5, 3, 4, Hr[0]); b.px(10, hy + 9, Hr[1]); b.px(21, hy + 9, Hr[0])
      b.px(14, hy + 1, sk[2]); b.px(15, hy + 1, sk[2]) // a shiny forehead
    } else if (view === 'back') {
      b.rect(10, hy + 3, 12, 5, Hr[1]); b.hline(11, hy + 7, 10, Hr[0])
      b.px(15, hy + 1, sk[2])
    } else {
      b.rect(17, hy + 2, 4, 6, Hr[1]); b.vline(20, hy + 2, 6, Hr[0])
      b.rect(13, hy + 6, 3, 4, Hr[1]); b.px(14, hy + 10, Hr[1])
      b.px(14, hy + 1, sk[2])
    }
  },
  ringlets(b, s, view, hy) {
    const Hr = s.hairColors
    const ringlet = (x, y, len, c) => { b.rect(x, y, 2, len, c); for (let k = 1; k < len; k += 2) b.px(x + (k % 4 === 1 ? 0 : 1), y + k, Hr[0]) }
    if (view === 'front') {
      rrect(b, 13, hy - 5, 6, 4, Hr[1])
      rrect(b, 10, hy - 2, 12, 5, Hr[1]); b.vline(15, hy - 2, 3, Hr[2]); b.hline(11, hy - 1, 3, Hr[2])
      ringlet(8, hy + 2, 8, Hr[1]); ringlet(22, hy + 2, 8, Hr[1])
      b.px(10, hy + 3, Hr[1]); b.px(21, hy + 3, Hr[0])
    } else if (view === 'back') {
      rrect(b, 9, hy - 2, 14, 12, Hr[1]); rrect(b, 13, hy - 5, 6, 4, Hr[1]); b.hline(14, hy - 5, 3, Hr[2])
      for (const x of [10, 13, 16, 19]) b.vline(x, hy + 3, 6, Hr[0])
    } else {
      rrect(b, 11, hy - 2, 10, 5, Hr[1]); rrect(b, 15, hy - 5, 6, 4, Hr[1])
      b.rect(16, hy, 5, 6, Hr[1])
      ringlet(19, hy + 3, 8, Hr[1])
      b.px(12, hy + 3, Hr[1])
    }
  },
}

// ── Accessories (layer: 'behind' the body, 'under' / 'over' the hair) ──

const EXTRAS = {
  backpack(b, s, view, hy, ty, layer) {
    const P = s.pack
    if (view === 'front' && layer === 'over') { b.vline(13, ty, 3, P[0]); b.vline(18, ty, 3, P[0]) }
    if (view === 'back' && layer === 'over') {
      rrect(b, 12, ty - 1, 8, 7, P[1]); b.hline(13, ty - 1, 6, P[2]); b.hline(12, ty + 1, 8, P[0]); b.rect(14, ty + 3, 4, 2, P[2])
    }
    if (view === 'side' && layer === 'behind') { rrect(b, 18, ty - 1, 4, 7, P[1]); b.vline(18, ty, 5, P[2]); b.hline(18, ty + 1, 4, P[0]) }
  },
  glasses(b, s, view, hy, ty, layer) {
    if (layer !== 'under') return
    const F = C('#2a2a36'), L = C('#bfe4ff')
    if (view === 'front') {
      b.rect(12, hy + 4, 3, 3, L); b.rect(17, hy + 4, 3, 3, L)
      b.vline(13, hy + 5, 2, EYE); b.vline(18, hy + 5, 2, EYE)
      b.hline(12, hy + 4, 3, F); b.hline(17, hy + 4, 3, F); b.hline(15, hy + 5, 2, F)
    } else if (view === 'side') {
      b.rect(11, hy + 4, 3, 3, L); b.vline(13, hy + 5, 2, EYE); b.hline(11, hy + 4, 3, F); b.hline(14, hy + 5, 3, F)
    }
  },
  scarf(b, s, view, hy, ty, layer) {
    if (layer !== 'over') return
    const R = s.scarf
    if (view === 'side') { b.hline(13, ty, 6, R[1]); b.rect(19, ty + 1, 2, 4, R[0]) }
    else { b.hline(12, ty, 8, R[1]); b.hline(12, ty + 1, 8, R[0]); b.rect(view === 'front' ? 17 : 13, ty + 2, 2, 3, R[1]) }
  },
  headphones(b, s, view, hy, ty, layer) {
    if (layer !== 'over') return
    const D = C('#26262e'), A = s.accent
    if (view === 'side') { b.hline(13, hy - 3, 6, D); b.vline(16, hy - 3, 6, D); b.rect(15, hy + 3, 3, 4, D); b.px(16, hy + 4, A) }
    else { b.hline(11, hy - 3, 10, D); b.rect(8, hy + 3, 2, 4, D); b.rect(22, hy + 3, 2, 4, D); b.px(8, hy + 4, A); b.px(23, hy + 4, A) }
  },
  beard(b, s, view, hy, ty, layer) {
    if (layer !== 'under') return
    const Bd = s.beard
    if (view === 'front') { b.rect(12, hy + 7, 8, 4, Bd[1]); b.vline(19, hy + 7, 4, Bd[0]); b.hline(14, hy + 8, 4, s.skin[0]); b.px(15, hy + 11, Bd[1]); b.px(16, hy + 11, Bd[0]) }
    if (view === 'side') { b.rect(11, hy + 7, 5, 4, Bd[1]); b.px(12, hy + 11, Bd[1]) }
  },
  stubble(b, s, view, hy, ty, layer) {
    if (layer !== 'under') return
    const Hr = s.hairColors
    if (view === 'front') {
      // a short beard along the jaw, a moustache, the mouth left clear
      b.hline(14, hy + 7, 4, Hr[0])
      b.vline(11, hy + 6, 3, Hr[1]); b.vline(20, hy + 6, 3, Hr[0])
      b.hline(12, hy + 9, 8, Hr[1]); b.hline(13, hy + 10, 6, Hr[1]); b.hline(14, hy + 10, 4, Hr[0])
    }
    if (view === 'side') { b.px(16, hy + 7, Hr[1]); b.rect(12, hy + 8, 5, 2, Hr[1]); b.hline(12, hy + 10, 4, Hr[0]); b.px(11, hy + 7, Hr[0]) }
  },
}

// ── The cast ──

export const CHARACTERS = {
  player: {
    skin: SKIN.light, hair: 'cap', hairColors: ramp('#3a2418', '#5c3a26', '#7e5236'),
    hat: ramp('#7a1820', '#c22e36', '#ee5a5a'), visor: C('#5a1016'), logo: WHITE,
    top: ramp('#0f4e4a', '#1c7c74', '#3cb0a2'), pants: ramp('#1c1e34', '#2e3254'), shoes: ramp('#3a2418', '#e8e8ee'),
    extras: ['backpack'], pack: ramp('#8a5a0e', '#d89a1e', '#f6cc4e'),
  },
  npc: {
    skin: SKIN.light, hair: 'cap', hairColors: ramp('#16161e', '#26262e', '#3a3a46'),
    hat: ramp('#1a2e6e', '#2c4cb0', '#5a7ee0'), visor: C('#14224e'), logo: C('#ffdd44'),
    top: ramp('#2a3a6a', '#4060a0', '#6a8ad0'), pants: ramp('#2e2e3a', '#4a4a5a'), shoes: ramp('#1b1626', '#5a5a6a'),
  },
  trainer2: {
    skin: SKIN.tan, hair: 'beanie', hairColors: ramp('#1e140e', '#3a2a1e', '#5a4432'),
    hat: ramp('#1d4a2a', '#2e7a40', '#52a860'),
    top: ramp('#8a3c10', '#d0641e', '#f09040'), pants: ramp('#3a2a1e', '#5a4430'), shoes: ramp('#1b1626', '#7a6a5a'),
    extras: ['glasses'],
  },
  trainer3: {
    skin: SKIN.light, hair: 'ponytail', hairColors: ramp('#3e1e5e', '#6a3a9a', '#9a68d0'), accent: C('#ffdd44'),
    top: ramp('#8a2a5a', '#d04a8a', '#f080b4'), pants: ramp('#2a2238', '#3e3454'), shoes: ramp('#6a1e40', '#f080b4'),
  },
  trainer4: {
    skin: SKIN.dark, hair: 'headband', hairColors: ramp('#0e0c10', '#1e1a20', '#36303a'), accent: C('#f0c040'),
    body: 'tank', top: ramp('#8a3a0e', '#d8641e', '#f8944a'), pants: ramp('#1e2230', '#2e3448'), shoes: ramp('#1b1626', '#f0f0f0'),
  },
  trainer5: {
    skin: SKIN.light, hair: 'bob', hairColors: ramp('#0e4a4a', '#1a7a74', '#3ab0a4'), accent: C('#ff5a7a'),
    top: ramp('#3a2266', '#5e3aa0', '#8a66d6'), pants: ramp('#1c1c28', '#2c2c3c'), shoes: ramp('#1b1626', '#ff5a7a'),
    extras: ['headphones'],
  },
  trainer6: {
    skin: SKIN.light, hair: 'curls', hairColors: ramp('#7a2e0e', '#c8581e', '#f08a3e'),
    body: 'overalls', top: ramp('#b8bcc8', '#e8ecf4', '#ffffff'), pants: ramp('#1e3c7a', '#2e5ab0'), shoes: ramp('#3a2418', '#7a5a40'),
    extras: ['scarf'], scarf: ramp('#8e1a22', '#d0343c'),
  },
  guide: {
    skin: SKIN.tan, hair: 'strawhat', hairColors: ramp('#6a6a74', '#9a9aa6', '#c8c8d2'),
    hat: ramp('#8a6a2e', '#d8b45a', '#f6dc8e'), accent: C('#b8302c'),
    body: 'vest', top: ramp('#b8bcc8', '#e8ecf4', '#ffffff'), vest: ramp('#1e4a2a', '#2e6a3c'),
    pants: ramp('#3e2c1e', '#5c4430'), shoes: ramp('#1b1626', '#5c4430'),
    extras: ['beard'], beard: ramp('#9a9aa6', '#d4d4dc'),
  },
  profPi: {
    skin: SKIN.light, hair: 'bun', hairColors: ramp('#3e2616', '#64402a', '#8a5c3c'),
    body: 'labcoat', coat: ramp('#9aa0b8', '#e2e6f0', '#ffffff'), top: ramp('#2e4a8a', '#4a6eb8', '#7a9ad8'),
    strap: ramp('#6a3e1e', '#8e5a2e'), pants: ramp('#2e3a22', '#4a5a34'), shoes: ramp('#3a2418', '#6a4a30'),
    extras: ['stubble'],
  },
  boole: {
    skin: SKIN.light, hair: 'whiskers', hairColors: ramp('#7a7a84', '#a8a8b4', '#d4d4dc'),
    body: 'frock', coat: ramp('#16161e', '#2a2a36', '#40404e'), vest: ramp('#1a3e24', '#2c6038'),
    top: ramp('#16161e', '#2a2a36', '#40404e'), pants: ramp('#1e1e28', '#2e2e3a'), shoes: ramp('#0e0c10', '#3a3a46'),
  },
  lovelace: {
    skin: SKIN.light, hair: 'ringlets', hairColors: ramp('#1e120c', '#3a2418', '#5c3a26'),
    body: 'gown', top: ramp('#3e1e5e', '#6a3a9a', '#9a6ad0'), pants: ramp('#3e1e5e', '#6a3a9a'), shoes: ramp('#2a1240', '#4a2a6a'),
  },
}

// ── Sheets ──

const PHASE_OF_COLUMN = [0, 1, 0, 2]

function frame(spec, view, phase) {
  const fig = new Bitmap(32, 32)
  if (view === 'side') drawSide(fig, spec, phase)
  else drawFront(fig, spec, phase, view === 'back')
  fig.outline(OUTLINE)
  const out = new Bitmap(32, 32)
  out.ellipse(15.5, 30, 5, 1, [0, 0, 0, 70])
  out.blit(fig, 0, 0)
  return out
}

export function sheet(spec) {
  const b = new Bitmap(128, 128)
  for (let col = 0; col < 4; col++) {
    const phase = PHASE_OF_COLUMN[col]
    b.blit(frame(spec, 'front', phase), col * 32, 0)
    const side = frame(spec, 'side', phase)
    b.blit(side, col * 32, 32)
    b.blit(side.mirrorX(), col * 32, 64)
    b.blit(frame(spec, 'back', phase), col * 32, 96)
  }
  return b
}

export function characterAssets() {
  return Object.entries(CHARACTERS).map(([name, spec]) => ({ out: name, bitmap: sheet(spec), kind: 'sprite' }))
}
