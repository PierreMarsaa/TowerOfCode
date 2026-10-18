import type { MapData } from '@/data/types'
import { cellHash, mask4, pickWeighted } from '@/generation/autotile'

/**
 * Inside the Training Hall: the maze's rocks become dojo partitions (a wall face
 * where floor lies below, the wall's top elsewhere) and the floor wooden planks,
 * shaded under the walls. Layout and gameplay are untouched.
 */
function insideTheHall(map: MapData): MapData {
  const w = map.width!, h = map.height!
  const isWall = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && map.wallsLayer[y * w + x] === 'objects/rock'
  const face = (x: number, y: number): boolean => isWall(x, y) && y + 1 < h && !isWall(x, y + 1)
  const wallsLayer = map.wallsLayer.map((key, i) => {
    if (key !== 'objects/rock') return key
    const x = i % w, y = Math.floor(i / w)
    if (!face(x, y)) return `objects/hall/wall_${mask4(isWall, x, y)}`
    const left = face(x - 1, y), right = face(x + 1, y)
    return `objects/hall/face_${left && right ? 'mid' : left ? 'right' : right ? 'left' : 'single'}`
  })
  const groundLayer = map.groundLayer.map((key, i) => {
    if (key !== 'ground/basic/2') return key
    const x = i % w, y = Math.floor(i / w)
    return isWall(x, y - 1) ? 'ground/hall/shade' : `ground/hall/floor_${1 + pickWeighted(cellHash(x, y, 7), [70, 20, 10])}`
  })
  return { ...map, wallsLayer, groundLayer }
}

