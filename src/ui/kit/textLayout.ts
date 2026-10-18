// Pure (no Phaser, no assets): measuring and wrapping text in the interface font.
// The game binds it to the font's metrics (src/ui/kit/font.ts); scripts/check-story.mjs
// reads the same metrics to check that every line fits its window.
import { NBSP } from './glyphs.ts'

/** Per character: [x, y, drawn width, advance] in art pixels (src/assets/ui/ui-font.json) */
export type Glyphs = Record<string, readonly number[]>

/** Width of a single line in art pixels (unknown characters count as "?") */
export function measureWith(glyphs: Glyphs, text: string): number {
  let w = 0
  for (const ch of text) {
    if (ch === '\n') continue
    const g = glyphs[ch === NBSP ? ' ' : ch] ?? glyphs['?']
    w += g ? g[3] : 0
  }
  return w
}

/**
 * Word-wrap to lines at most `maxWidth` art pixels wide. Explicit "\n" breaks are
 * kept, French punctuation never starts a line ("Salut !" keeps its "!"), and a
 * word longer than a line is cut.
 */
export function wrapWith(glyphs: Glyphs, text: string, maxWidth: number): string[] {
  const glued = text.replace(/ ([!?:;»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`)
  const width = (s: string): number => measureWith(glyphs, s)
  const lines: string[] = []
  for (const para of glued.split('\n')) {
    let line = ''
    for (const raw of para.split(' ')) {
      let word = raw
      while (width(word) > maxWidth) {
        if (line) { lines.push(line); line = '' }
        let n = word.length
        while (n > 1 && width(word.slice(0, n)) > maxWidth) n--
        lines.push(word.slice(0, n))
        word = word.slice(n)
      }
      if (!line) line = word
      else if (width(`${line} ${word}`) <= maxWidth) line += ` ${word}`
      else { lines.push(line); line = word }
    }
    lines.push(line)
  }
  return lines.map(l => l.replaceAll(NBSP, ' '))
}
