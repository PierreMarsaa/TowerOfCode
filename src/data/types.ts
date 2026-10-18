export interface LocalizedText {
  en: string
  fr: string
}

export type Direction = 'down' | 'up' | 'left' | 'right'

export type NpcBehavior = 'static' | 'detect' | 'lookout' | 'lookout-random' | 'patrol' | 'gatekeeper'

/** A trainer battle drawn from one chapter of the course */
export interface TrainerBattleData {
  /** Chapter key "<classId>/<chapterId>" (see src/data/curriculum/python/index.json) */
  chapter: string
  /** How many quiz questions to draw from the chapter (default 3, capped by what exists) */
  questions?: number
  /** End the battle with one of the chapter's coding challenges */
  code?: boolean
}

export interface NPCData {
  name: string  // unique per map: it identifies a trainer in the save
  tileX: number
  tileY: number
  facing: Direction
  spriteKey: string
  behavior: NpcBehavior
  dialogKey?: string
  /** Legacy: explicit exercise ids (what the frozen editor writes). Prefer `battle`. */
  challengeIds?: string[]
  battle?: TrainerBattleData
  /** Opponent Codémon id (default: a stable pick from the trainer's name) */
  codemon?: string
  /** Blocks its tile until beaten, then leaves for good (tower bridges, stairs guardian) */
  guard?: boolean
  /** Chapter keys this NPC teaches when talked to: their lessons, no battle (Prof Pi on tower floors) */
  lesson?: string[]
  /** A guard says this once beaten, before stepping aside (a chapter's boss) */
  beatenDialogKey?: string
  /** Sprite tint (0xRRGGBB), so generated trainers don't all look alike */
  tint?: number
  lookoutPattern?: Direction[]
  lookoutTempo?: number
  patrolPath?: { x: number; y: number }[]
  // ── Story (all optional: the frozen editor never writes them) ──
  /** Stable handle for scripts (defaults to the name) */
  id?: string
  /** Talking to this character runs a script instead of the dialog */
  talkScript?: string
  /** Only present when the save's story flags match */
  visibleWhen?: Condition
  /** Not on the map until a script shows it */
  hidden?: boolean
  /** How many tiles a 'detect' trainer sees ahead (default 4) */
  sight?: number
}

/** A test on the save's story flags: every flag of `all`, none of `none` */
export interface Condition {
  all?: string[]
  none?: string[]
}

/** Runs a story script when the player steps into an area, or when the map opens */
export interface TriggerData {
  id: string
  on: 'step' | 'enter'
  /** Tiles that trigger it (step triggers): x, y and an optional size */
  area?: { x: number; y: number; w?: number; h?: number }
  script: string
  when?: Condition
}

// --- CL Exercise format ---

export interface ClContentBlock {
  type: 'text' | 'codeBlock' | 'codeEditorRun' | 'image' | 'infoCard' | 'profPi' | 'row'
  language?: string
  value?: LocalizedText | string  // absent on 'row'
  caption?: LocalizedText
  cardType?: string
  expandable?: boolean
  initiallyExpanded?: boolean
  title?: LocalizedText
  content?: LocalizedText | string
  children?: ClContentBlock[]     // 'row': blocks shown side by side
}

interface ClBase {
  id: string
  metadata?: {
    difficulty?: string
    tags?: string[]
  }
  title: LocalizedText
}

export interface ClExplanationConfig extends ClBase {
  type: 'explanation'
  content: {
    question: ClContentBlock[]
  }
}

export interface ClMultipleChoiceOption {
  type: 'text' | 'codeBlock'
  value: LocalizedText | string
  language?: string
}

export interface ClMultipleChoiceConfig extends ClBase {
  type: 'multiple_choice'
  content: {
    question: ClContentBlock[]
    exercise: {
      options: ClMultipleChoiceOption[]
      correctAnswer: number
    }
    hint: LocalizedText
  }
}

export interface ClFillInTextConfig extends ClBase {
  type: 'fill_in_text'
  content: {
    question: ClContentBlock[]
    exercise: {
      run?: boolean
      language?: string
      text: string
      options: string[]
      correctAnswers: Record<string, string>
    }
    hint?: LocalizedText
  }
}

export interface ClMatchingValue {
  type: 'text' | 'codeBlock'
  value: LocalizedText | string
}

export interface ClMatchingPair {
  id: string
  term: ClMatchingValue
  match: ClMatchingValue
}

export interface ClMatchingPairsConfig extends ClBase {
  type: 'matching_pairs'
  content: {
    question: ClContentBlock[]
    exercise: {
      pairs: ClMatchingPair[]
    }
  }
}

export interface ClChallengeConfig extends ClBase {
  type: 'challenge'
  content: {
    question: ClContentBlock[]
    exercise: {
      language: string
      value: LocalizedText
    }
    solution: ClContentBlock[]
  }
}

