import type { Category, SpeechLang } from '@/lib/complaints/types'
import {
  CATEGORY_LEXICON,
  DRAINAGE_CONFIRMERS,
  DURATION_UNITS,
  HINDI_NUMBERS,
  LOCALITIES,
  PROBLEM_PHRASE,
  URGENCY_TERMS,
} from './lexicon'

export type DetectedLanguage = 'hi' | 'en' | 'mixed' | 'bn' | 'ta' | 'mr'

export interface Extraction {
  category: Category
  categoryConfidence: number
  categoryScores: Record<Category, number>
  problemEn: string
  problemHi: string
  location: string | null
  locationConfidence: number
  durationDays: number | null
  urgency: 'normal' | 'high'
  language: DetectedLanguage
  speechLang: SpeechLang
}

export type MissingField = 'category' | 'location'

export interface EngineResult {
  extraction: Extraction
  missing: MissingField[]
}

const CATEGORIES = Object.keys(CATEGORY_LEXICON) as Exclude<Category, 'other'>[]

const DEVANAGARI_DIGITS = '०१२३४५६७८९'

/** Lower-cases, converts Devanagari digits, strips noise. Keeps the words. */
export function normalize(input: string): string {
  let out = input.normalize('NFC').toLowerCase()
  out = out.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
  out = out.replace(/[“”„"'’‘`]/g, '')
  out = out.replace(/\s+/g, ' ')
  return out.trim()
}

function containsTerm(haystack: string, term: string): boolean {
  // Unicode-aware boundary so "road" doesn't fire inside "broadband".
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(haystack)
}

function detectLanguage(text: string): DetectedLanguage {
  const deva = (text.match(/[\u0900-\u097F]/g) ?? []).length
  const beng = (text.match(/[\u0980-\u09FF]/g) ?? []).length
  const tamil = (text.match(/[\u0B80-\u0BFF]/g) ?? []).length
  if (beng > 2 && beng >= deva) return 'bn'
  if (tamil > 2 && tamil >= deva) return 'ta'
  if (deva === 0) {
    const romanHindi = [
      'hai',
      'nahi',
      'nahin',
      'raha',
      'rahi',
      'hui',
      'hua',
      'mein',
      'me',
      'ke',
      'ki',
      'ka',
      'se',
      'par',
      'pada',
      'band',
      'ho',
      'gaya',
      'gayi',
      'bahut',
      'koi',
      'kuch',
      'aap',
      'mera',
      'mere',
      'yahan',
      'wahan',
    ]
    const words = text.split(/\s+/)
    const hits = words.filter((w) => romanHindi.includes(w.replace(/[^a-z]/g, ''))).length
    return hits >= 2 ? 'mixed' : 'en'
  }
  const latin = (text.match(/[a-z]/g) ?? []).length
  return latin > 6 ? 'mixed' : 'hi'
}

function scoreCategories(text: string): Record<Category, number> {
  const scores: Record<Category, number> = {
    sanitation: 0,
    streetlight: 0,
    water: 0,
    road: 0,
    drainage: 0,
    electricity: 0,
    other: 0,
  }

  for (const category of CATEGORIES) {
    for (const { term, weight } of CATEGORY_LEXICON[category]) {
      if (containsTerm(text, term)) scores[category] += weight
    }
  }

  // A drain that is blocked/overflowing is drainage even when the user also
  // mentions the road or the water standing on it.
  if (scores.drainage > 0) {
    const confirmations = DRAINAGE_CONFIRMERS.filter((c) => containsTerm(text, c)).length
    scores.drainage += confirmations * 2
  }

  return scores
}

const DELHI_LOCALITIES = new Set(
  LOCALITIES.filter(
    (l) => !['noida', 'gurugram', 'gurgaon', 'ghaziabad', 'faridabad', 'indirapuram', 'vaishali'].includes(l),
  ),
)

const NCR_CITY: Record<string, string> = {
  noida: 'Noida',
  gurugram: 'Gurugram',
  gurgaon: 'Gurugram',
  ghaziabad: 'Ghaziabad',
  faridabad: 'Faridabad',
  indirapuram: 'Ghaziabad',
  vaishali: 'Ghaziabad',
}

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function extractLocation(text: string): { label: string | null; confidence: number } {
  // Longest locality first so "greater kailash 2" beats "greater kailash".
  const sorted = [...LOCALITIES].sort((a, b) => b.length - a.length)
  for (const locality of sorted) {
    if (containsTerm(text, locality)) {
      const tidy = titleCase(locality)
      if (DELHI_LOCALITIES.has(locality)) {
        return { label: `${tidy}, New Delhi`, confidence: 0.94 }
      }
      const city = NCR_CITY[locality]
      return { label: city && city !== tidy ? `${tidy}, ${city}` : tidy, confidence: 0.9 }
    }
  }

  const pin = text.match(/\b(11\d{3}|20\d{3}|12\d{3}|30\d{3})\b/)
  if (pin) return { label: `Pincode ${pin[1]}`, confidence: 0.62 }

  const sector = text.match(/\bsector\s*(\d{1,3})\b/)
  if (sector) return { label: `Sector ${sector[1]}`, confidence: 0.6 }

  // Only accept a street name when it explicitly ends in a place-type word.
  // Deliberately no "near / ke saamne" heuristic: that shape captures whole
  // sentences ("ke saamne teen hafte se kachra..."), and a wrong location sends
  // the complaint to the wrong desk. Better to ask.
  const street = text.match(
    /\b([a-z\u0900-\u097F]+(?:\s+[a-z\u0900-\u097F]+){0,3})\s+(road|street|marg|colony|nagar|vihar|enclave|gali|chowk|park)\b/,
  )
  if (street) {
    const candidate = `${street[1]} ${street[2]}`.trim()
    if (!PLACE_STOPWORDS.test(candidate)) {
      return { label: titleCase(candidate), confidence: 0.62 }
    }
  }

  return { label: null, confidence: 0 }
}

/** Words that mean the capture was actually part of a sentence, not a place. */
const PLACE_STOPWORDS =
  /\b(hai|nahi|se|mein|me|par|pada|padi|raha|rahi|hua|hui|gaya|gayi|bahut|koi|kuch|ko|ne|tha|thi|aa)\b/i

function extractDurationDays(text: string): number | null {
  if (/\bkal\s+se\b/.test(text)) return 1
  if (/\bparso\s+se\b/.test(text)) return 2

  const unitAlternation = DURATION_UNITS.flatMap((u) => u.words)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  const numeric = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${unitAlternation})`, 'i'))
  if (numeric) {
    const value = Number(numeric[1])
    const unit = DURATION_UNITS.find((u) => u.words.some((w) => numeric[0].includes(w)))
    if (unit) return Math.max(0.5, Math.round(value * unit.days * 10) / 10)
  }

  const wordAlt = Object.keys(HINDI_NUMBERS)
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const wordy = text.match(new RegExp(`(?<![\\p{L}])(${wordAlt})\\s*(?:${unitAlternation})`, 'iu'))
  if (wordy) {
    const value = HINDI_NUMBERS[wordy[1].toLowerCase()]
    const unit = DURATION_UNITS.find((u) => u.words.some((w) => wordy[0].includes(w)))
    if (value && unit) return Math.max(0.5, Math.round(value * unit.days * 10) / 10)
  }

  return null
}

function speechLangFor(language: DetectedLanguage, fallback: SpeechLang): SpeechLang {
  switch (language) {
    case 'hi':
    case 'mixed':
      return 'hi-IN'
    case 'bn':
      return 'bn-IN'
    case 'ta':
      return 'ta-IN'
    case 'en':
      return 'en-IN'
    case 'mr':
      return 'mr-IN'
    default:
      return fallback
  }
}

/**
 * Reads a single utterance into structured fields. Deterministic by design:
 * the same words always produce the same complaint, which matters when you
 * are demonstrating it live and cannot afford a flaky model.
 */
export function analyze(
  rawText: string,
  options: { speechLang?: SpeechLang } = {},
): EngineResult {
  const text = normalize(rawText)
  const language = detectLanguage(text)
  const speechLang = speechLangFor(language, options.speechLang ?? 'hi-IN')

  const scores = scoreCategories(text)
  let topCategory: Category = 'other'
  let topScore = 0
  for (const c of CATEGORIES) {
    if (scores[c] > topScore) {
      topScore = scores[c]
      topCategory = c
    }
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  let confidence = 0
  if (total > 0 && topScore > 0) {
    confidence = Math.min(0.98, Math.max(0.35, topScore / Math.max(total, topScore + 2)))
    if (topScore >= 5) confidence = Math.max(confidence, 0.9)
    if (topScore >= 9) confidence = Math.max(confidence, 0.96)
  }

  const location = extractLocation(text)
  const urgency = URGENCY_TERMS.some((t) => containsTerm(text, t)) ? 'high' : 'normal'

  const extraction: Extraction = {
    category: topCategory,
    categoryConfidence: topCategory === 'other' ? 0 : Number(confidence.toFixed(2)),
    categoryScores: scores,
    problemEn: PROBLEM_PHRASE[topCategory].en,
    problemHi: PROBLEM_PHRASE[topCategory].hi,
    location: location.label,
    locationConfidence: location.confidence,
    durationDays: extractDurationDays(text),
    urgency,
    language,
    speechLang,
  }

  return { extraction, missing: computeMissing(extraction) }
}

export function computeMissing(extraction: Extraction): MissingField[] {
  const missing: MissingField[] = []
  if (extraction.category === 'other' || extraction.categoryConfidence < 0.55) {
    missing.push('category')
  }
  if (!extraction.location || extraction.locationConfidence < 0.55) {
    missing.push('location')
  }
  return missing
}

/**
 * Folds a follow-up answer into what we already know. Anything the user has
 * already told us survives — they should never have to repeat themselves.
 */
export function mergeExtractions(previous: Extraction, next: Extraction): Extraction {
  const merged: Extraction = { ...previous }

  if (next.category !== 'other' && next.categoryConfidence >= 0.55) {
    merged.category = next.category
    merged.categoryConfidence = next.categoryConfidence
    merged.categoryScores = next.categoryScores
    merged.problemEn = next.problemEn
    merged.problemHi = next.problemHi
  }

  if (next.location && next.locationConfidence > previous.locationConfidence) {
    merged.location = next.location
    merged.locationConfidence = next.locationConfidence
  }

  if (next.durationDays !== null && previous.durationDays === null) {
    merged.durationDays = next.durationDays
  }

  if (next.urgency === 'high') merged.urgency = 'high'

  // Keep the most recent language signal, since the user may switch mid-flow.
  if (next.language !== 'en' || previous.category === 'other') {
    merged.language = next.language
    merged.speechLang = next.speechLang
  }

  return merged
}

/** Empty starting point for a new conversation. */
export function emptyExtraction(speechLang: SpeechLang): Extraction {
  return {
    category: 'other',
    categoryConfidence: 0,
    categoryScores: {
      sanitation: 0,
      streetlight: 0,
      water: 0,
      road: 0,
      drainage: 0,
      electricity: 0,
      other: 0,
    },
    problemEn: PROBLEM_PHRASE.other.en,
    problemHi: PROBLEM_PHRASE.other.hi,
    location: null,
    locationConfidence: 0,
    durationDays: null,
    urgency: 'normal',
    language: 'hi',
    speechLang,
  }
}
