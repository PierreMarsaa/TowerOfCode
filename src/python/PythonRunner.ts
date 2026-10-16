/**
 * Main-thread singleton that communicates with the Pyodide Web Worker.
 *
 * - Pyodide loads once per worker; every run uses a fresh namespace
 * - Runs and grades are queued: one at a time, never "already running"
 * - A run is killed after 10s (infinite loops), a grade after 20s (it runs the
 *   starter, the solution and the player's code); the next call respawns the worker
 * - Callers wait at most 60s for Pyodide, but a slow download keeps going in the
 *   background (Retry waits on the same download); a failed load is retried with a new worker
 * - The grader (grader.py) is handed to every new worker with its init message
 *   (a ?raw import inside the classic worker would break the dev server)
 */

import graderSource from './grader.py?raw'
import type { GradeResult, PythonResult, RunnerStatus, ToWorkerMessage, FromWorkerMessage } from './types'
import { i18n } from '@/i18n/I18nManager'

const RUN_TIMEOUT_MS = 10_000
const GRADE_TIMEOUT_MS = 20_000
const LOAD_WAIT_MS = 60_000

/** Reject if `promise` takes longer than `ms` (the work itself is not cancelled) */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      err => { clearTimeout(timer); reject(err) },
    )
  })
}

class PythonRunnerSingleton {
  private worker: Worker | null = null
  private status: RunnerStatus = 'idle'
  private nextId = 1
  private loadPromise: Promise<void> | null = null
  private queue: Promise<unknown> = Promise.resolve()

  getStatus(): RunnerStatus {
    return this.status
  }

  /** Wait (up to 60s) for Pyodide. Rejects if it isn't ready; a later call waits again or retries. */
  initialize(): Promise<void> {
    if (this.status === 'ready' && this.worker) return Promise.resolve()
    if (!this.loadPromise) this.loadPromise = this.startLoad()
    return withTimeout(this.loadPromise, LOAD_WAIT_MS)
  }

  runCode(code: string): Promise<PythonResult> {
    return this.enqueue(async () => {
      try {
        await this.initialize()
      } catch {
        return { output: [], errors: [i18n.t('code_python_unavailable')], success: false }
      }
      const id = this.nextId++
      const msg = await this.request(id, { type: 'run', code, id }, RUN_TIMEOUT_MS)
      if (!msg || msg.type !== 'result') {
        return { output: [], errors: [i18n.t('code_timeout')], success: false }
      }
      return { output: msg.output, errors: msg.errors, success: msg.success }
    })
  }

  /** Grade a code challenge (config as JSON, as stored in the curriculum) */
  grade(config: string, lang: string, code: string, overrides: string): Promise<GradeResult> {
    return this.enqueue(async () => {
      try {
        await this.initialize()
      } catch {
        return { status: 'unavailable', problems: [], stdout: '', error: null }
      }
      const id = this.nextId++
      const msg = await this.request(id, { type: 'grade', id, config, lang, code, overrides }, GRADE_TIMEOUT_MS)
      if (!msg || msg.type !== 'grade-result') {
        return { status: 'timeout', problems: [], stdout: '', error: null }
      }
      return JSON.parse(msg.json) as GradeResult
    })
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task)
    this.queue = result.catch(() => undefined)
    return result
  }

  /** Start Pyodide in a new worker; resolves when ready, rejects if loading fails */
  private startLoad(): Promise<void> {
    this.ensureWorker()
    const worker = this.worker!
    const load = new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
      }
      const fail = (): void => {
        cleanup()
        this.killWorker('error')
        reject(new Error('Pyodide failed to load'))
      }
      const onMessage = (e: MessageEvent<FromWorkerMessage>): void => {
        if (e.data.type !== 'status') return
        if (e.data.status === 'ready') {
          cleanup()
          resolve()
        } else if (e.data.status === 'error') {
          fail()
        }
      }
      const onError = (): void => fail() // the worker script itself failed

      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      this.status = 'loading'
      this.send({ type: 'init', grader: graderSource })
    })
    // Forget a failed load so the next call starts over with a fresh worker
    load.catch(() => {
      if (this.loadPromise === load) this.loadPromise = null
    })
    return load
  }

  /** Send a run/grade message and wait for its answer; null on timeout (the worker is killed) */
  private request(id: number, msg: ToWorkerMessage, timeoutMs: number): Promise<FromWorkerMessage | null> {
    const worker = this.worker!
    return new Promise(resolve => {
      const onMessage = (e: MessageEvent<FromWorkerMessage>): void => {
        const m = e.data
        if (m.type === 'status' || m.id !== id) return
        clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        resolve(m)
      }
      // An infinite loop can't be interrupted: kill the worker, the next call respawns it
      const timer = setTimeout(() => {
        worker.removeEventListener('message', onMessage)
        this.killWorker('idle')
        resolve(null)
      }, timeoutMs)
      worker.addEventListener('message', onMessage)
      this.send(msg)
    })
  }

  private ensureWorker(): void {
    if (this.worker) return

    this.worker = new Worker(
      new URL('./python.worker.ts', import.meta.url),
      { type: 'classic' },
    )
    this.worker.addEventListener('message', (e: MessageEvent<FromWorkerMessage>) => {
      if (e.data.type === 'status') this.status = e.data.status
    })
    this.status = 'idle'
  }

  private killWorker(status: RunnerStatus): void {
    this.worker?.terminate()
    this.worker = null
    this.loadPromise = null
    this.status = status
  }

  private send(msg: ToWorkerMessage): void {
    this.worker?.postMessage(msg)
  }
}

export const PythonRunner = new PythonRunnerSingleton()
