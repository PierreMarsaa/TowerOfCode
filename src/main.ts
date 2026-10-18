import Phaser from 'phaser'
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '@/config/game.config'
import { BootScene } from '@/scenes/BootScene'
import { MenuScene } from '@/scenes/MenuScene'
import { GameScene } from '@/scenes/GameScene'
import { DialogScene } from '@/scenes/DialogScene'
import { ChallengeScene } from '@/scenes/ChallengeScene'
import { StartMenuScene } from '@/scenes/StartMenuScene'
import { TransitionScene } from '@/scenes/TransitionScene'
import { i18n } from '@/i18n/I18nManager'
import { saveManager } from '@/systems/SaveManager'
import { validateContent } from '@/data/validateContent'
import { installScreenLayout } from '@/ui/screenLayout'
import { applyTextSpeed } from '@/ui/kit/settings'

const save = saveManager.getData()
i18n.setLanguage(save.language)
applyTextSpeed(save.textSpeed)
// {player} works in every text
i18n.setGlobalParams(() => ({ player: saveManager.getData().playerName }))

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  backgroundColor: '#000000',
  parent: 'app',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  input: {
    keyboard: {
      target: window,
    },
  },
  // Later scenes draw on top: the map, then dialogs, battles, the START menu, the fade
  scene: [BootScene, MenuScene, GameScene, DialogScene, ChallengeScene, StartMenuScene, TransitionScene],
})

installScreenLayout(game)

// Dev-only: handles for debugging and automated browser checks, and a content check
// that flags map references the course no longer has (all stripped from production builds)
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game
  void import('@/debug/testHooks').then(m => m.installTestHooks(game))
  for (const problem of validateContent()) console.error(`[content] ${problem}`)
}
