import type Phaser from 'phaser'
import { PIXEL } from '@/config/game.config'
import { GLOW } from '@/ui/kit/assets'
import { colorNumber, drawPill, drawScreenBox, nineSlice, setInk, uiText } from '@/ui/kit/text'
import { measure, wrapText, LINE_H } from '@/ui/kit/font'
import type { PadInput } from '@/ui/kit/input'
import { Menu } from '@/ui/kit/Menu'
import { popWidget, pushWidget, type Widget, type WidgetState } from '@/ui/kit/registry'
import { CODEMON, CODEMON_TYPE_COLORS, codemonTexture, getCodemon, type CodemonDef } from '@/data/codemon'
import { CODEDEX_TEXT } from '@/data/codedex'
import { TYPE_NAMES } from '@/data/typeChart'
import { saveManager, MAX_HP } from '@/systems/SaveManager'
import { i18n } from '@/i18n/I18nManager'
import { resolveText } from '@/utils/i18n-helpers'

const P = PIXEL
const DEPTH = 3000
/** The list on the right: 8 rows of 16 art pixels */
const LIST = { x: 110 * P, y: 24 * P, w: 124 * P, rowH: 16 * P, rows: 8 }
/** The card on the left */
const CARD = { x: 6 * P, y: 22 * P, w: 98 * P, h: 132 * P }

type Track = <T extends Phaser.GameObjects.GameObject>(o: T, d?: number) => T

function tracker(objects: Phaser.GameObjects.GameObject[], depth: number): Track {
  return (o, d = 1) => {
    (o as unknown as { setScrollFactor(n: number): void }).setScrollFactor(0)
    ;(o as unknown as { setDepth(n: number): void }).setDepth(depth + d)
    objects.push(o)
    return o
  }
}

function typeName(mon: CodemonDef): string {
  return TYPE_NAMES[mon.type][i18n.getLanguage()].toUpperCase()
}

/** A Codémon's picture and the glow behind it (either may be missing if its texture is) */
export interface Portrait {
  glow: Phaser.GameObjects.Image | null
  image: Phaser.GameObjects.Image | null
  /** Both, to add to a container or destroy */
  parts: Phaser.GameObjects.Image[]
}

/** A Codémon's picture on a soft glow in its type colour, centred on (cx, cy), as tall as `size` (canvas pixels) */
export function codemonPortrait(scene: Phaser.Scene, mon: CodemonDef, cx: number, cy: number, size: number, depth: number): Portrait {
  let glow: Phaser.GameObjects.Image | null = null
  let image: Phaser.GameObjects.Image | null = null
  if (scene.textures.exists(GLOW)) {
    glow = scene.add.image(cx, cy, GLOW).setTint(colorNumber(CODEMON_TYPE_COLORS[mon.type]))
    glow.setDisplaySize(size * 1.5, size * 1.5).setAlpha(0.85).setDepth(depth).setScrollFactor(0)
  }
  const key = codemonTexture(mon.id)
  if (scene.textures.exists(key)) {
    image = scene.add.image(cx, cy, key).setDepth(depth + 1).setScrollFactor(0)
    image.setScale(size / Math.max(image.width, image.height))
  }
  return { glow, image, parts: [glow, image].filter((o): o is Phaser.GameObjects.Image => !!o) }
}

/** The left card: picture, number, name, type (a "?" silhouette when unseen) */
class Card {
  private objects: Phaser.GameObjects.GameObject[] = []
  private readonly scene: Phaser.Scene
  constructor(scene: Phaser.Scene, track: Track) {
    this.scene = scene
    track(nineSlice(scene, 'bar', CARD.x, CARD.y, CARD.w, CARD.h), 0)
  }

  show(mon: CodemonDef | null, number: string, seen: boolean, extra?: string): void {
    this.objects.forEach(o => o.destroy())
    this.objects = []
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      (o as unknown as { setScrollFactor(n: number): void }).setScrollFactor(0)
      ;(o as unknown as { setDepth(n: number): void }).setDepth(DEPTH + 3)
      this.objects.push(o)
      return o
    }
    const cx = CARD.x + CARD.w / 2
    add(uiText(this.scene, CARD.x + 6 * P, CARD.y + 3 * P, number, 'dim'))
    if (!mon || !seen) {
      add(uiText(this.scene, cx - measure('?') / 2, CARD.y + 40 * P, '?', 'dim'))
      return
    }
    this.objects.push(...codemonPortrait(this.scene, mon, cx, CARD.y + 50 * P, 64 * P, DEPTH + 2).parts)
    const name = mon.name.toUpperCase()
    add(uiText(this.scene, cx - measure(name) / 2, CARD.y + 84 * P, name))
    const type = typeName(mon)
    const pillW = measure(type) + 6 * P
    add(drawPill(this.scene, cx - pillW / 2, CARD.y + 101 * P, type, colorNumber(CODEMON_TYPE_COLORS[mon.type])))
    if (extra) {
      const w = measure(extra) + 6 * P
      add(drawPill(this.scene, cx - w / 2, CARD.y + 117 * P, extra, colorNumber('#ffc94a')))
    }
  }

  destroy(): void {
    this.objects.forEach(o => o.destroy())
  }
}

