#!/usr/bin/env node

/**
 * Imports the Python course from a local Code-Life checkout (READ-ONLY: nothing
 * is ever written inside Code-Life).
 *
 * Reads   <CODELIFE_DIR>/course_source/new_courses/python/{new_metadata.json,_database/*.json}
 *         <CODELIFE_DIR>/assets/images/courses/**   (course images + Codémon art)
 * Writes  src/data/curriculum/python/index.json            classes → chapters, in course order
 *         src/data/curriculum/python/exercises/NN-<id>.json  one file per class (readable diffs)
 *         src/assets/course-images/<key>.<ext>               images used by the exercises (+ Prof Pi's face)
 *         src/assets/codemon/<id>.webp                       Codémon art
 *
 * Usage: npm run sync:codelife      (CODELIFE_DIR=/path/to/Code-Life to override the default sibling path)
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, copyFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CODELIFE = path.resolve(process.env.CODELIFE_DIR ?? path.join(ROOT, '../../RN/Code-Life'))
const COURSE = path.join(CODELIFE, 'course_source/new_courses/python')
const IMAGES = path.join(CODELIFE, 'assets/images/courses')

const OUT_CURRICULUM = path.join(ROOT, 'src/data/curriculum/python')
const OUT_EXERCISES = path.join(OUT_CURRICULUM, 'exercises')
const OUT_IMAGES = path.join(ROOT, 'src/assets/course-images')
const OUT_CODEMON = path.join(ROOT, 'src/assets/codemon')

const ID_PREFIX = 'python_' // the form saves and maps already use
const KNOWN_BLOCKS = new Set(['text', 'codeBlock', 'codeEditorRun', 'image', 'infoCard', 'profPi', 'row'])
// Images the game shows outside exercise content
const EXTRA_IMAGE_KEYS = ['characters_ProfPiHead']

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writeJson(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

/** Recreate a directory this script owns entirely */
function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
}

/** Every content block in an exercise (question, solution, options, nested row children) */
function* blocksOf(node) {
  if (Array.isArray(node)) {
    for (const item of node) yield* blocksOf(item)
  } else if (node && typeof node === 'object') {
    if (typeof node.type === 'string' && ('value' in node || 'children' in node)) yield node
    for (const value of Object.values(node)) yield* blocksOf(value)
  }
}

/** Code-Life's image key: path under assets/images/courses with "/" → "_" and no extension */
function indexImages(dir, rel = '') {
  const map = new Map()
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue
    const full = path.join(dir, name)
    const relPath = rel ? `${rel}/${name}` : name
    if (statSync(full).isDirectory()) {
      for (const [k, v] of indexImages(full, relPath)) map.set(k, v)
    } else if (/\.(webp|png|jpe?g)$/i.test(name)) {
      const key = relPath.replace(/\.[^.]+$/, '').replaceAll('/', '_')
      if (map.has(key)) console.warn(`  ! image key collision: ${key}`)
      map.set(key, full)
    }
  }
  return map
}

