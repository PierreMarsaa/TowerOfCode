/**
 * Colour ramps, darkest first. One outline colour everywhere, light from the top-left.
 */
import { hex } from './bitmap.mjs'

const ramp = (...cs) => cs.map(hex)

export const OUTLINE = hex('#1b1626')
export const WHITE = hex('#ffffff')
export const SHADOW = hex('#1b162660')

export const PAL = {
  grass: ramp('#1f4a2a', '#2f6b3a', '#3f8a42', '#58a848', '#7cc45a', '#a8e070'),
  dirt: ramp('#2e1b12', '#4a2e1e', '#6b4328', '#8a5a34', '#a8703e', '#c99556'),
  sand: ramp('#5a3c22', '#7e5a36', '#a07a4c', '#c09a66', '#dcbc88'),
  water: ramp('#123060', '#1b4a86', '#2564ae', '#3482cc', '#62aee8', '#bfe4ff'),
  wood: ramp('#2e1c10', '#4a2e1a', '#6a4426', '#8c5e36', '#b07c4a', '#d0a06a'),
  darkWood: ramp('#1e130b', '#2f1e10', '#452c18', '#5e3e22', '#7a5230', '#996a40'),
  leaf: ramp('#173c22', '#22552e', '#2f723a', '#43914a', '#64b35a', '#92d36e'),

  stone: ramp('#161828', '#232842', '#323a5a', '#434d72', '#5b6790', '#8592b8'),
  crystal: ramp('#2c1d5c', '#4f33a6', '#7a52dc', '#a888ff', '#d6c6ff', '#7fe8ff'),
  abyss: ramp('#040309', '#0a0817', '#130e29', '#1e1640', '#352a66', '#7d6cc8'),
  rock: ramp('#0e101a', '#1a1e30', '#282e46', '#373f5e', '#4c567c', '#6b77a0'),
  caveRock: ramp('#120c10', '#21171c', '#33242a', '#4a343a', '#634850', '#80626a'),
  moss: ramp('#1e3a30', '#2c5444', '#3e7058', '#5a9070'),

  brick: ramp('#1c0e0e', '#341a1a', '#4e2420', '#6e3328', '#8e4a36', '#b46c4a', '#d8936a'),
  lava: ramp('#3c0a04', '#6e1406', '#a8240a', '#dc4614', '#ff7a1e', '#ffbe3c', '#fff0a0'),
  basalt: ramp('#0f0b0e', '#1e171c', '#2e2429', '#40333a', '#55464e', '#6e5d66'),
  iron: ramp('#16161c', '#26262e', '#3a3a44', '#55555f', '#76767f', '#a0a0aa'),
  pillar: ramp('#2a2428', '#403a40', '#58525a', '#736c76', '#918a94', '#b6aeb8'),

  ice: ramp('#2a5a86', '#4886be', '#78b6e2', '#a8d8f6', '#d8f2ff'),
  slab: ramp('#24242e', '#34343f', '#474756', '#5c5c6e', '#757588', '#9a9aae'),
  boulder: ramp('#2c2428', '#463c42', '#62575e', '#80747c', '#a0959c', '#c6bcc2'),
  plank: ramp('#3a2414', '#5a3820', '#7a4e2c', '#96643a', '#b27e4c', '#cc9a64'),
  roofRed: ramp('#3e1214', '#6a1e20', '#94302c', '#bc4a3a', '#e0705a'),
  wall: ramp('#3a3030', '#5c4c48', '#7e6a62', '#a08a7e', '#c4ae9e', '#e6d6c6'),
  gold: ramp('#5a3a06', '#8e6010', '#c48e1c', '#f0c040', '#ffe88a'),
}

/** Per-world terrain set (the citadel's platforms float over lava; the others are walled) */
export const WORLD_PAL = {
  forest: { floor: PAL.grass },
  caves: { floor: PAL.stone },
  citadel: { floor: PAL.brick, cliff: PAL.basalt, void: PAL.lava, bridge: PAL.iron },
}

export const WORLDS = Object.keys(WORLD_PAL)