export const map00: MapData = insideTheHall({
  id: 'map-00',
  name: 'Training Maze',
  width: 20,
  height: 20,
  groundLayer: [
    'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/arrows/down', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/arrows/up', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/arrows/right', 'ground/ice/1', 'ground/ice/1', 'ground/ice/1', 'ground/ice/1', 'ground/basic/2', 'ground/arrows/up', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/ice/1', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/arrows/down', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
    'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2', 'ground/basic/2',
  ],
  wallsLayer: [
    '', 'objects/rock', '', '', '', 'objects/rock', '', '', 'objects/portal/teleporter_purple', 'objects/rock', '', '', '', '', '', '', '', '', '', 'objects/rock',
    '', 'objects/rock', '', '', '', 'objects/rock', '', '', '', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', '', '', '', 'objects/rock',
    '', 'objects/rock', '', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock', '', 'objects/rock', '', '', '', '', '', 'objects/rock', '', 'objects/rock',
    '', 'objects/rock', '', '', '', 'objects/rock', '', 'objects/rock', '', '', 'objects/rock', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock',
    '', '', '', '', '', 'objects/rock', 'objects/portal/teleporter_gold', 'objects/rock', '', '', '', '', '', 'objects/rock', '', 'objects/rock', '', '', '', '',
    'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock', '', 'objects/rock', '', '',
    'objects/portal/teleporter_purple', '', '', 'objects/rock', '', '', '', '', '', '', '', 'objects/rock', '', 'objects/rock', '', '', '', 'objects/rock', '', '',
    '', '', '', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', '', '', 'objects/rock', 'objects/portal/teleporter_gold', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', '', '',
    '', '', '', 'objects/rock', '', '', '', '', '', '', '', 'objects/rock', '', 'objects/rock', '', '', '', '', '', '',
    '', '', '', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', '', '', '', 'objects/rock',
    '', '', '', '', '', '', '', 'objects/rock', '', '', '', '', '', '', '', '', '', 'objects/rock', '', 'objects/rock',
    '', '', '', '', '', '', '', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock',
    '', '', '', '', '', '', '', 'objects/rock', '', 'objects/rock', '', '', '', '', '', '', '', '', '', '',
    '', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock',
    '', 'objects/rock', '', '', '', '', '', '', '', 'objects/rock', '', '', '', 'objects/rock', '', 'objects/rock', '', '', '', 'objects/rock',
    '', 'objects/rock', '', 'objects/rock', 'objects/rock', '', '', '', '', 'objects/rock', '', 'objects/rock', '', 'objects/rock', '', '', '', 'objects/rock', '', '',
    '', 'objects/rock', '', 'objects/portal/teleporter_purple', '', 'objects/rock', '', 'objects/rock', '', '', '', '', '', 'objects/rock', '', '', '', '', '', '',
    'objects/rock', 'objects/rock', 'objects/rock', '', '', '', '', '', '', '', '', '', '', '', '', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock',
    '', '', '', '', '', 'objects/rock', '', 'objects/rock', '', '', 'objects/rock', '', '', '', '', '', '', '', '', '',
    'objects/portal/warp', '', 'objects/rock', 'objects/rock', '', '', '', '', '', 'objects/rock', 'objects/rock', 'objects/rock', '', 'objects/rock', '', '', '', '', '', '',
  ],
  playerStart: { tileX: 0, tileY: 0, facing: 'down' },
  npcs: [
    {
      name: 'Prof Pi',
      tileX: 10,
      tileY: 6,
      spriteKey: 'profPi',
      facing: 'left',
      behavior: 'detect',
      dialogKey: 'prof_pi_battle',
      battle: { chapter: 'variables-types/what_are_variables', questions: 3, code: true },
    },
    {
      name: 'Ada',
      tileX: 6,
      tileY: 1,
      spriteKey: 'trainer3',
      facing: 'right',
      behavior: 'detect',
      dialogKey: 'hint_npc_01',
      battle: { chapter: 'variables-types/naming-conventions' },
    },
    {
      name: 'Alan',
      tileX: 10,
      tileY: 0,
      spriteKey: 'npc',
      facing: 'right',
      behavior: 'detect',
      battle: { chapter: 'variables-types/numbers' },
    },
    {
      name: 'Grace',
      tileX: 14,
      tileY: 4,
      spriteKey: 'trainer5',
      facing: 'down',
      behavior: 'patrol',
      battle: { chapter: 'variables-types/types' },
      patrolPath: [{ x: 14, y: 8 }, { x: 19, y: 8 }, { x: 19, y: 4 }, { x: 16, y: 4 }, { x: 16, y: 6 }, { x: 14, y: 6 }, { x: 14, y: 8 }],
    },
    {
      name: 'Guido',
      tileX: 2,
      tileY: 9,
      spriteKey: 'trainer2',
      facing: 'left',
      behavior: 'lookout',
      battle: { chapter: 'variables-types/strings' },
      lookoutPattern: ['left', 'up'],
      lookoutTempo: 1,
    },
    {
      name: 'Linus',
      tileX: 6,
      tileY: 10,
      spriteKey: 'trainer6',
      facing: 'down',
      behavior: 'lookout-random',
      battle: { chapter: 'variables-types/boolean' },
    },
    {
      name: 'Margaret',
      tileX: 12,
      tileY: 12,
      spriteKey: 'trainer4',
      facing: 'up',
      behavior: 'lookout',
      battle: { chapter: 'variables-types/quizz', questions: 4 },
      lookoutPattern: ['up', 'right'],
      lookoutTempo: 1,
    },
    {
      name: 'Dennis',
      tileX: 7,
      tileY: 14,
      spriteKey: 'trainer2',
      facing: 'right',
      behavior: 'detect',
      battle: { chapter: 'helpers/comments' },
    },
    {
      name: 'Barbara',
      tileX: 14,
      tileY: 19,
      spriteKey: 'trainer3',
      facing: 'up',
      behavior: 'lookout',
      battle: { chapter: 'helpers/print' },
      lookoutPattern: ['up', 'right', 'up'],
      lookoutTempo: 1,
    },
    {
      name: 'Ken',
      tileX: 5,
      tileY: 17,
      spriteKey: 'trainer6',
      facing: 'left',
      behavior: 'lookout',
      battle: { chapter: 'variables-types/new-challenge', questions: 0, code: true },
      lookoutPattern: ['left', 'right'],
      lookoutTempo: 1,
    }
  ],
  // Trainers are tracked by name in the save; gatekeepers (none here) read this list
  requiredChallenges: [],
  tileEffects: [
    { tileX: 0, tileY: 6, effect: 'ice' },
    { tileX: 0, tileY: 7, effect: 'ice' },
    { tileX: 4, tileY: 7, effect: 'redirect', direction: 'down' },
    { tileX: 10, tileY: 7, effect: 'redirect', direction: 'up' },
    { tileX: 0, tileY: 8, effect: 'ice' },
    { tileX: 4, tileY: 8, effect: 'redirect', direction: 'right' },
    { tileX: 5, tileY: 8, effect: 'ice' },
    { tileX: 6, tileY: 8, effect: 'ice' },
    { tileX: 7, tileY: 8, effect: 'ice' },
    { tileX: 8, tileY: 8, effect: 'ice' },
    { tileX: 10, tileY: 8, effect: 'redirect', direction: 'up' },
    { tileX: 0, tileY: 9, effect: 'ice' },
    { tileX: 0, tileY: 10, effect: 'ice' },
    { tileX: 0, tileY: 11, effect: 'ice' },
    { tileX: 0, tileY: 12, effect: 'ice' },
    { tileX: 0, tileY: 13, effect: 'ice' },
    { tileX: 0, tileY: 14, effect: 'ice' },
    { tileX: 0, tileY: 15, effect: 'ice' },
    { tileX: 0, tileY: 16, effect: 'ice' },
    { tileX: 9, tileY: 16, effect: 'redirect', direction: 'down' }
  ],
  noCollision: [
    { tileX: 8, tileY: 0 },
    { tileX: 6, tileY: 4 },
    { tileX: 0, tileY: 6 },
    { tileX: 12, tileY: 7 },
    { tileX: 3, tileY: 16 },
    { tileX: 0, tileY: 19 }
  ],
  stairs: [
    { tileX: 0, tileY: 19, targetMapId: 'map-01' }
  ],
  teleports: [
    { id: 'tp-1', tileX: 8, tileY: 0, role: 'sender', targetId: 'tp-2' },
    { id: 'tp-2', tileX: 0, tileY: 6, role: 'sender', targetId: 'tp-1' },
    { id: 'tp-3', tileX: 3, tileY: 16, role: 'sender', targetId: 'tp-2' },
    { id: 'tp-4', tileX: 6, tileY: 4, role: 'sender', targetId: 'tp-5' },
    { id: 'tp-5', tileX: 12, tileY: 7, role: 'sender', targetId: 'tp-4' }
  ],
  startingHp: 3,
})
