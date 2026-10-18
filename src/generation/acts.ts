import type { LocalizedText } from '@/data/types'

/*
 * The game's three chapters. In code they're "acts", because "chapter" already
 * means a chapter of the course (one tower floor each); players see "Chapitre".
 * Each act starts at a class of the course, has its own world and final boss;
 * beating the boss opens the way to the next act's first floor.
 */

export type WorldId = 'forest' | 'caves' | 'citadel'

export interface ActBoss {
  name: string
  spriteKey: string
  /** Said before the fight */
  dialogKey: string
  /** Said once beaten, before stepping aside */
  beatenDialogKey: string
}

export interface ActDef {
  /** Course class the act starts with (the first act also takes anything before it) */
  firstClass: string
  title: LocalizedText
  world: WorldId
  boss: ActBoss
}

export const ACTS: readonly ActDef[] = [
  {
    firstClass: 'intro-python',
    title: { en: 'The Basics', fr: 'Les bases' },
    world: 'forest',
    boss: { name: 'Boole', spriteKey: 'boole', dialogKey: 'boss_boole', beatenDialogKey: 'boss_boole_beaten' },
  },
  {
    firstClass: 'lists',
    title: { en: 'Data & Loops', fr: 'Données & boucles' },
    world: 'caves',
    boss: { name: 'Lovelace', spriteKey: 'lovelace', dialogKey: 'boss_lovelace', beatenDialogKey: 'boss_lovelace_beaten' },
  },
  {
    firstClass: 'functions',
    title: { en: 'Advanced', fr: 'Avancé' },
    world: 'citadel',
    boss: { name: 'Prof Pi', spriteKey: 'profPi', dialogKey: 'tower_final', beatenDialogKey: 'tower_ending' },
  },
]

/** Where the climb starts (floor 1's stairs down) and ends (the top floor's portal): the tower's hall */
export const HUB_MAP_ID = 'tower-0'

/** 1-based act of a course class index: the last act starting at or before it */
export function actOfClassIndex(classIndex: number, classKeys: readonly string[]): number {
  let act = 1
  ACTS.forEach((a, i) => {
    const start = i === 0 ? 0 : classKeys.indexOf(a.firstClass)
    if (start >= 0 && start <= classIndex) act = i + 1
  })
  return act
}
