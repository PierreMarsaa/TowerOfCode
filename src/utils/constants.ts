/** Phaser scene keys — used in super({ key }) and scene.start/launch/stop */
export const SCENE = {
  BOOT: 'BootScene',
  /** The title screen (the key predates it: the editor's test mode stubs this key) */
  MENU: 'MenuScene',
  GAME: 'GameScene',
  DIALOG: 'DialogScene',
  CHALLENGE: 'ChallengeScene',
  TRANSITION: 'TransitionScene',
  START_MENU: 'StartMenuScene',
} as const
