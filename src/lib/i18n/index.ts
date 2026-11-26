import { en, type Dictionary } from './en'
import { hi } from './hi'
import { hinglish } from './hinglish'
import type { UiLang } from '@/lib/complaints/types'
import { useSettings } from '@/state/settings'

export const dictionaries: Record<UiLang, Dictionary> = { en, hi, hinglish }

export function dictFor(lang: UiLang): Dictionary {
  return dictionaries[lang] ?? en
}

/** Copy for the current interface language, typed by the English shape. */
export function useDict(): Dictionary {
  const uiLang = useSettings((s) => s.uiLang)
  return dictFor(uiLang)
}

export function useUiLang(): UiLang {
  return useSettings((s) => s.uiLang)
}

export type { Dictionary }
