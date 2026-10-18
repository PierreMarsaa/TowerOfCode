/**
 * A pixel font as a TrueType file, for the HTML screens (battles, lessons): every
 * lit pixel becomes a square, so text is crisp when 1 em is a whole number of
 * pixels per font pixel. Built with opentype.js (a dev dependency, only used here).
 */
import opentype from 'opentype.js'

const PX = 64 // font units per pixel

function glyphPath(rows, baselineRow) {
  const path = new opentype.Path()
  rows.forEach((row, y) => {
    // Row `baselineRow` sits right on the baseline: row y spans [(b - y), (b + 1 - y)) pixels above it
    const y0 = (baselineRow - y) * PX
    const y1 = (baselineRow + 1 - y) * PX
    let x = 0
    while (x < row.length) {
      if (row[x] !== '#') { x++; continue }
      let end = x
      while (end < row.length && row[end] === '#') end++
      path.moveTo(x * PX, y1)
      path.lineTo(end * PX, y1)
      path.lineTo(end * PX, y0)
      path.lineTo(x * PX, y0)
      path.close()
      x = end
    }
  })
  return path
}

/**
 * TTF bytes. `glyphs`: [{ ch, rows (strings of '#'/'.'), adv (pixels) }], drawn in
 * cells `rows` pixels tall whose row `baselineRow` stands on the baseline; 1 em = one cell.
 */
export function buildTtf({ family, rows, baselineRow, glyphs }) {
  const em = rows * PX
  const list = [new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: em / 2, path: new opentype.Path() })]
  const seen = new Set()
  for (const g of glyphs) {
    if (seen.has(g.ch)) continue
    seen.add(g.ch)
    list.push(new opentype.Glyph({
      name: `u${g.ch.codePointAt(0).toString(16).padStart(4, '0')}`,
      unicode: g.ch.codePointAt(0),
      advanceWidth: g.adv * PX,
      path: glyphPath(g.rows, baselineRow),
    }))
  }
  // The no-break space draws like a space
  const space = glyphs.find(g => g.ch === ' ')
  if (space) list.push(new opentype.Glyph({ name: 'uni00A0', unicode: 0xa0, advanceWidth: space.adv * PX, path: new opentype.Path() }))
  const font = new opentype.Font({
    familyName: family,
    styleName: 'Regular',
    unitsPerEm: em,
    ascender: (baselineRow + 1) * PX,
    descender: -(rows - baselineRow - 1) * PX,
    glyphs: list,
  })
  return pinDates(Buffer.from(font.toArrayBuffer()))
}

/** A fixed date (2026-01-01) in the 'head' table, checksums redone: the same glyphs give the same bytes */
function pinDates(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const sum = (offset, length) => {
    let total = 0
    for (let i = 0; i < length; i += 4) total = (total + (offset + i + 4 <= buf.length ? view.getUint32(offset + i) : 0)) >>> 0
    return total
  }
  const numTables = view.getUint16(4)
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16
    if (String.fromCharCode(...buf.subarray(rec, rec + 4)) !== 'head') continue
    const head = view.getUint32(rec + 8)
    const length = view.getUint32(rec + 12)
    const date = BigInt(1767225600 + 2082844800) // seconds since 1904
    view.setBigUint64(head + 20, date) // created
    view.setBigUint64(head + 28, date) // modified
    view.setUint32(head + 8, 0) // checkSumAdjustment is computed with itself at 0
    view.setUint32(rec + 4, sum(head, Math.ceil(length / 4) * 4))
    view.setUint32(head + 8, (0xb1b0afba - sum(0, buf.length)) >>> 0)
  }
  return buf
}
