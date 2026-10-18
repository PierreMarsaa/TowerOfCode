/**
 * Menu icons, 16×16 each, side by side in src/assets/ui/ui-icons.png (in ICONS order;
 * src/ui/kit/assets.ts names the frames the same way). Code-Life colours, dark outline.
 */
import { Bitmap } from '../bitmap.mjs'
import { fromAscii } from '../gbc/palette.mjs'
import { CL } from './palette.mjs'

export const ICON_SIZE = 16

// prettier-ignore
const ICONS = {
  dex: [
    '................',
    '.KKKKKKKKKKKKKK.',
    '.KMMMMMMMMMMMMK.',
    '.KMKKKKKKKKKKMK.',
    '.KMKCCCCCCCCKMK.',
    '.KMKCWWCCCCCKMK.',
    '.KMKCWCCCCCCKMK.',
    '.KMKCCCCCCCCKMK.',
    '.KMKCCCCCCCCKMK.',
    '.KMKKKKKKKKKKMK.',
    '.KMMMMMMMMMMMMK.',
    '.KMKKMMMMMMGGMK.',
    '.KMKKMMMMMMGGMK.',
    '.KMMMMMMMMMMMMK.',
    '.KKKKKKKKKKKKKK.',
    '................',
  ],
  team: [
    '................',
    '.....KKKKKK.....',
    '...KKMMMMMMKK...',
    '..KMMWWMMMMMMK..',
    '.KMMWMMMMMMMMMK.',
    '.KMMMMMMMMMMMMK.',
    'KMMMMMKKKKMMMMMK',
    'KKKKKKKWWKKKKKKK',
    'KWWWWWKWWKWWWWWK',
    'KWWWWWWKKWWWWWWK',
    '.KWWWWWWWWWWWDK.',
    '.KWWWWWWWWWWWDK.',
    '..KWWWWWWWWDDK..',
    '...KKWWWWDDKK...',
    '.....KKKKKK.....',
    '................',
  ],
  save: [
    '................',
    '.KKKKKKKKKKKKK..',
    '.KPPKWWWWWWKPPK.',
    '.KPPKWWWKWWKPPK.',
    '.KPPKWWWKWWKPPK.',
    '.KPPKWWWWWWKPPK.',
    '.KPPPKKKKKKPPPK.',
    '.KPPPPPPPPPPPPK.',
    '.KPPWWWWWWWWPPK.',
    '.KPPWDDDDDDWPPK.',
    '.KPPWWWWWWWWPPK.',
    '.KPPWDDDDDDWPPK.',
    '.KPPWWWWWWWWPPK.',
    '.KKKKKKKKKKKKKK.',
    '................',
    '................',
  ],
  options: [
    '................',
    '......KKKK......',
    '..KK..KWWK..KK..',
    '.KWWKKKWWKKKWWK.',
    '.KWWWWWWWWWWWWK.',
    '..KWWWKKKKWWWK..',
    '.KKWWKDDDDKWWKK.',
    'KWWWWKD..DKWWWWK',
    'KWWWWKD..DKWWWWK',
    '.KKWWKDDDDKWWKK.',
    '..KWWWKKKKWWWK..',
    '.KWWWWWWWWWWWWK.',
    '.KWWKKKWWKKKWWK.',
    '..KK..KWWK..KK..',
    '......KKKK......',
    '................',
  ],
  back: [
    '................',
    '................',
    '................',
    '......KK........',
    '.....KCK........',
    '....KCCKKKKKKKK.',
    '...KCCCCCCCCCCK.',
    '..KCCCCCCCCCCCK.',
    '...KCCCCCCCCCCK.',
    '....KCCKKKKKKKK.',
    '.....KCK........',
    '......KK........',
    '................',
    '................',
    '................',
    '................',
  ],
  continue: [
    '................',
    '................',
    '....KK..........',
    '....KNKK........',
    '....KNNNKK......',
    '....KNNNNNKK....',
    '....KNNNNNNNKK..',
    '....KNNNNNNNNNK.',
    '....KNNNNNNNKK..',
    '....KNNNNNKK....',
    '....KNNNKK......',
    '....KNKK........',
    '....KK..........',
    '................',
    '................',
    '................',
  ],
  new: [
    '................',
    '.......KK.......',
    '......KGGK......',
    '......KGGK......',
    '.....KGGGGK.....',
    '.KKKKGGGGGGKKKK.',
    'KGGGGGGWWGGGGGGK',
    '.KKGGGGWWGGGGKK.',
    '...KKGGGGGGKK...',
    '....KGGGGGGK....',
    '....KGGKKGGK....',
    '...KGGK..KGGK...',
    '...KGK....KGK...',
    '...KK......KK...',
    '................',
    '................',
  ],
}

export const ICON_NAMES = Object.keys(ICONS)

export function iconAssets() {
  const colors = { K: CL.shadow, W: CL.text, D: CL.dim, M: CL.magenta, C: CL.cyan, G: CL.gold, P: CL.purple, N: CL.green }
  const sheet = new Bitmap(ICON_NAMES.length * ICON_SIZE, ICON_SIZE)
  ICON_NAMES.forEach((name, i) => {
    const rows = ICONS[name]
    if (rows.length !== ICON_SIZE || rows.some(r => r.length !== ICON_SIZE)) throw new Error(`icon ${name} is not 16×16`)
    sheet.blit(fromAscii(rows, colors), i * ICON_SIZE, 0)
  })
  return [{ out: 'src/assets/ui/ui-icons.png', bitmap: sheet, kind: 'file' }]
}
