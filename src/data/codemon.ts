/**
 * Codémon roster, copied from Code-Life (src/services/codemon/config.ts).
 * Ids match Code-Life's and the art in src/assets/codemon/<id>.webp
 * (copied by `npm run sync:codelife`). Zap is Prof Pi's own Codémon; it is
 * not one of the 18 collectibles.
 */

export type CodemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy'

export interface CodemonDef {
  id: string
  name: string
  type: CodemonType
}

/** Accent colour of each type (same as Code-Life's Codédex) */
export const CODEMON_TYPE_COLORS: Record<CodemonType, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
}

export const ZAP: CodemonDef = { id: 'zap', name: 'Zap', type: 'electric' }

/** The 18 collectibles, in Codédex order */
export const CODEMON: CodemonDef[] = [
  { id: 'aqua', name: 'Aquachu', type: 'water' },
  { id: 'pyro', name: 'Pyrochu', type: 'fire' },
  { id: 'flora', name: 'Florachu', type: 'grass' },
  { id: 'rocka', name: 'Rockachu', type: 'rock' },
  { id: 'meta', name: 'Metachu', type: 'steel' },
  { id: 'volta', name: 'Voltachu', type: 'electric' },
  { id: 'pura', name: 'Purachu', type: 'normal' },
  { id: 'cryo', name: 'Cryochu', type: 'ice' },
  { id: 'comba', name: 'Combachu', type: 'fighting' },
  { id: 'toxi', name: 'Toxichu', type: 'poison' },
  { id: 'terra', name: 'Terrachu', type: 'ground' },
  { id: 'venta', name: 'Ventachu', type: 'flying' },
  { id: 'psyka', name: 'Psykachu', type: 'psychic' },
  { id: 'buga', name: 'Bugachu', type: 'bug' },
  { id: 'shadow', name: 'Shadowchu', type: 'ghost' },
  { id: 'draco', name: 'Dracochu', type: 'dragon' },
  { id: 'nympha', name: 'Nymphachu', type: 'fairy' },
  { id: 'luna', name: 'Lunachu', type: 'dark' },
]

const byId = new Map([ZAP, ...CODEMON].map(c => [c.id, c]))

const artUrls = new Map(
  Object.entries(
    import.meta.glob('/src/assets/codemon/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  ).map(([file, url]) => [file.replace(/^.*\//, '').replace(/\.webp$/, ''), url]),
)

export function getCodemon(id: string): CodemonDef | undefined {
  return byId.get(id)
}

/** Texture key of a Codémon's painted art in Phaser (loaded by BootScene) */
export const codemonTexture = (id: string): string => `codemon-${id}`

export function codemonArtUrl(id: string): string | undefined {
  return artUrls.get(id)
}

/** Stable pick for a trainer that doesn't name its Codémon (never Zap) */
export function codemonForTrainer(seed: string): CodemonDef {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return CODEMON[Math.abs(hash) % CODEMON.length]
}
