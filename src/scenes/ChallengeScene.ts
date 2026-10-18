import Phaser from 'phaser'
import { createChallenge } from '@/challenges/ChallengeRegistry'
import type { IChallenge } from '@/challenges/IChallenge'
import type { ChallengeConfig } from '@/data/types'
import { getChallenge } from '@/data/challenges'
import { getCodemon, ZAP, type CodemonDef } from '@/data/codemon'
import { effectiveness } from '@/data/typeChart'
import { saveManager } from '@/systems/SaveManager'
import { i18n } from '@/i18n/I18nManager'
import type { HpManager } from '@/systems/HpManager'
import type { BattlePlan } from '@/systems/TrainerBattle'
import { createChallengeOverlay } from '@/challenges/cl-utils/ClDomRenderer'
import { BattleHud } from '@/ui/BattleHud'
import { PythonRunner } from '@/python'
import { SCENE } from '@/utils/constants'

export interface ChallengeSceneData {
  plan: BattlePlan
  returnScene?: string
}

/** Sent with 'challenge-closed' to the scene that launched the battle */
export interface ChallengeResult {
  trainerId: string
  /** Every step answered (false when the player died, or for a lesson without questions) */
  won: boolean
}

/** Pause after a hit so the attack reads before the next question appears */
const NEXT_STEP_DELAY = 450

/**
 * Runs a trainer's plan: its steps one after another in a single overlay.
 * When the plan has graded steps it's a battle: a HUD (your Codémon + hearts vs
 * the opponent + its HP) sits above the panel, and it ends on a victory screen.
 */
export class ChallengeScene extends Phaser.Scene {
  private plan!: BattlePlan
  private returnScene: string = SCENE.GAME
  private challenge: IChallenge | null = null
  private overlay: HTMLDivElement | null = null
  private panel: HTMLDivElement | null = null
  private hud: BattleHud | null = null
  private hpManager: HpManager | null = null
  private stepIndex = 0
  private opponentHp = 0
  private closing = false // a fatal hit landed: ignore further answers
  private closed = false
  private victoryKeyHandler: ((e: KeyboardEvent) => void) | null = null
  private timers: ReturnType<typeof setTimeout>[] = []
  private peekPaid = new Set<string>() // solutions already paid for in this battle
  private lead: CodemonDef = ZAP
  /** The opponent's type is not very effective against your lead: wrong answers cost half */
  private resisted = false

  // Field handlers so they can be removed by reference
  private readonly onWrongAnswer = (): void => {
    if (this.closing || this.closed) return
    this.hud?.opponentAttack()
    this.hitPanel()
    const stepId = this.plan.steps[this.stepIndex]
    if (this.hpManager?.isBar && stepId && getChallenge(stepId)?.type !== 'explanation') saveManager.addMissed(stepId)
    if (this.hud) this.hud.say(this.resisted
      ? i18n.t('battle_msg_resisted', { name: this.plan.opponent.name.toUpperCase() })
      : i18n.t('battle_msg_hit', { name: this.plan.opponent.name.toUpperCase() }))
    const damage = this.hpManager ? (this.resisted ? Math.max(1, this.hpManager.damagePerHit / 2) : this.hpManager.damagePerHit) : 0
    if (!this.hpManager?.takeDamage(damage)) return // map without hearts
    this.hud?.setHp(this.hpManager.hp)
    this.data.set('hearts', this.hpManager.hp)
    if (this.hpManager.isDead) {
      // Freeze the panel so a late click can't answer, then let GameScene handle death
      this.closing = true
      if (this.panel) this.panel.style.pointerEvents = 'none'
      this.later(600, () => this.closeScene(false))
    }
  }

  // Looking at a code solution in battle costs one heart, once per challenge
  private readonly onPeeked = (exerciseId: string): void => {
    if (!this.data.get('peekCost') || this.peekPaid.has(exerciseId)) return
    this.peekPaid.add(exerciseId)
    this.onWrongAnswer()
  }

  // Runs on scene stop and when the whole game is destroyed (editor test mode
  // calls game.destroy(), which emits 'destroy' but not 'shutdown')
  private readonly onShutdown = (): void => {
    this.events.off('shutdown', this.onShutdown)
    this.events.off('destroy', this.onShutdown)
    this.teardown()
  }

