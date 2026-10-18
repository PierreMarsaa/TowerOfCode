import type { CodemonType } from '@/data/codemon'

/**
 * The standard 18-type chart: how well an attacking type hits a defending type
 * (2 super effective, 0.5 not very effective, 0 no effect, else 1). Type names
 * in French and English are copied from Code-Life's translations.
 */

type Row = { strong?: CodemonType[]; weak?: CodemonType[]; none?: CodemonType[] }

const CHART: Record<CodemonType, Row> = {
  normal: { weak: ['rock', 'steel'], none: ['ghost'] },
  fire: { strong: ['grass', 'ice', 'bug', 'steel'], weak: ['fire', 'water', 'rock', 'dragon'] },
  water: { strong: ['fire', 'ground', 'rock'], weak: ['water', 'grass', 'dragon'] },
  electric: { strong: ['water', 'flying'], weak: ['electric', 'grass', 'dragon'], none: ['ground'] },
  grass: { strong: ['water', 'ground', 'rock'], weak: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'] },
  ice: { strong: ['grass', 'ground', 'flying', 'dragon'], weak: ['fire', 'water', 'ice', 'steel'] },
  fighting: { strong: ['normal', 'ice', 'rock', 'dark', 'steel'], weak: ['poison', 'flying', 'psychic', 'bug', 'fairy'], none: ['ghost'] },
  poison: { strong: ['grass', 'fairy'], weak: ['poison', 'ground', 'rock', 'ghost'], none: ['steel'] },
  ground: { strong: ['fire', 'electric', 'poison', 'rock', 'steel'], weak: ['grass', 'bug'], none: ['flying'] },
  flying: { strong: ['grass', 'fighting', 'bug'], weak: ['electric', 'rock', 'steel'] },
  psychic: { strong: ['fighting', 'poison'], weak: ['psychic', 'steel'], none: ['dark'] },
  bug: { strong: ['grass', 'psychic', 'dark'], weak: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'] },
  rock: { strong: ['fire', 'ice', 'flying', 'bug'], weak: ['fighting', 'ground', 'steel'] },
  ghost: { strong: ['psychic', 'ghost'], weak: ['dark'], none: ['normal'] },
  dragon: { strong: ['dragon'], weak: ['steel'], none: ['fairy'] },
  dark: { strong: ['psychic', 'ghost'], weak: ['fighting', 'dark', 'fairy'] },
  steel: { strong: ['ice', 'rock', 'fairy'], weak: ['fire', 'water', 'electric', 'steel'] },
  fairy: { strong: ['fighting', 'dragon', 'dark'], weak: ['fire', 'poison', 'steel'] },
}

/** Multiplier when `attack` hits `defense` */
export function effectiveness(attack: CodemonType, defense: CodemonType): number {
  const row = CHART[attack]
  if (row.none?.includes(defense)) return 0
  if (row.strong?.includes(defense)) return 2
  if (row.weak?.includes(defense)) return 0.5
  return 1
}

export const TYPE_NAMES: Record<CodemonType, { en: string; fr: string }> = {
  normal: { en: 'Normal', fr: 'Normal' },
  fire: { en: 'Fire', fr: 'Feu' },
  water: { en: 'Water', fr: 'Eau' },
  electric: { en: 'Electric', fr: 'Électrique' },
  grass: { en: 'Grass', fr: 'Plante' },
  ice: { en: 'Ice', fr: 'Glace' },
  fighting: { en: 'Fighting', fr: 'Combat' },
  poison: { en: 'Poison', fr: 'Poison' },
  ground: { en: 'Ground', fr: 'Sol' },
  flying: { en: 'Flying', fr: 'Vol' },
  psychic: { en: 'Psychic', fr: 'Psy' },
  bug: { en: 'Bug', fr: 'Insecte' },
  rock: { en: 'Rock', fr: 'Roche' },
  ghost: { en: 'Ghost', fr: 'Spectre' },
  dragon: { en: 'Dragon', fr: 'Dragon' },
  dark: { en: 'Dark', fr: 'Ténèbres' },
  steel: { en: 'Steel', fr: 'Acier' },
  fairy: { en: 'Fairy', fr: 'Fée' },
}
