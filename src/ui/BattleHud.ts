/**
 * The battle screen's top half: the opponent's Codémon top-right with its card
 * (name, type, PV bar) top-left, yours bottom-left (mirrored to face it) with your
 * card bottom-right, each on a glow in its type colour, and a text box for the
 * battle messages. Pure DOM; styles in battle-hud.css.
 */

import { CODEMON_TYPE_COLORS, codemonArtUrl, type CodemonDef } from '@/data/codemon'
import { TYPE_NAMES } from '@/data/typeChart'
import { i18n } from '@/i18n/I18nManager'
import './battle-hud.css'

export interface BattleHudOptions {
  player: CodemonDef
  opponent: CodemonDef
  trainerName: string
  /** Your PV (0 max = no PV: the bar is hidden) */
  maxHp: number
  hp: number
  /** Opponent PV = number of graded steps */
  opponentHp: number
}

const MESSAGE_SPEED_MS = 22

/** A type's colour, and the ink (dark or light) that reads best on it */
function typeStyle(def: CodemonDef): { color: string; ink: string } {
  const color = CODEMON_TYPE_COLORS[def.type]
  const n = parseInt(color.slice(1), 16)
  const luma = 0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)
  return { color, ink: luma > 150 ? '#1c1846' : '#fafafe' }
}

export class BattleHud {
  readonly el: HTMLDivElement
  private readonly playerMon: HTMLDivElement
  private readonly opponentMon: HTMLDivElement
  private readonly playerBar: HTMLDivElement | null
  private readonly opponentBar: HTMLDivElement
  private readonly playerHpText: HTMLSpanElement | null
  private readonly message: HTMLDivElement
  private readonly maxHp: number
  private readonly opponentMax: number
  private typing?: ReturnType<typeof setInterval>
  private pause?: ReturnType<typeof setTimeout>
  private readonly queue: string[] = []

  constructor(opts: BattleHudOptions) {
    this.maxHp = opts.maxHp
    this.opponentMax = Math.max(1, opts.opponentHp)
    this.el = document.createElement('div')
    this.el.className = 'battle-hud'

    const field = document.createElement('div')
    field.className = 'battle-field'

    // ── Opponent: info top-left, Codémon top-right ──
    const oppInfo = this.createInfo(opts.opponent, 'opponent')
    this.opponentBar = oppInfo.querySelector('.battle-bar-fill') as HTMLDivElement
    this.opponentMon = this.createMon(opts.opponent, false, 'opponent')

    // ── You: Codémon bottom-left, info bottom-right ──
    this.playerMon = this.createMon(opts.player, true, 'player')
    const playerInfo = this.createInfo(opts.player, 'player', opts.maxHp > 0)
    this.playerBar = playerInfo.querySelector('.battle-bar-fill')
    this.playerHpText = playerInfo.querySelector('.battle-hp-text')

    field.append(oppInfo, this.opponentMon, this.playerMon, playerInfo)

    this.message = document.createElement('div')
    this.message.className = 'battle-message'
    this.message.setAttribute('aria-live', 'polite')

    this.el.append(field, this.message)
    this.setHp(opts.hp)
    this.setOpponentHp(opts.opponentHp)
  }

  /** Your PV (in the same units as maxHp) */
  setHp(hp: number): void {
    if (!this.playerBar || this.maxHp <= 0) return
    this.fill(this.playerBar, hp / this.maxHp)
    if (this.playerHpText) this.playerHpText.textContent = `${Math.ceil((hp / this.maxHp) * 20)}/20`
  }

  /** Kept for callers using hearts */
  setHearts(hearts: number): void {
    this.setHp(hearts)
  }

  setOpponentHp(hp: number): void {
    this.fill(this.opponentBar, hp / this.opponentMax)
  }

  /** A battle message, typed in the text box after the ones already waiting */
  say(text: string): void {
    // French punctuation never starts a line ("battre !" keeps its "!")
    this.queue.push(text.replace(/ ([!?:;»])/g, '\u00a0$1'))
    if (!this.typing && !this.pause) this.next()
  }

