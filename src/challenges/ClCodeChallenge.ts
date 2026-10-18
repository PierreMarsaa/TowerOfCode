import { ChallengeBase } from '@/challenges/ChallengeBase'
import type { ClChallengeConfig } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'
import { EditorView } from '@codemirror/view'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { PythonRunner, type GradeResult } from '@/python'
import { gradingOverride, isAutoGraded } from '@/data/grading'
import { i18n } from '@/i18n/I18nManager'
import { renderConsoleOutput } from '@/challenges/cl-utils/ClCodeMirrorFactory'

/**
 * Write-the-code challenge. Auto-checked challenges are graded on Submit
 * (src/python/grader.py); the others stay self-assessed ("Done").
 *
 * Battle integration is through scene events and scene data, so the exercise
 * browser (no battle) works unchanged:
 *   - wrong Submit → 'challenge-wrong-answer' (the battle takes a heart)
 *   - first look at the solution → 'challenge-peeked' with the exercise id
 *     (auto-checked challenges only: self-checked ones ask you to compare with it)
 *   - scene data 'peekCost' / 'hearts' → the solution button shows the cost
 */
export class ClCodeChallenge extends ChallengeBase<ClChallengeConfig> {
  protected readonly layout = 'code'
  private config!: ClChallengeConfig
  private showSolution = false
  private peekAnnounced = false
  private auto = true // graded on Submit; false = self-checked (peeking is then free)
  private checking = false
  private done = false
  private editor: EditorView | null = null
  private outputEl: HTMLDivElement | null = null
  private feedbackArea!: HTMLDivElement
  private btnBar!: HTMLDivElement
  private mainBtn!: HTMLButtonElement
  private solBtn!: HTMLButtonElement
  private readonly onHeartsChanged = (): void => this.updateSolutionLabel()

  protected onCreate(
    _scene: Phaser.Scene,
    config: ClChallengeConfig,
    content: HTMLDivElement,
  ): void {
    this.config = config
    this.showSolution = false
    this.peekAnnounced = false
    this.checking = false
    this.done = false
    this.auto = isAutoGraded(config.id)
    const auto = this.auto

    // Two columns on wide screens (challenge.css): the brief on the left, the work on the right
    const brief = document.createElement('div')
    brief.className = 'cl-code-brief'
    content.appendChild(brief)
    const work = document.createElement('div')
    work.className = 'cl-code-work'
    content.appendChild(work)

    // Title
    const title = document.createElement('div')
    title.className = 'cl-title'
    title.textContent = resolveText(this.config.title)
    brief.appendChild(title)

    // Question content blocks
    this.renderer.renderContentBlocks(brief, this.config.content.question)

    // Code editor with IDE-like layout (shared widget)
    const starterCode = resolveText(this.config.content.exercise.value)
    const { editor, outputEl } = this.renderer.createCodeMirrorEditable(
      work,
      starterCode,
      [keymap.of([indentWithTab])],
    )
    this.editor = editor
    this.outputEl = outputEl

    this.feedbackArea = document.createElement('div')
    work.appendChild(this.feedbackArea)
    if (!auto) this.setFeedback('cl-text-block', i18n.t('grade_self'))

    // Button bar — no keyboard shortcuts, just buttons (code editor needs all keys)
    this.btnBar = document.createElement('div')
    this.btnBar.className = 'cl-actions'
    work.appendChild(this.btnBar)

    this.solBtn = document.createElement('button')
    this.solBtn.className = 'cl-btn'
    this.solBtn.addEventListener('click', () => this.toggleSolution())
    this.btnBar.appendChild(this.solBtn)

    this.mainBtn = document.createElement('button')
    this.mainBtn.className = 'cl-btn-primary'
    if (auto) {
      this.mainBtn.textContent = this.t('challenge_btn_submit')
      this.mainBtn.addEventListener('click', () => { void this.submit() })
    } else {
      this.mainBtn.textContent = this.t('challenge_btn_done')
      this.mainBtn.addEventListener('click', () => this.onComplete(true))
    }
    this.btnBar.appendChild(this.mainBtn)
    this.updateSolutionLabel()
    this.scene.events.on('changedata-hearts', this.onHeartsChanged)
  }

  protected onDestroy(): void {
    this.scene.events.off('changedata-hearts', this.onHeartsChanged)
    if (this.editor) {
      this.editor.destroy()
      this.editor = null
    }
    this.outputEl = null
  }

  // ── Grading ──

