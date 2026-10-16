import type { DialogLine } from '@/systems/DialogSystem'
import enUi from '@/i18n/locales/en/ui.json'
import enMaps from '@/i18n/locales/en/maps.json'
import enDialogs from '@/i18n/locales/en/dialogs.json'
import frUi from '@/i18n/locales/fr/ui.json'
import frMaps from '@/i18n/locales/fr/maps.json'
import frDialogs from '@/i18n/locales/fr/dialogs.json'

type Language = 'en' | 'fr'
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

  has(key: string): boolean {
    return this.lookup(key) !== undefined
  }

  t(key: string, params?: I18nParams): string {
    const val = this.lookup(key)
    if (typeof val === 'string') return interpolate(val, params)
    if (Array.isArray(val)) return interpolate(val.join('\n'), params)
    return `[${key}]`
  }

  /** Returns all locale keys whose values are arrays (i.e. dialog keys). */
  getDialogKeys(): string[] {
    const data = locales[this.language]
    return Object.keys(data).filter(k => Array.isArray(data[k]))
  }

  getDialog(key: string, speaker?: string, params?: I18nParams): DialogLine[] {
    const val = this.lookup(key)
    if (Array.isArray(val)) {
      return val.map(text => ({ speaker, text: interpolate(text, params) }))
    }
    if (typeof val === 'string') {
      return [{ speaker, text: interpolate(val, params) }]
    }
    return [{ speaker, text: `[${key}]` }]
  }
}

export const i18n = new I18nManagerImpl()
