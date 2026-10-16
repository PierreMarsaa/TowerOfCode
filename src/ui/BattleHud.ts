/**
 * Battle header shown above the challenge panel: your Codémon (left, mirrored
 * to face the opponent) with your hearts, the trainer's Codémon (right) with its
 * HP. Pure DOM, laid out with flexbox, injected styles like ClStyles.
 */

import { CODEMON_TYPE_COLORS, codemonArtUrl, type CodemonDef } from '@/data/codemon'

export interface BattleHudOptions {
  player: CodemonDef
  opponent: CodemonDef
  trainerName: string
  /** 0 = infinite hearts (map without HP): the hearts row is hidden */
  maxHearts: number
  hearts: number
  /** Opponent HP = number of graded steps */
  opponentHp: number
}

const HEART_FULL = '♥'
const HEART_EMPTY = '♡'

let stylesInjected = false

function injectBattleStyles(): void {
  if (stylesInjected) return
  stylesInjected = true
  const style = document.createElement('style')
  style.textContent = `
    /* The overlay becomes a column: HUD on top, panel fills the rest */
    .cl-overlay.battle {
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      padding: 12px 20px 20px;
      gap: 10px;
      box-sizing: border-box;
    }
    .cl-overlay.battle > .cl-panel {
      width: auto;
      height: auto;
      flex: 1 1 0;
      min-height: 0;
    }

    .battle-hud {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 16px;
      background: #1e1e2e;
      border: 3px solid #ccaa66;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      color: #eee;
      min-width: 0;
    }
    .battle-side {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .battle-side.opponent {
      flex-direction: row-reverse;
      text-align: right;
    }
    .battle-mon {
      flex: 0 0 auto;
      width: 96px;
      height: 96px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .battle-mon img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .battle-mon img.mirrored { transform: scaleX(-1); }
    .battle-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .battle-side.opponent .battle-info { align-items: flex-end; }
    .battle-name {
      font-size: 16px;
      font-weight: bold;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .battle-type {
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 10px;
      color: #111;
      font-weight: bold;
      align-self: flex-start;
    }
    .battle-side.opponent .battle-type { align-self: flex-end; }
    .battle-hearts {
      display: flex;
      gap: 4px;
      font-size: 22px;
      line-height: 1;
    }
    .battle-hearts span { transition: color 0.2s; }
    .battle-hp {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .battle-hp span {
      width: 18px;
      height: 10px;
      border-radius: 2px;
      background: #44cc66;
      border: 1px solid #227733;
      transition: background 0.3s;
    }
    .battle-hp span.empty {
      background: #333;
      border-color: #444;
    }
    .battle-trainer {
      flex: 0 1 auto;
      font-size: 12px;
      color: #ccaa66;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    @keyframes battle-lunge-right {
      0%, 100% { transform: translateX(0); }
      40% { transform: translateX(28px); }
    }
    @keyframes battle-lunge-left {
      0%, 100% { transform: translateX(0); }
      40% { transform: translateX(-28px); }
    }
    @keyframes battle-hurt {
      0%, 100% { transform: translateX(0); filter: none; }
      15% { transform: translateX(-6px); filter: brightness(1.8) saturate(0.4); }
      30% { transform: translateX(6px); }
      45% { transform: translateX(-4px); filter: brightness(1.8) saturate(0.4); }
      60% { transform: translateX(3px); filter: none; }
    }
    @keyframes battle-faint {
      to { transform: translateY(24px); opacity: 0; }
    }
    .battle-mon.lunge-right { animation: battle-lunge-right 0.35s ease-out; }
    .battle-mon.lunge-left { animation: battle-lunge-left 0.35s ease-out; }
    .battle-mon.hurt { animation: battle-hurt 0.45s ease-out; }
    .battle-mon.fainted { animation: battle-faint 0.6s ease-in forwards; }

    /* Victory screen, rendered in the challenge panel */
    .battle-victory {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      min-height: 100%;
      text-align: center;
    }

    /* Short screens (landscape phones): smaller portraits */
    @media (max-height: 560px) {
      .battle-mon { width: 56px; height: 56px; }
      .battle-name { font-size: 13px; }
      .battle-hearts { font-size: 16px; }
      .battle-hud { padding: 4px 10px; }
      .cl-overlay.battle { padding: 6px 10px 10px; gap: 6px; }
    }
  `
  document.head.appendChild(style)
}

