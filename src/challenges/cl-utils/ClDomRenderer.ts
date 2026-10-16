/**
 * Shared DOM rendering utility for CL challenge types.
 * Creates an HTML overlay on top of the Phaser canvas and renders
 * content blocks. Delegates to focused modules for styles, syntax
 * highlighting, and CodeMirror instances.
 */

import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { ClContentBlock } from '@/data/types'
import { resolveText } from '@/utils/i18n-helpers'
import { injectClStyles } from './ClStyles'
import { escapeHtml, highlightInlineCode } from './ClSyntaxHighlighter'
import {
  createCodeMirrorReadOnly as cmReadOnly,
  createCodeMirrorEditable as cmEditable,
} from './ClCodeMirrorFactory'

// Course images copied from Code-Life by the sync script, keyed like Code-Life
// ("python_box_var" → src/assets/course-images/python_box_var.webp)
const courseImageUrls = new Map(
  Object.entries(
    import.meta.glob('/src/assets/course-images/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
  ).map(([file, url]) => [file.replace(/^.*\//, '').replace(/\.[^.]+$/, ''), url]),
)

const PROF_PI_FACE = 'characters_ProfPiHead'

/**
 * The overlay (on top of the Phaser canvas) and the panel challenges render into.
 * Exported so a scene can own one overlay across several chained challenges.
 */
export function createChallengeOverlay(scene: Phaser.Scene): { overlay: HTMLDivElement; panel: HTMLDivElement } {
  injectClStyles()

  const parent = scene.game.canvas.parentElement!
  if (getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative'
  }

  const overlay = document.createElement('div')
  overlay.className = 'cl-overlay'
  const panel = document.createElement('div')
  panel.className = 'cl-panel'
  overlay.appendChild(panel)
  parent.appendChild(overlay)

  return { overlay, panel }
}

export class ClDomRenderer {
  private overlay: HTMLDivElement | null = null
  private panel: HTMLDivElement | null = null
  private cmInstances: EditorView[] = []

  /**
   * Creates the overlay div on top of the Phaser canvas.
   * Returns the inner panel element for content.
   */
  createOverlay(scene: Phaser.Scene): HTMLDivElement {
    const { overlay, panel } = createChallengeOverlay(scene)
    this.overlay = overlay
    this.panel = panel
    return panel
  }

  getOverlay(): HTMLDivElement | null {
    return this.overlay
  }

  getPanel(): HTMLDivElement | null {
    return this.panel
  }

  renderContentBlocks(container: HTMLElement, blocks: ClContentBlock[]): void {
    for (const block of blocks) {
      switch (block.type) {
        case 'text':
          this.renderTextBlock(container, block)
          break
        case 'codeBlock':
          this.renderCodeBlock(container, block)
          break
        case 'codeEditorRun':
          this.renderCodeEditorRun(container, block)
          break
        case 'infoCard':
          this.renderInfoCard(container, block)
          break
        case 'image':
          this.renderImage(container, block)
          break
        case 'profPi':
          this.renderProfPi(container, block)
          break
        case 'row':
          this.renderRow(container, block)
          break
      }
    }
  }

  createCodeMirrorReadOnly(container: HTMLElement, code: string): EditorView {
    return cmReadOnly(container, code, this.cmInstances)
  }

  createCodeMirrorEditable(
    container: HTMLElement,
    code: string,
    extraExtensions: Extension[] = [],
  ): {
    editor: EditorView
    outputEl: HTMLDivElement
    runBtn: HTMLButtonElement
  } {
    return cmEditable(container, code, this.cmInstances, extraExtensions)
  }

  adoptPanel(panel: HTMLDivElement): void {
    this.panel = panel
    this.overlay = panel.parentElement as HTMLDivElement | null
  }

  clearPanel(): void {
    for (const cm of this.cmInstances) {
      cm.destroy()
    }
    this.cmInstances = []
    if (this.panel) this.panel.innerHTML = ''
  }

  destroyOverlay(): void {
    this.clearPanel()
    if (this.overlay && this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay)
    }
    this.overlay = null
    this.panel = null
  }

  // ── Private render methods ──

  private renderTextBlock(container: HTMLElement, block: ClContentBlock): void {
    const div = document.createElement('div')
    div.className = 'cl-text-block'
    div.innerHTML = this.formatText(resolveText(block.value))
    container.appendChild(div)
  }

  /** Escaped text with ***bold*** / **bold** and `inline code` */
  private formatText(raw: string): string {
    let html = escapeHtml(raw)
    // Code-Life writes inline code as ```x```: make it `x` so backticks pair up (as info cards do)
    html = html.replace(/```(.*?)```/g, '`$1`')
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    return highlightInlineCode(html)
  }

  /** Prof Pi speaking: his face next to a speech bubble */
  private renderProfPi(container: HTMLElement, block: ClContentBlock): void {
    const row = document.createElement('div')
    row.className = 'cl-profpi'

    const faceUrl = courseImageUrls.get(PROF_PI_FACE)
    if (faceUrl) {
      const face = document.createElement('img')
      face.className = 'cl-profpi-face'
      face.src = faceUrl
      face.alt = 'Prof Pi'
      row.appendChild(face)
    }

    const bubble = document.createElement('div')
    bubble.className = 'cl-profpi-bubble'
    bubble.innerHTML = this.formatText(resolveText(block.value))
    row.appendChild(bubble)

    container.appendChild(row)
  }

  /** Blocks shown side by side (wraps on narrow screens) */
  private renderRow(container: HTMLElement, block: ClContentBlock): void {
    const row = document.createElement('div')
    row.className = 'cl-row'
    for (const child of block.children ?? []) {
      const cell = document.createElement('div')
      cell.className = 'cl-row-cell'
      this.renderContentBlocks(cell, [child])
      row.appendChild(cell)
    }
    container.appendChild(row)
  }

  private renderCodeBlock(container: HTMLElement, block: ClContentBlock): void {
    const code = typeof block.value === 'string' ? block.value : resolveText(block.value)
    this.createCodeMirrorReadOnly(container, code)
  }

  private renderCodeEditorRun(container: HTMLElement, block: ClContentBlock): void {
    const code = typeof block.value === 'string' ? block.value : resolveText(block.value)
    this.createCodeMirrorEditable(container, code)
  }

  private renderInfoCard(container: HTMLElement, block: ClContentBlock): void {
    // Info card blocks use a loosely-typed value object with title/content subfields
    const val = block.value as unknown as Record<string, unknown>
    const titleSource = (val?.title ?? block.title) as { en: string; fr: string } | string | undefined
    const contentSource = (val?.content ?? block.content) as { en: string; fr: string } | string | undefined
    const expandable = block.expandable ?? false
    const initiallyExpanded = block.initiallyExpanded ?? true

    const cardTitle = titleSource
      ? (typeof titleSource === 'string' ? titleSource : resolveText(titleSource))
      : ''
    const cardContent = contentSource
      ? (typeof contentSource === 'string' ? contentSource : resolveText(contentSource))
      : ''

    if (expandable) {
      const details = document.createElement('details')
      details.className = 'cl-info-card'
      if (initiallyExpanded) details.open = true

      const summary = document.createElement('summary')
      summary.className = 'cl-info-card-title'
      summary.style.cursor = 'pointer'
      summary.style.listStyle = 'none'
      summary.textContent = `${details.open ? '▾' : '▸'} ${cardTitle}`
      details.appendChild(summary)

      details.addEventListener('toggle', () => {
        summary.textContent = `${details.open ? '▾' : '▸'} ${cardTitle}`
      })

      if (cardContent) {
        const contentEl = document.createElement('div')
        contentEl.className = 'cl-info-card-content'
        contentEl.innerHTML = this.formatCardContent(cardContent)
        details.appendChild(contentEl)
      }

      container.appendChild(details)
    } else {
      const card = document.createElement('div')
      card.className = 'cl-info-card'

      if (cardTitle) {
        const titleEl = document.createElement('div')
        titleEl.className = 'cl-info-card-title'
        titleEl.textContent = cardTitle
        card.appendChild(titleEl)
      }

      if (cardContent) {
        const contentEl = document.createElement('div')
        contentEl.className = 'cl-info-card-content'
        contentEl.innerHTML = this.formatCardContent(cardContent)
        card.appendChild(contentEl)
      }

      container.appendChild(card)
    }
  }

  private formatCardContent(text: string): string {
    let html = escapeHtml(text)
    html = html.replace(/```(.*?)```/g, '`$1`')
    html = highlightInlineCode(html)
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    return html
  }

  private renderImage(container: HTMLElement, block: ClContentBlock): void {
    const key = typeof block.value === 'string' ? block.value : ''
    const url = courseImageUrls.get(key)
    const caption = resolveText(block.caption)

    // A few images don't exist in Code-Life either: keep the caption as a placeholder
    if (!url) {
      if (!caption) return
      const div = document.createElement('div')
      div.className = 'cl-image-placeholder'
      div.textContent = `[${caption}]`
      container.appendChild(div)
      return
    }

    const figure = document.createElement('figure')
    figure.className = 'cl-figure'
    const img = document.createElement('img')
    img.src = url
    img.alt = caption
    img.loading = 'lazy'
    figure.appendChild(img)
    if (caption) {
      const figcaption = document.createElement('figcaption')
      figcaption.textContent = caption
      figure.appendChild(figcaption)
    }
    container.appendChild(figure)
  }
}
