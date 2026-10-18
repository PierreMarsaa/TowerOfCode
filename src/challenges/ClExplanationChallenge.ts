import { ChallengeBase } from '@/challenges/ChallengeBase'
import type { ClExplanationConfig } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'

export class ClExplanationChallenge extends ChallengeBase<ClExplanationConfig> {
  protected readonly layout = 'lesson'

  protected onCreate(
    _scene: Phaser.Scene,
    config: ClExplanationConfig,
    content: HTMLDivElement,
  ): void {
    // Title
    const title = document.createElement('div')
    title.className = 'cl-title'
    title.textContent = resolveText(config.title)
    content.appendChild(title)

    // Content blocks
    this.renderer.renderContentBlocks(content, config.content.question)

    // Continue button
    const actions = document.createElement('div')
    actions.className = 'cl-actions'
    content.appendChild(actions)

    const btn = document.createElement('button')
    btn.className = 'cl-btn-primary'
    btn.textContent = this.t('challenge_btn_continue')
    btn.addEventListener('click', () => this.onComplete(true))
    actions.appendChild(btn)

    this.bindKeys({ onKey: () => {} })
  }
}
