import type { MapData, NPCData, StairData } from '@/data/types'
import { createRng, hashSeed, label, type Rng } from './rng.ts'
import { generateLayout, type Layout } from './layout.ts'
import { FLOOR, ROCK, carveLayout, cellAt, erodeRoom, fillRoom, type FloorGrid, type RoomKind } from './rooms.ts'
import { populate, type Placement } from './populate.ts'
import { EXIT_TILE, STAIRS_DOWN_TILE, STAIRS_UP_TILE, TELEPORTER_TILES, worldForAct } from './theme.ts'
import { skinFloor } from './skin.ts'
import { ACTS, HUB_MAP_ID } from './acts.ts'
import { buildSimWorld, reachableFrom, simulateMove, type Point } from './simulate.ts'
import type { TowerFloorPlan } from './recipe.ts'
import { DIR_OFFSETS, DIRECTIONS } from '../utils/directions.ts'

/*
 * One tower floor from (seed, plan): layout → room fills → placement → map
 * (drawn in its act's world, src/generation/skin.ts), then proven playable with the game's own movement rules:
 *   - solvable: from the spawn, guards are beaten as they become reachable and
 *     the stairs up are reached in the end
 *   - no traps: from every tile you can reach, some stairs stay reachable
 *     (an ice slide or an arrow can't strand you)
 *   - mandatory: with any single guard left in place, the stairs up are unreachable
 *   - arrivals: every stair's arrival tile is free walkable floor
 * A failed floor is retried with the next sub-seed; the last resort is a
 * straight row of plain rooms. Pure and deterministic: same input, same map.
 */

export const TOWER_PREFIX = 'tower-'
const STARTING_HP = 3
const MAX_ATTEMPTS = 24

export function towerMapId(floor: number): string {
  return `${TOWER_PREFIX}${floor}`
}

/** "tower-12" → 12, anything else → null */
export function parseTowerMapId(id: string): number | null {
  if (!id.startsWith(TOWER_PREFIX)) return null
  const n = Number(id.slice(TOWER_PREFIX.length))
  return Number.isInteger(n) && n > 0 ? n : null
}

const TRAINER_NAMES = [
  'Ada', 'Alan', 'Grace', 'Guido', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Bjarne',
  'Brendan', 'Tim', 'Katherine', 'Hedy', 'Radia', 'Frances', 'Donald', 'Edsger', 'John', 'Anita',
  'Sophie', 'Joan', 'Yukihiro', 'Rasmus', 'James', 'Larry', 'Brian', 'Niklaus', 'Shafi', 'Evelyn',
  'Annie', 'Jean', 'Mary', 'Lynn', 'Adele', 'Fran', 'Hal', 'Leslie', 'Rob', 'Carol',
]

/** The trainer looks (src/assets/sprites/), picked per trainer */
const TRAINER_SPRITES = ['npc', 'trainer2', 'trainer3', 'trainer4', 'trainer5', 'trainer6']

export interface GeneratedFloor {
  map: MapData
  attempts: number
  fallback: boolean
}

export function generateTowerFloor(seed: number, plan: TowerFloorPlan, totalFloors: number): GeneratedFloor {
  const layoutSeed = hashSeed(seed, plan.floor, label('layout'))
  const fightCount = plan.fights.length
  const shape = createRng(layoutSeed)
  const pathLength = fightCount + 1 + shape.int(0, 2)
  const sideCount = shape.int(0, 2)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const map = buildFloor(seed, plan, totalFloors, attempt, pathLength, sideCount, false)
    if (map && validateFloor(map) === null) return { map, attempts: attempt + 1, fallback: false }
  }
  // Last resort: a straight row of plain rooms
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const map = buildFloor(seed, plan, totalFloors, attempt, fightCount + 1, 0, true)
    if (map && validateFloor(map) === null) return { map, attempts: MAX_ATTEMPTS + attempt + 1, fallback: true }
  }
  throw new Error(`Tower floor ${plan.floor}: no valid layout`)
}

