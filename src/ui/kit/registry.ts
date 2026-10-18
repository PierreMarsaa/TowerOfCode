/**
 * The Game Boy widgets on screen, most recent last. Only used by the dev test
 * hooks (window.__toc.ui()) so browser checks can read what the player sees.
 */
export interface WidgetState {
  kind: 'text' | 'menu' | 'name' | 'other'
  [k: string]: unknown
}

export interface Widget {
  state(): WidgetState
}

const stack: Widget[] = []

export function pushWidget(w: Widget): void {
  stack.push(w)
}

export function popWidget(w: Widget): void {
  const i = stack.lastIndexOf(w)
  if (i >= 0) stack.splice(i, 1)
}

export function topWidget(): WidgetState | null {
  return stack.length ? stack[stack.length - 1].state() : null
}

export function allWidgets(): WidgetState[] {
  return stack.map(w => w.state())
}
