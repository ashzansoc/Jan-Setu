/**
 * Core domain vocabulary for JANSETU.
 *
 * Kept in one place so the voice layer, the intent engine, the connectors and
 * the UI all speak about complaints using identical terms.
 */

export type Category =
  | 'sanitation'
  | 'streetlight'
  | 'water'
  | 'road'
  | 'drainage'
  | 'electricity'
  | 'other'

/**
 * The full lifecycle. `draft` exists so a conversation can be paused before it
 * is even ready to show; anything a citizen sees as "waiting for your yes" is
 * `awaiting_approval`.
 */
export type ComplaintStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'submitted'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'assisted_filing'
  | 'user_confirmed_submission'
  | 'reopened'
  | 'rejected'
  | 'failed'

/** The four publicly visible stages, derived from status for the tracker. */
export type Stage = 'prepared' | 'submitted' | 'acknowledged' | 'resolved'

export const STAGE_ORDER: Stage[] = ['prepared', 'submitted', 'acknowledged', 'resolved']

/** Coarse buckets used by the summary cards and the filter pills. */
export type StatusGroup = 'approval' | 'active' | 'resolved' | 'closed'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

/**
 * Where the claim "this was submitted / resolved" came from.
 * Only `live` may ever be presented as an official system response.
 */
export type VerificationMode = 'live' | 'sandbox' | 'user' | 'assisted' | 'none'

export type ResolutionSource = 'official' | 'user_confirmed'

/** UI language. Hindi, English and Roman-script Hinglish ship fully translated. */
export type UiLang = 'hi' | 'en' | 'hinglish'

/** BCP-47 tags handed to speech recognition + synthesis. */
export type SpeechLang = 'hi-IN' | 'en-IN' | 'bn-IN' | 'ta-IN' | 'mr-IN'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface ComplaintLocation {
  /** Human-readable label, e.g. "Greater Kailash 2, New Delhi" */
  label: string
  point?: GeoPoint
}

export interface Department {
  id: string
  name: string
  jurisdiction: string
  /** Which connector can actually receive this department's complaints. */
  connectorId: string
  /** Null means no online filing channel is known for this body. */
  onlineFiling: boolean
  helpline?: string
}

export interface Verification {
  mode: VerificationMode
  /** e.g. "MCD portal" — only naming a real system when mode === 'live'. */
  source: string
  verifiedAt: string | null
}

export type TimelineStep =
  | 'request'
  | 'understanding'
  | 'location'
  | 'department'
  | 'generation'
  | 'consent'
  | 'submission'
  | 'acknowledgement'
  | 'in_progress'
  | 'resolution'
  | 'reopened'
  | 'amendment'
  | 'assisted_filing'
  | 'user_confirmed'

/**
 * A timeline entry records only what happened and when. All wording is derived
 * at render time from the complaint itself, so the history reads correctly in
 * Hindi or English even for a complaint recorded months earlier.
 */
export interface TimelineEvent {
  step: TimelineStep
  at: string
  /** Free-form detail the history needs but the dictionary cannot supply. */
  note?: string
}

export interface Complaint {
  id: string
  userId: string
  category: Category
  /** Formal subject line, e.g. "Garbage accumulation — Greater Kailash 2". */
  title: string
  problem: string
  /** Composed formal body sent to the department. */
  description: string
  /** The citizen's own words, preserved verbatim. */
  transcript: string
  language: UiLang
  speechLang: SpeechLang
  location: ComplaintLocation
  department: Department
  durationDays?: number
  urgency: 'normal' | 'high'

  createdAt: string
  preparedAt: string
  submittedAt: string | null
  resolvedAt: string | null
  updatedAt: string

  reference: string | null
  status: ComplaintStatus
  approval: ApprovalStatus
  verification: Verification
  resolutionSource: ResolutionSource | null
  userConfirmedResolution: boolean

  /** Seeded / sample records are flagged so the UI can tag them. */
  isDemo: boolean
  timeline: TimelineEvent[]
}

/** A draft handed from the conversation to the complaint store. */
export interface ComplaintDraft {
  category: Category
  problem: string
  description: string
  location: ComplaintLocation
  durationDays?: number
  urgency: 'normal' | 'high'
  department: Department
  speechLang: SpeechLang
  /** The user's own words, preserved verbatim for the replay. */
  transcript: string
}

export const CATEGORY_LABEL: Record<Category, { en: string; hi: string; hinglish: string }> = {
  sanitation: { en: 'Garbage accumulation', hi: 'कचरा जमा होना', hinglish: 'Kachra jama hona' },
  streetlight: { en: 'Streetlight not working', hi: 'स्ट्रीटलाइट खराब', hinglish: 'Streetlight band hai' },
  water: { en: 'Water supply interruption', hi: 'पानी की आपूर्ति बाधित', hinglish: 'Paani ki supply band' },
  road: { en: 'Road damage', hi: 'सड़क क्षतिग्रस्त', hinglish: 'Sadak kharab' },
  drainage: { en: 'Drainage blockage', hi: 'नाली जाम', hinglish: 'Naali jam' },
  electricity: {
    en: 'Electricity supply problem',
    hi: 'बिजली की समस्या',
    hinglish: 'Bijli ki samasya',
  },
  other: { en: 'Civic issue', hi: 'नागरिक समस्या', hinglish: 'Nagrik samasya' },
}
