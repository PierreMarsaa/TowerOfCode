/**
 * Game Boy Color look: shared colours, 4-colour material palettes and the checks
 * that keep every asset within the hardware's limits.
 *
 * - Tiles are 16×16 (four 8×8 hardware tiles). Each 8×8 quarter may use at most
 *   4 colours, as on the real console (one BG palette per 8×8 tile).
 * - Overworld sprites are 16×16 with at most 3 colours plus transparency
 *   (light, main, dark), drawn 4 px above their tile like Gold/Silver/Crystal.
 * - Portraits (trainer pics) are 56×56 with at most 4 colours.
 *
 * Palettes are listed light → dark: [0] lightest, [3] darkest.
 */
import { Bitmap, hex } from '../bitmap.mjs'

const pal = (...cs) => cs.map(hex)

export const WHITE = hex('#f8f8f8')
export const BLACK = hex('#181010')

/** Background (tile) palettes, one per material: [light, mid-light, mid-dark, dark] */
export const BG = {
  grass: pal('#e8f8b0', '#a8e070', '#58b048', '#205820'),
  tallGrass: pal('#c8f088', '#78c850', '#388830', '#103810'),
  tree: pal('#e8f8b0', '#78c050', '#307830', '#102810'),
  path: pal('#f8f0c8', '#e8d098', '#b89058', '#584020'),
  sand: pal('#f8f0d0', '#f0d898', '#c8a060', '#685030'),
  water: pal('#e0f0ff', '#88c0f8', '#4070d0', '#183870'),
  flowerRed: pal('#f8f8f8', '#f8a0a0', '#e04040', '#205820'),
  flowerYellow: pal('#f8f8f8', '#f8e060', '#d0a020', '#205820'),
  roofRed: pal('#f8e0d0', '#f89070', '#d04030', '#501818'),
  roofBlue: pal('#e0e8f8', '#88a8f0', '#3858c0', '#182050'),
  roofGreen: pal('#e0f8d0', '#90d070', '#409040', '#183818'),
  roofPurple: pal('#f0e0f8', '#c098e0', '#7848b0', '#281840'),
  roofOrange: pal('#f8e8c8', '#f8b860', '#d07020', '#503010'),
  roofBrown: pal('#f0e0c8', '#c89868', '#885830', '#382010'),
  wall: pal('#f8f8f8', '#d8d8c8', '#a09888', '#403830'),
  brick: pal('#f8e0c8', '#e0a078', '#a85838', '#401810'),
  stone: pal('#f0f0f0', '#b8b8c0', '#787880', '#303038'),
  wood: pal('#f8e8c8', '#e0b878', '#a87840', '#503018'),
  floorTile: pal('#f8f8f8', '#d0d8e8', '#98a0b8', '#404858'),
  carpetRed: pal('#f8d8d0', '#e88070', '#b83830', '#481010'),
  carpetBlue: pal('#d8e0f8', '#7890d8', '#3850a0', '#101838'),
  metal: pal('#f8f8f8', '#c0c8d0', '#707880', '#202028'),
  screen: pal('#e0f8f0', '#70d0b0', '#208860', '#082818'),
  snow: pal('#f8f8f8', '#d8e8f8', '#98b0d0', '#384868'),
  cave: pal('#f0e0c8', '#c0a078', '#806040', '#302010'),
  lava: pal('#f8f0a0', '#f8a030', '#d03010', '#400800'),
}

/** Sprite palettes: [light (skin/white), main, dark (outline)] — index '1', '2', '3' in the ASCII */
export const OBJ = {
  red: pal('#f8d8b0', '#e04830', '#181010'),
  blue: pal('#f8d8b0', '#4870d8', '#181010'),
  green: pal('#f8d8b0', '#40a040', '#181010'),
  brown: pal('#f8d8b0', '#a06838', '#181010'),
  purple: pal('#f0d8a0', '#8050b0', '#181010'),
  pink: pal('#f8d8b0', '#e070a0', '#181010'),
  gray: pal('#f8f8f8', '#8890a0', '#181010'),
  orange: pal('#f8d8b0', '#e88830', '#181010'),
  teal: pal('#f8d8b0', '#30a0a0', '#181010'),
}

/** Text box, menus, battle UI */
export const UI = {
  paper: hex('#f8f8f8'),
  ink: hex('#181010'),
  frameLight: hex('#a8a8b8'),
  frameDark: hex('#383848'),
}

/**
 * A bitmap from ASCII rows. `colors` maps each character to a colour; characters
 * absent from the map ('.' usually) stay transparent.
 */
export function fromAscii(rows, colors) {
  const w = Math.max(...rows.map(r => r.length))
  return new Bitmap(w, rows.length).ascii(rows, colors)
}

/** Colour map for 4-colour tile ASCII: '0'..'3' → palette[0..3] */
export function tileColors(palette) {
  return { 0: palette[0], 1: palette[1], 2: palette[2], 3: palette[3] }
}

/** Colour map for sprite ASCII: '1'..'3' → light, main, dark; '.' transparent */
export function spriteColors(palette) {
  return { 1: palette[0], 2: palette[1], 3: palette[2] }
}

/** Mirror ASCII rows left↔right (for facing right from a left-facing frame) */
export function mirrorRows(rows) {
  return rows.map(r => [...r].reverse().join(''))
}

const key = c => `${c[0]},${c[1]},${c[2]},${c[3]}`

/** Distinct opaque colours in a region of a bitmap */
export function colorsIn(bitmap, x = 0, y = 0, w = bitmap.w, h = bitmap.h) {
  const seen = new Set()
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      const c = bitmap.get(i, j)
      if (c[3] > 0) seen.add(key(c))
    }
  }
  return seen.size
}

/** Problems with a 16×16 tile: more than 4 colours in any 8×8 quarter */
export function checkTile(bitmap, name) {
  const problems = []
  for (let qy = 0; qy < bitmap.h; qy += 8) {
    for (let qx = 0; qx < bitmap.w; qx += 8) {
      const n = colorsIn(bitmap, qx, qy, 8, 8)
      if (n > 4) problems.push(`${name}: ${n} colours in the 8×8 quarter at ${qx},${qy} (max 4)`)
    }
  }
  return problems
}

/** Problems with a sprite frame: more than 3 opaque colours, or semi-transparent pixels */
export function checkSprite(bitmap, name) {
  const problems = []
  const n = colorsIn(bitmap)
  if (n > 3) problems.push(`${name}: ${n} colours (max 3 + transparency)`)
  for (let i = 3; i < bitmap.data.length; i += 4) {
    const a = bitmap.data[i]
    if (a !== 0 && a !== 255) {
      problems.push(`${name}: semi-transparent pixels`)
      break
    }
  }
  return problems
}
