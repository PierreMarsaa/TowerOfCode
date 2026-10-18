import { TEXT_SPEED_MS, type TextSpeed } from '@/config/game.config'

/** Interface settings read by the widgets (the save sets them; tests can make text instant) */
export const uiSettings = {
  /** ms per character in text boxes; 0 = instant */
  speedMs: TEXT_SPEED_MS.mid as number,
}

export function applyTextSpeed(speed: TextSpeed): void {
  uiSettings.speedMs = TEXT_SPEED_MS[speed]
}
