import { SAVE_KEY } from '@/config/game.config'
import type { SaveData } from '@/data/types'

/** A brand-new save. A factory (not a shared constant) so arrays are never shared between saves. */
function freshSave(): SaveData {
  return {
    language: 'fr',
    currentMap: 'map-01',
    completedChallenges: [],
    defeatedTrainers: [],
    companion: 'zap',
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
}

class SaveManagerImpl {
  private data: SaveData

  constructor() {
    this.data = this.load()
  }

  /** Read the save, tolerating missing fields, old formats and corrupt JSON */
  private load(): SaveData {
    const fresh = freshSave()
    const raw = this.readRaw()
    if (!raw) return fresh

    try {
      const parsed = JSON.parse(raw) as Partial<SaveData> & { currentFloor?: unknown }
      // Migrate old saves that used "currentFloor" / "floor-" prefix
      const legacyMap = typeof parsed.currentFloor === 'string'
        ? parsed.currentFloor.replace('floor-', 'map-')
        : undefined
      return {
        language: parsed.language === 'en' || parsed.language === 'fr' ? parsed.language : fresh.language,
        currentMap: typeof parsed.currentMap === 'string' ? parsed.currentMap : legacyMap ?? fresh.currentMap,
        completedChallenges: isStringArray(parsed.completedChallenges) ? [...parsed.completedChallenges] : [],
        defeatedTrainers: isStringArray(parsed.defeatedTrainers) ? [...parsed.defeatedTrainers] : [],
        // Saves from before Zap was given out get Zap; an explicit null (no companion) is kept
        companion: parsed.companion === undefined ? fresh.companion : parsed.companion,
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

  completeChallenge(id: string): void {
    if (!this.data.completedChallenges.includes(id)) {
      this.data.completedChallenges.push(id)
      this.save()
    }
  }

  isChallengeCompleted(id: string): boolean {
    return this.data.completedChallenges.includes(id)
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

  setCurrentMap(mapId: string): void {
    this.data.currentMap = mapId
    this.save()
  }

  setLanguage(lang: 'en' | 'fr'): void {
    this.data.language = lang
    this.save()
  }

  setCompanion(spriteKey: string | null): void {
    this.data.companion = spriteKey
    this.save()
  }

  getCompanion(): string | null {
    return this.data.companion ?? null
  }

  getCompletedChallenges(): string[] {
    return [...this.data.completedChallenges]
  }

  setCompletedChallenges(ids: string[]): void {
    this.data.completedChallenges = [...ids]
    this.save()
  }

  /** New game: wipe progress but keep the player's language choice */
  reset(): void {
    this.data = { ...freshSave(), language: this.data.language }
    this.save()
  }
}

export const saveManager = new SaveManagerImpl()
