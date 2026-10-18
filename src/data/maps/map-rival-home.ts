import type { MapData } from '../types.ts'
import { MapCode, door, sign } from './mapcode.ts'

/* The student's house: she revises for the Tower of Code. Legend as in map-home.ts. */
// prettier-ignore
const M = new MapCode([
  'HHwWWWWwHH',
  'hh......hh',
  '..........',
  '...TT.....',
  '..xTTx....',
  '..........',
  'p........p',
  '....MM....',
])
M.paint({
  W: { wall: 'objects/indoor/wall' },
  w: { wall: 'objects/indoor/wall_window' },
  H: { wall: 'objects/indoor/shelf_top' },
  h: { wall: 'objects/indoor/shelf_bottom' },
  x: { wall: 'objects/indoor/chair' },
  p: { wall: 'objects/indoor/plant' },
  M: { ground: 'ground/indoor/mat' },
}, (x, y) => ((x + y) % 5 === 0 ? 'ground/indoor/wood_2' : 'ground/indoor/wood'))
M.stamp('T', 'objects/indoor/table', 2, 2)
const mats = M.find('M')

// prettier-ignore
export const studentHome: MapData = {
  id: 'rival-home',
  name: "Maison de l'étudiante",
  width: M.width,
  height: M.height,
  groundLayer: M.groundLayer,
  wallsLayer: M.wallsLayer,
  playerStart: { tileX: mats[0].x, tileY: mats[0].y - 1, facing: 'up' },
  indoor: true,
  npcs: [
    { name: 'Étudiante', id: 'student', tileX: 6, tileY: 3, facing: 'left', spriteKey: 'sister', behavior: 'static', dialogKey: 'student_talk' },
  ],
  requiredChallenges: [],
  stairs: mats.map(p => door(p.x, p.y, 'town-0', { x: mats[0].x, y: mats[0].y - 1, facing: 'up' })),
  signs: [sign(0, 1, 'shelf_home'), sign(1, 1, 'shelf_home')],
}