  /** Show a message at once, dropping the ones still waiting */
  setMessage(text: string): void {
    this.stopTyping()
    this.queue.length = 0
    this.message.textContent = text
  }

  private next(): void {
    const text = this.queue.shift()
    if (text === undefined) return
    let n = 0
    this.message.textContent = ''
    this.typing = setInterval(() => {
      n++
      this.message.textContent = text.slice(0, n)
      if (n < text.length) return
      clearInterval(this.typing)
      this.typing = undefined
      // A beat to read it before the next one
      this.pause = setTimeout(() => {
        this.pause = undefined
        this.next()
      }, 450)
    }, MESSAGE_SPEED_MS)
  }

  private stopTyping(): void {
    if (this.typing) clearInterval(this.typing)
    if (this.pause) clearTimeout(this.pause)
    this.typing = undefined
    this.pause = undefined
  }

  /** Right answer: your Codémon lunges, the opponent takes the hit */
  playerAttack(): void {
    this.play(this.playerMon, 'lunge-right')
    window.setTimeout(() => this.play(this.opponentMon, 'hurt'), 150)
  }

  /** Wrong answer: the opponent lunges, your Codémon takes the hit */
  opponentAttack(): void {
    this.play(this.opponentMon, 'lunge-left')
    window.setTimeout(() => this.play(this.playerMon, 'hurt'), 150)
  }

  opponentFaint(): void {
    this.opponentMon.classList.add('fainted')
  }

  destroy(): void {
    this.stopTyping()
    this.queue.length = 0
  }

  private fill(bar: HTMLDivElement, ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio))
    bar.style.width = `${r * 100}%`
    bar.classList.toggle('mid', r <= 0.5 && r > 0.2)
    bar.classList.toggle('low', r <= 0.2)
  }

  private play(mon: HTMLDivElement, animation: string): void {
    if (mon.classList.contains('fainted')) return
    mon.classList.remove('lunge-right', 'lunge-left', 'hurt')
    void mon.offsetWidth // restart the animation
    mon.classList.add(animation)
    mon.addEventListener('animationend', () => mon.classList.remove(animation), { once: true })
  }

  private createMon(def: CodemonDef, mirrored: boolean, side: string): HTMLDivElement {
    // The wrapper animates; the image only mirrors (two transforms can't share an element)
    const wrap = document.createElement('div')
    wrap.className = `battle-mon ${side}`
    wrap.style.setProperty('--type', typeStyle(def).color)
    const url = codemonArtUrl(def.id)
    if (url) {
      const img = document.createElement('img')
      img.src = url
      img.alt = def.name
      if (mirrored) img.className = 'mirrored'
      wrap.appendChild(img)
    }
    return wrap
  }

  private createInfo(def: CodemonDef, side: 'player' | 'opponent', withBar = true): HTMLDivElement {
    const info = document.createElement('div')
    info.className = `battle-info ${side}`
    const name = document.createElement('div')
    name.className = 'battle-name'
    name.textContent = def.name.toUpperCase()
    const type = document.createElement('div')
    type.className = `battle-type type-${def.type}`
    const { color, ink } = typeStyle(def)
    type.style.setProperty('--type', color)
    type.style.setProperty('--type-ink', ink)
    type.textContent = TYPE_NAMES[def.type][i18n.getLanguage()].toUpperCase()
    info.append(name, type)
    if (withBar) {
      const row = document.createElement('div')
      row.className = 'battle-bar-row'
      const label = document.createElement('span')
      label.className = 'battle-bar-label'
      label.textContent = i18n.t('battle_hp')
      const bar = document.createElement('div')
      bar.className = 'battle-bar'
      const fill = document.createElement('div')
      fill.className = 'battle-bar-fill'
      bar.appendChild(fill)
      row.append(label, bar)
      info.appendChild(row)
      if (side === 'player') {
        const hp = document.createElement('span')
        hp.className = 'battle-hp-text'
        info.appendChild(hp)
      }
    }
    return info
  }
}
