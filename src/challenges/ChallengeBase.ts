import type { ChallengeConfig, LocalizedText } from '@/data/types'
import type { IChallenge } from '@/challenges/IChallenge'
import { ClDomRenderer } from '@/challenges/cl-utils/ClDomRenderer'
import { i18n } from '@/i18n/I18nManager'
import { resolveText } from '@/utils/i18n-helpers'

/** How the content is laid out (challenge.css): a reading column, a quiz card, or the code split */
export type ChallengeLayout = 'lesson' | 'quiz' | 'code'

export abstract class ChallengeBase<C extends ChallengeConfig = ChallengeConfig>
  implements IChallenge
{
  protected readonly renderer = new ClDomRenderer()
  protected readonly layout: ChallengeLayout = 'quiz'
  protected onComplete!: (success: boolean) => void
  protected scene!: Phaser.Scene
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null
  private pendingTimers: ReturnType<typeof setTimeout>[] = []
  private attempts = 0
  private attemptEl: HTMLSpanElement | null = null
  private contentEl: HTMLDivElement | null = null

  create(
    _scene: Phaser.Scene,
    config: ChallengeConfig,
    onComplete: (success: boolean) => void,
  ): void {
    this.onComplete = onComplete
    this.scene = _scene
    this.attempts = 0
    const panel = this.renderer.createOverlay(_scene)
    this.initPanel(panel, _scene, config)
  }

  createInPanel(
    _scene: Phaser.Scene,
    config: ChallengeConfig,
    onComplete: (success: boolean) => void,
    panel: HTMLDivElement,
  ): void {
    this.onComplete = onComplete
    this.scene = _scene
    this.attempts = 0
    this.renderer.adoptPanel(panel)
    this.initPanel(panel, _scene, config)
  }

  /** The panel is a fixed frame: the challenge renders into a scrolling content wrapper inside it */
  private initPanel(panel: HTMLDivElement, scene: Phaser.Scene, config: ChallengeConfig): void {
    this.contentEl = document.createElement('div')
    this.contentEl.className = `cl-content cl-content--${this.layout}`
    panel.appendChild(this.contentEl)
    this.attemptEl = document.createElement('span')
    this.attemptEl.className = 'cl-attempt-counter'
    this.attemptEl.style.display = 'none'
    this.contentEl.appendChild(this.attemptEl)
    this.onCreate(scene, config as C, this.contentEl)
  }

  update(): void {}

  /** Full cleanup — removes the overlay from DOM */
  destroy(): void {
    this.clearTimers()
    this.unbindKeys()
    this.onDestroy()
    this.renderer.destroyOverlay()
  }

  /** Soft cleanup — keeps the overlay, clears content for next challenge */
  softDestroy(): void {
    this.clearTimers()
    this.unbindKeys()
    this.onDestroy()
    this.renderer.clearPanel()
  }

  getPanel(): HTMLDivElement | null {
    return this.renderer.getPanel()
  }

  protected abstract onCreate(
    scene: Phaser.Scene,
    config: C,
    content: HTMLDivElement,
  ): void

  protected onDestroy(): void {}

  /** Shorthand for I18nManager.t() */
  protected t(key: string): string {
    return i18n.t(key)
  }

  /** Increment and display the attempt counter */
  protected addAttempt(): void {
    this.attempts++
    if (this.attemptEl) {
      this.attemptEl.style.display = ''
      this.attemptEl.textContent = `${this.t('challenge_attempt')} ${this.attempts}`
    }
  }

  /** Notify the scene that the player gave a wrong answer (for HP damage) */
  protected notifyWrongAnswer(): void {
    this.scene.events.emit('challenge-wrong-answer')
  }

  /** Hint under the feedback: green after a right answer, orange after a wrong one */
  protected showHint(container: HTMLElement, hint: LocalizedText | undefined, correct: boolean): void {
    const text = resolveText(hint)
    if (!text) return
    const div = document.createElement('div')
    div.className = `cl-hint ${correct ? 'correct' : 'incorrect'}`
    div.textContent = text
    container.appendChild(div)
  }

  /**
   * "Continue" after success: in the given action bar (it takes the place of
   * Submit/Verify), else in a new bar at the end of the content
   */
  protected showDoneButton(bar?: HTMLElement): void {
    let host = bar
    if (!host) {
      if (!this.contentEl) return
      host = document.createElement('div')
      host.className = 'cl-actions'
      this.contentEl.appendChild(host)
    }
    const btn = document.createElement('button')
    btn.className = 'cl-btn-primary'
    btn.textContent = this.t('challenge_btn_continue')
    btn.addEventListener('click', () => this.onComplete(true))
    host.appendChild(btn)
  }

  protected addTimer(callback: () => void, ms: number): ReturnType<typeof setTimeout> {
    const handle = setTimeout(callback, ms)
    this.pendingTimers.push(handle)
    return handle
  }

  private clearTimers(): void {
    for (const t of this.pendingTimers) clearTimeout(t)
    this.pendingTimers = []
  }

  protected bindKeys(opts: {
    onKey: (e: KeyboardEvent) => void
    isAnswered?: () => boolean
  }): void {
    this.unbindKeys()
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.target as HTMLElement)?.closest('.cm-editor')) return
      if (e.code === 'Escape') { e.preventDefault(); return }
      if (opts.isAnswered?.()) return
      opts.onKey(e)
    }
    document.addEventListener('keydown', this.boundKeyHandler)
  }

  private unbindKeys(): void {
    if (this.boundKeyHandler) {
      document.removeEventListener('keydown', this.boundKeyHandler)
      this.boundKeyHandler = null
    }
  }
}
