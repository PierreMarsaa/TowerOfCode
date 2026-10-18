/**
 * Interface windows in Code-Life's colours, drawn at 1× (the game doubles them):
 *   src/assets/ui/ui-window.png  24×24, a 9-slice in 8×8 cells [TL, T, TR / L, fill, R / BL, B, BR]:
 *       a dark outline, a 1-px purple border, a lighter indigo inner line, indigo fill;
 *       corners rounded. Edges are uniform, so the game stretches them.
 *   src/assets/ui/ui-tag.png     7×13, a 9-slice with 3-px corners: the speaker's name tag on
 *       the text box, a purple pill with a light top line
 *   src/assets/ui/ui-bar.png     6×6, a 9-slice with 2-px corners: the highlight under the
 *       selected menu row
 *   src/assets/ui/ui-pill.png    6×6, a 9-slice with 2-px corners: white with a grey bottom
 *       edge, tinted by the game (a Codémon's type, a label)
 *   src/assets/ui/ui-glow.png    64×64, a soft white disc (tinted by type colour behind Codémon)
 */
import { Bitmap } from '../bitmap.mjs'
import { fromAscii } from '../gbc/palette.mjs'
import { CL } from './palette.mjs'

// prettier-ignore
const WINDOW = [
  '...KKKKKKKKKKKKKKKKKK...',
  '.KKPPPPPPPPPPPPPPPPPPKK.',
  '.KPCCCCCCCCCCCCCCCCCCPK.',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  'KPCFFFFFFFFFFFFFFFFFFCPK',
  '.KPCCCCCCCCCCCCCCCCCCPK.',
  '.KKPPPPPPPPPPPPPPPPPPKK.',
  '...KKKKKKKKKKKKKKKKKK...',
]

// prettier-ignore
const TAG = [
  '.KKKKK.',
  'KLLLLLK',
  'KPPPPPK',
  'KPPPPPK',
  'KPPPPPK',
  'KPPPPPK',
  'KPPPPPK',
  'KPPPPPK',
  'KPPPPPK',
  'KPPPPPK',
  'KPPPPPK',
  'KDDDDDK',
  '.KKKKK.',
]

// prettier-ignore
const BAR = [
  '.HHHH.',
  'HRRRRH',
  'RRRRRR',
  'RRRRRR',
  'RRRRRR',
  '.RRRR.',
]

// prettier-ignore
const PILL = [
  '.WWWW.',
  'WWWWWW',
  'WWWWWW',
  'WWWWWW',
  'SSSSSS',
  '.SSSS.',
]

function glow() {
  const size = 64
  const b = new Bitmap(size, size)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - c, y - c) / (size / 2)
      if (r >= 1) continue
      const a = Math.round(255 * (1 - r) * (1 - r))
      if (a > 0) b.put(x, y, [255, 255, 255, a])
    }
  }
  return b
}

export function windowAssets() {
  return [
    { out: 'src/assets/ui/ui-window.png', bitmap: fromAscii(WINDOW, { K: CL.shadow, P: CL.purple, C: CL.card, F: CL.panel }), kind: 'file' },
    { out: 'src/assets/ui/ui-tag.png', bitmap: fromAscii(TAG, { K: CL.shadow, L: CL.purpleLight, P: CL.purple, D: CL.lavender }), kind: 'file' },
    { out: 'src/assets/ui/ui-bar.png', bitmap: fromAscii(BAR, { H: CL.purple, R: CL.raised }), kind: 'file' },
    { out: 'src/assets/ui/ui-pill.png', bitmap: fromAscii(PILL, { W: [255, 255, 255, 255], S: [196, 196, 214, 255] }), kind: 'file' },
    { out: 'src/assets/ui/ui-glow.png', bitmap: glow(), kind: 'file' },
  ]
}
