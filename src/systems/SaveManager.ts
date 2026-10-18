import { SAVE_KEY } from '@/config/game.config'
import type { SaveData, Spot } from '@/data/types'

/** The map a new adventure starts on (Prof Pi's lab) */
export const START_MAP = 'lab'
/** PV, in half-hits: 4 hits */
export const MAX_HP = 8

/** A new random world seed (32-bit unsigned) */
function rollTowerSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0
}

/** A brand-new save. A factory (not a shared constant) so arrays are never shared between saves. */
function freshSave(): SaveData {
  return {
    version: 3,
    language: 'fr',
    textSpeed: 'mid',
    currentMap: START_MAP,
    completedChallenges: [],
    defeatedTrainers: [],
    towerSeed: rollTowerSeed(),
    companion: null,
    playerName: '',
    starter: null,
    flags: [],
    team: [],
    lead: null,
    seen: [],
    missed: [],
    badges: [],
    lastHeal: null,
    position: null,
    hp: null,
    playTimeMs: 0,
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
}

function isSpot(value: unknown): value is Spot {
  const s = value as Spot | null
  return !!s && typeof s.mapId === 'string' && Number.isInteger(s.tileX) && Number.isInteger(s.tileY)
    && (s.facing === 'up' || s.facing === 'down' || s.facing === 'left' || s.facing === 'right')
}

class SaveManagerImpl {
  private data: SaveData
  private needsWrite = false // an old save was upgraded

  constructor() {
    this.data = this.load()
    if (this.needsWrite) this.save()
  }

  /**
   * Read the save, tolerating missing fields and corrupt JSON. Saves from an older
   * story (no version, or version 2: the Game Boy opening) start the current story
   * but keep their course progress, language, text speed and world seed.
   */
  private load(): SaveData {
    const fresh = freshSave()
    const raw = this.readRaw()
    if (!raw) return fresh

    try {
      const p = JSON.parse(raw) as Partial<SaveData> & Record<string, unknown>
      const language = p.language === 'en' || p.language === 'fr' ? p.language : fresh.language
      const completedChallenges = isStringArray(p.completedChallenges) ? [...p.completedChallenges] : []
      const towerSeed = typeof p.towerSeed === 'number' && Number.isInteger(p.towerSeed) && p.towerSeed >= 0 ? p.towerSeed >>> 0 : fresh.towerSeed
      const textSpeed = p.textSpeed === 'fast' || p.textSpeed === 'slow' ? p.textSpeed : 'mid'
      if (p.version !== 3) {
        this.needsWrite = true
        return { ...fresh, language, textSpeed, completedChallenges, towerSeed }
      }
      return {
        version: 3,
        language,
        textSpeed,
        currentMap: typeof p.currentMap === 'string' ? p.currentMap : fresh.currentMap,
        completedChallenges,
        defeatedTrainers: isStringArray(p.defeatedTrainers) ? [...p.defeatedTrainers] : [],
        towerSeed,
        companion: typeof p.companion === 'string' ? p.companion : null,
        playerName: typeof p.playerName === 'string' ? p.playerName : '',
        starter: typeof p.starter === 'string' ? p.starter : null,
        flags: isStringArray(p.flags) ? [...p.flags] : [],
        team: isStringArray(p.team) ? [...p.team] : [],
        lead: typeof p.lead === 'string' ? p.lead : null,
        seen: isStringArray(p.seen) ? [...p.seen] : [],
        missed: isStringArray(p.missed) ? [...p.missed] : [],
        badges: Array.isArray(p.badges) ? p.badges.filter((b): b is number => Number.isInteger(b)) : [],
        lastHeal: isSpot(p.lastHeal) ? { ...p.lastHeal } : null,
        position: isSpot(p.position) ? { ...p.position } : null,
        hp: typeof p.hp === 'number' && p.hp >= 0 && p.hp <= MAX_HP ? p.hp : null,
        playTimeMs: typeof p.playTimeMs === 'number' && p.playTimeMs >= 0 ? p.playTimeMs : 0,
      }
    } catch (e) {
      console.warn('Save data is corrupt — starting fresh', e)
      return fresh
    }
  }

  private readRaw(): string | null {
    try {
      return localStorage.getItem(SAVE_KEY)
    } catch {
      return null // storage blocked (private mode, sandboxed iframe)
    }
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data))
    } catch (e) {
      console.warn('Could not write save data', e)
    }
  }

  getData(): SaveData {
    return this.data
  }

  hasSave(): boolean {
    return this.readRaw() !== null
  }

  /** An adventure has started (the player has a name): the title screen offers CONTINUE */
  hasStory(): boolean {
    return this.data.flags.includes('named')
  }

  // ── Course progress ──

  completeChallenge(id: string): void {
    if (!this.data.completedChallenges.includes(id)) {
      this.data.completedChallenges.push(id)
      this.save()
    }
  }

  isChallengeCompleted(id: string): boolean {
    return this.data.completedChallenges.includes(id)
  }

  getCompletedChallenges(): string[] {
    return [...this.data.completedChallenges]
  }

  setCompletedChallenges(ids: string[]): void {
    this.data.completedChallenges = [...ids]
    this.save()
  }

  /** A question that cost a hit: review battles ask it again first */
  addMissed(id: string): void {
    if (!this.data.missed.includes(id)) {
      this.data.missed.push(id)
      this.save()
    }
  }

  defeatTrainer(trainerId: string): void {
    if (!this.data.defeatedTrainers.includes(trainerId)) {
      this.data.defeatedTrainers.push(trainerId)
      this.save()
    }
  }

  isTrainerDefeated(trainerId: string): boolean {
    return this.data.defeatedTrainers.includes(trainerId)
  }

  // ── Story ──

  hasFlag(flag: string): boolean {
    return this.data.flags.includes(flag)
  }

  setFlag(flag: string): void {
    if (!this.data.flags.includes(flag)) {
      this.data.flags.push(flag)
      this.save()
    }
  }

  clearFlag(flag: string): void {
    const before = this.data.flags.length
    this.data.flags = this.data.flags.filter(f => f !== flag)
    if (this.data.flags.length !== before) this.save()
  }

  setPlayerName(name: string): void {
    this.data.playerName = name
    this.save()
  }

  setStarter(id: string): void {
    this.data.starter = id
    this.save()
  }

  /** A Codémon joins the team (and the Codédex); the first one leads */
  giveCodemon(id: string): void {
    if (!this.data.team.includes(id)) this.data.team.push(id)
    if (!this.data.seen.includes(id)) this.data.seen.push(id)
    if (!this.data.lead) this.data.lead = id
    this.save()
  }

  setLead(id: string): void {
    if (!this.data.team.includes(id)) return
    this.data.lead = id
    this.save()
  }

  getLead(): string | null {
    return this.data.lead
  }

  markSeen(id: string): void {
    if (!this.data.seen.includes(id)) {
      this.data.seen.push(id)
      this.save()
    }
  }

  addBadge(n: number): void {
    if (!this.data.badges.includes(n)) {
      this.data.badges.push(n)
      this.data.badges.sort((a, b) => a - b)
      this.save()
    }
  }

  hasBadge(n: number): boolean {
    return this.data.badges.includes(n)
  }

  // ── Places and PV ──

  setCurrentMap(mapId: string): void {
    this.data.currentMap = mapId
    this.save()
  }

  setPosition(spot: Spot): void {
    this.data.position = { ...spot }
    this.data.currentMap = spot.mapId
    this.save()
  }

  setLastHeal(spot: Spot): void {
    this.data.lastHeal = { ...spot }
    this.save()
  }

  /** PV left in half-hits (full when never hurt) */
  getHp(): number {
    return this.data.hp ?? MAX_HP
  }

  setHp(hp: number | null): void {
    this.data.hp = hp === null || hp >= MAX_HP ? null : Math.max(0, hp)
    this.save()
  }

  /** Counted while the map is on screen; written with the next save */
  addPlayTime(ms: number): void {
    this.data.playTimeMs += ms
  }

  // ── Settings ──

  setLanguage(lang: 'en' | 'fr'): void {
    this.data.language = lang
    this.save()
  }

  setTextSpeed(speed: SaveData['textSpeed']): void {
    this.data.textSpeed = speed
    this.save()
  }

  setCompanion(spriteKey: string | null): void {
    this.data.companion = spriteKey
    this.save()
  }

  getCompanion(): string | null {
    return this.data.companion ?? null
  }

  /**
   * New adventure: the story starts over, but course progress (completed
   * exercises), language and text speed are kept.
   */
  newGame(): void {
    const { language, textSpeed, completedChallenges } = this.data
    this.data = { ...freshSave(), language, textSpeed, completedChallenges: [...completedChallenges] }
    this.save()
  }

  /** Kept for callers of the old menu */
  reset(): void {
    this.newGame()
  }
}

export const saveManager = new SaveManagerImpl()
