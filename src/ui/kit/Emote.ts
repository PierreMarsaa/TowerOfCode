import type Phaser from 'phaser'

export type EmoteKind = '!' | '?' | '...'

const TEXTURES: Record<EmoteKind, string> = { '!': 'ui/emote_excl', '?': 'ui/emote_quest', '...': 'ui/emote_dots' }

/**
 * A speech balloon over a character's head ("!" when a trainer spots you), as an
 * image from the tile set so the editor's test mode has it too. Follows the sprite
 * until removed.
 */
export function showEmote(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, kind: EmoteKind): Phaser.GameObjects.Image {
  const key = TEXTURES[kind]
  const img = scene.add.image(sprite.x, sprite.y - 44, scene.textures.exists(key) ? key : '__MISSING')
    .setDepth(99999)
  const follow = (): void => { img.setPosition(sprite.x, sprite.y - 44) }
  scene.events.on('postupdate', follow)
  img.once('destroy', () => scene.events.off('postupdate', follow))
  return img
}

/** Show an emote for `ms`, then remove it */
export function popEmote(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, kind: EmoteKind, ms = 600): Promise<void> {
  const img = showEmote(scene, sprite, kind)
  return new Promise(resolve => scene.time.delayedCall(ms, () => { img.destroy(); resolve() }))
}