export type ChallengeConfig =
  | ClExplanationConfig
  | ClMultipleChoiceConfig
  | ClFillInTextConfig
  | ClMatchingPairsConfig
  | ClChallengeConfig

// --- Tile Effects ---

/** Numeric IDs stored in the editor's effectsLayer array */
export const EffectId = {
  None: 0,
  Ice: 1,
  RedirectDown: 2,
  RedirectUp: 3,
  RedirectLeft: 4,
  RedirectRight: 5,
  Hole: 6,
  LedgeDown: 7,
  LedgeUp: 8,
  LedgeLeft: 9,
  LedgeRight: 10,
} as const

export type TileEffectType = 'ice' | 'redirect' | 'hole' | 'ledge'

export interface TileEffectData {
  tileX: number
  tileY: number
  effect: TileEffectType
  direction?: Direction // required for 'redirect'
}

// --- Stairs ---

export interface StairData {
  tileX: number
  tileY: number
  targetMapId: string | null // null = map doesn't exist yet
  /** Explicit direction (otherwise inferred from the stair's position vs playerStart) */
  direction?: 'up' | 'down'
  /** Where you appear when arriving through this stair (otherwise the tile below it) */
  arrival?: { tileX: number; tileY: number; facing: Direction }
  /**
   * A hub gate into this game chapter (act, 1-based): its target is the act's first
   * floor, it stays locked until the previous act's boss is beaten, and coming back
   * from any floor of the act lands here. Its targetMapId stays null.
   */
  act?: number
}

// --- Signs ---

/** A readable sign: face it and press the action key to read its dialog */
export interface SignData {
  tileX: number
  tileY: number
  textKey: string
}

// --- Teleports (intra-map) ---

export type TeleportRole = 'sender' | 'receiver'

export interface TeleportData {
  id: string
  tileX: number
  tileY: number
  role: TeleportRole
  targetId?: string // only for senders — id of another teleport to land on
}

// --- Pushable Blocks ---

export interface PushableBlockData {
  tileX: number
  tileY: number
  spriteKey?: string  // object tile key (e.g. 'objects/rock') — fallback to brown box
}

// --- Heart Pickups ---

export interface HeartPickupData {
  tileX: number
  tileY: number
  restoreAmount?: number  // defaults to 1
}

// --- Map & Save ---

export interface MapData {
  id: string
  name: string
  /** Display name per language (generated maps); takes precedence over the i18n key and `name` */
  title?: LocalizedText
  width?: number   // tile columns (default 20)
  height?: number  // tile rows (default 15)
  groundLayer: string[]
  wallsLayer: string[]
  wallsCollision?: boolean[]
  noCollision?: { tileX: number; tileY: number }[]  // sparse format (exported by editor)
  playerStart: { tileX: number; tileY: number; facing: Direction }
  npcs: NPCData[]
  requiredChallenges: string[]
  stairs: StairData[]
  teleports?: TeleportData[]
  tileEffects?: TileEffectData[]
  blocks?: PushableBlockData[]
  startingHp?: number          // 0 or undefined = infinite (no HP loss)
  hearts?: HeartPickupData[]
  signs?: SignData[]
  // ── Story maps (all optional) ──
  triggers?: TriggerData[]
  /** i18n key of the place's name, shown in a popup when you arrive (the town, the tower) */
  location?: string
  /** Tile drawn all around the map, beyond its edges (trees, sea…); none = black */
  border?: string
  /** An inside: a fixed camera centred on the room, black around it */
  indoor?: boolean
}

/** A tile on a map, and which way you face there */
export interface Spot {
  mapId: string
  tileX: number
  tileY: number
  facing: Direction
}

export interface SaveData {
  version: 3
  language: 'en' | 'fr'
  textSpeed: 'fast' | 'mid' | 'slow'
  /** Map to load when no position is saved (and the map the game is on) */
  currentMap: string
  completedChallenges: string[]
  /** Beaten trainers, as "<mapId>:<npcName>" */
  defeatedTrainers: string[]
  /** Seed of this save's generated world: same seed, same maps */
  towerSeed: number
  /** Legacy partner (the editor's test mode still fights with it); the story has no follower */
  companion?: string | null
  playerName: string
  /** The Codémon that hatched in Prof Pi's lab */
  starter: string | null
  /** Story progress: flags set by scripts (e.g. "got_starter") */
  flags: string[]
  /** Codémon caught, in order (the starter first) */
  team: string[]
  /** The Codémon that fights */
  lead: string | null
  /** Codémon met at least once (the Codédex's "seen") */
  seen: string[]
  /** Exercises that once cost a hit: review battles ask them first */
  missed: string[]
  /** Badges held: one per section master beaten (1–8) */
  badges: number[]
  /** Where you wake up after blacking out (the last healer, or Prof Pi's lab) */
  lastHeal: Spot | null
  /** Where you were when the game was last saved */
  position: Spot | null
  /** PV left, in half-hits (max 8); null = full */
  hp: number | null
  playTimeMs: number
}
