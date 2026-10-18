import type { MapData } from '../types.ts'
import { cellHash } from '../../generation/autotile.ts'
import { MapCode, door, sign } from './mapcode.ts'

/*
 * Bourg-Hello, at the foot of the Tower of Code: the tower's base fills the north
 * edge, its great door opens on a stone plaza.
 *
 *   T trees   X the tower's facade (8×6, door in the middle of its bottom row)
 *   q plaza   k brazier   . grass   f flowers   = dirt path   b bush   o rock
 *   H the neighbour's house (red roof, door h)   R the student's house (blue roof, door r)
 *   L Prof Pi's lab (door l)   F fence   s sign   m mailbox
 *   : sand   ~ the sea (it runs on past the bottom edge)
 */
// prettier-ignore
const ROWS = [
  'TTTTTTXXXXXXXXTTTTTT',
  'TTTTTTXXXXXXXXTTTTTT',
  'TTTTTTXXXXXXXXTTTTTT',
  'TTTTTTXXXXXXXXTTTTTT',
  'TTTTTTXXXXXXXXTTTTTT',
  'TTTTTTXXXXXXXXTTTTTT',
  'TT..fkqqqqqqqqkf..TT',
  'TT.....bs==.b.....TT',
  'TT.HHHH..=...RRRR.TT',
  'TT.HHHH..=...RRRR.TT',
  'TT.HhHH..=...RRrR.TT',
  'TT..=m...=....m=..TT',
  'TT..============..TT',
  'TTff.....=......ffTT',
  'TTff..s..=......ffTT',
  'TT.FFFF..=.LLLLLL.TT',
  'TT.FffF..=.LLLLLL.TT',
  'TT.FffF..=.LLLLLL.TT',
  'TT.FFFF..=sLLLlLL.TT',
  'TT.......======...TT',
  'TT:::::o::::::::::TT',
  ':::~~~~~~~~~~~~~~:::',
  '~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~',
]

const m = new MapCode(ROWS)
const grass = (x: number, y: number): string => (cellHash(x, y, 11) < 0.82 ? 'ground/town/grass_1' : 'ground/town/grass_2')
// The plaza counts as path, so the path joins it without a grass edge
const PATH = '=hrlq'

m.paint({
  'T': { wall: (x, y) => (cellHash(x, y, 5) < 0.85 ? 'objects/town/tree' : 'objects/town/tree_2') },
  'q': { ground: 'ground/town/plaza' },
  'k': { ground: 'ground/town/plaza', wall: 'objects/town/brazier_f1' },
  'f': { ground: 'ground/town/flowers_f1' },
  '=': { ground: (x, y) => `ground/town/path_${m.mask(PATH, x, y, false)}` },
  ':': { ground: 'ground/town/sand' },
  'o': { ground: 'ground/town/sand', wall: 'objects/town/rock' },
  '~': { ground: (x, y) => `ground/town/water_${m.mask('~', x, y, true)}_f1` },
  'F': { wall: (x, y) => `objects/town/fence_${m.mask('F', x, y, false)}` },
  's': { wall: 'objects/town/sign' },
  'm': { wall: 'objects/town/mailbox' },
  'b': { wall: 'objects/town/bush' },
}, grass)

const tower = m.stamp('X', 'objects/town/tower', 8, 6)
m.stamp('H', 'objects/town/house_red', 4, 3)
m.stamp('R', 'objects/town/house_blue', 4, 3)
m.stamp('L', 'objects/town/lab', 6, 4)
const homeDoor = m.first('h')
const studentDoor = m.first('r')
const labDoor = m.first('l')
const [homeBox, studentBox] = m.find('m')
const [towerSign, townSign, labSign] = m.find('s')
/** The great door: the two middle tiles of the facade's bottom row */
const towerDoor = [{ x: tower.x + 3, y: tower.y + 5 }, { x: tower.x + 4, y: tower.y + 5 }]

const stairs = [
  ...towerDoor.map(d => door(d.x, d.y, 'tower-0', { x: d.x, y: d.y + 1, facing: 'down' })),
  door(homeDoor.x, homeDoor.y, 'home-1f', { x: homeDoor.x, y: homeDoor.y + 1, facing: 'down' }),
  door(studentDoor.x, studentDoor.y, 'rival-home', { x: studentDoor.x, y: studentDoor.y + 1, facing: 'down' }),
  door(labDoor.x, labDoor.y, 'lab', { x: labDoor.x, y: labDoor.y + 1, facing: 'down' }),
]

// prettier-ignore
export const town0: MapData = {
  id: 'town-0',
  name: 'Bourg-Hello',
  width: m.width,
  height: m.height,
  groundLayer: m.groundLayer,
  wallsLayer: m.wallsLayer,
  noCollision: stairs.map(s => ({ tileX: s.tileX, tileY: s.tileY })),
  playerStart: { tileX: labDoor.x, tileY: labDoor.y + 1, facing: 'down' },
  location: 'loc_town0',
  border: 'objects/town/tree',
  npcs: [
    { name: 'Fillette', tileX: 12, tileY: 14, facing: 'down', spriteKey: 'girl', behavior: 'static', dialogKey: 'town_girl' },
    { name: 'Gamin', tileX: 5, tileY: 19, facing: 'right', spriteKey: 'kid', behavior: 'static', dialogKey: 'town_kid' },
    { name: 'Pêcheur', tileX: 12, tileY: 20, facing: 'down', spriteKey: 'oldman', behavior: 'static', dialogKey: 'town_fisher' },
  ],
  requiredChallenges: [],
  stairs,
  signs: [
    sign(towerSign.x, towerSign.y, 'sign_tower'),
    sign(townSign.x, townSign.y, 'sign_town0'),
    sign(labSign.x, labSign.y, 'sign_lab'),
    sign(homeBox.x, homeBox.y, 'sign_home'),
    sign(studentBox.x, studentBox.y, 'sign_student_home'),
  ],
}
