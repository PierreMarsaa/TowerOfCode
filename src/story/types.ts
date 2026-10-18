import type { Condition, Direction } from '@/data/types'

/** Who a step moves: the player, or a character by id (or name) on this map */
export type Actor = 'player' | string

/**
 * One step of a story script. Scripts are plain data, checked by
 * scripts/check-story.mjs (every key, actor and script exists).
 */
export type Step =
  /** Text box with one or more dialog keys (their lines, in order) */
  | { op: 'say'; key: string | string[]; params?: Record<string, string> }
  /** Text then a question; runs branches[answer] (OUI = 0, NON = 1 for 'yesno'); `required`: B can't skip it */
  | { op: 'ask'; key: string; choices?: 'yesno' | string[]; branches: Step[][]; required?: boolean }
  /** Walk a path like "U3 L2" (Up, Down, Left, Right × tiles); followers walk in its trail */
  | { op: 'walk'; actor: Actor; path: string; followers?: Actor[]; ms?: number }
  /** Walk to a tile, or next to someone, around obstacles */
  | { op: 'walkTo'; actor: Actor; to: { x: number; y: number } | { actor: Actor }; followers?: Actor[]; ms?: number }
  | { op: 'face'; actor: Actor; dir: Direction | { actor: Actor } }
  | { op: 'emote'; actor: Actor; kind: '!' | '?' | '...' }
  | { op: 'wait'; ms: number }
  | { op: 'setFlag'; flag: string }
  | { op: 'clearFlag'; flag: string }
  | { op: 'if'; when: Condition; then: Step[]; else?: Step[] }
  /** Put a hidden character on the map (optionally at a tile) */
  | { op: 'show'; actor: Actor; at?: { x: number; y: number; facing?: Direction } }
  | { op: 'hide'; actor: Actor }
  | { op: 'teleport'; actor: Actor; x: number; y: number; facing?: Direction }
  /** A Codémon joins your team: an id or '$starter' */
  | { op: 'give'; codemon: string }
  | { op: 'chooseStarter'; codemon: string }
  /** A question (dialog key) then the name entry: the answer becomes the player's name */
  | { op: 'name'; key: string }
  /** The egg hatches into this Codémon (an id or '$starter'); its picture stays up until `picture: null` */
  | { op: 'hatch'; codemon: string }
  /** Restore PV; `respawn` also makes this spot the blackout point */
  | { op: 'heal'; respawn?: boolean }
  /** Lessons of these chapters, full screen */
  | { op: 'lesson'; chapters: string[] }
  /**
   * A battle against `trainer` (an actor on this map, or just a name) with that
   * chapter's questions. Without `blackout`, losing doesn't send you home.
   */
  | { op: 'battle'; trainer: Actor; name?: string; codemon: string; chapter: string; questions?: number; code?: boolean; blackout?: boolean; win?: Step[]; lose?: Step[] }
  /** Show a Codémon's picture in a box (null hides it) */
  | { op: 'picture'; codemon: string | null }
  | { op: 'fade'; to: 'black' | 'clear' }
  | { op: 'save' }
  | { op: 'call'; script: string }
  /** Go to another map (always last: the map restarts) */
  | { op: 'warp'; map: string; x: number; y: number; facing: Direction }

export type Script = Step[]
