export type RunnerStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PythonResult {
  output: string[]
  errors: string[]
  success: boolean
}

/** Outcome of grading a code challenge (see src/python/grader.py) */
export interface GradeResult {
  /**
   * pass / fail (wrong or missing values) / error (the code raised) / self (nothing
   * checkable: self-assessed) / timeout (too slow) / unavailable (Python didn't load) /
   * internal (the grader itself failed — never the learner's fault)
   */
  status: 'pass' | 'fail' | 'error' | 'self' | 'timeout' | 'unavailable' | 'internal'
  problems: { kind: 'missing' | 'wrong' | 'type' | 'call'; name: string }[]
  stdout: string
  error: string | null
}

// ── Messages: main thread → worker ──

export type ToWorkerMessage =
  | { type: 'init'; grader: string }
  | { type: 'run'; code: string; id: number }
  | { type: 'grade'; id: number; config: string; lang: string; code: string; overrides: string }

// ── Messages: worker → main thread ──

export type FromWorkerMessage =
  | { type: 'status'; status: RunnerStatus }
  | { type: 'result'; id: number; output: string[]; errors: string[]; success: boolean }
  | { type: 'grade-result'; id: number; json: string }
