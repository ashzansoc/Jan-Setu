import type { Complaint, UiLang } from './types'
import { CATEGORY_LABEL } from './types'
import { formatDayMonth, formatDurationDays } from '@/lib/format'
import type { Dictionary } from '@/lib/i18n/en'

/** "Greater Kailash 2, New Delhi" → "Greater Kailash 2" for dense card meta. */
export function shortLocation(label: string): string {
  return label
    .replace(/,\s*new delhi$/i, '')
    .replace(/,\s*delhi$/i, '')
    .replace(/^near\s+/i, '')
    .trim()
}

/** Titles are localised; the stored title is the English subject. */
export function displayTitle(complaint: Complaint, lang: UiLang): string {
  if (lang === 'en') return complaint.title
  const base = CATEGORY_LABEL[complaint.category][lang]
  if (complaint.category === 'water' && complaint.durationDays) {
    return `${base} · ${formatDurationDays(complaint.durationDays, lang)}`
  }
  return base
}

/** "Greater Kailash 2 · Filed 12 Mar" / "Block M, GK-2 · Closed 9 Mar". */
export function metaLine(
  complaint: Complaint,
  lang: UiLang,
  d: Dictionary,
): string {
  const place = shortLocation(complaint.location.label)
  const date = (iso: string | null) => (iso ? formatDayMonth(iso, lang) : null)

  const when =
    complaint.status === 'resolved'
      ? date(complaint.resolvedAt) ?? date(complaint.updatedAt)
      : complaint.status === 'awaiting_approval' || complaint.status === 'draft'
        ? date(complaint.preparedAt)
        : date(complaint.submittedAt) ?? date(complaint.createdAt)

  const label =
    complaint.status === 'resolved'
      ? d.complaints.closedOn(when ?? '')
      : complaint.status === 'awaiting_approval' || complaint.status === 'draft'
        ? d.complaints.preparedOn(when ?? '')
        : d.complaints.filedOn(when ?? '')

  return `${place} · ${label}`
}

export function isAwaitingApproval(complaint: Complaint): boolean {
  return complaint.status === 'awaiting_approval' || complaint.status === 'draft'
}

/**
 * Verification sources are stored as data (often proper nouns) but rendered as
 * copy. Known phrases are localised; anything unrecognised is shown verbatim so
 * a real department name is never rewritten.
 */
const SOURCE_LABEL: Record<string, { hi: string; hinglish: string }> = {
  'Confirmed by you': { hi: 'Aapne confirm kiya', hinglish: 'Aapne confirm kiya' },
  'Reported by you': { hi: 'Aapne darj kiya', hinglish: 'Aapne darj kiya' },
  'Helpline (no online filing)': {
    hi: 'Helpline (online filing nahi)',
    hinglish: 'Helpline (online filing nahi)',
  },
  'No online filing channel': {
    hi: 'Koi online filing channel nahi',
    hinglish: 'Koi online filing channel nahi',
  },
  'Location not recorded': { hi: 'Jagah darj nahi', hinglish: 'Jagah darj nahi' },
}

export function sourceLabel(source: string, lang: UiLang): string {
  if (lang === 'en') return source
  return SOURCE_LABEL[source]?.[lang] ?? source
}
