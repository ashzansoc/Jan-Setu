import {
  ORGANISATIONS,
  findOrganisation,
  type Organisation,
  type OrgService,
  type ServiceCategory,
} from './org-registry'

/**
 * Organisation & Service Discovery.
 *
 * The critical rule from the product spec: never pick an organisation because
 * the user mentioned a category. Resolve it from evidence, and when the
 * evidence is insufficient, ask — do not guess.
 */

export interface DiscoveryRequest {
  category: ServiceCategory
  /** Free-text locality the user gave, e.g. "Greater Kailash 2". */
  locality?: string
  /** A provider the user named, e.g. "BSES". */
  providerHint?: string
  purpose?: OrgService['purpose']
}

export type DiscoveryOutcome =
  | {
      status: 'resolved'
      organisation: Organisation
      service: OrgService
      /** How the organisation was chosen — surfaced to the user. */
      basis: 'provider-named' | 'jurisdiction' | 'single-provider'
    }
  | {
      status: 'ambiguous'
      /** The options the user must choose between. */
      candidates: Organisation[]
      /** A question JANSETU should ask, already phrased for voice. */
      questionKey: 'whichElectricityProvider' | 'whichOrganisation'
    }
  | { status: 'unsupported'; category: ServiceCategory }

/**
 * Delhi distribution areas, at the resolution we can defend.
 *
 * These are broad, published service areas — not ward-level truth. A locality
 * that falls in an overlap returns `ambiguous` rather than a guess.
 */
const DELHI_ELECTRICITY_AREAS: { organisationId: string; localities: string[] }[] = [
  {
    organisationId: 'bses.brpl',
    localities: [
      'greater kailash',
      'gk',
      'saket',
      'malviya nagar',
      'hauz khas',
      'vasant kunj',
      'dwarka',
      'janakpuri',
      'rajouri garden',
      'punjabi bagh',
      'lajpat nagar',
      'kalkaji',
      'nehru place',
      'defence colony',
      'south extension',
    ],
  },
  {
    organisationId: 'bses.bypl',
    localities: [
      'yamuna vihar',
      'shahdara',
      'laxmi nagar',
      'preet vihar',
      'mayur vihar',
      'patparganj',
      'krishna nagar',
      'gandhi nagar',
      'geeta colony',
      'chandni chowk',
      'daryaganj',
    ],
  },
  {
    organisationId: 'tpddl',
    localities: [
      'rohini',
      'pitampura',
      'shalimar bagh',
      'model town',
      'civil lines',
      'burari',
      'narela',
      'bawana',
      'karol bagh',
      'paschim vihar',
      'ashok vihar',
      'adarsh nagar',
    ],
  },
]

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function matchesLocality(locality: string, candidate: string): boolean {
  const target = normalise(locality)
  const needle = normalise(candidate)
  if (!target || !needle) return false
  // Word-boundary-ish match so "gk" does not match "kg".
  return ` ${target} `.includes(` ${needle} `) || target.includes(needle)
}

function providerFromHint(hint?: string): string | null {
  if (!hint) return null
  const value = normalise(hint)
  if (/\bbrpl\b|rajdhani/.test(value)) return 'bses.brpl'
  if (/\bbypl\b|yamuna power/.test(value)) return 'bses.bypl'
  if (/\btpddl\b|tata power/.test(value)) return 'tpddl'
  return null
}

export function discover(request: DiscoveryRequest): DiscoveryOutcome {
  const { category, locality, providerHint, purpose = 'complaint' } = request

  if (category === 'electricity') {
    // 1. A named provider is the strongest evidence.
    const fromHint = providerFromHint(providerHint)
    if (fromHint) {
      const organisation = findOrganisation(fromHint)
      const service = organisation?.services.find((entry) => entry.purpose === purpose)
      if (organisation && service) return { status: 'resolved', organisation, service, basis: 'provider-named' }
    }

    // 2. Otherwise derive it from the locality.
    if (locality) {
      const hits = DELHI_ELECTRICITY_AREAS.filter((area) =>
        area.localities.some((candidate) => matchesLocality(locality, candidate)),
      )
      if (hits.length === 1) {
        const organisation = findOrganisation(hits[0].organisationId)
        const service = organisation?.services.find((entry) => entry.purpose === purpose)
        if (organisation && service) return { status: 'resolved', organisation, service, basis: 'jurisdiction' }
      }
      if (hits.length > 1) {
        return {
          status: 'ambiguous',
          candidates: hits.map((hit) => findOrganisation(hit.organisationId)!).filter(Boolean),
          questionKey: 'whichElectricityProvider',
        }
      }
    }

    // 3. No evidence — ask which provider their bill names.
    return {
      status: 'ambiguous',
      candidates: ['bses.brpl', 'bses.bypl', 'tpddl'].map((id) => findOrganisation(id)!).filter(Boolean),
      questionKey: 'whichElectricityProvider',
    }
  }

  // Categories served by exactly one organisation resolve directly.
  const single = ORGANISATIONS.find((organisation) => organisation.category === category)
  if (single) {
    const service = single.services.find((entry) => entry.purpose === purpose) ?? single.services[0]
    if (service) return { status: 'resolved', organisation: single, service, basis: 'single-provider' }
  }

  return { status: 'unsupported', category }
}

/** Public shape for the client: no limitations text, no unverified guarantees. */
export function toPublicOrganisation(organisation: Organisation) {
  return {
    id: organisation.id,
    name: organisation.name,
    category: organisation.category,
    jurisdiction: organisation.jurisdiction,
    officialUrl: organisation.officialUrl,
    verification: organisation.verification,
    services: organisation.services.map((service) => ({
      id: service.id,
      label: service.label,
      purpose: service.purpose,
      identifiers: service.identifiers,
      auth: service.auth,
    })),
  }
}