import type { MapData } from '../types.ts'
import { MapCode, door, sign } from './mapcode.ts'

/*
 * The Tower of Code's hall (floor 0): a carpet from the great door to the reception
 * desk, pillars, the elevator in the back wall and the stairs up to floor 1 in the
 * corner (the climb ends back here, through the top floor's portal).
 *   W wall  w window  b banner  E/e elevator doors  S stairs  p plant
 *   I/i pillar (top / bottom)  D/M/R reception desk  c carpet  m mat (exit)
 */
// prettier-ignore
const H = new MapCode([
  'WWwWWEeWbWWwWW',
  'p...........Sp',
  '..I.......I...',
  '..i..DMR..i...',
  '......c.......',
  '..I...c...I...',
  '..i...c...i...',
  '......c.......',
  'p.....c......p',
  '.....mm.......',
])
H.paint({
  W: { wall: 'objects/tower/wall' },
  w: { wall: 'objects/tower/wall_window' },
  b: { wall: 'objects/tower/wall_banner' },
  E: { wall: 'objects/tower/elevator_l' },
  e: { wall: 'objects/tower/elevator_r' },
  S: { wall: 'objects/tower/stairs' },
  p: { wall: 'objects/lab/plant' },
  I: { wall: 'objects/tower/pillar_top' },
  i: { wall: 'objects/tower/pillar_bottom' },
  D: { wall: 'objects/tower/desk_l' },
  M: { wall: 'objects/tower/desk_m' },
  R: { wall: 'objects/tower/desk_r' },
  c: { ground: 'ground/tower/carpet' },
  m: { ground: 'ground/lab/mat' },
}, (x, y) => ((x * 7 + y * 3) % 11 === 0 ? 'ground/tower/floor_2' : 'ground/tower/floor_1'))

const mats = H.find('m')
const stairsUp = H.first('S')
const stairs = [
  ...mats.map(p => door(p.x, p.y, 'town-0', { x: mats[0].x, y: mats[0].y - 1, facing: 'up' })),
  door(stairsUp.x, stairsUp.y, 'tower-1', { x: stairsUp.x, y: stairsUp.y + 1, facing: 'down' }),
]

// prettier-ignore
export const towerHall: MapData = {
  id: 'tower-0',
  name: 'Tour du Code · Hall',
  width: H.width,
  height: H.height,
  groundLayer: H.groundLayer,
  wallsLayer: H.wallsLayer,
  noCollision: [{ tileX: stairsUp.x, tileY: stairsUp.y }],
  playerStart: { tileX: mats[0].x, tileY: mats[0].y - 1, facing: 'up' },
  indoor: true,
  location: 'loc_tower0',
  npcs: [
    { name: 'Accueil', id: 'reception', tileX: 6, tileY: 2, facing: 'down', spriteKey: 'aide', behavior: 'static', dialogKey: 'hall_reception' },
  ],
  requiredChallenges: [],
  stairs,
  signs: [
    sign(5, 3, 'hall_reception'), sign(6, 3, 'hall_reception'), sign(7, 3, 'hall_reception'),
    sign(5, 0, 'hall_elevator'), sign(6, 0, 'hall_elevator'),
    sign(8, 0, 'hall_banner'),
  ],
}
