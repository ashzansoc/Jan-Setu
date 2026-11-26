import type { Category, Complaint, Department, Verification } from './types'
import { CATEGORY_LABEL } from './types'
import { resolveDepartment } from './departments'
import { composeComplaint } from './compose'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

interface SeedSpec {
  id: string
  category: Category
  /** Days ago the citizen first spoke. */
  filedAgo: number
  status: Complaint['status']
  location: string
  durationDays?: number
  urgency?: 'normal' | 'high'
  transcript: string
  reference: string | null
  /** Only set for records that reached a resolution. */
  resolvedAgo?: number
  resolutionSource?: 'official' | 'user_confirmed' | null
  verification: Verification
  approval?: Complaint['approval']
  department?: Department
  /** Distinct display title; falls back to the category label. */
  title?: string
}

const SPECS: SeedSpec[] = [
  {
    id: 'demo-draft-drainage',
    category: 'drainage',
    filedAgo: 0,
    status: 'awaiting_approval',
    location: 'Near Central Market, Lajpat Nagar, New Delhi',
    urgency: 'high',
    transcript:
      'Naali band hone ki wajah se sadak par paani jama ho raha hai. Bachche school jaate waqt phisal jaate hain. Kripya jaldi safai karwaiye.',
    reference: null,
    approval: 'pending',
    verification: { mode: 'none', source: '', verifiedAt: null },
  },
  {
    id: 'demo-active-sanitation',
    category: 'sanitation',
    filedAgo: 3,
    status: 'acknowledged',
    location: 'Greater Kailash 2, New Delhi',
    durationDays: 21,
    transcript:
      'Mere ghar ke saamne teen hafte se kachra pada hai. Bahut badbu aa rahi hai. Koi safai karne nahi aa raha.',
    reference: 'MCD-SAN-24-88142',
    verification: { mode: 'sandbox', source: 'JANSETU sandbox', verifiedAt: new Date(Date.now() - 2 * HOUR).toISOString() },
  },
  {
    id: 'demo-assisted-water',
    category: 'water',
    filedAgo: 2,
    status: 'assisted_filing',
    location: 'Sangam Vihar, New Delhi',
    durationDays: 4,
    urgency: 'high',
    transcript:
      'Chaar din se hamare ilaake mein paani nahi aa raha. Tanki khali hai. Kaafi takleef ho rahi hai.',
    reference: null,
    verification: { mode: 'assisted', source: 'Delhi Jal Board helpline', verifiedAt: null },
  },
  {
    id: 'demo-resolved-streetlight',
    title: 'Streetlight not working',
    category: 'streetlight',
    filedAgo: 12,
    status: 'resolved',
    location: 'Block M, Greater Kailash 2, New Delhi',
    transcript: 'Block M ki gali mein streetlight teen din se band hai. Raat ko bahut andhera rehta hai.',
    reference: 'MCD-ELE-24-70311',
    resolvedAgo: 2,
    resolutionSource: 'official',
    verification: { mode: 'sandbox', source: 'JANSETU sandbox', verifiedAt: new Date(Date.now() - 2 * DAY).toISOString() },
  },
  {
    id: 'demo-resolved-pothole',
    title: 'Pothole on Outer Ring Road',
    category: 'road',
    filedAgo: 20,
    status: 'resolved',
    location: 'Outer Ring Road, near Munirka flyover, New Delhi',
    durationDays: 30,
    transcript: 'Outer Ring Road par bahut bada pothole hai. Gaadiyan phans jaati hain.',
    reference: 'MCD-RD-24-57740',
    resolvedAgo: 8,
    resolutionSource: 'user_confirmed',
    verification: { mode: 'user', source: 'Confirmed by you', verifiedAt: new Date(Date.now() - 8 * DAY).toISOString() },
  },
  {
    id: 'demo-resolved-drain',
    title: 'Drainage overflow',
    category: 'drainage',
    filedAgo: 26,
    status: 'resolved',
    location: 'Kalkaji Extension, New Delhi',
    transcript: 'Kalkaji mein nala overflow ho raha hai, gali mein paani bhar gaya hai.',
    reference: 'MCD-DRN-24-66012',
    resolvedAgo: 19,
    resolutionSource: 'official',
    verification: { mode: 'sandbox', source: 'JANSETU sandbox', verifiedAt: new Date(Date.now() - 19 * DAY).toISOString() },
  },
  {
    id: 'demo-resolved-garbage',
    title: 'Garbage not collected',
    category: 'sanitation',
    filedAgo: 34,
    status: 'resolved',
    location: 'Saket, New Delhi',
    transcript: 'Saket ke market ke peeche kachra jama hai, safai nahi ho rahi.',
    reference: 'MCD-SAN-24-61930',
    resolvedAgo: 27,
    resolutionSource: 'official',
    verification: { mode: 'sandbox', source: 'JANSETU sandbox', verifiedAt: new Date(Date.now() - 27 * DAY).toISOString() },
  },
  {
    id: 'demo-resolved-lamp',
    title: 'Streetlight flickering',
    category: 'streetlight',
    filedAgo: 44,
    status: 'resolved',
    location: 'Chittaranjan Park, New Delhi',
    transcript: 'CR Park ki gali mein streetlight flicker kar rahi hai, raat ko band ho jaati hai.',
    reference: 'MCD-ELE-24-58871',
    resolvedAgo: 36,
    resolutionSource: 'official',
    verification: { mode: 'sandbox', source: 'JANSETU sandbox', verifiedAt: new Date(Date.now() - 36 * DAY).toISOString() },
  },
]

