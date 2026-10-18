import enUi from '@/i18n/locales/en/ui.json'
import enMaps from '@/i18n/locales/en/maps.json'
import enDialogs from '@/i18n/locales/en/dialogs.json'
import frUi from '@/i18n/locales/fr/ui.json'
import frMaps from '@/i18n/locales/fr/maps.json'
import frDialogs from '@/i18n/locales/fr/dialogs.json'

type Language = 'en' | 'fr'

/** One line of a dialog (the speaker is kept for callers; Game Boy text boxes don't show it) */
export interface DialogLine {
  speaker?: string
  text: string
}
type LocaleData = Record<string, string | string[]>
export type I18nParams = Record<string, string | number>

const locales: Record<Language, LocaleData> = {
  en: { ...enUi, ...enMaps, ...enDialogs },
  fr: { ...frUi, ...frMaps, ...frDialogs },
}

/** Replace `{name}` placeholders with values from params */
function interpolate(text: string, params?: I18nParams): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match)
}

class I18nManagerImpl {
  private language: Language = 'fr'
  /** Values every text can use, e.g. {player} and {rival} (set by the game from the save) */
  private globals: () => I18nParams = () => ({})

  setGlobalParams(fn: () => I18nParams): void {
    this.globals = fn
  }

  private params(params?: I18nParams): I18nParams {
    return { ...this.globals(), ...params }
  }

  setLanguage(lang: Language): void {
    this.language = lang
  }

  getLanguage(): Language {
    return this.language
  }

  /** Lookup in the current language, falling back to English */
  private lookup(key: string): string | string[] | undefined {
    return locales[this.language][key] ?? locales.en[key]
  }

  /** Fill placeholders in any text (the globals too: {player}, {rival}) */
  format(text: string, params?: I18nParams): string {
    return interpolate(text, this.params(params))
  }

  has(key: string): boolean {
    return this.lookup(key) !== undefined
  }

  t(key: string, params?: I18nParams): string {
    const val = this.lookup(key)
    if (typeof val === 'string') return interpolate(val, this.params(params))
    if (Array.isArray(val)) return interpolate(val.join('\n'), this.params(params))
    return `[${key}]`
  }

  /** Returns all locale keys whose values are arrays (i.e. dialog keys). */
  getDialogKeys(): string[] {
    const data = locales[this.language]
    return Object.keys(data).filter(k => Array.isArray(data[k]))
  }

  getDialog(key: string, speaker?: string, params?: I18nParams): DialogLine[] {
    const val = this.lookup(key)
    const all = this.params(params)
    if (Array.isArray(val)) {
      return val.map(text => ({ speaker, text: interpolate(text, all) }))
    }
    if (typeof val === 'string') {
      return [{ speaker, text: interpolate(val, all) }]
    }
    return [{ speaker, text: `[${key}]` }]
  }
}

export const i18n = new I18nManagerImpl()
