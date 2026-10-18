#!/usr/bin/env node
/**
 * QA for the story: scripts, the hand-made story maps and the texts.
 *   - every script a map runs (triggers, talkScript) exists, and so does every script it calls
 *   - every dialog key (scripts, NPCs, signs) exists in French AND English
 *   - every character a script moves or shows is on the map that runs it
 *   - warps and doors lead to existing maps
 *   - every flag a map or script tests is set somewhere
 *   - every character of the texts can be drawn by the interface font
 *   - labels fit their windows, measured with the font's metrics (name tags, menus,
 *     Codédex rows, place names), and no word is too long for a line of the text box
 * Needs Node 22+ (runs TypeScript directly).
 *
 * Usage: npm run check:story
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCRIPTS } from '../src/story/scripts/index.ts'
import { UI_CHARS, sanitize } from '../src/ui/kit/glyphs.ts'
import { measureWith } from '../src/ui/kit/textLayout.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** The hand-made story maps (relative imports only, so Node can load them) */
const MAP_FILES = ['map-town-0.ts', 'map-home.ts', 'map-rival-home.ts', 'map-lab.ts', 'map-tower-hall.ts']

const locale = lang => Object.assign({}, ...['ui', 'maps', 'dialogs'].map(f =>
  JSON.parse(readFileSync(path.join(ROOT, `src/i18n/locales/${lang}/${f}.json`), 'utf8'))))
const fr = locale('fr')
const en = locale('en')

