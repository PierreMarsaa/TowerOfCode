import type { ChallengeConfig, LocalizedText } from '@/data/types'
import curriculumIndex from '@/data/curriculum/python/index.json'

// ── Curriculum (generated from Code-Life by `npm run sync:codelife`) ──

export interface CurriculumChapter {
  /** Stable reference: "<classId>/<chapterId>" (Code-Life slugs) */
  key: string
  title: LocalizedText
  /** Exercise ids in course order (opaque — never derived from positions) */
  exerciseIds: string[]
  /** Randomized quiz chapter: Code-Life draws `pick` of its exercises */
  quiz?: { pick: number; shuffle: boolean }
}

export interface CurriculumClass {
  key: string
  title: LocalizedText
  chapters: CurriculumChapter[]
}

const curriculum = curriculumIndex as { language: string; classes: CurriculumClass[] }

// One file per class; all of Python is ~300 KB gzipped, so load it eagerly
const classFiles = import.meta.glob('../curriculum/python/exercises/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, ChallengeConfig[]>

// Local showcase exercises (0_0_X), kept alongside the course
const localModules = import.meta.glob('./clExercises/*.json', { eager: true }) as Record<
  string,
  { default: ChallengeConfig }
>

const allChallenges = new Map<string, ChallengeConfig>()
const exercises: ChallengeConfig[] = []

// Local exercises first (take precedence)
for (const mod of Object.values(localModules)) {
  allChallenges.set(mod.default.id, mod.default)
  exercises.push(mod.default)
}

// Course exercises, in course order (file names are prefixed with the class number)
for (const file of Object.keys(classFiles).sort()) {
  for (const ex of classFiles[file]) {
    if (allChallenges.has(ex.id)) continue
    allChallenges.set(ex.id, ex)
    exercises.push(ex)
  }
}

const chapters: CurriculumChapter[] = curriculum.classes.flatMap(c => c.chapters)
const chapterByKey = new Map(chapters.map(ch => [ch.key, ch]))
const chapterByExercise = new Map<string, CurriculumChapter>()
for (const ch of chapters) {
  for (const id of ch.exerciseIds) chapterByExercise.set(id, ch)
}

// ── Exercises ──

export function getChallenge(id: string): ChallengeConfig | undefined {
  return allChallenges.get(id)
}

export function getAllChallenges(): ChallengeConfig[] {
  return exercises
}

export function getAllChallengeIds(): string[] {
  return exercises.map(c => c.id)
}

// ── Chapters ──

export function getCurriculumClasses(): CurriculumClass[] {
  return curriculum.classes
}

export function getChapters(): CurriculumChapter[] {
  return chapters
}

export function getChapter(key: string): CurriculumChapter | undefined {
  return chapterByKey.get(key)
}

/** The chapter an exercise belongs to (undefined for local showcase exercises) */
export function getChapterOf(exerciseId: string): CurriculumChapter | undefined {
  return chapterByExercise.get(exerciseId)
}
