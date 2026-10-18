import type { Direction } from '@/data/types'
import { DIR_OFFSETS } from '@/utils/directions'
import { matches } from '@/story/conditions'
import { findPath, parsePath } from '@/story/pathfind'
import type { Actor, Script, Step } from '@/story/types'

/** A character a script can move */
export interface ActorHandle {
  readonly tileX: number
  readonly tileY: number
  readonly facing: Direction
  /** One tile in `dir` (collisions are the script's business) */
  step(dir: Direction, ms?: number): Promise<void>
  face(dir: Direction): void
  teleport(x: number, y: number, facing?: Direction): void
}

/** What a script can do in the game (implemented by GameScene) */
export interface ScriptHost {
  has(flag: string): boolean
  setFlag(flag: string): void
  clearFlag(flag: string): void
  /** Dialog lines of an i18n key, placeholders filled */
  lines(key: string, params?: Record<string, string>): string[]
  say(lines: string[]): Promise<void>
  ask(lines: string[], choices: 'yesno' | string[], required?: boolean): Promise<number | null>
  actor(id: Actor): ActorHandle | null
  isBlocked(x: number, y: number): boolean
  mapSize(): { width: number; height: number }
  show(id: Actor, at?: { x: number; y: number; facing?: Direction }): void
  hide(id: Actor): void
  emote(id: Actor, kind: '!' | '?' | '...'): Promise<void>
  give(codemon: string): Promise<void>
  chooseStarter(codemon: string): void
  askName(lines: string[]): Promise<void>
  hatch(codemon: string): Promise<void>
  heal(respawn: boolean): Promise<void>
  lesson(chapters: string[]): Promise<void>
  battle(step: Extract<Step, { op: 'battle' }>): Promise<boolean>
  picture(codemon: string | null): void
  fade(to: 'black' | 'clear'): Promise<void>
  save(): void
  warp(map: string, x: number, y: number, facing: Direction): void
  wait(ms: number): Promise<void>
}

/** Which way a tile is from another (they must be neighbours) */
function dirBetween(from: { x: number; y: number }, to: { x: number; y: number }): Direction | null {
  for (const [dir, off] of Object.entries(DIR_OFFSETS) as [Direction, { x: number; y: number }][]) {
    if (from.x + off.x === to.x && from.y + off.y === to.y) return dir
  }
  return null
}

