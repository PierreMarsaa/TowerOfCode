import Phaser from 'phaser'
import { getAllTiles } from '@/data/tiles/TileRegistry'
import { getAllSprites } from '@/data/sprites/SpriteRegistry'
import { normalizeTileTextures } from '@/utils/normalizeTileTextures'
import { normalizeSpriteTextures } from '@/utils/normalizeSpriteTextures'
import { SCENE } from '@/utils/constants'
import { CODEMON, ZAP, codemonArtUrl, codemonTexture } from '@/data/codemon'
import { preloadStoryArt, preloadUi, registerUi } from '@/ui/kit/assets'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.BOOT })
  }

  preload(): void {
    this.createLoadingBar()

    // Tilesets (auto-discovered from src/assets/tilesets/)
    for (const tile of getAllTiles()) {
      this.load.image(tile.key, tile.url)
    }
    // Sprites (auto-discovered, loaded as images — converted to spritesheets in create)
    for (const sprite of getAllSprites()) {
      this.load.image(sprite.key, sprite.url)
    }
    // Codémon pictures (Codédex, the hatching, the team)
    for (const mon of [ZAP, ...CODEMON]) {
      const url = codemonArtUrl(mon.id)
      if (url) this.load.image(codemonTexture(mon.id), url)
    }
    // Stairs (the editor's palette), the interface, the title screen and the opening's egg
    this.load.image('stairs_straight', 'assets/tilesets/stairs_straight.png')
    preloadUi(this)
    preloadStoryArt(this)
  }

  create(): void {
    normalizeTileTextures(this)
    normalizeSpriteTextures(this)
    registerUi(this)
    // Painted art is shown smaller than drawn: smooth it instead of pixelating it
    for (const mon of [ZAP, ...CODEMON]) {
      const key = codemonTexture(mon.id)
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR)
    }
    this.scene.start(SCENE.MENU)
  }

  private createLoadingBar(): void {
    const { width, height } = this.scale
    // The interface's colours: an indigo track, a gold bar
    const barBg = this.add.rectangle(width / 2, height / 2, 200, 12, 0x2b2860).setStrokeStyle(2, 0x9095ff)
    const bar = this.add.rectangle(width / 2 - 98, height / 2, 0, 8, 0xffc94a).setOrigin(0, 0.5)
    this.load.on('progress', (value: number) => { bar.width = 196 * value })
    this.load.on('complete', () => {
      barBg.destroy()
      bar.destroy()
    })
  }
}
