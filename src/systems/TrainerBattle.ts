import type { ChallengeConfig, NPCData } from '@/data/types'
import { getChallenge, getChapter } from '@/data/challenges'
import { codemonForTrainer, getCodemon, type CodemonDef } from '@/data/codemon'
import { saveManager } from '@/systems/SaveManager'
import { isAutoGraded } from '@/data/grading'

/** Exercise types a trainer asks as questions (explanations are lessons, challenges are code fights) */
const QUESTION_TYPES = new Set<ChallengeConfig['type']>(['multiple_choice', 'fill_in_text', 'matching_pairs'])

/** What a talk with a trainer turns into */
export interface BattlePlan {
  /** Save key of this trainer: "<mapId>:<npcName>" */
  trainerId: string
  trainerName: string
  opponent: CodemonDef
  /** Exercise ids in order: unseen lessons interleaved with the drawn questions, then the code fight */
  steps: string[]
  /** Steps that hit the opponent (everything but explanations) = opponent HP. 0 = a lesson, not a battle */
  gradedSteps: number
}

export function isTrainer(npc: NPCData): boolean {
  return npc.behavior !== 'gatekeeper' && (!!npc.battle || !!npc.challengeIds?.length)
}

export function trainerIdOf(mapId: string, npc: NPCData): string {
  return `${mapId}:${npc.name}`
}

function typeOf(id: string): ChallengeConfig['type'] | undefined {
  return getChallenge(id)?.type
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Code fight: prefer auto-checked challenges the player hasn't solved (a real fight),
 * then any unsolved one (new practice beats a repeat), then auto-checked, then any
 */
function pickCodeChallenge(pool: string[], rng: () => number): string | undefined {
  const fresh = (id: string) => !saveManager.isChallengeCompleted(id)
  const tiers = [
    pool.filter(id => isAutoGraded(id) && fresh(id)),
    pool.filter(fresh),
    pool.filter(id => isAutoGraded(id)),
    pool,
  ]
  const candidates = tiers.find(t => t.length) ?? []
  return candidates.length ? candidates[Math.floor(rng() * candidates.length)] : undefined
}

/** Draw `count` ids, unanswered ones first, so trainers on one floor don't repeat each other */
function drawFreshFirst(pool: string[], count: number, rng: () => number): Set<string> {
  const fresh = pool.filter(id => !saveManager.isChallengeCompleted(id))
  const answered = pool.filter(id => saveManager.isChallengeCompleted(id))
  return new Set([...shuffled(fresh, rng), ...shuffled(answered, rng)].slice(0, count))
}

/**
 * Build the battle for a trainer. Returns an error string for content mistakes
 * (unknown chapter, nothing to fight with) so the caller can surface them.
 */
export function buildBattlePlan(mapId: string, npc: NPCData, rng: () => number = Math.random): BattlePlan | string {
  const trainerId = trainerIdOf(mapId, npc)
  const opponent = (npc.codemon ? getCodemon(npc.codemon) : undefined) ?? codemonForTrainer(trainerId)
  let steps: string[]

  if (npc.battle) {
    const chapter = getChapter(npc.battle.chapter)
    if (!chapter) return `${npc.name}: unknown chapter "${npc.battle.chapter}"`
    const ids = chapter.exerciseIds.filter(id => getChallenge(id))

    const questionPool = ids.filter(id => QUESTION_TYPES.has(typeOf(id)!))
    const count = Math.min(npc.battle.questions ?? 3, questionPool.length)
    const drawn = drawFreshFirst(questionPool, count, rng)

    // Walk the chapter in course order so each lesson sits right before its questions.
    // Lessons already read are skipped: the first trainer of a chapter teaches it.
    steps = ids.filter(id =>
      drawn.has(id) || (typeOf(id) === 'explanation' && !saveManager.isChallengeCompleted(id)))

    if (npc.battle.code) {
      const code = pickCodeChallenge(ids.filter(id => typeOf(id) === 'challenge'), rng)
      if (code) steps.push(code)
    }
  } else {
    steps = (npc.challengeIds ?? []).filter(id => getChallenge(id))
  }

  const gradedSteps = steps.filter(id => typeOf(id) !== 'explanation').length
  if (npc.battle && gradedSteps === 0) {
    return `${npc.name}: chapter "${npc.battle.chapter}" has nothing to fight with`
  }
  if (steps.length === 0) return `${npc.name}: none of its exercises exist`

  return { trainerId, trainerName: npc.name, opponent, steps, gradedSteps }
}

/**
 * What a teacher NPC says (`lesson`): every lesson of those chapters, in course
 * order, read-only (no battle, nothing to win). Undefined if none exist.
 */
export function buildLessonPlan(mapId: string, npc: NPCData): BattlePlan | undefined {
  const steps = (npc.lesson ?? [])
    .flatMap(key => getChapter(key)?.exerciseIds ?? [])
    .filter(id => typeOf(id) === 'explanation')
  if (!steps.length) return undefined
  const trainerId = trainerIdOf(mapId, npc)
  return { trainerId, trainerName: npc.name, opponent: codemonForTrainer(trainerId), steps, gradedSteps: 0 }
}