/** The direction from one tile toward another (the larger axis wins) */
export function directionToward(from: { x: number; y: number }, to: { x: number; y: number }): Direction {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

/**
 * Runs story scripts step by step over a host. One script at a time; `busy` while
 * running (the map ignores the player's input then). A warp ends the script.
 */
export class ScriptRunner {
  busy = false
  current: string | null = null
  private cancelled = false
  private readonly host: ScriptHost
  private readonly scripts: Record<string, Script>

  constructor(host: ScriptHost, scripts: Record<string, Script>) {
    this.host = host
    this.scripts = scripts
  }

  has(id: string): boolean {
    return id in this.scripts
  }

  async run(id: string): Promise<void> {
    const script = this.scripts[id]
    if (!script) {
      console.error(`[story] unknown script "${id}"`)
      return
    }
    if (this.busy) return
    this.busy = true
    this.current = id
    this.cancelled = false
    try {
      await this.exec(script)
    } catch (e) {
      console.error(`[story] script "${id}" failed`, e)
    } finally {
      this.busy = false
      this.current = null
    }
  }

  /** Stop at the next step (the scene is shutting down) */
  cancel(): void {
    this.cancelled = true
  }

  private async exec(steps: readonly Step[]): Promise<void> {
    for (let i = 0; i < steps.length && !this.cancelled; i++) {
      const step = steps[i]
      if (step.op === 'say') {
        // Consecutive lines share one text box
        const lines: string[] = []
        let j = i
        while (j < steps.length && steps[j].op === 'say') {
          const s = steps[j] as Extract<Step, { op: 'say' }>
          for (const key of Array.isArray(s.key) ? s.key : [s.key]) lines.push(...this.host.lines(key, s.params))
          j++
        }
        i = j - 1
        await this.host.say(lines)
        continue
      }
      if (step.op === 'warp') {
        this.host.warp(step.map, step.x, step.y, step.facing)
        this.cancelled = true
        return
      }
      await this.execOne(step)
    }
  }

  private async execOne(step: Step): Promise<void> {
    const h = this.host
    switch (step.op) {
      case 'ask': {
        const answer = await h.ask(h.lines(step.key), step.choices ?? 'yesno', step.required)
        const branch = step.branches[answer ?? (step.choices === 'yesno' || !step.choices ? 1 : -1)]
        if (branch) await this.exec(branch)
        return
      }
      case 'walk':
        return this.walk(step.actor, parsePath(step.path), step.followers ?? [], step.ms)
      case 'walkTo': {
        const actor = h.actor(step.actor)
        if (!actor) return
        const { width, height } = h.mapSize()
        let path: Direction[] | null
        if ('actor' in step.to) {
          const target = h.actor(step.to.actor)
          if (!target) return
          path = findPath(width, height, (x, y) => h.isBlocked(x, y), { x: actor.tileX, y: actor.tileY },
            (x, y) => Math.abs(x - target.tileX) + Math.abs(y - target.tileY) === 1)
        } else {
          const goal = step.to
          path = findPath(width, height, (x, y) => h.isBlocked(x, y) && !(x === goal.x && y === goal.y),
            { x: actor.tileX, y: actor.tileY }, (x, y) => x === goal.x && y === goal.y)
        }
        if (!path) {
          console.warn(`[story] ${step.actor} can't reach its target`)
          return
        }
        await this.walk(step.actor, path, step.followers ?? [], step.ms)
        if ('actor' in step.to) {
          const target = h.actor(step.to.actor)!
          actor.face(directionToward({ x: actor.tileX, y: actor.tileY }, { x: target.tileX, y: target.tileY }))
        }
        return
      }
      case 'face': {
        const actor = h.actor(step.actor)
        if (!actor) return
        if (typeof step.dir === 'string') actor.face(step.dir)
        else {
          const target = h.actor(step.dir.actor)
          if (target) actor.face(directionToward({ x: actor.tileX, y: actor.tileY }, { x: target.tileX, y: target.tileY }))
        }
        return
      }
      case 'emote':
        return h.emote(step.actor, step.kind)
      case 'wait':
        return h.wait(step.ms)
      case 'setFlag':
        return h.setFlag(step.flag)
      case 'clearFlag':
        return h.clearFlag(step.flag)
      case 'if':
        return this.exec(matches(step.when, f => h.has(f)) ? step.then : step.else ?? [])
      case 'show':
        return h.show(step.actor, step.at)
      case 'hide':
        return h.hide(step.actor)
      case 'teleport':
        return h.actor(step.actor)?.teleport(step.x, step.y, step.facing)
      case 'give':
        return h.give(step.codemon)
      case 'chooseStarter':
        return h.chooseStarter(step.codemon)
      case 'name':
        return h.askName(h.lines(step.key))
      case 'hatch':
        return h.hatch(step.codemon)
      case 'heal':
        return h.heal(!!step.respawn)
      case 'lesson':
        return h.lesson(step.chapters)
      case 'battle': {
        const won = await h.battle(step)
        await this.exec((won ? step.win : step.lose) ?? [])
        return
      }
      case 'picture':
        return h.picture(step.codemon)
      case 'fade':
        return h.fade(step.to)
      case 'save':
        return h.save()
      case 'call': {
        const script = this.scripts[step.script]
        if (script) await this.exec(script)
        else console.error(`[story] unknown script "${step.script}"`)
        return
      }
      default:
        return
    }
  }

  /** Walk an actor along `dirs`; followers each step into the tile of the one ahead */
  private async walk(id: Actor, dirs: Direction[], followers: Actor[], ms?: number): Promise<void> {
    const leader = this.host.actor(id)
    if (!leader) return
    const chain = [leader, ...followers.map(f => this.host.actor(f)).filter((a): a is ActorHandle => !!a)]
    for (const dir of dirs) {
      if (this.cancelled) return
      const targets = chain.map((a, k) => {
        if (k === 0) return { x: a.tileX + DIR_OFFSETS[dir].x, y: a.tileY + DIR_OFFSETS[dir].y }
        const ahead = chain[k - 1]
        return { x: ahead.tileX, y: ahead.tileY }
      })
      await Promise.all(chain.map((a, k) => {
        const d = k === 0 ? dir : dirBetween({ x: a.tileX, y: a.tileY }, targets[k])
        if (d) return a.step(d, ms)
        if (targets[k].x !== a.tileX || targets[k].y !== a.tileY) a.teleport(targets[k].x, targets[k].y)
        return Promise.resolve()
      }))
    }
  }
}

