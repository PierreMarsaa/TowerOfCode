import type { MapData } from '@/data/types'
import { getMapById } from '@/data/maps/MapRegistry'
import { getChallenge, getCurriculumClasses } from '@/data/challenges'
import { isAutoGraded } from '@/data/grading'
import { saveManager } from '@/systems/SaveManager'
import { towerFloorPlans, type TowerFloorPlan } from '@/generation/recipe'
import { generateTowerFloor, parseTowerMapId, towerMapId } from '@/generation/tower'
import { ACTS } from '@/generation/acts'

let plans: TowerFloorPlan[] | undefined

/** The tower's floors, built once from the course (one per chapter with something to fight) */
export function getTowerPlans(): TowerFloorPlan[] {
  plans ??= towerFloorPlans(getCurriculumClasses(), id => getChallenge(id)?.type, isAutoGraded)
  return plans
}

// Generated floors per "seed:floor" (New Game rolls a new seed without reloading the page)
const towerCache = new Map<string, MapData>()

/**
 * The map behind an id, for the game: a hand-made map from the registry, or a
 * tower floor ("tower-12") generated from this save's seed. Undefined for unknown
 * ids (e.g. a floor removed by a course update), so callers fall back to the Entrance.
 * The editor keeps using MapRegistry directly.
 */
export function resolveMap(id: string): MapData | undefined {
  const floor = parseTowerMapId(id)
  if (floor === null) return getMapById(id)
  const all = getTowerPlans()
  const plan = all[floor - 1]
  if (!plan) return undefined
  const seed = saveManager.getData().towerSeed
  const cacheKey = `${seed}:${floor}`
  let map = towerCache.get(cacheKey)
  if (!map) {
    map = generateTowerFloor(seed, plan, all.length).map
    towerCache.set(cacheKey, map)
  }
  return map
}

/** The game chapter (act) a map belongs to: tower floors only */
export function actOfMap(id: string): number | null {
  const floor = parseTowerMapId(id)
  return floor === null ? null : getTowerPlans()[floor - 1]?.act ?? null
}

/** An act's first floor (null if the act has none) */
export function actEntryMapId(act: number): string | null {
  const plan = getTowerPlans().find(p => p.act === act)
  return plan ? towerMapId(plan.floor) : null
}

/**
 * Act N opens once act N-1's boss is beaten. A save that already beat someone in
 * act N or later (saves from before the acts) keeps it open too.
 */
export function isActOpen(act: number, defeated: readonly string[]): boolean {
  if (act <= 1) return true
  const plans = getTowerPlans()
  const prevBoss = ACTS[act - 2]?.boss.name
  return defeated.some(id => {
    const sep = id.indexOf(':')
    const floor = parseTowerMapId(id.slice(0, sep))
    const floorAct = floor === null ? 0 : plans[floor - 1]?.act ?? 0
    return floorAct >= act || (floorAct === act - 1 && id.slice(sep + 1) === prevBoss)
  })
}
