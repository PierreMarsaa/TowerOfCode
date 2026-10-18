/**
 * A tiny RGBA bitmap with the pixel-art primitives the art script needs.
 * Pure JS: node-canvas is only used to encode PNGs (see draw-art.mjs).
 * Colours are [r, g, b, a] arrays; hex() parses '#rrggbb' / '#rrggbbaa'.
 */

export const CLEAR = [0, 0, 0, 0]

export function hex(s) {
  const n = s.replace('#', '')
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
    n.length >= 8 ? parseInt(n.slice(6, 8), 16) : 255,
  ]
}

/** Linear mix of two colours (t = 0 → a, t = 1 → b) */
export function mix(a, b, t) {
  return [0, 1, 2, 3].map(i => Math.round(a[i] + (b[i] - a[i]) * t))
}

export function withAlpha(c, alpha) {
  return [c[0], c[1], c[2], Math.round(alpha * 255)]
}

export class Bitmap {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.data = new Uint8ClampedArray(w * h * 4)
    /** When true, coordinates wrap around (seamless tiles) */
    this.wrap = false
  }

  clone() {
    const b = new Bitmap(this.w, this.h)
    b.data.set(this.data)
    b.wrap = this.wrap
    return b
  }

  index(x, y) {
    if (this.wrap) {
      x = ((x % this.w) + this.w) % this.w
      y = ((y % this.h) + this.h) % this.h
    } else if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1
    return (y * this.w + x) * 4
  }

  get(x, y) {
    const i = this.index(Math.round(x), Math.round(y))
    if (i < 0) return CLEAR
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]
  }

  alphaAt(x, y) {
    const i = this.index(x, y)
    return i < 0 ? 0 : this.data[i + 3]
  }

  /** Opaque write (or alpha-blended "over" when the colour is translucent) */
  px(x, y, c) {
    if (!c) return
    const i = this.index(Math.round(x), Math.round(y))
    if (i < 0) return
    const a = c[3] / 255
    if (a >= 1) {
      this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255
      return
    }
    if (a <= 0) return
    const da = this.data[i + 3] / 255
    const oa = a + da * (1 - a)
    for (let k = 0; k < 3; k++) {
      this.data[i + k] = Math.round((c[k] * a + this.data[i + k] * da * (1 - a)) / oa)
    }
    this.data[i + 3] = Math.round(oa * 255)
  }

  /** Raw write, no blending (used to punch transparent pixels) */
  put(x, y, c) {
    const i = this.index(Math.round(x), Math.round(y))
    if (i < 0) return
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = c[3]
  }

  fill(c) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.put(x, y, c)
    return this
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c)
    return this
  }

  hline(x, y, w, c) { return this.rect(x, y, w, 1, c) }
  vline(x, y, h, c) { return this.rect(x, y, 1, h, c) }

  /** 1-px rectangle outline */
  frame(x, y, w, h, c) {
    this.hline(x, y, w, c)
    this.hline(x, y + h - 1, w, c)
    this.vline(x, y, h, c)
    this.vline(x + w - 1, y, h, c)
    return this
  }

  /** Filled ellipse centred on (cx, cy) with radii rx, ry (pixel centres) */
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.5)
        const dy = (y - cy) / (ry + 0.5)
        if (dx * dx + dy * dy <= 1) this.px(x, y, c)
      }
    }
    return this
  }

  disc(cx, cy, r, c) { return this.ellipse(cx, cy, r, r, c) }

  /** Bresenham line */
  line(x0, y0, x1, y1, c) {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.px(x0, y0, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
    return this
  }

  /** Draw another bitmap on top (alpha "over"), optionally mirrored */
  blit(src, dx, dy, { mirrorX = false } = {}) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.get(mirrorX ? src.w - 1 - x : x, y)
        if (c[3]) this.px(dx + x, dy + y, c)
      }
    }
    return this
  }

  crop(x, y, w, h) {
    const b = new Bitmap(w, h)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) b.put(i, j, this.get(x + i, y + j))
    return b
  }

  mirrorX() {
    const b = new Bitmap(this.w, this.h)
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) b.put(this.w - 1 - x, y, this.get(x, y))
    return b
  }

  /** Recolour: map from 'r,g,b' keys (or a function) to new colours */
  recolor(fn) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y)
        if (!c[3]) continue
        const n = fn(c, x, y)
        if (n) this.put(x, y, n)
      }
    }
    return this
  }

  /** 1-px outline around every opaque shape (4-neighbourhood), drawn in transparent pixels */
  outline(c) {
    const src = this.clone()
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src.alphaAt(x, y)) continue
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const nx = x + dx, ny = y + dy
          return nx >= 0 && ny >= 0 && nx < this.w && ny < this.h && src.alphaAt(nx, ny) > 128
        })
        if (near) this.put(x, y, c)
      }
    }
    return this
  }

  /** Draw an ASCII pixel map: each character maps to a colour via the palette (unknown = skip) */
  ascii(rows, palette, ox = 0, oy = 0, { mirrorX = false } = {}) {
    const width = Math.max(...rows.map(r => r.length))
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = palette[row[x]]
        if (!c) continue
        this.px(ox + (mirrorX ? width - 1 - x : x), oy + y, c)
      }
    })
    return this
  }

  /** Nearest-neighbour upscale by an integer factor (previews) */
  scale(k) {
    const b = new Bitmap(this.w * k, this.h * k)
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) b.put(x, y, this.get(Math.floor(x / k), Math.floor(y / k)))
    return b
  }

  isOpaque() {
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i] !== 255) return false
    return true
  }
}
