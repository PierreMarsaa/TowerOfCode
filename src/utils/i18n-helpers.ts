import type { LocalizedText, MapData } from '@/data/types'
import { i18n } from '@/i18n/I18nManager'

/**
 * Resolve exercise text in the current language. Code-Life content mixes
 * plain strings and {en, fr} objects, and some optional fields are absent,
 * so accept all three and fall back to the other language.
 */
export function resolveText(text: LocalizedText | string | null | undefined): string {
  if (text == null) return ''
  if (typeof text === 'string') return text
  const lang = i18n.getLanguage()
  return text[lang] ?? text[lang === 'en' ? 'fr' : 'en'] ?? ''
}

/** Display name of a map: its title (generated maps), else its i18n key (e.g. map_01_name), else MapData.name */
export function mapDisplayName(map: Pick<MapData, 'id' | 'name' | 'title'>): string {
  if (map.title) return resolveText(map.title)
  const key = `${map.id.replace('-', '_')}_name`
  return i18n.has(key) ? i18n.t(key) : map.name
}
