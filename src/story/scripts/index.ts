import type { Script } from '@/story/types'
import { OPENING } from './opening.ts'

/** Every story script, by id */
export const SCRIPTS: Record<string, Script> = {
  ...OPENING,
}
