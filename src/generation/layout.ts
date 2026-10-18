import type { Direction } from '@/data/types'
import type { Rng } from './rng.ts'

/*
 * Floor layout: a grid of cells, at most one room per cell, rooms floating in
 * the void. A random walk over the cells gives the critical path (entrance →
 * … → stairs room); side rooms hang off it as dead ends. Neighbouring rooms are
 * joined by straight, 1-tile-wide bridges across the void, so a guard standing
 * on a bridge blocks it completely. The stairs room is a leaf with one bridge.
 */

export const CELL_W = 12
export const CELL_H = 10
export const MARGIN = 1
const MIN_ROOM_W = 5
const MIN_ROOM_H = 4
/** Grid shapes tried in order: [columns, rows] */
const GRIDS: readonly [number, number][] = [[3, 2], [4, 2], [3, 3], [4, 3], [5, 3], [5, 4], [6, 4]]

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export type RoomRole = 'entrance' | 'path' | 'stairs' | 'side'

export interface Room {
  id: number
  cx: number
  cy: number
  /** Floor area (inclusive x..x+w-1, y..y+h-1) */
  rect: Rect
  role: RoomRole
}

export interface Bridge {
  /** Room nearer the entrance */
  from: number
  /** Room further from the entrance */
  to: number
  /** Direction of travel from `from` to `to` */
  dir: Direction
  /** Void tiles the bridge covers, ordered from `from` to `to` */
  tiles: Point[]
  /** Room tiles where the bridge lands */
  doorFrom: Point
  doorTo: Point
  /** On the entrance → stairs route */
  critical: boolean
}

export interface Layout {
  width: number
  height: number
  rooms: Room[]
  bridges: Bridge[]
  /** Room ids from the entrance to the stairs room */
  path: number[]
}

type Cell = [number, number]

const NEIGHBOURS: readonly Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/** Self-avoiding random walk of `length` cells (DFS with backtracking, bounded) */
function randomWalk(rng: Rng, cols: number, rows: number, length: number): Cell[] | null {
  let budget = 4000
  const inside = ([x, y]: Cell) => x >= 0 && y >= 0 && x < cols && y < rows
  const key = ([x, y]: Cell) => y * cols + x
  const walk = (path: Cell[], used: Set<number>): Cell[] | null => {
    if (path.length === length) return path
    if (--budget <= 0) return null
    const [x, y] = path[path.length - 1]
    for (const [dx, dy] of rng.shuffle(NEIGHBOURS)) {
      const next: Cell = [x + dx, y + dy]
      if (!inside(next) || used.has(key(next))) continue
      used.add(key(next))
      const found = walk([...path, next], used)
      if (found) return found
      used.delete(key(next))
    }
    return null
  }
  const start: Cell = [rng.int(0, cols - 1), rng.int(0, rows - 1)]
  return walk([start], new Set([key(start)]))
}

/**
 * Lay out a floor with `pathLength` rooms on the critical path (≥ 2) and up to
 * `sideCount` dead-end side rooms. `straight` forces a single row (the fallback).
 */
export function generateLayout(rng: Rng, pathLength: number, sideCount: number, straight = false): Layout | null {
  const shapes = straight ? [[pathLength, 1] as [number, number]] : GRIDS.filter(([c, r]) => c * r >= pathLength + 1)
  for (const [cols, rows] of shapes) {
    const cells = straight
      ? Array.from({ length: pathLength }, (_, i) => [i, 0] as Cell)
      : randomWalk(rng, cols, rows, pathLength)
    if (!cells) continue
    return buildLayout(rng, cols, rows, cells, straight ? 0 : sideCount)
  }
  return null
}

