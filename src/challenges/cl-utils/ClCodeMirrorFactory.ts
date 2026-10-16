/**
 * Factory functions for creating CodeMirror editor instances.
 * Each function pushes the created EditorView into the provided
 * cmInstances array so the caller can manage lifecycle.
 */

import { EditorView, keymap } from '@codemirror/view'
import { EditorState, type Extension } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap } from '@codemirror/commands'
import { PythonRunner } from '@/python'
import { i18n } from '@/i18n/I18nManager'

export function createCodeMirrorReadOnly(
  container: HTMLElement,
  code: string,
  cmInstances: EditorView[],
): EditorView {
  const wrapper = document.createElement('div')
  wrapper.className = 'cl-code-block'
  container.appendChild(wrapper)

  const state = EditorState.create({
    doc: code,
    extensions: [
      python(),
      oneDark,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
    ],
  })

  const view = new EditorView({ state, parent: wrapper })
  cmInstances.push(view)
  return view
}

export function createCodeMirrorEditable(
  container: HTMLElement,
  code: string,
  cmInstances: EditorView[],
  extraExtensions: Extension[] = [],
): {
  editor: EditorView
  outputEl: HTMLDivElement
  runBtn: HTMLButtonElement
} {
  // Widget wrapper
  const widget = document.createElement('div')
  widget.className = 'cl-editor-widget'
  container.appendChild(widget)

  // ── Toolbar ──
  const toolbar = document.createElement('div')
  toolbar.className = 'cl-editor-toolbar'
  widget.appendChild(toolbar)

  const runBtn = document.createElement('button')
  runBtn.className = 'cl-run-btn'
  runBtn.innerHTML = '<span class="play-icon">&#9654;</span> '
  runBtn.appendChild(document.createTextNode(i18n.t('code_run')))
  toolbar.appendChild(runBtn)

  const statusEl = document.createElement('span')
  statusEl.className = 'cl-run-status'
  toolbar.appendChild(statusEl)

  const langLabel = document.createElement('span')
  langLabel.className = 'cl-lang-label'
  langLabel.textContent = 'python'
  toolbar.appendChild(langLabel)

  // ── Editor ──
  const state = EditorState.create({
    doc: code,
    extensions: [
      python(),
      oneDark,
      keymap.of(defaultKeymap),
      ...extraExtensions,
    ],
  })

  const editor = new EditorView({ state, parent: widget })
  cmInstances.push(editor)

  // ── Console header ──
  const consoleHeader = document.createElement('div')
  consoleHeader.className = 'cl-console-header'
  widget.appendChild(consoleHeader)

  const consoleLabel = document.createElement('span')
  consoleLabel.className = 'cl-console-label'
  consoleLabel.textContent = i18n.t('code_console')
  consoleHeader.appendChild(consoleLabel)

  const clearBtn = document.createElement('button')
  clearBtn.className = 'cl-clear-btn'
  clearBtn.textContent = i18n.t('code_clear')
  consoleHeader.appendChild(clearBtn)

  // ── Console output (always visible) ──
  const outputEl = document.createElement('div')
  outputEl.className = 'cl-console-output'
  showPlaceholder(outputEl, i18n.t('code_ready'))
  widget.appendChild(outputEl)

  // ── Clear handler ──
  clearBtn.addEventListener('click', () => {
    showPlaceholder(outputEl, i18n.t('code_ready'))
    statusEl.textContent = ''
    statusEl.className = 'cl-run-status'
  })

  // ── Run handler ──
  runBtn.addEventListener('click', async () => {
    const currentCode = editor.state.doc.toString()
    runBtn.disabled = true
    statusEl.className = 'cl-run-status'
    statusEl.textContent = i18n.t(PythonRunner.getStatus() === 'ready' ? 'code_running' : 'code_loading_python')
    outputEl.innerHTML = ''

    try {
      const result = await PythonRunner.runCode(currentCode)

      renderConsoleOutput(outputEl, result.output, result.errors.join('\n'))

      statusEl.textContent = i18n.t(result.success ? 'code_status_done' : 'code_status_error')
      statusEl.classList.add(result.success ? 'success' : 'error')
    } catch {
      outputEl.innerHTML = ''
      const errSpan = document.createElement('span')
      errSpan.className = 'cl-error'
      errSpan.textContent = i18n.t('code_run_failed')
      outputEl.appendChild(errSpan)
      statusEl.textContent = i18n.t('code_status_error')
      statusEl.classList.add('error')
    } finally {
      runBtn.disabled = false
    }
  })

  return { editor, outputEl, runBtn }
}

/**
 * Show a program's output in a console area: one "> " line per printed line,
 * then the error (if any) in red, or "(no output)". Shared by Run and Submit.
 */
export function renderConsoleOutput(outputEl: HTMLElement, lines: string[], error?: string | null): void {
  outputEl.innerHTML = ''
  for (const line of lines) {
    const lineEl = document.createElement('div')
    lineEl.innerHTML = '<span class="cl-prompt">&gt; </span>'
    lineEl.appendChild(document.createTextNode(line))
    outputEl.appendChild(lineEl)
  }
  if (error) {
    const errSpan = document.createElement('span')
    errSpan.className = 'cl-error'
    errSpan.textContent = error
    outputEl.appendChild(errSpan)
  }
  if (lines.length === 0 && !error) showPlaceholder(outputEl, i18n.t('code_no_output'))
}

/** Grey one-line message in the console area (text, never HTML) */
function showPlaceholder(outputEl: HTMLElement, text: string): void {
  outputEl.innerHTML = ''
  const span = document.createElement('span')
  span.className = 'cl-placeholder'
  span.textContent = text
  outputEl.appendChild(span)
}
