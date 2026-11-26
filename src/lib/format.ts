import type { UiLang } from '@/lib/complaints/types'
import type { Dictionary } from '@/lib/i18n/en'

/** Compact "2h ago" style stamp used on the verification strip. */
export function relativeTime(iso: string, dict: Dictionary, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, now - then)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return dict.verification.justNow
  if (minutes < 60) return dict.verification.minutesAgo(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return dict.verification.hoursAgo(hours)
  const days = Math.floor(hours / 24)
  return dict.verification.daysAgo(days)
}

/** Human duration, e.g. 21 → "3 weeks". */
export function formatDurationDays(days: number, lang: UiLang): string {
  const hi = lang === 'hi'
  if (days < 1) return hi ? 'कुछ घंटे' : 'a few hours'
  if (days < 7) {
    const n = Math.round(days)
    return hi ? `${n} दिन` : `${n} ${n === 1 ? 'day' : 'days'}`
  }
  if (days < 30) {
    const n = Math.max(1, Math.round(days / 7))
    return hi ? `${n} हफ़्ते` : `${n} ${n === 1 ? 'week' : 'weeks'}`
  }
  if (days < 365) {
    const n = Math.max(1, Math.round(days / 30))
    return hi ? `${n} महीने` : `${n} ${n === 1 ? 'month' : 'months'}`
  }
  const n = Math.max(1, Math.round(days / 365))
  return hi ? `${n} साल` : `${n} ${n === 1 ? 'year' : 'years'}`
}

/** "for the past three weeks" / "पिछले तीन हफ़्तों से". */
export function forPastDuration(days: number, lang: UiLang): string {
  const value = formatDurationDays(days, lang)
  return lang === 'hi' ? `पिछले ${value} से` : `for the past ${value}`
}

/** "12 Mar" — used on complaint cards; the year is noise at this distance. */
export function formatDayMonth(iso: string, lang: UiLang): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
    }).format(date)
  } catch {
    return date.toDateString()
  }
}

export function formatClock(iso: string, lang: UiLang): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
}
