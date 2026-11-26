import type { Provenance } from './types'
import { useSettings } from '@/state/settings'
import { usePlaces } from '@/state/places'
import { useComplaints } from '@/state/complaints'

/**
 * User context.
 *
 * Every value carries its provenance, and nothing is invented. A field the
 * citizen has never confirmed comes back as `null` with `unknown` provenance so
 * the planner asks instead of guessing.
 */

export interface ContextField {
  value: string | null
  provenance: Provenance
}

export interface UserContext {
  name: ContextField
  phone: ContextField
  email: ContextField
  address: ContextField
  locality: ContextField
  pincode: ContextField
  language: ContextField
  consumerNumber: ContextField
  recentReferences: string[]
}

const EMPTY: ContextField = { value: null, provenance: 'unknown' }

export function buildUserContext(): UserContext {
  const settings = useSettings.getState()
  const places = usePlaces.getState()
  const complaints = useComplaints.getState().complaints

  const defaultPlace = places.places.find((place) => place.isDefault) ?? places.places[0]

  const address = defaultPlace
    ? [defaultPlace.line1, defaultPlace.locality, defaultPlace.pincode].filter(Boolean).join(', ')
    : null

  return {
    name: settings.name ? { value: settings.name, provenance: 'verified_profile' } : EMPTY,
    phone: EMPTY,
    email: EMPTY,
    address: address ? { value: address, provenance: 'user_confirmed' } : EMPTY,
    locality: defaultPlace?.locality
      ? { value: defaultPlace.locality, provenance: 'user_confirmed' }
      : EMPTY,
    pincode: defaultPlace?.pincode
      ? { value: defaultPlace.pincode, provenance: 'user_confirmed' }
      : EMPTY,
    language: { value: settings.uiLang, provenance: 'verified_profile' },
    // Consumer identifiers are never stored today; asking is the honest path.
    consumerNumber: EMPTY,
    recentReferences: complaints
      .map((complaint) => complaint.reference)
      .filter((reference): reference is string => Boolean(reference))
      .slice(0, 5),
  }
}

export function getContextField(context: UserContext, field: string): ContextField {
  const record = context as unknown as Record<string, ContextField | string[]>
  const value = record[field]
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as ContextField
  return EMPTY
}

/** Fields the engine may reuse without asking, and their provenance. */
export function reusableFields(context: UserContext): { field: string; provenance: Provenance }[] {
  return Object.entries(context)
    .filter(([, value]) => value && typeof value === 'object' && 'provenance' in (value as object))
    .filter(([, value]) => (value as ContextField).value !== null)
    .map(([field, value]) => ({ field, provenance: (value as ContextField).provenance }))
}

/** Only these provenances may be reused without fresh confirmation. */
export function isTrustedProvenance(provenance: Provenance): boolean {
  return provenance === 'verified_profile' || provenance === 'user_confirmed'
}