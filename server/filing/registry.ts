/**
 * JANSETU Service Registry — verified official government destinations.
 *
 * The orchestrator may ONLY navigate to URLs present here (destination
 * validation). Each entry records what the service needs so the engine can
 * pre-fill Category A fields and know which Category B/C/D/E fields to hand
 * to the citizen. `lastVerified` is a manual audit date — re-verify before
 * relying on a portal in production.
 */

export interface ServiceField {
  id: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'date' | 'file'
  required: boolean
  /** A/B/C/D/E — see filing/classify.ts */
  category: 'A' | 'B' | 'C' | 'D' | 'E'
  sensitive?: boolean
}

export interface GovService {
  id: string
  department: string
  name: string
  jurisdiction: string
  officialWebsite: string
  applicationUrl: string
  /** Verified public contact, when the department publishes one. */
  officialEmail?: string
  operations: string[]
  requiredInfo: ServiceField[]
  requiredDocuments: string[]
  authRequirements: string[]
  knownLimitations?: string
  lastVerified: string // ISO date
}

const VERIFIED = '2026-11-25'

export const SERVICE_REGISTRY: GovService[] = [
  {
    id: 'jal-board-water-complaint',
    department: 'Delhi Jal Board',
    name: 'Water Complaint Registration',
    jurisdiction: 'Delhi / NCT',
    officialWebsite: 'https://www.delhijalboard.nic.in',
    applicationUrl: 'https://www.delhijalboard.nic.in/citizen/complaint',
    operations: ['register-complaint', 'track-status'],
    requiredInfo: [
      { id: 'name', label: 'Applicant Name', type: 'text', required: true, category: 'A' },
      { id: 'mobile', label: 'Registered Mobile', type: 'text', required: true, category: 'A' },
      { id: 'address', label: 'Address', type: 'textarea', required: true, category: 'A' },
      { id: 'consumer_id', label: 'Consumer ID', type: 'text', required: true, category: 'B' },
      { id: 'category', label: 'Complaint Category', type: 'select', required: true, category: 'A' },
      { id: 'description', label: 'Complaint Description', type: 'textarea', required: true, category: 'A' },
      { id: 'aadhaar', label: 'Aadhaar / Citizen ID', type: 'text', required: false, category: 'C', sensitive: true },
      { id: 'captcha', label: 'Security Captcha', type: 'text', required: true, category: 'D' },
    ],
    requiredDocuments: [],
    authRequirements: ['mobile-otp'],
    knownLimitations: 'Consumer ID is mandatory and not derivable from the profile.',
    lastVerified: VERIFIED,
  },
  {
    id: 'mcd-grievance-complaint',
    department: 'Municipal Corporation of Delhi',
    name: 'Public Grievance / Solid Waste Complaint',
    jurisdiction: 'Delhi / NCT',
    officialWebsite: 'https://mcdonline.nic.in',
    applicationUrl: 'https://mcdonline.nic.in/citizen/portal/login',
    operations: ['register-complaint', 'track-status'],
    requiredInfo: [
      { id: 'name', label: 'Applicant Name', type: 'text', required: true, category: 'A' },
      { id: 'mobile', label: 'Registered Mobile', type: 'text', required: true, category: 'A' },
      { id: 'ward', label: 'Ward & Zone', type: 'text', required: true, category: 'A' },
      { id: 'category', label: 'Complaint Category', type: 'select', required: true, category: 'A' },
      { id: 'description', label: 'Complaint Details', type: 'textarea', required: true, category: 'A' },
      { id: 'aadhaar', label: 'Aadhaar / Citizen ID', type: 'text', required: false, category: 'C', sensitive: true },
      { id: 'captcha', label: 'Security Captcha', type: 'text', required: true, category: 'D' },
    ],
    requiredDocuments: [],
    authRequirements: ['mobile-otp'],
    knownLimitations: 'Captcha is mandatory and must be completed by the citizen.',
    lastVerified: VERIFIED,
  },
  {
    id: 'tatapower-delhi-electricity',
    department: 'Tata Power Delhi Distribution',
    name: 'Electricity Supply & Billing Complaint',
    jurisdiction: 'Delhi / NCT',
    officialWebsite: 'https://www.tatapowerdelhi.com',
    applicationUrl: 'https://www.tatapowerdelhi.com',
    operations: ['register-complaint', 'track-status', 'billing-query'],
    requiredInfo: [
      { id: 'name', label: 'Applicant Name', type: 'text', required: true, category: 'A' },
      { id: 'mobile', label: 'Registered Mobile', type: 'text', required: true, category: 'A' },
      { id: 'address', label: 'Supply Address', type: 'textarea', required: true, category: 'A' },
      { id: 'consumer_id', label: 'Consumer / Account Number', type: 'text', required: true, category: 'B' },
      { id: 'category', label: 'Complaint Category', type: 'select', required: true, category: 'A' },
      { id: 'description', label: 'Complaint Details', type: 'textarea', required: true, category: 'A' },
      { id: 'captcha', label: 'Security Captcha', type: 'text', required: true, category: 'D' },
    ],
    requiredDocuments: [],
    authRequirements: ['mobile-otp'],
    knownLimitations:
      'Complaint form path must be confirmed on the live portal; navigation is restricted to the official domain.',
    lastVerified: VERIFIED,
  },
]

/** Resolve a free-text request to a registry service by keyword match. */
export function discoverService(query: string): GovService | null {
  const q = query.toLowerCase()
  // direct id / url hit
  const byId = SERVICE_REGISTRY.find((s) => q.includes(s.id) || q.includes(s.applicationUrl))
  if (byId) return byId
  const keywords: Record<string, string[]> = {
    'jal-board-water-complaint': ['jal board', 'delhi jal', 'water', 'paani', 'पानी', 'जल'],
    'mcd-grievance-complaint': ['mcd', 'municipal', 'ward', 'garbage', 'kachra', 'कचरा', 'सफाई'],
    'tatapower-delhi-electricity': [
      'electricity',
      'bijli',
      'power cut',
      'load shedding',
      'meter',
      'बिजली',
    ],
  }
  for (const s of SERVICE_REGISTRY) {
    if ((keywords[s.id] ?? []).some((k) => q.includes(k))) return s
  }
  return null
}

/** Destination validation — refuse any URL not in the registry. */
export function isApprovedDestination(url: string): boolean {
  return SERVICE_REGISTRY.some(
    (s) => url === s.applicationUrl || url === s.officialWebsite || url.startsWith(s.officialWebsite),
  )
}