  constructor() {
    super({ key: SCENE.CHALLENGE })
  }

  create(data: ChallengeSceneData): void {
    this.plan = data.plan
    this.returnScene = data.returnScene ?? SCENE.GAME
    this.stepIndex = 0
    this.opponentHp = data.plan.gradedSteps
    this.closing = false
    this.closed = false
    this.events.once('shutdown', this.onShutdown)
    this.events.once('destroy', this.onShutdown)

    const cam = this.cameras.main
    this.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x111122).setDepth(10)

    const gameScene = this.scene.get(this.returnScene) as { hpManager?: HpManager } | null
    this.hpManager = gameScene?.hpManager ?? null
    // Read by code challenges to label "Show Solution" with its cost
    const finiteHearts = !!this.hpManager && !this.hpManager.isInfinite
    this.peekPaid.clear()
    this.data.set('peekCost', this.plan.gradedSteps > 0 && finiteHearts ? 1 : 0)
    this.data.set('hearts', this.hpManager?.hp ?? 0)

    this.input.keyboard?.disableGlobalCapture()
    const { overlay, panel } = createChallengeOverlay(this)
    this.overlay = overlay
    this.panel = panel

    if (this.plan.gradedSteps > 0) {
      overlay.classList.add('battle')
      // Your Codémon: the team's lead (story), else the old partner (editor test mode), else Zap
      const lead = saveManager.getLead() ?? saveManager.getCompanion()
      this.lead = (lead && getCodemon(lead)) || ZAP
      this.resisted = effectiveness(this.plan.opponent.type, this.lead.type) < 1
      // The Codédex records every Codémon you meet (story)
      if (this.hpManager?.isBar) saveManager.markSeen(this.plan.opponent.id)
      this.hud = new BattleHud({
        player: this.lead,
        opponent: this.plan.opponent,
        trainerName: this.plan.trainerName,
        maxHp: this.hpManager && !this.hpManager.isInfinite ? this.hpManager.maxHp : 0,
        hp: this.hpManager?.hp ?? 0,
        opponentHp: this.opponentHp,
      })
      overlay.insertBefore(this.hud.el, panel)
      this.hud.say(i18n.t('battle_msg_start', { trainer: this.plan.trainerName, name: this.plan.opponent.name.toUpperCase() }))
      this.hud.say(i18n.t('battle_msg_go', { name: this.lead.name.toUpperCase() }))
    }

    // A code fight ahead: download Python while the player answers the rest
    if (this.plan.steps.some(id => getChallenge(id)?.type === 'challenge')) {
      PythonRunner.initialize().catch(() => { /* the code challenge shows its own load error */ })
    }