function titleFor(spec: SeedSpec): string {
  const base = CATEGORY_LABEL[spec.category].en
  if (spec.category === 'water' && spec.durationDays) {
    return `No water supply · ${spec.durationDays} days`
  }
  if (spec.category === 'road' && /outer ring/i.test(spec.location)) {
    return 'Pothole on Outer Ring Road'
  }
  return base
}

function timelineFor(spec: SeedSpec, filedAt: number, now: number): Complaint['timeline'] {
  const at = (offsetMinutes: number) => new Date(filedAt + offsetMinutes * MINUTE).toISOString()
  const steps: Complaint['timeline'] = [
    { step: 'request', at: at(0) },
    { step: 'understanding', at: at(1) },
    { step: 'location', at: at(2) },
    { step: 'department', at: at(3) },
    { step: 'generation', at: at(4) },
    { step: 'consent', at: at(5) },
  ]

  if (spec.status === 'awaiting_approval') return steps.slice(0, 5)
  if (spec.status === 'assisted_filing') {
    steps.push({ step: 'assisted_filing', at: at(6) })
    return steps
  }

  steps.push({ step: 'submission', at: at(6) })
  if (spec.status !== 'submitted') {
    steps.push({ step: 'acknowledgement', at: new Date(filedAt + 4 * HOUR).toISOString() })
  }
  if (spec.status === 'in_progress') {
    steps.push({ step: 'in_progress', at: new Date(now - DAY).toISOString() })
  }
  if (spec.resolutionSource) {
    steps.push({ step: 'resolution', at: new Date(now - (spec.resolvedAgo ?? 1) * DAY).toISOString() })
    if (spec.resolutionSource === 'user_confirmed') {
      steps.push({ step: 'user_confirmed', at: new Date(now - (spec.resolvedAgo ?? 1) * DAY + HOUR).toISOString() })
    }
  }
  return steps
}

/**
 * Eight records that show every state the product knows about: one draft
 * awaiting approval, one acknowledged complaint, one that needs assisted filing
 * because its department has no online channel, and five resolutions — four
 * official, one confirmed by the citizen.
 */
export function createSeedComplaints(now: number = Date.now()): Complaint[] {
  return SPECS.map((spec) => {
    const filedAt = now - spec.filedAgo * DAY - (spec.status === 'awaiting_approval' ? 10 * MINUTE : 0)
    const location = { label: spec.location }
    const department = spec.department ?? resolveDepartment(spec.category, spec.location)
    const { body } = composeComplaint(
      {
        category: spec.category,
        locationLabel: spec.location,
        durationDays: spec.durationDays ?? null,
        urgency: spec.urgency ?? 'normal',
        department,
        transcript: spec.transcript,
      },
      'en',
    )

    const resolvedAt = spec.resolvedAgo ? new Date(now - spec.resolvedAgo * DAY).toISOString() : null

    return {
      id: spec.id,
      userId: 'demo-citizen',
      category: spec.category,
      title: spec.title ?? titleFor(spec),
      problem: CATEGORY_LABEL[spec.category].en,
      description: body,
      transcript: spec.transcript,
      language: 'en' as const,
      speechLang: 'hi-IN' as const,
      location,
      department,
      durationDays: spec.durationDays,
      urgency: spec.urgency ?? 'normal',
      createdAt: new Date(filedAt).toISOString(),
      preparedAt: new Date(
        spec.status === 'awaiting_approval' ? filedAt : filedAt + 5 * MINUTE,
      ).toISOString(),
      submittedAt: spec.reference ? new Date(filedAt + 6 * MINUTE).toISOString() : null,
      resolvedAt,
      updatedAt: resolvedAt ?? new Date(now - (spec.status === 'awaiting_approval' ? 10 * MINUTE : 2 * HOUR)).toISOString(),
      reference: spec.reference,
      status: spec.status,
      approval: spec.approval ?? (spec.status === 'awaiting_approval' ? 'pending' : 'approved'),
      verification: spec.verification,
      resolutionSource: spec.resolutionSource ?? null,
      userConfirmedResolution: spec.resolutionSource === 'user_confirmed',
      isDemo: true,
      timeline: timelineFor(spec, filedAt, now),
    }
  })
}
