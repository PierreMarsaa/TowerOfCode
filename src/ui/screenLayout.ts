import type Phaser from 'phaser'
import { PIXEL, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/config/game.config'

/**
 * The game screen inside the browser window: scaled by a whole number of device
 * pixels per art pixel (crisp, every pixel the same size), centred in the room
 * left by the frame and, on touch screens, by the controls (under the screen in
 * portrait, at its sides in landscape).
 *
 * Writes --scr-x/y/w/h, --frame-pad and --frame-plate on <html> for the CSS frame
 * and controls, and the classes `touch`, `portrait`/`landscape`.
 */

const ART_W = SCREEN_WIDTH / PIXEL  // 240
const ART_H = SCREEN_HEIGHT / PIXEL // 160

export function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
}

/** Phaser zoom giving `k` whole device pixels per art pixel, as large as fits */
export function screenZoom(availW: number, availH: number, dpr: number): number {
  const k = Math.max(1, Math.floor(Math.min((availW * dpr) / ART_W, (availH * dpr) / ART_H)))
  return k / (PIXEL * dpr)
}

/** Round a CSS length to whole device pixels */
function snap(v: number, dpr: number): number {
  return Math.round(v * dpr) / dpr
}

export function installScreenLayout(game: Phaser.Game): void {
  const root = document.documentElement
  let lastZoom = 0

  const layout = (): void => {
    const canvas = game.canvas
    if (!canvas) return
    const touch = isTouchDevice()
    const vw = window.visualViewport?.width ?? window.innerWidth
    const vh = window.visualViewport?.height ?? window.innerHeight
    const portrait = vh >= vw
    root.classList.toggle('touch', touch)
    root.classList.toggle('portrait', portrait)
    root.classList.toggle('landscape', !portrait)

    // Room for the screen and its frame
    let areaX = 0
    let areaY = 0
    let areaW = vw
    let areaH = vh
    if (touch && portrait) areaH = Math.round(vh * 0.6)
    if (touch && !portrait) {
      const side = Math.round(Math.min(vw * 0.24, 200))
      areaX = side
      areaW = vw - 2 * side
    }
    const compact = areaW < 560 || areaH < 420
    const pad = compact ? 6 : 18          // frame around the screen
    const plate = compact ? 0 : 30        // the name plate under the screen
    const dpr = window.devicePixelRatio || 1

    const zoom = screenZoom(areaW - 2 * pad, areaH - 2 * pad - plate, dpr)
    if (zoom !== lastZoom) {
      game.scale.setZoom(zoom)
      lastZoom = zoom
    }
    const w = SCREEN_WIDTH * zoom
    const h = SCREEN_HEIGHT * zoom
    const x = snap(areaX + (areaW - w) / 2, dpr)
    const y = snap(areaY + (areaH - h - plate) / 2, dpr)

    canvas.style.position = 'absolute'
    canvas.style.left = `${x}px`
    canvas.style.top = `${y}px`
    canvas.style.margin = '0'
    root.style.setProperty('--scr-x', `${x}px`)
    root.style.setProperty('--scr-y', `${y}px`)
    root.style.setProperty('--scr-w', `${w}px`)
    root.style.setProperty('--scr-h', `${h}px`)
    root.style.setProperty('--frame-pad', `${pad}px`)
    root.style.setProperty('--frame-plate', `${plate}px`)
    root.style.setProperty('--area-h', `${areaH}px`)
    game.scale.refresh() // pointer input maps through the canvas bounds
  }

  window.addEventListener('resize', layout)
  window.visualViewport?.addEventListener('resize', layout)
  window.addEventListener('orientationchange', () => setTimeout(layout, 50))
  game.events.once('ready', layout)
  layout()
}
