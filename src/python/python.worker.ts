/**
 * Web Worker that loads and runs Pyodide in an isolated thread.
 * Every run gets a fresh namespace, like running a script: variables from one
 * exercise never leak into the next. Also hosts the code-challenge grader
 * (src/python/grader.py, sent by the main thread with the init message).
 */

import type { ToWorkerMessage, FromWorkerMessage, RunnerStatus } from './types'

declare function importScripts(...urls: string[]): void

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

interface PyProxy {
  set(key: string, value: unknown): void
  destroy(): void
  (...args: unknown[]): unknown
}

interface PyodideInterface {
  runPython(code: string): unknown
  runPythonAsync(code: string, options?: { globals?: PyProxy }): Promise<unknown>
  setStdout(options: { batched: (text: string) => void }): void
  setStderr(options: { batched: (text: string) => void }): void
  globals: { get(name: string): PyProxy }
  toPy(obj: object): PyProxy
}

let pyodide: PyodideInterface | null = null
let status: RunnerStatus = 'idle'
let graderSource = ''

function postStatus(s: RunnerStatus): void {
  status = s
  const msg: FromWorkerMessage = { type: 'status', status: s }
  self.postMessage(msg)
}

async function init(): Promise<void> {
  if (status === 'ready') return
  if (status === 'loading') return

  postStatus('loading')

  try {
    // importScripts works in classic workers; Pyodide's CDN script assigns loadPyodide to globalThis
    importScripts(`${PYODIDE_CDN}pyodide.js`)

    // Cast required: Pyodide is loaded from CDN via importScripts and attaches
    // loadPyodide to globalThis at runtime — no TS types are available for it.
    const loadPyodide = (globalThis as unknown as {
      loadPyodide: (config: { indexURL: string }) => Promise<PyodideInterface>
    }).loadPyodide

    pyodide = await loadPyodide({ indexURL: PYODIDE_CDN })
    if (graderSource) pyodide.runPython(graderSource) // defines toc_grade()
    postStatus('ready')
  } catch (_e) {
    postStatus('error')
  }
}

/** A fresh `__main__`-like namespace for one run */
function freshNamespace(py: PyodideInterface): PyProxy {
  const ns = py.toPy({})
  ns.set('__name__', '__main__')
  return ns
}

async function runCode(code: string, id: number): Promise<void> {
  if (status !== 'ready' || !pyodide) {
    await init()
  }

  if (!pyodide) {
    const msg: FromWorkerMessage = {
      type: 'result', id, output: [], errors: ['Pyodide not available'], success: false,
    }
    self.postMessage(msg)
    return
  }

  const output: string[] = []
  const errors: string[] = []

  pyodide.setStdout({ batched: (text: string) => output.push(text) })
  pyodide.setStderr({ batched: (text: string) => errors.push(text) })

  const ns = freshNamespace(pyodide)
  try {
    await pyodide.runPythonAsync(code, { globals: ns })
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e)
    errors.push(errMsg)
  } finally {
    ns.destroy()
  }

  const msg: FromWorkerMessage = {
    type: 'result', id, output, errors, success: errors.length === 0,
  }
  self.postMessage(msg)
}

async function grade(msg: Extract<ToWorkerMessage, { type: 'grade' }>): Promise<void> {
  if (status !== 'ready' || !pyodide) {
    await init()
  }
  let json: string
  if (!pyodide) {
    json = JSON.stringify({ status: 'unavailable', problems: [], stdout: '', error: null })
  } else {
    const tocGrade = pyodide.globals.get('toc_grade')
    try {
      json = String(tocGrade(msg.config, msg.lang, msg.code, msg.overrides))
    } catch (e: unknown) {
      // e.g. the player's code raised KeyboardInterrupt: answer now instead of waiting for the timeout
      json = JSON.stringify({ status: 'internal', problems: [], stdout: '', error: e instanceof Error ? e.message : String(e) })
    } finally {
      tocGrade.destroy()
    }
  }
  const out: FromWorkerMessage = { type: 'grade-result', id: msg.id, json }
  self.postMessage(out)
}

self.addEventListener('message', (e: MessageEvent<ToWorkerMessage>) => {
  const msg = e.data
  if (msg.type === 'init') {
    graderSource = msg.grader
    init()
  } else if (msg.type === 'run') {
    runCode(msg.code, msg.id)
  } else if (msg.type === 'grade') {
    grade(msg)
  }
})
