import type Phaser from 'phaser'
import { saveManager } from '@/systems/SaveManager'
import { SCENE } from '@/utils/constants'
import { allWidgets, topWidget } from '@/ui/kit/registry'
import { uiSettings } from '@/ui/kit/settings'
import type { PadButton } from '@/ui/kit/input'
import type { Direction, SaveData } from '@/data/types'
import { findPath } from '@/story/pathfind'

const CODES: Record<PadButton, [string, string, number]> = {
  up: ['ArrowUp', 'ArrowUp', 38], down: ['ArrowDown', 'ArrowDown', 40],
  left: ['ArrowLeft', 'ArrowLeft', 37], right: ['ArrowRight', 'ArrowRight', 39],
  a: ['Space', ' ', 32], b: ['Escape', 'Escape', 27], start: ['Enter', 'Enter', 13],
}

/**
 * Dev-only handles for the browser checks (window.__toc): read the save and the
 * widget on screen, press Game Boy buttons the way the touch controls do, jump
 * to a map. Never bundled in production (main.ts imports it under DEV only).
 */
export function installTestHooks(game: Phaser.Game): void {
  // Private scene fields are read on purpose here
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameScene = (): any => game.scene.getScene(SCENE.GAME)
  const fire = (type: 'keydown' | 'keyup', b: PadButton): void => {
    const [code, key, keyCode] = CODES[b]
    window.dispatchEvent(new KeyboardEvent(type, { code, key, keyCode, which: keyCode, bubbles: true, cancelable: true }))
  }
  const hooks = {
    game,
    save: (): SaveData => JSON.parse(JSON.stringify(saveManager.getData())),
    patchSave: (patch: Partial<SaveData>): void => {
      Object.assign(saveManager.getData(), patch)
      saveManager.save()
    },
    scenes: (): string[] => game.scene.getScenes(true).map(s => s.sys.settings.key),
    /** Press a button for `hold` ms (long enough for Phaser to see it) */
    press: (b: PadButton, hold = 90): Promise<void> => new Promise(resolve => {
      fire('keydown', b)
      setTimeout(() => { fire('keyup', b); resolve() }, hold)
    }),
    down: (b: PadButton): void => fire('keydown', b),
    up: (b: PadButton): void => fire('keyup', b),
    ui: () => topWidget(),
    widgets: () => allWidgets(),
    story: () => {
      const s = gameScene()
      return { busy: !!s?.story?.busy, script: s?.story?.current ?? null, flags: [...saveManager.getData().flags] }
    },
    player: () => {
      const s = gameScene()
      if (!s?.player || !game.scene.isActive(SCENE.GAME) && !game.scene.isPaused(SCENE.GAME)) return null
      return { map: s.mapData?.id, x: s.player.tileX, y: s.player.tileY, facing: s.player.facing, moving: !!s.gridMovement?.moving }
    },
    npcs: () => {
      const s = gameScene()
      return (s?.npcs ?? []).map((n: { id: string; data: { tileX: number; tileY: number }; sprite: { visible: boolean }; facing: string }) =>
        ({ id: n.id, x: n.data.tileX, y: n.data.tileY, visible: n.sprite.visible, facing: n.facing }))
    },
    /** 0 = instant text */
    setTextSpeed: (ms: number): void => { uiSettings.speedMs = ms },
    startAt: (mapId: string, tileX: number, tileY: number, facing: Direction = 'down', flags?: string[]): void => {
      if (flags) for (const f of flags) saveManager.setFlag(f)
      for (const key of [SCENE.DIALOG, SCENE.CHALLENGE, SCENE.START_MENU, SCENE.TRANSITION, SCENE.MENU]) {
        if (game.scene.isActive(key) || game.scene.isPaused(key)) game.scene.stop(key)
      }
      game.scene.start(SCENE.GAME, { mapId, spawn: { mapId, tileX, tileY, facing } })
    },
    runScript: (id: string): Promise<void> => gameScene()?.runScript(id),
    /** Shortest walk from the player to a tile (or next to it with `adjacent`), around walls and characters */
    pathTo: (x: number, y: number, adjacent = false): Direction[] | null => {
      const s = gameScene()
      if (!s?.player) return null
      const g = s.gridMovement
      const goal = adjacent
        ? (gx: number, gy: number) => Math.abs(gx - x) + Math.abs(gy - y) === 1
        : (gx: number, gy: number) => gx === x && gy === y
      return findPath(g.mapWidth, g.mapHeight, (bx, by) => g.isBlocked(bx, by) && !(bx === x && by === y && !adjacent),
        { x: s.player.tileX, y: s.player.tileY }, goal)
    },
  }
  ;(window as unknown as { __toc: typeof hooks }).__toc = hooks
}