function buildFloor(
  seed: number, plan: TowerFloorPlan, totalFloors: number, attempt: number,
  pathLength: number, sideCount: number, straight: boolean,
): MapData | null {
  const layoutRng = createRng(hashSeed(seed, plan.floor, label('layout'), attempt, straight ? 1 : 0))
  const layout = generateLayout(layoutRng, pathLength, sideCount, straight)
  if (!layout) return null
  const grid = carveLayout(layout)
  // Woods and caves have natural clearings and chambers; the citadel keeps square halls
  const natural = worldForAct(plan.act) !== 'citadel'
  for (const room of layout.rooms) {
    const kind = fillRoom(grid, layout, room, straight ? 'plain' : roomKind(room.role, plan.floor, layoutRng), layoutRng)
    if (natural && (kind === 'plain' || kind === 'rocks')) erodeRoom(grid, layout, room, hashSeed(seed, plan.floor, room.id, attempt))
  }
  // Population has its own stream, so fight counts don't reshape the rooms
  const popRng = createRng(hashSeed(seed, plan.floor, label('population'), attempt))
  const placement = populate(grid, layout, plan.fights.length, popRng)
  if (!placement) return null
  return toMapData(seed, plan, totalFloors, layout, grid, placement)
}

/** Puzzle variety unlocks as the player climbs; the newest mechanic shows up most */
function roomKind(role: string, floor: number, rng: Rng): RoomKind {
  if (role !== 'path') return 'plain'
  const kinds: RoomKind[] = ['plain', 'rocks']
  if (floor >= 3) kinds.push('maze', 'maze')
  if (floor >= 8) kinds.push('ice', 'ice')
  if (floor >= 20) kinds.push('arrows', 'arrows')
  if (floor >= 35) kinds.push('teleport', 'teleport', 'teleport')
  return rng.pick(kinds)
}

/** Trainer names: hashed per role so a name survives course changes elsewhere on the floor */
function trainerNames(seed: number, floor: number, count: number): string[] {
  const names: string[] = []
  const roles = ['guardian', ...Array.from({ length: count - 1 }, (_, i) => `trainer${i}`)]
  for (const role of roles) {
    let i = hashSeed(seed, floor, label(role)) % TRAINER_NAMES.length
    while (names.includes(TRAINER_NAMES[i])) i = (i + 1) % TRAINER_NAMES.length
    names.push(TRAINER_NAMES[i])
  }
  // names[0] is the guardian's; trainers follow in order
  return [...names.slice(1), names[0]]
}

