#!/usr/bin/env node
/**
 * QA for the generated tower (src/generation/, the same code the game runs).
 * For SEEDS seeds × every floor of the Python course:
 *   - the floor generates (no crash) and is deterministic (same seed → identical map)
 *   - it validates: solvable, every guard mandatory, safe stair arrivals
 *   - every tile key exists under src/assets/tilesets/
 *   - game chapters (acts): numbers restart per act, the last floor of each holds the act's
 *     boss; the floors form one climb from the hub (the tower's hall) back to the hub
 * Prints timings and statistics. Needs Node 22+ (runs TypeScript directly).
 *
 * Usage: npm run check:tower            (SEEDS=50 npm run check:tower for more)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { towerFloorPlans } from '../src/generation/recipe.ts'
import { generateTowerFloor, towerMapId, validateFloor } from '../src/generation/tower.ts'
import { ACTS, HUB_MAP_ID } from '../src/generation/acts.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CURRICULUM = path.join(ROOT, 'src/data/curriculum/python')
const SEEDS = Number(process.env.SEEDS ?? 20)

// The course, as plain data (the game reads the same files through Vite)
const index = JSON.parse(readFileSync(path.join(CURRICULUM, 'index.json'), 'utf8'))
const typeOf = new Map()
for (const file of readdirSync(path.join(CURRICULUM, 'exercises'))) {
  for (const ex of JSON.parse(readFileSync(path.join(CURRICULUM, 'exercises', file), 'utf8'))) typeOf.set(ex.id, ex.type)
}
const grading = JSON.parse(readFileSync(path.join(CURRICULUM, 'grading.json'), 'utf8'))
const plans = towerFloorPlans(index.classes, id => typeOf.get(id), id => grading[id] === 'auto')

const tileExists = new Map()
const hasTile = key => {
  if (!tileExists.has(key)) tileExists.set(key, existsSync(path.join(ROOT, 'src/assets/tilesets', `${key}.png`)))
  return tileExists.get(key)
}

const failures = []
const times = []
let fallbacks = 0
let maxAttempts = 0
const fightTotals = []
const puzzles = { ice: 0, arrows: 0, teleporters: 0, eligibleIce: 0, eligibleArrows: 0, eligibleTeleporters: 0 }
for (let seed = 1; seed <= SEEDS; seed++) {
  for (const plan of plans) {
    const where = `seed ${seed} floor ${plan.floor}`
    try {
      const t0 = performance.now()
      const { map, attempts, fallback } = generateTowerFloor(seed, plan, plans.length)
      times.push(performance.now() - t0)
      if (fallback) fallbacks++
      maxAttempts = Math.max(maxAttempts, attempts)
      const again = generateTowerFloor(seed, plan, plans.length).map
      if (JSON.stringify(again) !== JSON.stringify(map)) failures.push(`${where}: not deterministic`)
      const problem = validateFloor(map)
      if (problem) failures.push(`${where}: ${problem}`)
      const missing = [...new Set([...map.groundLayer, ...map.wallsLayer])].filter(k => k && !hasTile(k))
      if (missing.length) failures.push(`${where}: unknown tiles ${missing.join(', ')}`)
      // Prof Pi teaches at the entrance of every floor, and is the guardian of the top one
      const profs = map.npcs.filter(n => n.name === 'Prof Pi')
      const top = plan.floor === plans.length
      if (profs.length !== 1 || !!profs[0].guard !== top) failures.push(`${where}: expected Prof Pi as the ${top ? 'guardian' : 'teacher'}`)
      // One climb from the hub to the hub, the boss on each act's last floor, per-act numbering
      const down = plan.floor === 1 ? HUB_MAP_ID : towerMapId(plan.floor - 1)
      const up = top ? HUB_MAP_ID : towerMapId(plan.floor + 1)
      if (map.stairs[0].targetMapId !== down || map.stairs[2].targetMapId !== down) failures.push(`${where}: stairs down should lead to ${down}`)
      if (map.stairs[1].targetMapId !== up) failures.push(`${where}: stairs up should lead to ${up}`)
      const guardian = map.npcs.filter(n => n.guard).at(-1)
      const boss = ACTS[plan.act - 1]?.boss
      if (plan.actLast && (guardian?.name !== boss?.name || guardian?.spriteKey !== boss?.spriteKey)) failures.push(`${where}: the last floor's guardian should be ${boss?.name}`)
      const bossNames = new Set(ACTS.map(a => a.boss.name))
      if (map.npcs.some(n => n.guard && bossNames.has(n.name) && !(plan.actLast && n === guardian))) failures.push(`${where}: a trainer uses a boss's name`)
      if (!map.title?.fr.startsWith(`Étage ${plan.actFloor} · `)) failures.push(`${where}: title should number the floor within its act`)
      if (seed === 1) fightTotals.push(map.npcs.filter(n => n.guard).length)
      const effects = map.tileEffects ?? []
      if (plan.floor >= 8) { puzzles.eligibleIce++; if (effects.some(e => e.effect === 'ice')) puzzles.ice++ }
      if (plan.floor >= 20) { puzzles.eligibleArrows++; if (effects.some(e => e.effect === 'redirect')) puzzles.arrows++ }
      if (plan.floor >= 35) { puzzles.eligibleTeleporters++; if (map.teleports?.length) puzzles.teleporters++ }
    } catch (e) {
      failures.push(`${where}: ${e.message}`)
    }
  }
}

times.sort((a, b) => a - b)
const avg = times.reduce((a, b) => a + b, 0) / times.length
const p = q => times[Math.min(times.length - 1, Math.floor(times.length * q))]
console.log(`Floors: ${plans.length} per tower × ${SEEDS} seeds = ${plans.length * SEEDS}`)
console.log(`Generation: avg ${avg.toFixed(1)} ms, p95 ${p(0.95).toFixed(1)} ms, worst ${times[times.length - 1].toFixed(1)} ms`)
console.log(`Retries: worst ${maxAttempts} attempts; straight-row fallbacks: ${fallbacks}`)
const pct = (n, d) => `${n}/${d} (${d ? Math.round((n * 100) / d) : 0}%)`
console.log(`Floors with puzzles: ice ${pct(puzzles.ice, puzzles.eligibleIce)}, arrows ${pct(puzzles.arrows, puzzles.eligibleArrows)}, teleporters ${pct(puzzles.teleporters, puzzles.eligibleTeleporters)} (of floors where unlocked)`)
console.log(`Fights per floor (seed 1): ${[...new Set(fightTotals)].sort().map(n => `${n}×${fightTotals.filter(f => f === n).length}`).join(', ')}`)
console.log(`First floors: ${plans.slice(0, 3).map(p => `${p.floor}:${p.chapterKey}[${p.fights.length} fights, lesson ${p.lessonChapters.join('+')}]`).join('  ')}`)
console.log(`Chapters: ${ACTS.map((a, i) => { const f = plans.filter(p => p.act === i + 1); return `${i + 1} ${a.title.en} (${a.world}) floors ${f[0]?.floor}-${f.at(-1)?.floor}, boss ${a.boss.name}` }).join(' | ')}`)
if (ACTS.some((_, i) => !plans.some(p => p.act === i + 1))) failures.push('an act has no floor (check ACTS firstClass keys)')
if (failures.length) {
  console.log(`\nFAILED (${failures.length}):`)
  for (const f of failures.slice(0, 40)) console.log('  ✗ ' + f)
  process.exit(1)
}
console.log('\nALL FLOORS VALID')
