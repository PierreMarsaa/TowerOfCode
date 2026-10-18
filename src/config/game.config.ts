export const TILE_SIZE = 32

/** Size of a map that doesn't say (editor defaults, the generator's simulator): 20×15 tiles */
export const DEFAULT_MAP_WIDTH = 20
export const DEFAULT_MAP_HEIGHT = 15
/** The same defaults under the names the frozen level editor imports */
export const MAP_WIDTH_TILES = DEFAULT_MAP_WIDTH
export const MAP_HEIGHT_TILES = DEFAULT_MAP_HEIGHT

/** The 640×480 box of the editor's test mode and the exercise browser */
export const CANVAS_WIDTH = 640
export const CANVAS_HEIGHT = 480

/** The game screen: 15×10 tiles = 240×160 art pixels, each drawn 2×2 */
export const VIEW_WIDTH_TILES = 15
export const VIEW_HEIGHT_TILES = 10
export const PIXEL = 2
export const SCREEN_WIDTH = VIEW_WIDTH_TILES * TILE_SIZE   // 480
export const SCREEN_HEIGHT = VIEW_HEIGHT_TILES * TILE_SIZE // 320

/** One step from tile to tile: 16 frames on the Game Boy */
export const WALK_STEP_MS = 267
/** Text box speed, ms per character (OPTIONS → text speed) */
export const TEXT_SPEED_MS = { fast: 12, mid: 30, slow: 60 } as const
export type TextSpeed = keyof typeof TEXT_SPEED_MS

export const SAVE_KEY = 'towerofcode_save'
