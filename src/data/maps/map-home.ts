import type { MapData } from '../types.ts'
import { MapCode, door, sign } from './mapcode.ts'

/*
 * The neighbour's house: her grandson's room upstairs (a PC with code on it), the
 * living room downstairs, where she shares Python tips.
 *   W wall  w window  P poster  C desk + PC  S stairs  t TV  c console  B/b bed
 *   p plant  F/f fridge  H/h shelf  s sink  k stove  v counter  T table  x chair  M mat (exit)
 */

// prettier-ignore
const UP = new MapCode([
  'WWwWWPWW',
  '.C.....S',
  '........',
  'B..RR...',
  'b..RRtc.',
  '.......p',
  'p.......',
])
UP.paint({
  W: { wall: 'objects/indoor/wall' },
  w: { wall: 'objects/indoor/wall_window' },
  P: { wall: 'objects/indoor/wall_poster' },
  C: { wall: 'objects/indoor/pc' },
  R: { ground: (x: number, y: number) => `ground/indoor/rug_${x - 3}_${y - 3}` },
  S: { wall: 'objects/indoor/stairs_down' },
  t: { wall: 'objects/indoor/tv' },
  c: { wall: 'objects/indoor/console' },
  B: { wall: 'objects/indoor/bed_top' },
  b: { wall: 'objects/indoor/bed_bottom' },
  p: { wall: 'objects/indoor/plant' },
}, () => 'ground/indoor/wood')

const upStairs = UP.first('S')

// prettier-ignore
export const home2f: MapData = {
  id: 'home-2f',
  name: 'Chambre du petit-fils',
  width: UP.width,
  height: UP.height,
  groundLayer: UP.groundLayer,
  wallsLayer: UP.wallsLayer,
  noCollision: [{ tileX: upStairs.x, tileY: upStairs.y }],
  playerStart: { tileX: 1, tileY: 3, facing: 'down' },
  indoor: true,
  npcs: [],
  requiredChallenges: [],
  stairs: [door(upStairs.x, upStairs.y, 'home-1f', { x: upStairs.x - 1, y: upStairs.y, facing: 'left' })],
  signs: [
    sign(UP.first('C').x, UP.first('C').y, 'pc_bedroom'),
    sign(UP.first('t').x, UP.first('t').y, 'tv_bedroom'),
    sign(UP.first('c').x, UP.first('c').y, 'console_bedroom'),
  ],
}

// prettier-ignore
const DOWN = new MapCode([
  'WFWwWWWwWH',
  '.fskvv.xSh',
  '..........',
  '...TT.....',
  '..xTTx....',
  '..........',
  'p.......tp',
  '....MM....',
])
DOWN.paint({
  W: { wall: 'objects/indoor/wall' },
  w: { wall: 'objects/indoor/wall_window' },
  F: { wall: 'objects/indoor/fridge_top' },
  f: { wall: 'objects/indoor/fridge_bottom' },
  H: { wall: 'objects/indoor/shelf_top' },
  h: { wall: 'objects/indoor/shelf_bottom' },
  s: { wall: 'objects/indoor/sink' },
  k: { wall: 'objects/indoor/stove' },
  v: { wall: 'objects/indoor/counter' },
  S: { wall: 'objects/indoor/stairs_up' },
  x: { wall: 'objects/indoor/chair' },
  t: { wall: 'objects/indoor/tv' },
  p: { wall: 'objects/indoor/plant' },
  M: { ground: 'ground/indoor/mat' },
}, () => 'ground/indoor/wood')
DOWN.stamp('T', 'objects/indoor/table', 2, 2)

const downStairs = DOWN.first('S')
const mats = DOWN.find('M')

// prettier-ignore
export const home1f: MapData = {
  id: 'home-1f',
  name: 'Maison de la voisine',
  width: DOWN.width,
  height: DOWN.height,
  groundLayer: DOWN.groundLayer,
  wallsLayer: DOWN.wallsLayer,
  noCollision: [{ tileX: downStairs.x, tileY: downStairs.y }],
  playerStart: { tileX: mats[0].x, tileY: mats[0].y - 1, facing: 'up' },
  indoor: true,
  npcs: [
    { name: 'Voisine', id: 'neighbour', tileX: 5, tileY: 2, facing: 'down', spriteKey: 'mom', behavior: 'static', dialogKey: 'neighbour_talk' },
  ],
  requiredChallenges: [],
  stairs: [
    door(downStairs.x, downStairs.y, 'home-2f', { x: downStairs.x, y: downStairs.y + 1, facing: 'down' }),
    ...mats.map(p => door(p.x, p.y, 'town-0', { x: mats[0].x, y: mats[0].y - 1, facing: 'up' })),
  ],
  signs: [
    sign(DOWN.first('s').x, DOWN.first('s').y, 'sink_home'),
    sign(DOWN.first('h').x, DOWN.first('h').y, 'shelf_home'),
    sign(DOWN.first('t').x, DOWN.first('t').y, 'tv_bedroom'),
  ],
}