    this.events.on('challenge-wrong-answer', this.onWrongAnswer)
    this.events.on('challenge-peeked', this.onPeeked)
    this.showStep(0)
  }

  update(): void {
    this.challenge?.update()
  }

  private showStep(index: number): void {
    if (!this.panel) return
    // Skip steps whose exercise vanished (course re-sync) instead of losing the battle
    while (index < this.plan.steps.length && !getChallenge(this.plan.steps[index])) index++
    if (index >= this.plan.steps.length) {
      if (this.plan.gradedSteps > 0) this.showVictory()
      else this.closeScene(false)
      return
    }
    const config = getChallenge(this.plan.steps[index])!
    this.stepIndex = index
    if (this.challenge) {
      this.challenge.softDestroy()
      this.challenge = null
    }
    this.panel.scrollTop = 0

    const challenge = createChallenge(config.type, config)
    this.challenge = challenge
    let answered = false // one completion per step, even if "Continue" is clicked twice
    challenge.createInPanel(this, config, success => {
      if (answered || challenge !== this.challenge) return
      answered = true
      this.onStepComplete(success, config)
    }, this.panel)
  }

  private onStepComplete(success: boolean, config: ChallengeConfig): void {
    if (this.closing || this.closed) return
    if (!success) {
      this.closeScene(false)
      return
    }
    saveManager.completeChallenge(config.id)

    let delay = 50
    if (config.type !== 'explanation' && this.hud) {
      this.opponentHp = Math.max(0, this.opponentHp - 1)
      this.hud.setOpponentHp(this.opponentHp)
      this.hud.playerAttack()
      const move = i18n.t(`battle_move_${config.type}`)
      const strong = effectiveness(this.lead.type, this.plan.opponent.type) > 1
      this.hud.say(i18n.t('battle_msg_attack', { name: this.lead.name.toUpperCase(), move })
        + (strong ? ' ' + i18n.t('battle_msg_strong') : ''))
      delay = NEXT_STEP_DELAY
    }

    const next = this.stepIndex + 1
    if (next < this.plan.steps.length) {
      this.later(delay, () => this.showStep(next))
    } else if (this.plan.gradedSteps > 0) {
      this.later(delay, () => this.showVictory())
    } else {
      this.closeScene(false) // a lesson, not a battle
    }
  }

  /** Opponent faints, then "You defeated X!" + Continue (not recorded as an exercise) */
  private showVictory(): void {
    if (this.closing || this.closed || !this.panel) return
    if (this.challenge) {
      this.challenge.softDestroy()
      this.challenge = null
    }
    this.hud?.opponentFaint()
    if (this.hud) this.hud.setMessage(i18n.t('battle_msg_fainted', { name: this.plan.opponent.name.toUpperCase() }))

    const box = document.createElement('div')
    box.className = 'battle-victory'
    const title = document.createElement('div')
    title.className = 'cl-title'
    title.textContent = i18n.t('battle_victory', { name: this.plan.trainerName })
    const text = document.createElement('div')
    text.className = 'cl-text-block'
    text.textContent = i18n.t('battle_fainted', { name: this.plan.opponent.name })
    const btn = document.createElement('button')
    btn.className = 'cl-btn-primary'
    btn.textContent = i18n.t('challenge_btn_continue')
    btn.addEventListener('click', () => this.closeScene(true))
    box.append(title, text, btn)
    this.panel.innerHTML = ''
    this.panel.appendChild(box)

    this.victoryKeyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault()
        this.closeScene(true)
      }
    }
    document.addEventListener('keydown', this.victoryKeyHandler)
  }

  /**
   * Real-time delay for pacing (the CSS attack animations run in real time; Phaser's
   * clock slows down when the frame rate drops, e.g. while Python compiles).
   * Cleared on teardown, so nothing fires after the scene closes.
   */
  private later(ms: number, fn: () => void): void {
    const handle = setTimeout(() => {
      this.timers = this.timers.filter(t => t !== handle)
      if (!this.closed) fn()
    }, ms)
    this.timers.push(handle)
  }

  /** Red flash + shake on the challenge panel */
  private hitPanel(): void {
    const panel = this.panel
    if (!panel) return
    panel.classList.remove('hit')
    void panel.offsetWidth // restart the animation
    panel.classList.add('hit')
    panel.addEventListener('animationend', () => panel.classList.remove('hit'), { once: true })
  }

  private closeScene(won: boolean): void {
    if (this.closed) return
    this.closed = true
    this.teardown()

    const returnScene = this.scene.get(this.returnScene)
    if (returnScene) {
      const result: ChallengeResult = { trainerId: this.plan.trainerId, won }
      returnScene.events.emit('challenge-closed', result)
    }

    this.scene.stop()
    this.scene.resume(this.returnScene)
  }

  /** Remove everything this scene put in the DOM (safe to call twice) */
  private teardown(): void {
    this.input?.keyboard?.enableGlobalCapture()
    this.hud?.destroy()
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
    this.events.off('challenge-wrong-answer', this.onWrongAnswer)
    this.events.off('challenge-peeked', this.onPeeked)
    if (this.victoryKeyHandler) {
      document.removeEventListener('keydown', this.victoryKeyHandler)
      this.victoryKeyHandler = null
    }
    if (this.challenge) {
      this.challenge.destroy()
      this.challenge = null
    }
    this.overlay?.remove()
    this.overlay = null
    this.panel = null
    this.hud = null
  }
}
