import type Phaser from 'phaser'
import { PIXEL } from '@/config/game.config'
import { drawBox, uiText } from '@/ui/kit/text'
import { measure, wrapText } from '@/ui/kit/font'

const P = PIXEL

/**
 * The place's name in a small window that slides down at the top-left of the
 * screen, stays a moment and slides away (entering a town or the tower). `top`
 * leaves room above it (the editor's test mode shows its hearts there).
 */
export function showLocationPopup(scene: Phaser.Scene, name: string, top = 4 * P): void {
  // Long names (a floor and its chapter) wrap onto a second line
  const lines = wrapText(name.toUpperCase(), scene.scale.width - 26 * P)
  const w = Math.max(...lines.map(l => measure(l))) + 18 * P
  const h = (lines.length * 16 + 6) * P
  const shown = top
  const box = drawBox(scene, 0, 0, w, h)
  lines.forEach((line, i) => box.add(uiText(scene, 9 * P, (3 + i * 16) * P, line)))
  box.setPosition(4 * P, -h).setScrollFactor(0).setDepth(20000)
  scene.tweens.add({
    targets: box,
    y: shown,
    duration: 220,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      scene.time.delayedCall(1800, () => {
        scene.tweens.add({ targets: box, y: -h, duration: 220, ease: 'Cubic.easeIn', onComplete: () => box.destroy() })
      })
    },
  })
}