function main() {
  if (!existsSync(path.join(COURSE, 'new_metadata.json'))) {
    console.error(`Code-Life course not found at ${COURSE}\nSet CODELIFE_DIR to your Code-Life checkout.`)
    process.exit(1)
  }
  console.log(`Reading ${COURSE}`)

  const metadata = readJson(path.join(COURSE, 'new_metadata.json'))
  const dbDir = path.join(COURSE, '_database')
  const files = new Set(readdirSync(dbDir).filter(f => f.endsWith('.json') && !f.startsWith('.') && !f.startsWith('_')))

  resetDir(OUT_EXERCISES)
  const index = { language: 'python', classes: [] }
  const referenced = new Set()
  const typeCounts = {}
  const unknownBlocks = {}
  const imageKeys = new Set(EXTRA_IMAGE_KEYS)
  let chapterCount = 0

  metadata.classes.forEach((cls, ci) => {
    const fileName = `${String(ci + 1).padStart(2, '0')}-${cls.id}.json`
    const exercises = []
    const chapters = []

    for (const ch of cls.chapters) {
      const exerciseIds = []
      for (const rawId of ch.exercises) {
        if (referenced.has(rawId)) continue // never import the same exercise twice
        if (!files.has(`${rawId}.json`)) {
          console.warn(`  ! ${cls.id}/${ch.id}: missing exercise file ${rawId}.json`)
          continue
        }
        referenced.add(rawId)
        const ex = readJson(path.join(dbDir, `${rawId}.json`))
        ex.id = ID_PREFIX + rawId // ids are opaque: never derived from the chapter position
        exercises.push(ex)
        exerciseIds.push(ex.id)
        typeCounts[ex.type] = (typeCounts[ex.type] ?? 0) + 1
        for (const block of blocksOf(ex.content)) {
          if (block.type === 'image' && typeof block.value === 'string') imageKeys.add(block.value)
          if (!KNOWN_BLOCKS.has(block.type) && block !== ex.content) {
            unknownBlocks[block.type] = (unknownBlocks[block.type] ?? 0) + 1
          }
        }
      }
      const chapter = {
        key: `${cls.id}/${ch.id}`, // chapter ids repeat across classes ("quizz"), class ids don't
        title: { en: ch.translations?.en?.title ?? ch.id, fr: ch.translations?.fr?.title ?? ch.id },
        exerciseIds,
      }
      if (ch.randomize) chapter.quiz = { pick: ch.randomize.pick, shuffle: !!ch.randomize.shuffle }
      chapters.push(chapter)
      chapterCount++
    }

    writeJson(path.join(OUT_EXERCISES, fileName), exercises)
    index.classes.push({
      key: cls.id,
      title: { en: cls.translations?.en?.title ?? cls.id, fr: cls.translations?.fr?.title ?? cls.id },
      chapters,
    })
  })

  writeJson(path.join(OUT_CURRICULUM, 'index.json'), index)

  // Images used by the exercises
  const imageFiles = indexImages(IMAGES)
  resetDir(OUT_IMAGES)
  const missingImages = []
  let copied = 0
  for (const key of [...imageKeys].sort()) {
    const src = imageFiles.get(key)
    if (!src) { missingImages.push(key); continue }
    copyFileSync(src, path.join(OUT_IMAGES, key + path.extname(src).toLowerCase()))
    copied++
  }

  // Codémon art (top-level fakemon/*.webp: the 18 collectibles + Zap)
  resetDir(OUT_CODEMON)
  const fakemonDir = path.join(IMAGES, 'fakemon')
  const codemonFiles = readdirSync(fakemonDir).filter(f => f.endsWith('.webp'))
  for (const f of codemonFiles) copyFileSync(path.join(fakemonDir, f), path.join(OUT_CODEMON, f))

  // Report
  const orphans = [...files].map(f => f.replace(/\.json$/, '')).filter(id => !referenced.has(id))
  const total = Object.values(typeCounts).reduce((a, b) => a + b, 0)
  console.log(`\nClasses: ${index.classes.length}   Chapters: ${chapterCount}   Exercises: ${total}`)
  console.log('By type:', Object.entries(typeCounts).map(([t, n]) => `${t} ${n}`).join(', '))
  console.log(`Images copied: ${copied}   Codémon art: ${codemonFiles.length}`)
  if (missingImages.length) console.log(`Images referenced but missing in Code-Life too (${missingImages.length}): ${missingImages.join(', ')}`)
  if (orphans.length) console.log(`Skipped (not in the course metadata): ${orphans.join(', ')}`)
  if (Object.keys(unknownBlocks).length) console.log('Block types the game does not render:', unknownBlocks)
  console.log(`\nWritten to ${path.relative(ROOT, OUT_CURRICULUM)}/`)
}

main()
