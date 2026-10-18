import type { LocalizedText } from '@/data/types'
import { actOfClassIndex } from './acts.ts'

/*
 * From the course to tower floors: one floor per chapter that has something to
 * fight with. Chapters made only of lessons are folded into a neighbouring
 * floor's lesson (Prof Pi teaches them). Shared by the game and by
 * scripts/check-tower.mjs, so it takes the course as plain data.
 */

export interface ChapterLike {
  key: string
  title: LocalizedText
  exerciseIds: string[]
  quiz?: { pick: number }
}

export interface ClassLike {
  key: string
  title: LocalizedText
  chapters: ChapterLike[]
}

export interface TowerFight {
  chapter: string
  /** Quiz questions to draw (0 for a code-only fight) */
  questions: number
  /** Ends with one of the chapter's coding challenges */
  code: boolean
}

export interface TowerFloorPlan {
  /** 1-based, in course order */
  floor: number
  /** Index of the course class (zone) */
  zone: number
  /** The game chapter (act) this floor belongs to, 1-based (src/generation/acts.ts) */
  act: number
  /** Floor number within its act, 1-based: what the player sees */
  actFloor: number
  /** The act's last floor: its guardian is the act's boss, its exit leads back to the hub */
  actLast: boolean
  chapterKey: string
  chapterTitle: LocalizedText
  /** Chapters whose lessons Prof Pi teaches on this floor (folded lesson-only chapters + this one) */
  lessonChapters: string[]
  /** Last floor only: the lesson-only chapters that close the course (Prof Pi's last words once beaten) */
  endingChapters?: string[]
  /** Battles on this floor, the guardian last */
  fights: TowerFight[]
}

const QUESTION_TYPES = new Set(['multiple_choice', 'fill_in_text', 'matching_pairs'])

/** Split `total` questions into `parts` near-equal shares (each ≥ 1) */
function split(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  return Array.from({ length: parts }, (_, i) => base + (i < total % parts ? 1 : 0))
}

export function towerFloorPlans(
  classes: readonly ClassLike[],
  typeOf: (exerciseId: string) => string | undefined,
  isAutoGraded: (exerciseId: string) => boolean,
): TowerFloorPlan[] {
  const plans: TowerFloorPlan[] = []
  let pendingLessons: string[] = []
  const classKeys = classes.map(c => c.key)

  classes.forEach((cls, zone) => {
    for (const chapter of cls.chapters) {
      const types = chapter.exerciseIds.map(id => [id, typeOf(id)] as const)
      const questions = types.filter(([, t]) => t !== undefined && QUESTION_TYPES.has(t)).length
      const codes = types.filter(([, t]) => t === 'challenge').map(([id]) => id)
      const hasLessons = types.some(([, t]) => t === 'explanation')

      // Nothing to fight with: Prof Pi teaches it on the next floor
      if (questions === 0 && codes.length === 0) {
        if (hasLessons) pendingLessons.push(chapter.key)
        continue
      }

      let fights: TowerFight[]
      if (chapter.quiz) {
        fights = [4, 4, 4, 5].map(q => ({ chapter: chapter.key, questions: q, code: false }))
      } else if (questions === 0) {
        const count = Math.min(Math.max(codes.length, 1), 3)
        fights = Array.from({ length: count }, () => ({ chapter: chapter.key, questions: 0, code: true }))
      } else if (codes.some(isAutoGraded)) {
        // About one fight per 3 questions, the guardian takes the (auto-checked) code challenge
        const total = Math.min(Math.max(1 + Math.round(questions / 3), 1), 3)
        const questionFights = split(questions, total - 1).map(q => ({ chapter: chapter.key, questions: q, code: false }))
        fights = [...questionFights, { chapter: chapter.key, questions: 0, code: true }]
      } else {
        const total = Math.min(Math.max(Math.round(questions / 3), 1), 3)
        fights = split(questions, total).map(q => ({ chapter: chapter.key, questions: q, code: false }))
      }

      plans.push({
        floor: plans.length + 1,
        zone,
        act: actOfClassIndex(zone, classKeys),
        actFloor: 0, // numbered below, once every floor is known
        actLast: false,
        chapterKey: chapter.key,
        chapterTitle: chapter.title,
        lessonChapters: [...pendingLessons, ...(hasLessons ? [chapter.key] : [])],
        fights,
      })
      pendingLessons = []
    }
  })

  // Lesson-only chapters at the very end (what's next…) close the course on the last floor
  if (pendingLessons.length && plans.length) plans[plans.length - 1].endingChapters = pendingLessons

  // Floor numbers restart in each act; the last floor of an act holds its boss
  plans.forEach((plan, i) => {
    const prev = plans[i - 1], next = plans[i + 1]
    plan.actFloor = prev && prev.act === plan.act ? prev.actFloor + 1 : 1
    plan.actLast = !next || next.act !== plan.act
  })
  return plans
}
