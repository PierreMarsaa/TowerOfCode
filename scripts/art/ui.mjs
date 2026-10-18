/**
 * Interface art:
 *   public/assets/ui/dialog-box.png   the dialog box (608×96), drawn at 304×48 and doubled.
 *       Same navy and frame as the battle panels (challenge.css). DialogScene writes the
 *       speaker 18 px from the left / 12 px from the top and draws its ">" near the
 *       bottom-right corner, so the frame stays thin and that corner clear.
 *   public/assets/ui/title-bg.png     the title screen (640×480): the three towers at dusk
 *   public/assets/ui/title-logo.png   "TOWER OF CODE" in a chunky pixel font (×4)
 *   ui/heart_full, ui/heart_empty     hearts for the HUD and the pickups (tiles, so they load
 *       with the others; the editor's palette only lists ground/ and objects/)
 */
import { Bitmap, CLEAR, hex } from './bitmap.mjs'
import { hash } from './hash.mjs'
import { OUTLINE, PAL } from './palettes.mjs'
import { towerBody } from './hub.mjs'
import { forestCanopy } from './terrain.mjs'

function dialogBox() {
  const W = 304, H = 48
  const b = new Bitmap(W, H)
  const bg = hex('#0f0f23'), frame = hex('#c8c8dc'), inner = hex('#464664'), shade = hex('#08081a')
  b.fill(bg)
  b.frame(0, 0, W, H, frame)
  b.frame(2, 2, W - 4, H - 4, inner)
  b.hline(3, H - 3, W - 6, shade)
  for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) b.put(x, y, CLEAR)
  for (const [x, y] of [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]]) b.put(x, y, frame)
  return b.scale(2)
}

function heart(full) {
  const b = new Bitmap(16, 16)
  const shape = [
    '..##...##..',
    '.####.####.',
    '###########',
    '###########',
    '###########',
    '.#########.',
    '..#######..',
    '...#####...',
    '....###....',
    '.....#.....',
  ]
  const R = full ? [hex('#a01c2c'), hex('#e83a4a'), hex('#ff8a94')] : [hex('#3a2228'), hex('#5a3238'), hex('#6a3a42')]
  shape.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '#') return
    b.px(x + 2, y + 3, y > 5 || x > 7 ? R[0] : R[1])
  }))
  b.px(4, 4, R[2]); b.px(5, 4, R[2]); b.px(4, 5, R[2])
  return b.outline(OUTLINE)
}

// ── Title screen ──

const GLYPHS = {
  T: ['#######', '#######', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..'],
  O: ['.#####.', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.'],
  W: ['##...##', '##...##', '##...##', '##.#.##', '##.#.##', '##.#.##', '#######', '###.###', '##...##'],
  E: ['#######', '##.....', '##.....', '######.', '##.....', '##.....', '##.....', '##.....', '#######'],
  R: ['######.', '##...##', '##...##', '##...##', '######.', '##.##..', '##..##.', '##...##', '##...##'],
  F: ['#######', '##.....', '##.....', '######.', '##.....', '##.....', '##.....', '##.....', '##.....'],
  C: ['.######', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '.######'],
  D: ['######.', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '######.'],
}

function logo(text) {
  const G = PAL.gold
  const width = [...text].reduce((w, ch) => w + (ch === ' ' ? 4 : 8), 0) + 4
  const letters = new Bitmap(width, 14)
  let x = 2
  for (const ch of text) {
    if (ch === ' ') { x += 4; continue }
    GLYPHS[ch].forEach((row, y) => [...row].forEach((c, i) => {
      if (c === '#') letters.px(x + i, y + 2, y < 3 ? G[4] : y < 6 ? G[3] : G[2])
    }))
    x += 8
  }
  letters.outline(OUTLINE)
  const b = new Bitmap(width, 14)
  // drop shadow, then the letters
  for (let y = 0; y < 14; y++) for (let i = 0; i < width; i++) if (letters.alphaAt(i, y)) b.px(i + 1, y + 1, hex('#1b162690'))
  b.blit(letters, 0, 0)
  return b.scale(4)
}

function titleBackground() {
  const W = 320, H = 240
  const b = new Bitmap(W, H)
  // dusk sky: navy to violet to warm horizon, with dithered bands
  const sky = [hex('#0f0f23'), hex('#1e1840'), hex('#3a2a5a'), hex('#6a3a64'), hex('#c06060'), hex('#f0a060')]
  for (let y = 0; y < 170; y++) {
    const t = (y / 170) * (sky.length - 1)
    const i = Math.min(sky.length - 2, Math.floor(t))
    for (let x = 0; x < W; x++) {
      const f = t - i
      b.put(x, y, f > 0.5 + ((x + y) % 2 ? 0.25 : -0.25) ? sky[i + 1] : sky[i])
    }
  }
  // stars and a moon
  for (let i = 0; i < 60; i++) {
    const x = hash(i, 500) % W, y = hash(i, 501) % 90
    b.put(x, y, i % 7 === 0 ? hex('#ffffff') : hex('#9d9db8'))
  }
  b.disc(284, 64, 11, hex('#fff2c8')); b.disc(280, 61, 9, hex('#fffbe8')); b.disc(288, 68, 2, hex('#e8d8a8'))
  // a far hill and the three towers on it
  for (let x = 0; x < W; x++) {
    const top = 150 + Math.round(Math.sin(x / 40) * 6)
    for (let y = top; y < H; y++) b.put(x, y, y === top ? PAL.leaf[3] : PAL.leaf[1])
  }
  const towers = [['forest', 92, 96], ['caves', 136, 84], ['citadel', 180, 96]]
  for (const [world, x, y] of towers) b.blit(towerBody(world), x, y)
  // a dirt road climbing to the towers
  for (let y = 160; y < H; y++) {
    const half = 2 + Math.floor((y - 160) / 6)
    for (let x = 160 - half; x <= 160 + half; x++) b.put(x, y, (x + y) % 5 === 0 ? PAL.sand[2] : PAL.sand[3])
  }
  // woods in the foreground, on both sides of the road
  for (let tx = 0; tx < W; tx += 16) {
    for (let ty = 192; ty < H; ty += 16) {
      if (Math.abs(tx + 8 - 160) < 34 + (ty - 192)) continue
      b.blit(forestCanopy(1 + (hash(tx, ty, 502) % 3)), tx, ty)
    }
  }
  for (let x = 0; x < W; x++) if (Math.abs(x - 160) >= 34) b.put(x, 191, OUTLINE)
  return b.scale(2)
}

export function uiAssets() {
  return [
    { out: 'public/assets/ui/dialog-box.png', bitmap: dialogBox(), kind: 'file' },
    { out: 'public/assets/ui/title-bg.png', bitmap: titleBackground(), kind: 'file' },
    { out: 'public/assets/ui/title-logo.png', bitmap: logo('TOWER OF CODE'), kind: 'file' },
    { out: 'ui/heart_full', bitmap: heart(true), kind: 'tile' },
    { out: 'ui/heart_empty', bitmap: heart(false), kind: 'tile' },
  ]
}