const maps = []
for (const file of MAP_FILES) {
  const mod = await import(path.join(ROOT, 'src/data/maps', file))
  for (const value of Object.values(mod)) if (value && typeof value === 'object' && 'id' in value && 'groundLayer' in value) maps.push(value)
}
const mapIds = new Set(maps.map(m => m.id))
// Codémon ids and names, read from the roster's source (it uses Vite-only imports)
const roster = readFileSync(path.join(ROOT, 'src/data/codemon.ts'), 'utf8')
const CODEMON_NAMES = new Map([...roster.matchAll(/\{ id: '([a-z]+)', name: '([^']+)'/g)].map(m => [m[1], m[2]]))
const metrics = JSON.parse(readFileSync(path.join(ROOT, 'src/assets/ui/ui-font.json'), 'utf8'))
/** Width in art pixels (the game draws them 2×) */
const width = text => measureWith(metrics.glyphs, sanitize(text))
const problems = []
const warnings = []

const hasKey = key => key in fr && key in en
const needKey = (key, where) => { if (!hasKey(key)) problems.push(`${where}: text "${key}" missing in ${key in fr ? 'EN' : key in en ? 'FR' : 'FR and EN'}`) }

// Flags set anywhere, flags tested anywhere
const setFlags = new Set()
const testedFlags = new Map()
const test = (when, where) => { for (const f of [...(when?.all ?? []), ...(when?.none ?? [])]) testedFlags.set(f, where) }

/** Walk a script's steps: keys, actors, warps, calls, flags */
function visit(steps, ctx, stack = []) {
  for (const step of steps) {
    const where = `${ctx.map.id} › ${stack.join(' › ')}`
    switch (step.op) {
      case 'say': for (const k of [].concat(step.key)) needKey(k, where); break
      case 'ask': needKey(step.key, where); step.branches.forEach(b => visit(b, ctx, stack)); break
      case 'name': needKey(step.key, where); break
      case 'hatch': if (step.codemon !== '$starter' && !CODEMON_NAMES.has(step.codemon)) problems.push(`${where}: hatch of unknown Codémon "${step.codemon}"`); break
      case 'if': test(step.when, where); visit(step.then, ctx, stack); visit(step.else ?? [], ctx, stack); break
      case 'battle': visit(step.win ?? [], ctx, stack); visit(step.lose ?? [], ctx, stack); break
      case 'setFlag': setFlags.add(step.flag); break
      case 'warp': if (!mapIds.has(step.map)) problems.push(`${where}: warp to unknown map "${step.map}"`); break
      case 'call':
        if (!SCRIPTS[step.script]) problems.push(`${where}: calls unknown script "${step.script}"`)
        else if (!stack.includes(step.script)) visit(SCRIPTS[step.script], ctx, [...stack, step.script])
        break
    }
    const actors = []
    if ('actor' in step) actors.push(step.actor)
    if (step.followers) actors.push(...step.followers)
    if (step.to && typeof step.to === 'object' && 'actor' in step.to) actors.push(step.to.actor)
    if (step.dir && typeof step.dir === 'object') actors.push(step.dir.actor)
    for (const a of actors) {
      if (a !== 'player' && !ctx.actors.has(a)) problems.push(`${where}: no character "${a}" on ${ctx.map.id}`)
    }
  }
}

for (const map of maps) {
  const actors = new Set(map.npcs.flatMap(n => [n.id, n.name].filter(Boolean)))
  const ctx = { map, actors }
  for (const npc of map.npcs) {
    if (npc.dialogKey) needKey(npc.dialogKey, `${map.id}/${npc.name}`)
    test(npc.visibleWhen, `${map.id}/${npc.name}`)
    if (npc.talkScript) {
      if (!SCRIPTS[npc.talkScript]) problems.push(`${map.id}/${npc.name}: unknown script "${npc.talkScript}"`)
      else visit(SCRIPTS[npc.talkScript], ctx, [npc.talkScript])
    }
  }
  for (const sign of map.signs ?? []) needKey(sign.textKey, `${map.id} sign`)
  for (const t of map.triggers ?? []) {
    test(t.when, `${map.id} trigger ${t.id}`)
    if (!SCRIPTS[t.script]) problems.push(`${map.id} trigger ${t.id}: unknown script "${t.script}"`)
    else visit(SCRIPTS[t.script], ctx, [t.script])
  }
  // Doors lead to a story map, or to a generated tower floor (checked by check:tower)
  for (const s of map.stairs) if (s.targetMapId && !mapIds.has(s.targetMapId) && !/^tower-[1-9]\d*$/.test(s.targetMapId)) problems.push(`${map.id}: door to unknown map "${s.targetMapId}"`)
  if (map.location) needKey(map.location, `${map.id} location`)
}
for (const [flag, where] of testedFlags) if (!setFlags.has(flag)) problems.push(`${where}: tests flag "${flag}" that nothing sets`)

// Every character of the texts exists in the font (sanitize maps the rest to "?")
for (const [lang, table] of [['FR', fr], ['EN', en]]) {
  for (const [key, value] of Object.entries(table)) {
    for (const text of [].concat(value)) {
      const clean = sanitize(text)
      for (let i = 0; i < clean.length; i++) {
        if (clean[i] === '?' && text[i] !== '?') warnings.push(`${lang} ${key}: "${text[i]}" isn't in the font`)
      }
    }
  }
}

// Labels fit their windows (art pixels; see src/ui/kit: the screen is 240×160)
const fits = (text, max, where) => { const w = width(text); if (w > max) problems.push(`${where}: "${text}" is ${w} px wide (max ${max})`) }
const SPEAKER = /^([A-ZÀ-ÖØ-ÞŒ0-9][A-ZÀ-ÖØ-ÞŒ0-9 .'’-]{0,15}?)\s?: (.+)$/s
for (const [lang, table] of [['FR', fr], ['EN', en]]) {
  const t = key => String(table[key] ?? '')
  for (const key of ['start_codedex', 'start_team', 'start_save', 'start_options', 'start_exit']) fits(t(key), 84, `${lang} START menu`)
  for (const key of ['menu_continue', 'menu_new_game', 'menu_options']) fits(t(key), 120, `${lang} title menu`)
  for (const key of ['options_text_speed', 'options_language', 'options_back']) fits(t(key), 120, `${lang} options`)
  for (const key of ['options_speed_fast', 'options_speed_mid', 'options_speed_slow']) fits(`◀ ${t(key)} ▶`, 80, `${lang} options`)
  for (const key of ['continue_player', 'continue_badges', 'continue_codedex', 'continue_time']) fits(t(key), 80, `${lang} continue`)
  for (const key of ['team_set_lead', 'team_cancel', 'name_new', 'hatch_new']) fits(t(key), 100, `${lang} ${key}`)
  fits(`${t('dex_seen')} 18   ${t('dex_caught')} 18`, 140, `${lang} Codédex header`)
  for (const [key, value] of Object.entries(table)) {
    if (key.startsWith('loc_')) fits(String(value).toUpperCase(), 214, `${lang} place name`)
    for (const text of [].concat(value)) {
      const m = SPEAKER.exec(text)
      if (m) fits(m[1], 110, `${lang} ${key} name tag`)
      for (const word of (m ? m[2] : text).split(/\s+/)) fits(word, 208, `${lang} ${key} word`)
    }
  }
}
CODEMON_NAMES.forEach((name, id) => {
  fits(`018  ${name.toUpperCase()} ★`, 116, `Codédex row ${id}`)
  fits(name.toUpperCase(), 90, `card name ${id}`)
})

console.log(`Scripts: ${Object.keys(SCRIPTS).length} · story maps: ${maps.map(m => m.id).join(', ')} · flags set: ${setFlags.size}`)
console.log(`Font: ${[...UI_CHARS].length} glyphs · ${CODEMON_NAMES.size} Codémon`)
if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n  ` + [...new Set(warnings)].slice(0, 30).join('\n  '))
if (problems.length) {
  console.log(`\nFAILED (${problems.length}):`)
  for (const p of problems.slice(0, 60)) console.log('  ✗ ' + p)
  process.exit(1)
}
console.log('\nSTORY OK')