/** The list on the right: rows of text, the selected one on the highlight bar */
class List {
  readonly rows: Phaser.GameObjects.BitmapText[]
  private readonly bar: Phaser.GameObjects.Container
  private readonly up: Phaser.GameObjects.BitmapText
  private readonly down: Phaser.GameObjects.BitmapText
  top = 0
  constructor(scene: Phaser.Scene, track: Track) {
    this.bar = track(nineSlice(scene, 'bar', LIST.x - 2 * P, LIST.y, LIST.w, LIST.rowH), 1)
    this.rows = Array.from({ length: LIST.rows }, (_, i) => track(uiText(scene, LIST.x + 4 * P, LIST.y + i * LIST.rowH, ''), 2))
    this.up = track(uiText(scene, LIST.x + LIST.w - 12 * P, LIST.y - 12 * P, '▲', 'gold'), 2)
    this.down = track(uiText(scene, LIST.x + LIST.w - 12 * P, LIST.y + LIST.rows * LIST.rowH - 8 * P, '▼', 'gold'), 2)
  }

  render(labels: { text: string; dim?: boolean }[], index: number): void {
    if (index < this.top) this.top = index
    if (index >= this.top + LIST.rows) this.top = index - LIST.rows + 1
    this.rows.forEach((row, k) => {
      const item = labels[this.top + k]
      row.setText(item?.text ?? '')
      setInk(row, this.top + k === index ? 'gold' : item?.dim ? 'dim' : 'light')
    })
    this.bar.setY(LIST.y + (index - this.top) * LIST.rowH).setVisible(labels.length > 0)
    this.up.setVisible(this.top > 0)
    this.down.setVisible(this.top + LIST.rows < labels.length)
  }
}

/**
 * The Codédex: the 18 Codémon in order with seen and caught counts, the highlighted
 * one on the left card; A on a Codémon you've seen opens its page. B closes.
 */
