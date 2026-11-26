import type { Complaint } from './types'
import { LOCALITIES, URGENCY_TERMS } from '@/lib/ai/lexicon'

/**
 * Reads a spoken amendment to an existing complaint.
 *
 * The rule is additive: the citizen's original words are never rewritten. New
 * detail is appended, and only fields they clearly restated are updated. That
 * keeps "add that water is also coming inside the house" from quietly replacing
 * the drainage complaint they filed an hour ago.
 */
export interface Amendment {
  note: string
  severity?: 'high'
  location?: string
  /** Which fields will visibly change — used for the confirmation sentence. */
  changes: { field: 'detail' | 'urgency' | 'location'; label: string }[]
}

const PREFIXES = [
  /^(isme|ismein|isme\s+bhi|isko|isko\s+update\s+karo|isko\s+badlo)\s*/i,
  /^(add\s+karo\s+(ki\s+)?|aur\s+add\s+karo\s+(ki\s+)?|also\s+add\s+(that\s+)?|please\s+add\s+(that\s+)?)/i,
  /^(update\s+karo\s+(ki\s+)?|aur\s+batao\s+(ki\s+)?)/i,
  /^(इसमें|इसमें\s+भी|इसको)\s*/,
  /^(जोड़ो\s+(कि\s+)?|जोड़\s+दो\s+(कि\s+)?|और\s+बताओ\s+(कि\s+)?)/,
]

function stripPrefix(input: string): string {
  let text = input.trim()
  for (let pass = 0; pass < 3; pass += 1) {
    const before = text
    for (const prefix of PREFIXES) text = text.replace(prefix, '')
    if (text === before) break
  }
  return text.replace(/^[,\s]+/, '').trim()
}

export function readAmendment(input: string, complaint: Complaint): Amendment {
  const cleaned = stripPrefix(input)
  const note = cleaned || input.trim()
  const lower = note.toLowerCase()
  const changes: Amendment['changes'] = [{ field: 'detail', label: 'detail' }]

  const severity = URGENCY_TERMS.some((term) => lower.includes(term)) ? ('high' as const) : undefined
  if (severity) changes.push({ field: 'urgency', label: 'urgency' })

  const localityHits = LOCALITIES.filter((locality) => lower.includes(locality)).sort(
    (a, b) => b.length - a.length,
  )
  const current = complaint.location.label.toLowerCase()
  const location = localityHits.find((locality) => !current.includes(locality))

  if (location) changes.push({ field: 'location', label: 'location' })

  return {
    note,
    severity,
    location: location ? `${location}, New Delhi` : undefined,
    changes,
  }
}