export class BattleHud {
  readonly el: HTMLDivElement
  private readonly playerMon: HTMLDivElement
  private readonly opponentMon: HTMLDivElement
  private readonly heartEls: HTMLSpanElement[] = []
  private readonly hpEls: HTMLSpanElement[] = []

  constructor(opts: BattleHudOptions) {
    injectBattleStyles()
    this.el = document.createElement('div')
    this.el.className = 'battle-hud'

    // ── You ──
    const playerSide = document.createElement('div')
    playerSide.className = 'battle-side player'
    this.playerMon = this.createMon(opts.player, true)
    playerSide.appendChild(this.playerMon)
    const playerInfo = this.createInfo(opts.player)
    if (opts.maxHearts > 0) {
      const hearts = document.createElement('div')
      hearts.className = 'battle-hearts'
      for (let i = 0; i < opts.maxHearts; i++) {
        const heart = document.createElement('span')
        hearts.appendChild(heart)
        this.heartEls.push(heart)
      }
      playerInfo.appendChild(hearts)
    }
    playerSide.appendChild(playerInfo)

    // ── Trainer ──
    const trainer = document.createElement('div')
    trainer.className = 'battle-trainer'
    trainer.textContent = opts.trainerName

    // ── Opponent ──
    const opponentSide = document.createElement('div')
    opponentSide.className = 'battle-side opponent'
    this.opponentMon = this.createMon(opts.opponent, false)
    opponentSide.appendChild(this.opponentMon)
    const opponentInfo = this.createInfo(opts.opponent)
    const hp = document.createElement('div')
    hp.className = 'battle-hp'
    for (let i = 0; i < opts.opponentHp; i++) {
      const seg = document.createElement('span')
      hp.appendChild(seg)
      this.hpEls.push(seg)
    }
    opponentInfo.appendChild(hp)
    opponentSide.appendChild(opponentInfo)

    this.el.append(playerSide, trainer, opponentSide)
    this.setHearts(opts.hearts)
    this.setOpponentHp(opts.opponentHp)
  }

  setHearts(hearts: number): void {
    this.heartEls.forEach((el, i) => {
      const filled = i < hearts
      el.textContent = filled ? HEART_FULL : HEART_EMPTY
      el.style.color = filled ? '#ff3344' : '#553333'
    })
  }

  setOpponentHp(hp: number): void {
    this.hpEls.forEach((el, i) => el.classList.toggle('empty', i >= hp))
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

  private play(mon: HTMLDivElement, animation: string): void {
    if (mon.classList.contains('fainted')) return
    mon.classList.remove('lunge-right', 'lunge-left', 'hurt')
    void mon.offsetWidth // restart the animation
    mon.classList.add(animation)
    mon.addEventListener('animationend', () => mon.classList.remove(animation), { once: true })
  }

  private createMon(def: CodemonDef, mirrored: boolean): HTMLDivElement {
    // The wrapper animates; the image only mirrors (two transforms can't share an element)
    const wrap = document.createElement('div')
    wrap.className = 'battle-mon'
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

  private createInfo(def: CodemonDef): HTMLDivElement {
    const info = document.createElement('div')
    info.className = 'battle-info'
    const name = document.createElement('div')
    name.className = 'battle-name'
    name.textContent = def.name
    const type = document.createElement('div')
    type.className = 'battle-type'
    type.textContent = def.type
    type.style.background = CODEMON_TYPE_COLORS[def.type]
    info.append(name, type)
    return info
  }
}
