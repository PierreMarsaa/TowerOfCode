import grading from '@/data/curriculum/python/grading.json'
import overrides from '@/data/curriculum/python/grading-overrides.json'

/**
 * Code-challenge grading data.
 * grading.json is written by `python3 scripts/check-grading.py --write` (auto/self per challenge);
 * grading-overrides.json is edited by hand when the automatic rule misfires:
 *   { "python_2_1_8": { "mode": "self" }, "python_x_y_z": { "ignore": ["temp_name"] } }
 */

export interface GradingOverride {
  mode?: 'self'
  ignore?: string[]
}

const status = grading as Record<string, 'auto' | 'self'>
const overrideMap = overrides as Record<string, GradingOverride>

/** Auto-checked unless QA found nothing fair to check (unknown ids are tried) */
export function isAutoGraded(id: string): boolean {
  return status[id] !== 'self' && overrideMap[id]?.mode !== 'self'
}

export function gradingOverride(id: string): GradingOverride {
  return overrideMap[id] ?? {}
}
