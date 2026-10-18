import type Phaser from 'phaser'

/** The Game Boy's buttons */
export type PadButton = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start'
export type Dir = 'up' | 'down' | 'left' | 'right'

/**
 * Keys by physical position (KeyboardEvent.code), so WASD is also ZQSD on an
 * AZERTY keyboard. A = Space or Z, B = Escape, X or Backspace, START = Enter.
 * The on-screen touch buttons send the same codes.
 */
const CODES: Record<string, PadButton> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'a', KeyZ: 'a',
  Escape: 'b', KeyX: 'b', Backspace: 'b',
  Enter: 'start', NumpadEnter: 'start',
}

const DIRS: ReadonlySet<PadButton> = new Set(['up', 'down', 'left', 'right'])
const REPEAT_DELAY = 350
const REPEAT_EVERY = 90

export function isDir(b: PadButton): b is Dir {
  return DIRS.has(b)
}

/** Typing in a text field or the code editor never reaches the game */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

type Listener = (button: PadButton) => void

/**
 * Buttons for one scene, through its keyboard plugin: a paused or sleeping scene
 * hears nothing. Directions held down repeat (for menus); `isDown` is for walking.
 * Never captures keys, so the code editor always gets Space, arrows and Backspace.
 */
export class PadInput {
  private readonly held = new Set<PadButton>()
  private readonly listeners = new Set<Listener>()
  private repeatTimer?: ReturnType<typeof setTimeout>
  private destroyed = false
  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const kb = scene.input.keyboard
    kb?.on('keydown', this.onDown)
    kb?.on('keyup', this.onUp)
    scene.events.on('pause', this.clear)
    scene.events.on('resume', this.clear)
    scene.events.on('sleep', this.clear)
    scene.events.on('wake', this.clear)
    window.addEventListener('blur', this.clear)
    scene.events.once('shutdown', this.destroy)
    scene.events.once('destroy', this.destroy)
  }

  /** Call `fn` on every press (and on repeats while a direction is held). Returns an unsubscribe. */
  on(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** The next press of one of `buttons` (any button if omitted) */
  next(buttons?: readonly PadButton[]): Promise<PadButton> {
    return new Promise(resolve => {
      const off = this.on(b => {
        if (buttons && !buttons.includes(b)) return
        off()
        resolve(b)
      })
    })
  }

  isDown(button: PadButton): boolean {
    return this.held.has(button)
  }

  /** The direction held most recently, if any */
  heldDir(): Dir | null {
    let last: Dir | null = null
    for (const b of this.held) if (isDir(b)) last = b
    return last
  }

  /** Forget held buttons (after a pause, a scene change, a lost focus) */
  readonly clear = (): void => {
    this.held.clear()
    if (this.repeatTimer) clearTimeout(this.repeatTimer)
    this.repeatTimer = undefined
  }

  readonly destroy = (): void => {
    if (this.destroyed) return
    this.destroyed = true
    this.clear()
    this.listeners.clear()
    const kb = this.scene.input?.keyboard
    kb?.off('keydown', this.onDown)
    kb?.off('keyup', this.onUp)
    this.scene.events.off('pause', this.clear)
    this.scene.events.off('resume', this.clear)
    this.scene.events.off('sleep', this.clear)
    this.scene.events.off('wake', this.clear)
    window.removeEventListener('blur', this.clear)
  }

  private readonly onDown = (event: KeyboardEvent): void => {
    if (isEditable(event.target)) return
    const button = CODES[event.code]
    if (!button || event.repeat) return
    // A new direction replaces the held one (no diagonals)
    if (isDir(button)) for (const b of [...this.held]) if (isDir(b)) this.held.delete(b)
    this.held.delete(button)
    this.held.add(button)
    this.emit(button)
    if (isDir(button)) this.startRepeat(button)
  }

  private readonly onUp = (event: KeyboardEvent): void => {
    const button = CODES[event.code]
    if (!button) return
    this.held.delete(button)
  }

  private startRepeat(button: PadButton): void {
    if (this.repeatTimer) clearTimeout(this.repeatTimer)
    const tick = (delay: number): void => {
      this.repeatTimer = setTimeout(() => {
        if (this.destroyed || !this.held.has(button)) return
        this.emit(button)
        tick(REPEAT_EVERY)
      }, delay)
    }
    tick(REPEAT_DELAY)
  }

  private emit(button: PadButton): void {
    for (const fn of [...this.listeners]) fn(button)
  }
}
