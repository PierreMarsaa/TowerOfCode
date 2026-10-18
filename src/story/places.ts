import type { Spot } from '@/data/types'

/** Where a new adventure starts: in Prof Pi's lab, facing him */
export const OPENING_SPAWN: Spot = { mapId: 'lab', tileX: 4, tileY: 4, facing: 'up' }

/** Where you wake up after blacking out before any other healer: by the lab's healing machine */
export const LAB_RESPAWN: Spot = { mapId: 'lab', tileX: 7, tileY: 2, facing: 'up' }
