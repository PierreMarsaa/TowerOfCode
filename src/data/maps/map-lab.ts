import type { MapData } from '../types.ts'
import { MapCode, door, sign } from './mapcode.ts'

/*
 * Prof Pi's lab, home base: the adventure starts here, and the aide at the big
 * machine heals your Codémon (blacking out brings you back here).
 *   W wall  w window  Q the machine (2×2, its top in the wall row)  S/s shelf (2 high)
 *   P plant  D desk  t table (Prof Pi's notes)  M mat (exit)
 */
// prettier-ignore
const M = new MapCode([
  'SSwWWQQwSS',
  'ssP..QQ.ss',
  '..........',
  '.....ttt..',
  '..........',
  '..D.......',
  '..........',
  'SS......SS',
  'ss......ss',
  '..........',
  'P........P',
  '....MM....',
])
M.paint({
  W: { wall: 'objects/lab/wall' },
  w: { wall: 'objects/lab/wall_window' },
  P: { wall: 'objects/lab/plant' },
  D: { wall: 'objects/lab/desk' },
  S: { wall: 'objects/lab/shelf_top' },
  s: { wall: 'objects/lab/shelf_bottom' },
  t: { wall: (x: number) => `objects/lab/table_${x - 5}` },
  M: { ground: 'ground/lab/mat' },
}, (x, y) => ((x + y) % 2 === 0 ? 'ground/lab/floor_1' : 'ground/lab/floor_2'))
// The machine: top half in the wall row
for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) M.setWall(5 + c, r, `objects/lab/machine_${c}_${r}`)

const mats = M.find('M')

// prettier-ignore
export const lab: MapData = {
  id: 'lab',
  name: 'Labo du Prof. Pi',
  width: M.width,
  height: M.height,
  groundLayer: M.groundLayer,
  wallsLayer: M.wallsLayer,
  playerStart: { tileX: mats[0].x, tileY: mats[0].y - 1, facing: 'up' },
  indoor: true,
  npcs: [
    { name: 'Prof Pi', id: 'profpi', tileX: 4, tileY: 3, facing: 'down', spriteKey: 'profPi', behavior: 'static', talkScript: 'pi_talk' },
    { name: 'Zap', id: 'zap', tileX: 3, tileY: 3, facing: 'down', spriteKey: 'zap', behavior: 'static', dialogKey: 'zap_talk' },
    { name: 'Assistant', id: 'aide', tileX: 7, tileY: 1, facing: 'down', spriteKey: 'aide', behavior: 'static', talkScript: 'lab_heal' },
  ],
  requiredChallenges: [],
  stairs: mats.map(p => door(p.x, p.y, 'town-0', { x: mats[0].x, y: mats[0].y - 1, facing: 'up' })),
  signs: [
    sign(5, 1, 'machine_lab'), sign(6, 1, 'machine_lab'), sign(2, 5, 'desk_lab'),
    sign(5, 3, 'table_lab'), sign(6, 3, 'table_lab'), sign(7, 3, 'table_lab'),
  ],
  triggers: [
    // A new adventure starts here; after a reload the opening picks up where it stopped
    { id: 'opening', on: 'enter', script: 'opening', when: { none: ['opening_done'] } },
  ],
}