  private async submit(): Promise<void> {
    if (this.checking || this.done || !this.editor) return
    this.checking = true
    this.mainBtn.disabled = true
    this.setFeedback('cl-text-block', i18n.t('grade_checking'))

    const result = await PythonRunner.grade(
      JSON.stringify(this.config),
      i18n.getLanguage(),
      this.editor.state.doc.toString(),
      JSON.stringify(gradingOverride(this.config.id)),
    )
    if (!this.editor) return // the challenge was closed while grading
    this.checking = false
    this.mainBtn.disabled = false
    this.showOutput(result)

    switch (result.status) {
      case 'pass':
        this.finish('cl-success', i18n.t('grade_pass'))
        break
      case 'self':
        this.auto = false // the grader found nothing fair to check: comparing with the solution is free
        this.updateSolutionLabel()
        this.finish('cl-text-block', i18n.t('grade_self'))
        break
      case 'fail':
        this.addAttempt()
        this.showProblems(result)
        this.notifyWrongAnswer()
        break
      case 'error':
        this.addAttempt()
        this.setFeedback('cl-failure', i18n.t('grade_error'))
        this.notifyWrongAnswer()
        break
      case 'timeout':
        this.setFeedback('cl-failure', i18n.t('grade_timeout')) // no heart: may not be the player's fault
        break
      case 'unavailable':
        this.showUnavailable(i18n.t('code_python_unavailable'))
        break
      case 'internal':
        this.showUnavailable(i18n.t('grade_internal')) // never the player's fault: no heart
        break
    }
  }

  /** Right answer (or self-checked): show the message and a Continue button */
  private finish(className: string, message: string): void {
    this.done = true
    this.mainBtn.style.display = 'none'
    this.setFeedback(className, message)
    this.showDoneButton(this.btnBar)
  }

  /** Name what's missing or wrong — never the expected value */
  private showProblems(result: GradeResult): void {
    this.feedbackArea.innerHTML = ''
    const head = document.createElement('div')
    head.className = 'cl-failure'
    head.textContent = i18n.t('grade_not_quite')
    this.feedbackArea.appendChild(head)

    const list = document.createElement('ul')
    list.className = 'cl-problems'
    for (const p of result.problems) {
      const key = { missing: 'grade_missing', wrong: 'grade_wrong', type: 'grade_type', call: 'grade_call' }[p.kind]
      const [before, after] = i18n.t(key, { name: '\u0000' }).split('\u0000')
      const li = document.createElement('li')
      const code = document.createElement('code')
      code.textContent = p.name
      li.append(before ?? '', code, after ?? '')
      list.appendChild(li)
    }
    this.feedbackArea.appendChild(list)
  }

  /** Can't check right now: retry, or continue unchecked so a battle can never lock */
  private showUnavailable(message: string): void {
    this.setFeedback('cl-failure', message)
    const row = document.createElement('div')
    row.className = 'cl-actions'
    const retry = document.createElement('button')
    retry.className = 'cl-btn'
    retry.textContent = i18n.t('grade_btn_retry')
    retry.addEventListener('click', () => { void this.submit() })
    const skip = document.createElement('button')
    skip.className = 'cl-btn'
    skip.textContent = i18n.t('grade_btn_continue_unchecked')
    skip.addEventListener('click', () => {
      this.done = true
      this.onComplete(true)
    })
    row.append(retry, skip)
    this.feedbackArea.appendChild(row)
  }

  /** What the player's code printed (and its error), in the editor's console */
  private showOutput(result: GradeResult): void {
    if (!this.outputEl) return
    const lines = result.stdout ? result.stdout.replace(/\n$/, '').split('\n') : []
    renderConsoleOutput(this.outputEl, lines, result.error)
  }

  private setFeedback(className: string, message: string): void {
    this.feedbackArea.innerHTML = ''
    const div = document.createElement('div')
    div.className = className
    div.textContent = message
    this.feedbackArea.appendChild(div)
  }

  // ── Solution ──

  /** In a battle, looking at the solution costs a heart once (the scene sets 'peekCost') */
  private updateSolutionLabel(): void {
    const cost = Number(this.scene.data?.get('peekCost') ?? 0)
    const hearts = Number(this.scene.data?.get('hearts') ?? 0)
    let key = 'challenge_btn_show_solution'
    if (cost > 0 && this.auto && !this.peekAnnounced) {
      key = hearts <= 1 ? 'challenge_btn_show_solution_last' : 'challenge_btn_show_solution_cost'
    }
    this.solBtn.textContent = this.t(key)
  }

  private toggleSolution(): void {
    if (this.showSolution) return
    this.showSolution = true

    if (!this.peekAnnounced && this.auto) {
      this.peekAnnounced = true
      this.scene.events.emit('challenge-peeked', this.config.id)
      this.updateSolutionLabel()
    }

    const overlay = this.renderer.getOverlay()
    if (!overlay) return

    // Solution overlay (inside the cl-overlay)
    const solOverlay = document.createElement('div')
    solOverlay.className = 'cl-solution-overlay'
    overlay.appendChild(solOverlay)

    const solPanel = document.createElement('div')
    solPanel.className = 'cl-solution-panel'
    solOverlay.appendChild(solPanel)

    const solTitle = document.createElement('div')
    solTitle.className = 'cl-solution-title'
    solTitle.textContent = this.t('challenge_title_solution')
    solPanel.appendChild(solTitle)

    // Solution blocks: formatted text and read-only code
    this.renderer.renderContentBlocks(solPanel, this.config.content.solution)

    // Close button
    const closeBar = document.createElement('div')
    closeBar.className = 'cl-actions'
    solPanel.appendChild(closeBar)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'cl-btn'
    closeBtn.textContent = this.t('challenge_btn_close_solution')
    closeBtn.addEventListener('click', () => {
      solOverlay.remove()
      this.showSolution = false
    })
    closeBar.appendChild(closeBtn)
  }
}
