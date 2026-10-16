import { getAllMapIds, getMapById } from '@/data/maps/MapRegistry'
import { getChallenge } from '@/data/challenges'
import { getCodemon } from '@/data/codemon'
import { buildBattlePlan, isTrainer } from '@/systems/TrainerBattle'

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

  return problems
}