function buildLayout(rng: Rng, cols: number, rows: number, path: Cell[], sideCount: number): Layout {
  const cellId = new Map<number, number>() // cell key → room id
  const cellsOfRoom: Cell[] = []
  const key = ([x, y]: Cell) => y * cols + x
  const addRoom = (c: Cell): number => {
    const id = cellsOfRoom.length
    cellsOfRoom.push(c)
    cellId.set(key(c), id)
    return id
  }
  const pathIds = path.map(addRoom)

  // Connections: the critical chain, then side rooms off it (never off the stairs room)
  const links: { from: number; to: number; critical: boolean }[] = []
  for (let i = 0; i + 1 < pathIds.length; i++) links.push({ from: pathIds[i], to: pathIds[i + 1], critical: true })
  const sideIds: number[] = []
  const hosts = pathIds.slice(0, -1)
  for (const host of rng.shuffle(hosts)) {
    if (sideIds.length >= sideCount) break
    const [hx, hy] = cellsOfRoom[host]
    const free = rng.shuffle(NEIGHBOURS)
      .map(([dx, dy]) => [hx + dx, hy + dy] as Cell)
      .find(c => c[0] >= 0 && c[1] >= 0 && c[0] < cols && c[1] < rows && !cellId.has(key(c)))
    if (!free) continue
    const id = addRoom(free)
    sideIds.push(id)
    links.push({ from: host, to: id, critical: false })
  }

  // Where each link crosses: a row (side-by-side cells) or a column (stacked cells)
  const reqX = cellsOfRoom.map(() => [] as number[])
  const reqY = cellsOfRoom.map(() => [] as number[])
  const crossings = links.map(link => {
    const [ax, ay] = cellsOfRoom[link.from]
    const by = cellsOfRoom[link.to][1]
    if (ay === by) {
      const y = ay * CELL_H + MARGIN + rng.int(2, CELL_H - 3)
      reqY[link.from].push(y)
      reqY[link.to].push(y)
      return { ...link, horizontal: true, at: y }
    }
    const x = ax * CELL_W + MARGIN + rng.int(2, CELL_W - 3)
    reqX[link.from].push(x)
    reqX[link.to].push(x)
    return { ...link, horizontal: false, at: x }
  })

  // Rooms: random size inside their cell, covering every crossing
  const rooms: Room[] = cellsOfRoom.map(([cx, cy], id) => {
    const xs = placeSpan(rng, cx * CELL_W + MARGIN, CELL_W, MIN_ROOM_W, reqX[id])
    const ys = placeSpan(rng, cy * CELL_H + MARGIN, CELL_H, MIN_ROOM_H, reqY[id])
    const rect: Rect = { x: xs.start, w: xs.size, y: ys.start, h: ys.size }
    const role: RoomRole = id === pathIds[0] ? 'entrance'
      : id === pathIds[pathIds.length - 1] ? 'stairs'
      : sideIds.includes(id) ? 'side' : 'path'
    return { id, cx, cy, rect, role }
  })

  const bridges: Bridge[] = crossings.map(c => makeBridge(rooms[c.from], rooms[c.to], c.horizontal, c.at, c.critical))
  return {
    width: cols * CELL_W + 2 * MARGIN,
    height: rows * CELL_H + 2 * MARGIN,
    rooms,
    bridges,
    path: pathIds,
  }
}

/** Start and length of a room along one axis: inside its cell (1 void tile each side), covering `required` */
function placeSpan(rng: Rng, cellStart: number, cellSize: number, minSize: number, required: number[]): { start: number; size: number } {
  const lo = cellStart + 1
  const hi = cellStart + cellSize - 2 // last usable coordinate
  const span = required.length ? Math.max(...required) - Math.min(...required) + 1 : 1
  const size = Math.max(span, rng.int(minSize, hi - lo + 1))
  let startLo = lo
  let startHi = hi - size + 1
  if (required.length) {
    startLo = Math.max(startLo, Math.max(...required) - size + 1)
    startHi = Math.min(startHi, Math.min(...required))
  }
  return { start: rng.int(startLo, startHi), size }
}

function makeBridge(from: Room, to: Room, horizontal: boolean, at: number, critical: boolean): Bridge {
  const tiles: Point[] = []
  let dir: Direction
  let doorFrom: Point
  let doorTo: Point
  if (horizontal) {
    const goingRight = to.cx > from.cx
    dir = goingRight ? 'right' : 'left'
    const fromEdge = goingRight ? from.rect.x + from.rect.w - 1 : from.rect.x
    const toEdge = goingRight ? to.rect.x : to.rect.x + to.rect.w - 1
    doorFrom = { x: fromEdge, y: at }
    doorTo = { x: toEdge, y: at }
    const step = goingRight ? 1 : -1
    for (let x = fromEdge + step; x !== toEdge; x += step) tiles.push({ x, y: at })
  } else {
    const goingDown = to.cy > from.cy
    dir = goingDown ? 'down' : 'up'
    const fromEdge = goingDown ? from.rect.y + from.rect.h - 1 : from.rect.y
    const toEdge = goingDown ? to.rect.y : to.rect.y + to.rect.h - 1
    doorFrom = { x: at, y: fromEdge }
    doorTo = { x: at, y: toEdge }
    const step = goingDown ? 1 : -1
    for (let y = fromEdge + step; y !== toEdge; y += step) tiles.push({ x: at, y })
  }
  return { from: from.id, to: to.id, dir, tiles, doorFrom, doorTo, critical }
}
