// Pure (no imports): shared by the game (bitmap font, text measuring) and by the
// art script (scripts/art/ui/font.mjs draws one glyph per character, in this order).

/** Every character the interface font can draw, in atlas order: rows of 16 cells */
export const UI_ROWS = [
  ' !"#$%&\'()*+,-./',
  '0123456789:;<=>?',
  '@ABCDEFGHIJKLMNO',
  'PQRSTUVWXYZ[\\]^_',
  '`abcdefghijklmno',
  'pqrstuvwxyz{|}~’',
  'àâäçéèêëîïôöùûüœ',
  'ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒ',
  'æÆÿŸ«»…·°×♥★▶◀▲▼',
  '▷▌→←©–—',
]

export const UI_CHARS = UI_ROWS.join('')
export const UI_COLUMNS = 16

/** No-break space: glues French punctuation to its word when wrapping (drawn as a space) */
export const NBSP = ' '

const KNOWN = new Set(UI_CHARS)

const REPLACEMENTS: Record<string, string> = {
  '−': '-', '‐': '-',
  '“': '"', '”': '"', '„': '"',
  '‘': '’',
  ' ': NBSP, ' ': ' ', '\t': ' ',
}

/** Text the font can draw: typographic variants mapped to known glyphs, anything else becomes "?" */
export function sanitize(text: string): string {
  let out = ''
  for (const ch of text) {
    if (ch === '\n' || ch === NBSP || KNOWN.has(ch)) out += ch
    else out += REPLACEMENTS[ch] ?? '?'
  }
  return out
}
