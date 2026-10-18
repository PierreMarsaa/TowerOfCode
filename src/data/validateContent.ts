import { getAllMapIds, getMapById } from '@/data/maps/MapRegistry'
import { getChallenge, getChapter, getCurriculumClasses } from '@/data/challenges'
import { getCodemon } from '@/data/codemon'
import { buildBattlePlan, isTrainer } from '@/systems/TrainerBattle'
import { getTowerPlans } from '@/data/maps/resolveMap'
import { towerMapId } from '@/generation/tower'
import { TOWER_TILE_KEYS } from '@/generation/theme'
import { getAllTiles } from '@/data/tiles/TileRegistry'
import { getAllSprites } from '@/data/sprites/SpriteRegistry'
import { ACTS } from '@/generation/acts'
import { i18n } from '@/i18n/I18nManager'

/**
 * Dev-time check of map content against the synced course: catches references
 * that would silently break at play time (deleted exercises, renamed chapters,
 * duplicate trainer names). Returns one message per problem.
 */
export function validateContent(): string[] {
  const problems: string[] = []

  for (const mapId of getAllMapIds()) {
    const map = getMapById(mapId)
    if (!map) continue
    const trainerNames = new Set<string>()

    for (const npc of map.npcs) {
      if (isTrainer(npc)) {
        if (trainerNames.has(npc.name)) {
          problems.push(`${mapId}: two trainers named "${npc.name}" (the name identifies a trainer in the save)`)
        }
        trainerNames.add(npc.name)
        const plan = buildBattlePlan(mapId, npc, () => 0)
        if (typeof plan === 'string') problems.push(`${mapId}/${plan}`)
      }
      for (const id of npc.challengeIds ?? []) {
        if (!getChallenge(id)) problems.push(`${mapId}/${npc.name}: unknown exercise "${id}"`)
      }
      if (npc.codemon && !getCodemon(npc.codemon)) {
        problems.push(`${mapId}/${npc.name}: unknown Codémon "${npc.codemon}"`)
      }
    }

    for (const id of map.requiredChallenges) {
      if (!getChallenge(id)) problems.push(`${mapId}: requiredChallenges lists unknown exercise "${id}"`)
    }
  }

  // Tower floors: every fight can be built, every lesson chapter exists
  for (const plan of getTowerPlans()) {
    const mapId = towerMapId(plan.floor)
    plan.fights.forEach((fight, i) => {
      const result = buildBattlePlan(mapId, {
        name: `fight ${i + 1}`, tileX: 0, tileY: 0, facing: 'down', spriteKey: 'npc', behavior: 'static', guard: true,
        battle: { chapter: fight.chapter, questions: fight.questions, code: fight.code },
      }, () => 0)
      if (typeof result === 'string') problems.push(`${mapId}/${result}`)
    })
    for (const key of [...plan.lessonChapters, ...(plan.endingChapters ?? [])]) {
      if (!getChapter(key)) problems.push(`${mapId}: unknown lesson chapter "${key}"`)
    }
  }
  const tileKeys = new Set(getAllTiles().map(t => t.key))
  for (const key of TOWER_TILE_KEYS) {
    if (!tileKeys.has(key)) problems.push(`tower theme uses missing tile "${key}"`)
  }

  // Game chapters (acts): each starts at an existing course class, has floors, a boss with a sprite and lines
  const classKeys = new Set(getCurriculumClasses().map(c => c.key))
  const spriteKeys = new Set(getAllSprites().map(s => s.key))
  const dialogKeys = new Set(i18n.getDialogKeys())
  ACTS.forEach((act, i) => {
    if (i > 0 && !classKeys.has(act.firstClass)) problems.push(`act ${i + 1}: unknown first class "${act.firstClass}"`)
    if (!getTowerPlans().some(p => p.act === i + 1)) problems.push(`act ${i + 1}: no floor`)
    if (!spriteKeys.has(act.boss.spriteKey)) problems.push(`act ${i + 1}: boss sprite "${act.boss.spriteKey}" missing`)
    for (const key of [act.boss.dialogKey, act.boss.beatenDialogKey]) {
      if (!dialogKeys.has(key)) problems.push(`act ${i + 1}: dialog "${key}" missing`)
    }
  })

  // Hand-made maps: full layers, known tiles, signs with text, gates to existing acts
  for (const mapId of getAllMapIds()) {
    const map = getMapById(mapId)
    if (!map) continue
    const size = (map.width ?? 20) * (map.height ?? 15)
    if (map.groundLayer.length !== size || map.wallsLayer.length !== size) problems.push(`${mapId}: layers should have ${size} tiles`)
    const unknown = [...new Set([...map.groundLayer, ...map.wallsLayer])].filter(k => k && !tileKeys.has(k))
    if (unknown.length) problems.push(`${mapId}: unknown tiles ${unknown.join(', ')}`)
    for (const sign of map.signs ?? []) {
      if (!dialogKeys.has(sign.textKey)) problems.push(`${mapId}: sign text "${sign.textKey}" missing`)
    }
    for (const stair of map.stairs) {
      if (stair.act !== undefined && !(stair.act >= 1 && stair.act <= ACTS.length)) problems.push(`${mapId}: gate to unknown act ${stair.act}`)
    }
  }

  return problems
}