export function openCodedex(scene: Phaser.Scene, input: PadInput): Promise<void> {
  return new Promise(resolve => {
    const { width } = scene.scale
    const objects: Phaser.GameObjects.GameObject[] = []
    const track = tracker(objects, DEPTH)
    track(drawScreenBox(scene), 0)
    const save = saveManager.getData()
    const seen = new Set(save.seen)
    const caught = new Set(save.team)
    track(uiText(scene, 10 * P, 4 * P, i18n.t('start_codedex'), 'gold'))
    // Only the 18 count (Zap, Prof Pi's Codémon, is seen in the opening but isn't one of them)
    const count = (set: Set<string>): number => CODEMON.filter(m => set.has(m.id)).length
    const counts = `${i18n.t('dex_seen')} ${count(seen)}   ${i18n.t('dex_caught')} ${count(caught)}`
    track(uiText(scene, width - 10 * P - measure(counts), 4 * P, counts))
    const card = new Card(scene, track)
    const list = new List(scene, track)
    let index = 0
    let page: Phaser.GameObjects.GameObject[] | null = null

    const number = (i: number): string => `No.${String(i + 1).padStart(3, '0')}`
    const render = (): void => {
      list.render(CODEMON.map((mon, i) => ({
        text: `${String(i + 1).padStart(3, '0')}  ${seen.has(mon.id) ? mon.name.toUpperCase() : '-----'}${caught.has(mon.id) ? ' ★' : ''}`,
        dim: !seen.has(mon.id),
      })), index)
      card.show(CODEMON[index], number(index), seen.has(CODEMON[index].id))
    }

    const openPage = (): void => {
      const mon = CODEMON[index]
      if (!seen.has(mon.id)) return
      const objs: Phaser.GameObjects.GameObject[] = []
      const t = tracker(objs, DEPTH + 10)
      t(drawScreenBox(scene), 0)
      objs.push(...codemonPortrait(scene, mon, 60 * P, 52 * P, 76 * P, DEPTH + 11).parts)
      t(uiText(scene, 118 * P, 14 * P, number(index), 'dim'), 3)
      t(uiText(scene, 118 * P, 30 * P, mon.name.toUpperCase()), 3)
      t(drawPill(scene, 118 * P, 48 * P, typeName(mon), colorNumber(CODEMON_TYPE_COLORS[mon.type])), 3)
      const text = caught.has(mon.id) ? resolveText(CODEDEX_TEXT[mon.id]) : i18n.t('dex_unknown')
      wrapText(text, width - 24 * P).slice(0, 3).forEach((line, i) => t(uiText(scene, 12 * P, 100 * P + i * LINE_H, line), 3))
      page = objs
    }

    const widget: Widget = { state: (): WidgetState => ({ kind: 'menu', items: list.rows.map(r => r.text), cursor: index, page: !!page }) }
    pushWidget(widget)
    const close = (): void => {
      off()
      page?.forEach(o => o.destroy())
      card.destroy()
      objects.forEach(o => o.destroy())
      popWidget(widget)
      resolve()
    }
    const off = input.on(b => {
      if (page) {
        if (b === 'a' || b === 'b' || b === 'start') { page.forEach(o => o.destroy()); page = null }
        return
      }
      if (b === 'up') index = (index + CODEMON.length - 1) % CODEMON.length
      else if (b === 'down') index = (index + 1) % CODEMON.length
      else if (b === 'left') index = Math.max(0, index - LIST.rows)
      else if (b === 'right') index = Math.min(CODEMON.length - 1, index + LIST.rows)
      else if (b === 'a') return openPage()
      else if (b === 'b' || b === 'start') return close()
      render()
    })
    render()
  })
}

/**
 * Your Codémon: the team in catch order, the lead marked ★ and shown on the card;
 * A then EN TÊTE makes one the lead (it fights for you). B closes.
 */
export function openTeam(scene: Phaser.Scene, input: PadInput): Promise<void> {
  return new Promise(resolve => {
    const { width, height } = scene.scale
    const objects: Phaser.GameObjects.GameObject[] = []
    const track = tracker(objects, DEPTH)
    track(drawScreenBox(scene), 0)
    track(uiText(scene, 10 * P, 4 * P, i18n.t('start_team'), 'gold'))
    const header = track(uiText(scene, 0, 4 * P, ''))
    const card = new Card(scene, track)
    const list = new List(scene, track)
    let index = 0
    let busy = false

    const render = (): void => {
      const save = saveManager.getData()
      const pv = Math.ceil((saveManager.getHp() / MAX_HP) * 20)
      header.setText(`${i18n.t('battle_hp')} ${pv}/20`).setX(width - 10 * P - measure(header.text))
      const team = save.team.map(id => getCodemon(id)).filter((m): m is CodemonDef => !!m)
      list.render(team.map(mon => ({ text: `${mon.name.toUpperCase()}${save.lead === mon.id ? ' ★' : ''}` })), index)
      const mon = team[index] ?? null
      card.show(mon, mon ? `No.${String(CODEMON.indexOf(mon) + 1).padStart(3, '0')}` : '', !!mon, mon && save.lead === mon.id ? i18n.t('team_set_lead') : undefined)
    }

    const widget: Widget = { state: (): WidgetState => ({ kind: 'menu', items: saveManager.getData().team, cursor: index }) }
    pushWidget(widget)
    const close = (): void => {
      off()
      card.destroy()
      objects.forEach(o => o.destroy())
      popWidget(widget)
      resolve()
    }
    const off = input.on(async b => {
      if (busy) return
      const team = saveManager.getData().team
      if (b === 'up') index = (index + team.length - 1) % Math.max(1, team.length)
      else if (b === 'down') index = (index + 1) % Math.max(1, team.length)
      else if (b === 'b' || b === 'start') return close()
      else if (b === 'a' && team[index]) {
        busy = true
        const menu = new Menu(scene, input, {
          alignRight: width - 6 * P,
          alignBottom: height - 6 * P,
          items: [i18n.t('team_set_lead'), i18n.t('team_cancel')],
          depth: DEPTH + 20,
        })
        const choice = await menu.choose()
        menu.destroy()
        if (choice === 0) saveManager.setLead(team[index])
        busy = false
      }
      render()
    })
    render()
  })
}