function toMapData(
  seed: number, plan: TowerFloorPlan, totalFloors: number,
  layout: Layout, grid: FloorGrid, placement: Placement,
): MapData {
  const world = worldForAct(plan.act)
  // At least one screen, so the camera never shows outside the map
  const width = Math.max(layout.width, 20)
  const height = Math.max(layout.height, 15)
  const corridor = new Set(layout.bridges.flatMap(b => [...b.tiles, b.doorFrom, b.doorTo]).map(p => `${p.x},${p.y}`))
  const roomOf = (id: number) => layout.rooms.find(r => r.id === id)!
  // Citadel halls: a carpet in the entrance and stairs rooms
  const carpets = world !== 'citadel' ? [] : [roomOf(layout.path[0]), roomOf(layout.path[layout.path.length - 1])]
    .filter(r => r.rect.w >= 5 && r.rect.h >= 4)
    .map(r => ({ x: r.rect.x + 1, y: r.rect.y + 1, w: r.rect.w - 2, h: r.rect.h - 2 }))
  const { ground: groundLayer, walls: wallsLayer } = skinFloor({
    world, width, height,
    cell: (x, y) => { const c = cellAt(grid, x, y); return c === FLOOR ? 'floor' : c === ROCK ? 'rock' : 'void' },
    corridor: (x, y) => corridor.has(`${x},${y}`) && cellAt(grid, x, y) === FLOOR,
    carpets,
    effects: grid.effects,
    salt: hashSeed(seed, plan.floor),
  })
  // Teleporter pairs share a colour
  grid.teleports.forEach((t, i) => {
    wallsLayer[t.tileY * width + t.tileX] = TELEPORTER_TILES[Math.floor(i / 2) % TELEPORTER_TILES.length]
  })

  // One climb: floor 1 starts from the hub (the tower's hall); an act's last floor (its boss)
  // opens a portal to the next act's first floor, and the top floor's portal leads back to the hall
  const below = plan.floor > 1 ? towerMapId(plan.floor - 1) : HUB_MAP_ID
  const above = plan.floor < totalFloors ? towerMapId(plan.floor + 1) : HUB_MAP_ID
  const stair = (s: Placement['down'], target: string | null, direction: 'up' | 'down'): StairData =>
    ({ tileX: s.x, tileY: s.y, targetMapId: target, direction, arrival: s.arrival })
  // The entrance stairs first: arriving from below looks stairs up by target, never these
  const stairs = [stair(placement.down, below, 'down'), stair(placement.up, above, 'up'), stair(placement.back, below, 'down')]
  for (const s of stairs) {
    wallsLayer[s.tileY * width + s.tileX] = s.direction === 'down' ? STAIRS_DOWN_TILE : plan.actLast ? EXIT_TILE : STAIRS_UP_TILE
  }

  const top = plan.floor === totalFloors
  const boss = plan.actLast ? ACTS[plan.act - 1]?.boss : undefined
  const names = trainerNames(seed, plan.floor, plan.fights.length)
  const npcs: NPCData[] = placement.guards.map((g): NPCData => {
    const fight = plan.fights[g.fight]
    const guardian = g.fight === plan.fights.length - 1
    const battle = { chapter: fight.chapter, questions: fight.questions, code: fight.code }
    // An act's last guardian is its boss; once beaten they speak (Prof Pi's lesson closes the course)
    if (guardian && boss) {
      return {
        name: boss.name,
        tileX: g.x,
        tileY: g.y,
        facing: g.facing,
        spriteKey: boss.spriteKey,
        behavior: 'static',
        guard: true,
        battle,
        dialogKey: boss.dialogKey,
        beatenDialogKey: boss.beatenDialogKey,
        lesson: plan.endingChapters?.length ? [...plan.endingChapters] : undefined,
      }
    }
    return {
      name: names[g.fight],
      tileX: g.x,
      tileY: g.y,
      facing: g.facing,
      spriteKey: TRAINER_SPRITES[hashSeed(seed, plan.floor, label(names[g.fight])) % TRAINER_SPRITES.length],
      behavior: 'static',
      guard: true,
      battle,
      dialogKey: guardian ? 'tower_guardian' : undefined,
    }
  })
  // Prof Pi greets the player at the entrance, except on the top floor where he waits at the stairs
  if (!top) {
    npcs.unshift({
      name: 'Prof Pi',
      tileX: placement.prof.x,
      tileY: placement.prof.y,
      facing: placement.prof.facing,
      spriteKey: 'profPi',
      behavior: 'static',
      dialogKey: plan.lessonChapters.length ? 'tower_prof_lesson' : 'tower_prof_review',
      lesson: plan.lessonChapters.length ? [...plan.lessonChapters] : undefined,
    })
  }

  return {
    id: towerMapId(plan.floor),
    name: `Floor ${plan.actFloor}`,
    title: {
      en: `Floor ${plan.actFloor} · ${plan.chapterTitle.en}`,
      fr: `Étage ${plan.actFloor} · ${plan.chapterTitle.fr}`,
    },
    width,
    height,
    groundLayer,
    wallsLayer,
    noCollision: [...stairs, ...grid.teleports].map(s => ({ tileX: s.tileX, tileY: s.tileY })),
    playerStart: placement.spawn,
    npcs,
    requiredChallenges: [],
    stairs,
    tileEffects: [...grid.effects.values()],
    teleports: grid.teleports.map(t => ({ ...t })),
    hearts: placement.hearts.map(h => ({ tileX: h.x, tileY: h.y })),
    startingHp: STARTING_HP,
  }
}

