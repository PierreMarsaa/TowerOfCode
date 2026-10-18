import Phaser from 'phaser'
import type { Spot } from '@/data/types'
import { SCENE } from '@/utils/constants'
import { fadeOut } from '@/ui/kit/fade'
import type { GameSceneData } from '@/scenes/GameScene'

interface TransitionData {
  mapId: string
  /** Kept for callers; the place's name now pops up on arrival instead */
  mapName?: string
  fromDirection?: 'up' | 'down'
  fromMapId?: string
  spawn?: Spot
}

/** Through a door: the screen steps to black, then the next map fades in (as on the Game Boy) */
export class TransitionScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE.TRANSITION })
  }

  create(data: TransitionData): void {
    void (async () => {
      await fadeOut(this, 0x000000, 60)
      const next: GameSceneData = {
        mapId: data.mapId,
        fromDirection: data.fromDirection,
        fromMapId: data.fromMapId,
        spawn: data.spawn,
        fadeIn: true,
      }
      // scene.start() stops the running map first, avoiding race conditions
      this.scene.start(SCENE.GAME, next)
      this.scene.stop()
    })()
  }
}
