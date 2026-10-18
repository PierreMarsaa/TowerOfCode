import type { MapData, SignData, StairData } from '@/data/types'
import { cellHash, mask4, pickWeighted, stamp } from '@/generation/autotile'
import { ACTS } from '@/generation/acts'

/*
 * The Entrance: a village in the woods. Map as code: edit the layout below and
 * the layers are built from it (woods, roads and cobbles autotiled, buildings
 * stamped from their tiles).
 *
 *   T woods          . grass           = dirt road        # cobblestone square
 *   A B C a chapter's tower (3×4), its door 1 2 3 (the gate into that chapter)
 *   h the Training Hall (3×3), its door H
 *   Q R houses (4×4)  O the fountain (3×3)
 *   s sign  l lamp  p planter  c crate  f fence
 *   G the Guide  @ where a new game starts
 */
// prettier-ignore
const ROWS = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTAAATTTTTTTBBBTTTTTTTCCCTTTTT',
  'TTTTAAATTTTTTTBBBTTTTTTTCCCTTTTT',
  'TTTTAAA.......BBB.......CCC.TTTT',
  'TTT.A1A.......B2B.......C3C..TTT',
  'TT...=s........=s........=s...TT',
  'TT...=...l.....=.....l...=....TT',
  'TT..=======================...TT',
  'TT.........l...=...l..........TT',
  'TT..QQQQ....p#####p....RRRR...TT',
  'TT..QQQQ....#######....RRRR...TT',
  'TT..QQQQ....##OOO##....RRRR...TT',
  'TT..QQQQc...##OOO##...cRRRR...TT',
  'TT.ffffff...##OOO##...ffffff..TT',
  'TThhh.......#######...........TT',
  'TThhh.......p#####p...........TT',
  'TThHh.s....l...G...l..........TT',
  'TT.=============..............TT',
  'TT.............@.s............TT',
  'TTTTT......................TTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
]

const W = ROWS[0].length
const H = ROWS.length
const at = (x: number, y: number): string => (x < 0 || y < 0 || x >= W || y >= H ? 'T' : ROWS[y][x])
const find = (ch: string): { x: number; y: number }[] => {
  const out: { x: number; y: number }[] = []
  ROWS.forEach((row, y) => [...row].forEach((c, x) => { if (c === ch) out.push({ x, y }) }))
  return out
}

const DOORS = ['1', '2', '3']
const isRoad = (x: number, y: number): boolean => '=GH@'.includes(at(x, y)) || DOORS.includes(at(x, y))
const isSquare = (x: number, y: number): boolean => '#Op'.includes(at(x, y)) && x >= 12 && x <= 18
const isWoods = (x: number, y: number): boolean => at(x, y) === 'T'
const isFence = (x: number, y: number): boolean => at(x, y) === 'f'
const GRASS = [1, 2, 3, 4].map(v => `ground/forest/floor_${v}`)

const groundLayer: string[] = []
const wallsLayer: string[] = []
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = at(x, y)
    if (isRoad(x, y)) groundLayer.push(`ground/hub/path_${mask4(isRoad, x, y)}`)
    else if (isSquare(x, y)) groundLayer.push(`ground/village/cobble_${mask4(isSquare, x, y)}`)
    else if (!isWoods(x, y) && isWoods(x, y - 1)) groundLayer.push('ground/forest/shade')
    else groundLayer.push(GRASS[pickWeighted(cellHash(x, y, 101), [60, 20, 13, 7])])

    let wall = ''
    if (c === 'T') {
      const m = mask4(isWoods, x, y)
      wall = m === 15 ? `objects/forest/canopy_${1 + Math.floor(cellHash(x, y, 103) * 3)}` : `objects/forest/tree_${m}`
    }
    if (c === 's') wall = 'objects/hub/sign'
    if (c === 'l') wall = 'objects/village/lamp'
    if (c === 'p') wall = 'objects/village/planter'
    if (c === 'c') wall = 'objects/village/crate'
    if (c === 'f') wall = `objects/hub/fence_${mask4(isFence, x, y)}`
    wallsLayer.push(wall)
  }
}

// Buildings: each block's top-left corner, stamped from its tiles
const topLeft = (ch: string): { x: number; y: number } => find(ch)[0]
const gateDoors = DOORS.map(d => find(d)[0])
;['A', 'B', 'C'].forEach((block, i) => {
  const { x, y } = topLeft(block)
  const world = ACTS[i].world
  // Open doors here; GameScene shows a closed one while the chapter is locked
  stamp(wallsLayer, W, `objects/gate/${world}`, 3, 4, x, y, { col: 1, row: 3, key: `objects/gate/${world}_door_open` })
})
const hallDoor = find('H')[0]
stamp(wallsLayer, W, 'objects/hall/entrance', 3, 3, topLeft('h').x, topLeft('h').y, { col: 1, row: 2, key: 'objects/hall/entrance_door' })
stamp(wallsLayer, W, 'objects/village/house_a', 4, 4, topLeft('Q').x, topLeft('Q').y)
stamp(wallsLayer, W, 'objects/village/house_b', 4, 4, topLeft('R').x, topLeft('R').y)
const fountain = topLeft('O')
for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) wallsLayer[(fountain.y + r) * W + fountain.x + c] = `objects/village/fountain_${c}_${r}_f1`

// Gates: their target is resolved when you step on them (a chapter's first floor)
const stairs: StairData[] = [
  ...gateDoors.map((d, i): StairData => ({
    tileX: d.x, tileY: d.y, targetMapId: null, act: i + 1, direction: 'up', arrival: { tileX: d.x, tileY: d.y + 1, facing: 'down' },
  })),
  { tileX: hallDoor.x, tileY: hallDoor.y, targetMapId: 'map-00', direction: 'up', arrival: { tileX: hallDoor.x, tileY: hallDoor.y + 1, facing: 'down' } },
]

// Signs: one beside each gate, one for the hall, one by the spawn
const signs: SignData[] = find('s').map(({ x, y }): SignData => {
  const gate = gateDoors.findIndex(d => d.y + 1 === y && d.x + 1 === x)
  const textKey = gate >= 0 ? `sign_act${gate + 1}` : y >= hallDoor.y && x < W / 2 - 4 ? 'sign_training' : 'sign_village'
  return { tileX: x, tileY: y, textKey }
})

const guide = find('G')[0]
const spawn = find('@')[0]

// prettier-ignore
export const map01: MapData = {
  id: 'map-01',
  name: 'The Entrance',
  width: W,
  height: H,
  groundLayer,
  wallsLayer,
  noCollision: stairs.map(s => ({ tileX: s.tileX, tileY: s.tileY })),
  playerStart: { tileX: spawn.x, tileY: spawn.y, facing: 'up' },
  npcs: [
    { name: 'Guide', tileX: guide.x, tileY: guide.y, spriteKey: 'guide', facing: 'down', behavior: 'detect', dialogKey: 'welcome_npc' },
  ],
  requiredChallenges: [],
  stairs,
  signs,
}