// ── Validation ──

const key = (p: { x: number; y: number }): string => `${p.x},${p.y}`
const pos = (n: NPCData): Point => ({ x: n.tileX, y: n.tileY })

/** Null when the floor is playable as designed, otherwise why it isn't */
export function validateFloor(map: MapData): string | null {
  const guards = map.npcs.filter(n => n.guard)
  const others = map.npcs.filter(n => !n.guard)
  const up = map.stairs.find(s => s.direction === 'up')
  if (!up) return 'no stairs up'
  const start = { x: map.playerStart.tileX, y: map.playerStart.tileY }
  const stops = new Set(map.stairs.map(s => key({ x: s.tileX, y: s.tileY })))
  const upKey = key({ x: up.tileX, y: up.tileY })

  // Arrival tiles: free walkable floor, no NPC, effect, stair or teleporter
  const all = buildSimWorld(map, map.npcs.map(pos))
  const npcTiles = new Set(map.npcs.map(n => key(pos(n))))
  for (const s of map.stairs) {
    const a = s.arrival
    if (!a) return 'stair without arrival'
    const k = key({ x: a.tileX, y: a.tileY })
    if (all.tiles.isWallAt(a.tileX, a.tileY) || npcTiles.has(k) || stops.has(k)) return `bad arrival ${k}`
    if (all.tiles.getEffect(a.tileX, a.tileY)) return `arrival on an effect ${k}`
    if (map.teleports?.some(t => t.tileX === a.tileX && t.tileY === a.tileY)) return `arrival on a teleporter ${k}`
  }

  // Solvable: beat guards as they become reachable (talk from a neighbouring tile)
  let remaining = [...guards]
  for (;;) {
    const reach = reachableFrom(buildSimWorld(map, [...others, ...remaining].map(pos)), start, stops)
    const talkable = remaining.filter(g => DIRECTIONS.some(d => reach.has(key({ x: g.tileX + DIR_OFFSETS[d].x, y: g.tileY + DIR_OFFSETS[d].y }))))
    if (!talkable.length) break
    remaining = remaining.filter(g => !talkable.includes(g))
  }
  if (remaining.length) return `unreachable guard ${remaining[0].name}`
  const open = reachableFrom(buildSimWorld(map, others.map(pos)), start, stops)
  if (!open.has(upKey)) return 'stairs up unreachable'
  for (const s of map.stairs) {
    if (!open.has(key({ x: s.tileX, y: s.tileY }))) return 'a stair is unreachable'
  }

  // No traps: every reachable tile can still get to some stairs (taking the stairs
  // down and back up restarts at the entrance, so any stairs is a way out)
  const world = buildSimWorld(map, others.map(pos))
  const into = new Map<string, string[]>() // tile → tiles that move onto it
  for (const k of open) {
    if (stops.has(k)) continue // stepping on stairs leaves the map
    const [x, y] = k.split(',').map(Number)
    for (const dir of DIRECTIONS) {
      const q = simulateMove(world, x, y, dir)
      if (!q) continue
      const qk = key(q)
      const list = into.get(qk)
      if (list) list.push(k)
      else into.set(qk, [k])
    }
  }
  const canLeave = new Set(stops)
  const queue = [...stops]
  for (let i = 0; i < queue.length; i++) {
    for (const prev of into.get(queue[i]) ?? []) {
      if (canLeave.has(prev)) continue
      canLeave.add(prev)
      queue.push(prev)
    }
  }
  for (const k of open) if (!canLeave.has(k)) return `trap at ${k}`

  // Mandatory: every guard alone blocks the way up
  for (const g of guards) {
    const reach = reachableFrom(buildSimWorld(map, [...others, g].map(pos)), start, stops)
    if (reach.has(upKey)) return `guard ${g.name} can be bypassed`
  }
  return null
}
