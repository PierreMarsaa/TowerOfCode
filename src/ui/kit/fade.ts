import type Phaser from 'phaser'

/**
 * Game Boy screen effects. The console faded by stepping through palettes, so
 * fades here move in visible steps instead of smoothly.
 */

const STEPS = [0.33, 0.66, 1]

function screenRect(scene: Phaser.Scene, color: number, depth: number): Phaser.GameObjects.Rectangle {
  const { width, height } = scene.scale
  return scene.add.rectangle(0, 0, width, height, color, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(depth).setAlpha(0)
}

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise(resolve => scene.time.delayedCall(ms, resolve))
}

/** Step to a solid colour (black by default). Returns the cover, left on screen. */
export async function fadeOut(scene: Phaser.Scene, color = 0x000000, stepMs = 70, depth = 50000): Promise<Phaser.GameObjects.Rectangle> {
  const cover = screenRect(scene, color, depth)
  for (const a of STEPS) {
    cover.setAlpha(a)
    await wait(scene, stepMs)
  }
  return cover
}

/** Step back from a solid colour; removes the cover */
export async function fadeIn(scene: Phaser.Scene, color = 0x000000, stepMs = 70, depth = 50000): Promise<void> {
  const cover = screenRect(scene, color, depth).setAlpha(1)
  for (const a of [...STEPS].reverse().slice(1).concat(0)) {
    await wait(scene, stepMs)
    cover.setAlpha(a)
  }
  cover.destroy()
}

/**
 * The battle transition: the screen flickers, then black bars sweep in from
 * alternating sides until the screen is covered. Resolves on full black.
 */
export async function battleIntro(scene: Phaser.Scene, depth = 50000): Promise<void> {
  const { width, height } = scene.scale
  const flash = screenRect(scene, 0xf8f8f8, depth)
  for (let i = 0; i < 3; i++) {
    flash.setAlpha(0.85)
    await wait(scene, 60)
    flash.setAlpha(0)
    await wait(scene, 60)
  }
  flash.destroy()
  const bars = 8
  const barH = Math.ceil(height / bars)
  const rects = Array.from({ length: bars }, (_, i) => {
    const fromLeft = i % 2 === 0
    return scene.add.rectangle(fromLeft ? 0 : width, i * barH, 0, barH, 0x000000, 1)
      .setOrigin(fromLeft ? 0 : 1, 0).setScrollFactor(0).setDepth(depth)
  })
  const steps = 12
  for (let s = 1; s <= steps; s++) {
    rects.forEach(r => r.setSize((width * s) / steps, barH))
    await wait(scene, 30)
  }
  await wait(scene, 120)
}
