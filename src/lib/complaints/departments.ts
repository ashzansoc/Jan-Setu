import type { Category, Department } from './types'

/**
 * Municipal ownership, which determines where a complaint can be filed — and
 * whether it can be filed online at all. `onlineFiling: false` is not a bug: it
 * is what makes JANSETU fall back to assisted filing instead of pretending.
 */
export const DEPARTMENTS: Record<Category, Department> = {
  sanitation: {
    id: 'mcd-sanitation',
    name: 'Municipal Sanitation Department',
    jurisdiction: 'Municipal Corporation of Delhi',
    connectorId: 'mcd',
    onlineFiling: true,
  },
  streetlight: {
    id: 'mcd-electrical',
    name: 'Street Lighting & Electrical Department',
    jurisdiction: 'Municipal Corporation of Delhi',
    connectorId: 'mcd',
    onlineFiling: true,
  },
  water: {
    id: 'djb-water',
    name: 'Water Supply & Sewerage Board',
    jurisdiction: 'Delhi Jal Board',
    connectorId: 'helpline',
    onlineFiling: false,
    helpline: '1916',
  },
  road: {
    id: 'mcd-engineering',
    name: 'Roads & Engineering Department',
    jurisdiction: 'Municipal Corporation of Delhi',
    connectorId: 'mcd',
    onlineFiling: true,
  },
  drainage: {
    id: 'mcd-drainage',
    name: 'Drainage & Sewerage Department',
    jurisdiction: 'Municipal Corporation of Delhi',
    connectorId: 'mcd',
    onlineFiling: true,
  },
  electricity: {
    id: 'discom-electricity',
    name: 'Electricity Distribution Company',
    jurisdiction: 'Delhi',
    connectorId: 'mcd',
    onlineFiling: true,
  },
  other: {
    id: 'mcd-general',
    name: 'Citizen Grievance Cell',
    jurisdiction: 'Municipal Corporation of Delhi',
    connectorId: 'mcd',
    onlineFiling: true,
  },
}

const NCR_AUTHORITY: { match: RegExp; name: string; id: string }[] = [
  { match: /noida/i, name: 'Noida Authority', id: 'noida-authority' },
  { match: /gurugram|gurgaon/i, name: 'Municipal Corporation of Gurugram', id: 'mcg-gurugram' },
  { match: /ghaziabad|indirapuram|vaishali/i, name: 'Ghaziabad Municipal Corporation', id: 'gmc-ghaziabad' },
  { match: /faridabad/i, name: 'Faridabad Municipal Corporation', id: 'fmc-faridabad' },
]

/**
 * Picks the owning body from the category, then overrides the jurisdiction when
 * the location is outside Delhi. Jurisdiction mistakes are the single most
 * common reason a civic complaint goes nowhere, so this is explicit.
 */
export function resolveDepartment(category: Category, locationLabel: string): Department {
  const base = DEPARTMENTS[category]
  const ncr = NCR_AUTHORITY.find((a) => a.match.test(locationLabel))
  if (!ncr) return base
  return {
    ...base,
    id: `${ncr.id}-${category}`,
    jurisdiction: ncr.name,
  }
}
