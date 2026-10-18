import type { Direction } from '@/data/types'

// Pure (no runtime imports): shared by the game and by the tower generator,
// which also runs in Node for QA (scripts/check-tower.mjs).

export const DIR_OFFSETS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right']
