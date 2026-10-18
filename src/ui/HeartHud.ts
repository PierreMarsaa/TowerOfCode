import Phaser from 'phaser'

// Pixel hearts drawn by scripts/draw-art.mjs (32×32 once loaded), shown at 24 px
const HEART_FULL = 'ui/heart_full'
const HEART_EMPTY = 'ui/heart_empty'
const HEART_SCALE = 0.75
const HEART_SIZE = 24
const HEART_GAP = 2
const HUD_X = 12
const HUD_Y = 10
const HUD_DEPTH = 99990 // above characters (their depth is their y)

export class HeartHud {
  private scene: Phaser.Scene
  private hearts: Phaser.GameObjects.Image[] = []
  private maxHp: number
  private hidden: boolean

  constructor(scene: Phaser.Scene, maxHp: number, isInfinite: boolean) {
    this.scene = scene
    this.maxHp = maxHp
    this.hidden = isInfinite

    if (this.hidden) return

    for (let i = 0; i < maxHp; i++) {
      const heart = scene.add.image(HUD_X + i * (HEART_SIZE + HEART_GAP), HUD_Y, HEART_FULL)
        .setScale(HEART_SCALE)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH)
        .setOrigin(0, 0)
      this.hearts.push(heart)
    }
  }

  update(hp: number): void {
    if (this.hidden) return

    for (let i = 0; i < this.maxHp; i++) {
      this.hearts[i]?.setTexture(i < hp ? HEART_FULL : HEART_EMPTY)
    }
  }

  playDamageAnimation(): void {
    if (this.hidden) return

    // Shake all hearts
    for (const heart of this.hearts) {
      const origX = heart.x
      this.scene.tweens.add({
        targets: heart,
        x: origX + 3,
        duration: 40,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.inOut',
        onComplete: () => { heart.x = origX },
      })
    }
  }

  playHealAnimation(hp: number): void {
    if (this.hidden) return

    // Bounce the newly filled heart
    const idx = hp - 1
    const heart = this.hearts[idx]
    if (!heart) return

    this.scene.tweens.add({
      targets: heart,
      scaleX: HEART_SCALE * 1.5,
      scaleY: HEART_SCALE * 1.5,
      duration: 150,
      yoyo: true,
      ease: 'Back.out',
    })
  }

  destroy(): void {
    for (const heart of this.hearts) {
      heart.destroy()
    }
    this.hearts = []
  }
}
