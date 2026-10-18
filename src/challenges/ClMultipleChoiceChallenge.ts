import { ChallengeBase } from '@/challenges/ChallengeBase'
import type { ClMultipleChoiceConfig, ClMultipleChoiceOption } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'
import { tokenizePython } from '@/challenges/cl-utils/ClSyntaxHighlighter'

/** Resolve option value (may be LocalizedText or plain string) and strip triple backticks. */
function resolveOptionText(option: ClMultipleChoiceOption): string {
  const raw = typeof option.value === 'string' ? option.value : resolveText(option.value)
  return raw.replace(/```/g, '')
}

/** Answers short enough for a 2×2 grid: one line, no code block, at most 30 characters */
const GRID_MAX_LENGTH = 30
function fitsGrid(options: ClMultipleChoiceOption[]): boolean {
  return options.every(option => {
    const text = resolveOptionText(option)
    return option.type !== 'codeBlock' && !text.includes('\n') && text.length <= GRID_MAX_LENGTH
  })
}

export class ClMultipleChoiceChallenge extends ChallengeBase<ClMultipleChoiceConfig> {
  private config!: ClMultipleChoiceConfig
  private selectedIndex = 0
  private answered = false
  private wrongShown = false
  private optionBtns: HTMLButtonElement[] = []
  private feedbackArea!: HTMLDivElement
  private hintBar!: HTMLDivElement
  private optionsDiv!: HTMLDivElement
  private triedIndices = new Set<number>()
  /** Maps display index → original index (for correctAnswer lookup after shuffle) */
  private shuffleMap: number[] = []

  protected onCreate(
    _scene: Phaser.Scene,
    config: ClMultipleChoiceConfig,
    content: HTMLDivElement,
  ): void {
    this.config = config
    this.selectedIndex = 0
    this.answered = false

    // Title
    const title = document.createElement('div')
    title.className = 'cl-title'
    title.textContent = resolveText(this.config.title)
    content.appendChild(title)

    // Question content blocks
    this.renderer.renderContentBlocks(content, this.config.content.question)

    // Options: one column, or a 2×2 grid on wide screens when the answers are short
    this.optionsDiv = document.createElement('div')
    this.optionsDiv.className = fitsGrid(this.config.content.exercise.options) ? 'cl-options cl-options--grid' : 'cl-options'
    content.appendChild(this.optionsDiv)

    this.renderOptions()

    // Feedback area
    this.feedbackArea = document.createElement('div')
    content.appendChild(this.feedbackArea)

    // Hint bar (keyboard keys: hidden on touch screens)
    this.hintBar = document.createElement('div')
    this.hintBar.className = 'cl-hint-bar cl-keys-hint'
    this.hintBar.textContent = this.t('challenge_hint_mcq')
    content.appendChild(this.hintBar)

    this.setupKeyboard()
  }

  private renderOptions(): void {
    this.optionsDiv.innerHTML = ''
    this.optionBtns = []
    const options = this.config.content.exercise.options

    // Fisher-Yates shuffle of display order
    this.shuffleMap = options.map((_, i) => i)
    for (let i = this.shuffleMap.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffleMap[i], this.shuffleMap[j]] = [this.shuffleMap[j], this.shuffleMap[i]]
    }

    for (let i = 0; i < options.length; i++) {
      const originalIdx = this.shuffleMap[i]
      const btn = document.createElement('button')
      btn.className = 'cl-btn cl-option'
      const option = options[originalIdx]
      const text = resolveOptionText(option)
      if (option.language || option.type === 'codeBlock') {
        const code = document.createElement('code')
        code.innerHTML = tokenizePython(text)
        if (option.type === 'codeBlock') code.style.whiteSpace = 'pre' // keep multi-line snippets intact
        btn.appendChild(code)
      } else {
        btn.textContent = text
      }
      btn.addEventListener('click', () => {
        if (this.answered) return
        if (this.triedIndices.has(i)) return
        // If showing wrong-answer feedback, clear it and let user pick again
        if (this.wrongShown) this.clearWrongState()
        this.selectedIndex = i
        this.highlightSelected()
        this.submitAnswer()
      })
      this.optionsDiv.appendChild(btn)
      this.optionBtns.push(btn)
    }
    this.highlightSelected()
  }

  private setupKeyboard(): void {
    this.bindKeys({
      isAnswered: () => this.answered,
      onKey: (e) => {
        if (e.code === 'ArrowUp') {
          e.preventDefault()
          if (this.wrongShown) this.clearWrongState()
          this.selectedIndex = this.findNextAvailable(this.selectedIndex, -1)
          this.highlightSelected()
        } else if (e.code === 'ArrowDown') {
          e.preventDefault()
          if (this.wrongShown) this.clearWrongState()
          this.selectedIndex = this.findNextAvailable(this.selectedIndex, 1)
          this.highlightSelected()
        } else if (e.code === 'Enter') {
          e.preventDefault()
          if (this.wrongShown) this.clearWrongState()
          this.submitAnswer()
        }
      },
    })
  }

  private highlightSelected(): void {
    for (let i = 0; i < this.optionBtns.length; i++) {
      if (this.triedIndices.has(i)) continue
      this.optionBtns[i].classList.toggle('selected', i === this.selectedIndex)
    }
  }

  /** Find the next available (not tried) option in the given direction */
  private findNextAvailable(from: number, dir: -1 | 1): number {
    let idx = from + dir
    while (idx >= 0 && idx < this.optionBtns.length) {
      if (!this.triedIndices.has(idx)) return idx
      idx += dir
    }
    return from // stay put if nothing available
  }

  private clearWrongState(): void {
    this.wrongShown = false
    this.feedbackArea.innerHTML = ''
    for (let i = 0; i < this.optionBtns.length; i++) {
      this.optionBtns[i].classList.remove('incorrect', 'dimmed', 'selected')
      // Keep tried options visually disabled
      if (this.triedIndices.has(i)) {
        this.optionBtns[i].classList.add('incorrect', 'dimmed')
        this.optionBtns[i].style.pointerEvents = 'none'
      }
    }
    this.hintBar.textContent = this.t('challenge_hint_mcq')
  }

  private submitAnswer(): void {
    if (this.answered) return
    // Block re-submitting an already tried answer
    if (this.triedIndices.has(this.selectedIndex)) return
    this.addAttempt()

    const originalCorrect = this.config.content.exercise.correctAnswer
    const selectedOriginal = this.shuffleMap[this.selectedIndex]
    const correct = selectedOriginal === originalCorrect
    // Find which display index holds the correct answer
    const correctDisplayIdx = this.shuffleMap.indexOf(originalCorrect)

    if (!correct) {
      this.triedIndices.add(this.selectedIndex)
    }

    // Show which was picked (and correct if right)
    for (let i = 0; i < this.optionBtns.length; i++) {
      this.optionBtns[i].classList.remove('selected')
      if (correct && i === correctDisplayIdx) {
        this.optionBtns[i].classList.add('correct')
      } else if (i === this.selectedIndex && !correct) {
        this.optionBtns[i].classList.add('incorrect')
      } else {
        this.optionBtns[i].classList.add('dimmed')
      }
    }

    // Show feedback
    this.feedbackArea.innerHTML = ''
    const feedback = document.createElement('div')
    feedback.className = correct ? 'cl-success' : 'cl-failure'
    feedback.textContent = correct ? this.t('challenge_feedback_correct') : this.t('challenge_feedback_incorrect')
    this.feedbackArea.appendChild(feedback)
    this.showHint(this.feedbackArea, this.config.content.hint, correct)

    if (correct) {
      this.answered = true
      this.hintBar.textContent = ''
      this.showDoneButton()
    } else {
      // Red stays until user clicks another option or navigates with keyboard
      this.wrongShown = true
      this.notifyWrongAnswer()
      this.hintBar.textContent = this.t('challenge_hint_enter_retry')
    }
  }
}
