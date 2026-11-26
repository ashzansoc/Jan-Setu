import type { Category, Complaint, StatusGroup, UiLang } from './types'
import { CATEGORY_LABEL } from './types'
import { groupOf } from './status'
import { CATEGORY_LEXICON, LOCALITIES } from '@/lib/ai/lexicon'

/**
 * Natural-language search over the citizen's own records.
 *
 * Deliberately conservative: it only narrows on things it can read with
 * confidence (category, status bucket, reference, a named locality). Everything
 * else is ignored rather than guessed, so a question never hides a complaint.
 */
export interface ComplaintQuery {
  raw: string
  categories: Category[]
  groups: StatusGroup[]
  reference: string | null
  locality: string | null
  /** "How many complaints do I have?" — answered with a count, not a list. */
  asksCount: boolean
  /** Nothing understood: show everything. */
  empty: boolean
}

const GROUP_TERMS: { group: StatusGroup; terms: string[] }[] = [
  {
    group: 'approval',
    terms: [
      'approval',
      'approve',
      'approval pending',
      'pending approval',
      'waiting for my yes',
      'draft',
      'not submitted',
      'martur',
      'manzoori',
      'मंज़ूरी',
      'मंजूरी',
      'स्वीकृति',
      'ड्राफ्ट',
      'अनुमोदन',
    ],
  },
  {
    group: 'resolved',
    terms: [
      'resolved',
      'resolution',
      'solved',
      'fixed',
      'closed',
      'close',
      'complete',
      'hal ho',
      'hal hui',
      'theek ho',
      'band ho gaya',
      'हल',
      'समाधान',
      'बंद हो',
      'पूरा',
    ],
  },
  {
    group: 'active',
    terms: [
      'active',
      'in progress',
      'in-progress',
      'ongoing',
      'pending',
      'submitted',
      'acknowledged',
      'chal rahi',
      'chal raha',
      'abhi tak',
      'lambit',
      'चालू',
      'लंबित',
      'प्रगति',
    ],
  },
]

const COUNT_TERMS = ['kitni', 'kitne', 'how many', 'count', 'total', 'कितनी', 'कितने']

const REF_PATTERN = /\bmcd-[a-z]{3}-\d{2}-\d{4,5}\b/i

function normalize(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/[“”"'’‘`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreCategory(text: string): Category[] {
  const hits: { category: Category; score: number }[] = []
  for (const category of Object.keys(CATEGORY_LEXICON) as Exclude<Category, 'other'>[]) {
    let score = 0
    for (const { term, weight } of CATEGORY_LEXICON[category]) {
      if (text.includes(term)) score += weight
    }
    if (score > 0) hits.push({ category, score })
  }
  hits.sort((a, b) => b.score - a.score)
  // Two categories at most: "garbage" mentioned twice must not become a filter
  // that excludes the complaint the citizen meant.
  return hits.slice(0, 2).map((hit) => hit.category)
}

export function parseComplaintQuery(raw: string): ComplaintQuery {
  const text = normalize(raw)
  const categories = scoreCategory(text)
  const groups: StatusGroup[] = []

  for (const { group, terms } of GROUP_TERMS) {
    if (terms.some((term) => text.includes(term))) groups.push(group)
  }

  // "unresolved", "resolve nahi hui", "band nahi hui" → the unresolved set.
  // Note "unresolved" contains "resolved", so negation must win over the
  // positive term rather than the other way round.
  const negatedResolution =
    /\bun(-|\s)?resolved\b/.test(text) ||
    /\bnot\s+(yet\s+)?(resolved|closed|fixed)\b/.test(text) ||
    /(resolve|closed|hal|band|fix)\s+(nahi|nahin|not)\b/.test(text) ||
    /(still\s+open|abhi\s+tak\s+(hal|band)\s+nahi)/.test(text)
  if (negatedResolution) {
    // "unresolved" means everything still open — drafts included.
    const index = groups.indexOf('resolved')
    if (index >= 0) groups.splice(index, 1)
    for (const openGroup of ['approval', 'active'] as const) {
      if (!groups.includes(openGroup)) groups.push(openGroup)
    }
  }

  // A bare "pending" means "still open", not "pending my approval" — but only
  // when the citizen did not explicitly say "unresolved".
  if (!negatedResolution && groups.length > 1 && groups.includes('active') && groups.includes('approval')) {
    const index = groups.indexOf('approval')
    groups.splice(index, 1)
  }

  const reference = text.match(REF_PATTERN)?.[0]?.toUpperCase() ?? null

  const localityHits = LOCALITIES.filter((locality) => text.includes(locality)).sort(
    (a, b) => b.length - a.length,
  )
  const locality = localityHits[0] ?? null

  const asksCount = COUNT_TERMS.some((term) => text.includes(term))

  return {
    raw: raw.trim(),
    categories,
    groups,
    reference,
    locality,
    asksCount,
    empty: !categories.length && !groups.length && !reference && !locality && !asksCount,
  }
}

export function matchesQuery(complaint: Complaint, query: ComplaintQuery): boolean {
  if (query.empty) return true

  if (query.reference && !complaint.reference?.toUpperCase().includes(query.reference)) {
    return false
  }

  if (query.categories.length && !query.categories.includes(complaint.category)) {
    return false
  }

  if (query.groups.length && !query.groups.includes(groupOf(complaint.status))) {
    return false
  }

  if (query.locality) {
    const haystack = `${complaint.location.label} ${complaint.title}`.toLowerCase()
    if (!haystack.includes(query.locality)) return false
  }

  return true
}

export function applyQuery(complaints: Complaint[], query: ComplaintQuery): Complaint[] {
  return complaints.filter((complaint) => matchesQuery(complaint, query))
}

/** A human/spoken description of what was understood, for the results header. */
export function describeQuery(query: ComplaintQuery, lang: UiLang): string | null {
  const parts: string[] = []
  if (query.categories.length) {
    parts.push(query.categories.map((category) => CATEGORY_LABEL[category][lang]).join(', '))
  }
  if (query.locality) parts.push(query.locality)
  if (query.reference) parts.push(query.reference)
  if (query.groups.length) {
    const labels: Record<StatusGroup, { hi: string; en: string; hinglish: string }> = {
      approval: { en: 'needs approval', hi: 'स्वीकृति बाकी', hinglish: 'approve chahiye' },
      active: { en: 'in progress', hi: 'प्रगति में', hinglish: 'chal rahi hai' },
      resolved: { en: 'resolved', hi: 'हल हुई', hinglish: 'hal ho gaya' },
      closed: { en: 'closed', hi: 'बंद', hinglish: 'band' },
    }
    parts.push(query.groups.map((group) => labels[group][lang]).join(', '))
  }
  return parts.length ? parts.join(' · ') : null
}
