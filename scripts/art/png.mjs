/** PNG encoding through node-canvas (the only thing the art script uses it for, besides preview labels) */
import { createCanvas, ImageData } from 'canvas'

export function encodePng(bitmap) {
  const canvas = createCanvas(bitmap.w, bitmap.h)
  canvas.getContext('2d').putImageData(new ImageData(bitmap.data, bitmap.w, bitmap.h), 0, 0)
  return canvas.toBuffer('image/png')
}
