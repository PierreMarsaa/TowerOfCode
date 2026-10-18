/**
 * Game Boy Color-style pieces of the world, drawn at 1× (the game doubles them):
 *   ui/emote_excl, ui/emote_quest, ui/emote_dots   16×16 tiles: the speech balloon over a
 *       character's head with "!", "?" or "…"
 *   ui/codeball                   16×16 tile: the Codé-Ball lying in the overworld
 * (The interface itself — font, windows, title — is drawn by scripts/art/ui/.)
 */
import { Bitmap, hex } from '../bitmap.mjs'
import { UI, fromAscii } from './palette.mjs'

// ── Emote balloons ──

const BALLOON = [
  '...KKKKKKKKKK...',
  '..KWWWWWWWWWWK..',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '..KWWWWWWWWWWK..',
  '...KKKKWWKKKK...',
  '......KWWK......',
  '.......KK.......',
  '................',
]

/** What goes inside the balloon ('#' = ink), drawn over it */
const MARKS = {
  excl: [
    '................',
    '................',
    '................',
    '......####......',
    '......####......',
    '.......##.......',
    '.......##.......',
    '.......##.......',
    '................',
    '.......##.......',
    '.......##.......',
  ],
  quest: [
    '................',
    '................',
    '................',
    '......####......',
    '.....##..##.....',
    '.........##.....',
    '........##......',
    '.......##.......',
    '................',
    '.......##.......',
    '.......##.......',
  ],
  dots: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...##..##..##...',
    '...##..##..##...',
  ],
}

function balloon(mark) {
  const b = fromAscii(BALLOON, { K: UI.ink, W: UI.paper })
  return b.ascii(MARKS[mark], { '#': UI.ink })
}

// ── Codé-Ball ──

const CODEBALL = [
  '................',
  '.....KKKKKK.....',
  '...KKTTTTTTKK...',
  '..KTTLLTTTTTTK..',
  '..KTLLTTTTTTTK..',
  '.KTTLTKKKKKKTTK.',
  '.KTTTTKWWWWKTTK.',
  '.KKKKKKWWWWKKKK.',
  '.KKKKKKWWWWKKKK.',
  '.KWWWWKWWWWKWLK.',
  '.KWWWWWKKKKWWLK.',
  '..KWWWWWWWWWLK..',
  '..KWWWWWWWWLLK..',
  '...KKWWLLLLKK...',
  '.....KKKKKK.....',
  '................',
]

function codeball() {
  return fromAscii(CODEBALL, { K: UI.ink, T: hex('#30a090'), L: hex('#a8e8d0'), W: UI.paper })
}

export function uiAssets() {
  return [
    { out: 'ui/emote_excl', bitmap: balloon('excl'), kind: 'tile' },
    { out: 'ui/emote_quest', bitmap: balloon('quest'), kind: 'tile' },
    { out: 'ui/emote_dots', bitmap: balloon('dots'), kind: 'tile' },
    { out: 'ui/codeball', bitmap: codeball(), kind: 'tile' },
  ]
}
