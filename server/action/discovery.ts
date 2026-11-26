import { SERVICE_REGISTRY, type GovService } from '../filing/registry.js'

/**
 * Government service discovery.
 *
 * Only the verified registry is searched — never a live web search whose top
 * result happens to contain a department's name. Entries carry the date they
 * were last checked so the UI can be honest about freshness.
 */

export interface ServiceSummary {
  id: string
  department: string
  name: string
  jurisdiction: string
  officialUrl: string
  serviceUrl: string
  officialEmail?: string
  operations: string[]
  verifiedAt: string
  knownLimitations?: string
}

export function toSummary(service: GovService): ServiceSummary {
  return {
    id: service.id,
    department: service.department,
    name: service.name,
    jurisdiction: service.jurisdiction,
    officialUrl: service.officialWebsite,
    serviceUrl: service.applicationUrl,
    ...(service.officialEmail ? { officialEmail: service.officialEmail } : {}),
    operations: service.operations,
    verifiedAt: service.lastVerified,
    ...(service.knownLimitations ? { knownLimitations: service.knownLimitations } : {}),
  }
}

const KEYWORDS: Record<string, string[]> = {
  'jal-board-water-complaint': ['jal board', 'delhi jal', 'water', 'paani', 'pani', 'पानी', 'जल', 'tanki'],
  'mcd-grievance-complaint': [
    'mcd',
    'municipal',
    'ward',
    'garbage',
    'kachra',
    'kooda',
    'safai',
    'streetlight',
    'batti',
    'road',
    'pothole',
    'naali',
    'drain',
    'कचरा',
    'सफाई',
    'नाली',
  ],
  'tatapower-delhi-electricity': [
    'electricity',
    'bijli',
    'power cut',
    'load shedding',
    'meter',
    'bill',
    'बिजली',
    'मीटर',
  ],
}

export function searchServices(query: string, location?: string): ServiceSummary[] {
  const text = (query || '').toLowerCase()
  if (!text.trim()) return SERVICE_REGISTRY.map(toSummary)

  const scored = SERVICE_REGISTRY.map((service) => {
    const keywords = KEYWORDS[service.id] ?? []
    const score = keywords.reduce((sum, keyword) => (text.includes(keyword) ? sum + 1 : sum), 0)
    return { service, score }
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  const matches = scored.map((entry) => toSummary(entry.service))
  if (matches.length > 0) return matches

  // A location alone can still resolve a city-level body.
  if (location) {
    const byJurisdiction = SERVICE_REGISTRY.filter((service) =>
      service.jurisdiction.toLowerCase().includes(location.toLowerCase()),
    )
    if (byJurisdiction.length) return byJurisdiction.map(toSummary)
  }

  return []
}

export function findService(id: string): GovService | undefined {
  return SERVICE_REGISTRY.find((service) => service.id === id)
}

export { SERVICE_REGISTRY }