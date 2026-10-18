import type { Condition } from '@/data/types'

/** Whether a set of story flags satisfies a condition (no condition = always) */
export function matches(when: Condition | undefined, has: (flag: string) => boolean): boolean {
  if (!when) return true
  return (when.all ?? []).every(has) && !(when.none ?? []).some(has)
}
