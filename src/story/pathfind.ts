import type { Direction } from '@/data/types'
import { DIR_OFFSETS } from '@/utils/directions'

const ORDER: Direction[] = ['up', 'down', 'left', 'right']

/**
 * Shortest walk (4 directions) from a tile to the nearest tile where `goal` holds,
 * around blocked tiles. Null when unreachable.
 */
export function findPath(
  width: number,
  height: number,
  blocked: (x: number, y: number) => boolean,
  from: { x: number; y: number },
  goal: (x: number, y: number) => boolean,
): Direction[] | null {
  if (goal(from.x, from.y)) return []
  const key = (x: number, y: number): number => y * width + x
  const prev = new Map<number, { k: number; dir: Direction }>()
  const seen = new Set<number>([key(from.x, from.y)])
  const queue: { x: number; y: number }[] = [from]
  while (queue.length) {
    const cur = queue.shift()!
    for (const dir of ORDER) {
      const nx = cur.x + DIR_OFFSETS[dir].x
      const ny = cur.y + DIR_OFFSETS[dir].y
      const k = key(nx, ny)
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen.has(k) || blocked(nx, ny)) continue
      seen.add(k)
      prev.set(k, { k: key(cur.x, cur.y), dir })
      if (goal(nx, ny)) {
        const path: Direction[] = []
        let at = k
        while (prev.has(at)) {
          const p = prev.get(at)!
          path.unshift(p.dir)
          at = p.k
        }
        return path
      }
      queue.push({ x: nx, y: ny })
    }
  }
  return null
}

/** "U3 L2" → up, up, up, left, left */
export function parsePath(path: string): Direction[] {
  const dirs: Record<string, Direction> = { U: 'up', D: 'down', L: 'left', R: 'right' }
  const out: Direction[] = []
  for (const part of path.trim().split(/\s+/)) {
    if (!part) continue
    const dir = dirs[part[0].toUpperCase()]
    if (!dir) throw new Error(`bad path step "${part}"`)
    const n = part.length > 1 ? Number(part.slice(1)) : 1
    for (let i = 0; i < n; i++) out.push(dir)
  }
  return out
}
