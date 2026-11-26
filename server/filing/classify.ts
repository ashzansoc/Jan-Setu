/**
 * Field classification + provenance.
 *
 * Every detected field is one of five categories (A–E) and carries a
 * provenance so the UI never presents AI-generated data as verified personal
 * information. Sensitive values (Category C) and human-verification answers
 * (Category D) must never enter the LLM context, ordinary logs, or Action
 * Replay.
 */
import type { ServiceField } from './registry.js'

export type FieldCategory = 'A' | 'B' | 'C' | 'D' | 'E'
export type Provenance =
  | 'profile'
  | 'confirmed'
  | 'conversation'
  | 'document'
  | 'ai-generated'
  | 'unavailable'

export interface ClassifiedField extends ServiceField {
  provenance: Provenance
  /** current value if known (never populated for C/D here) */
  value?: string
  status: 'available' | 'missing' | 'sensitive' | 'needs-human'
}

export interface ProfileSnapshot {
  name?: string
  mobile?: string
  address?: string
  email?: string
  ward?: string
}

/** Map a registry field to a profile key, if Category A and reusable. */
const PROFILE_KEY: Record<string, keyof ProfileSnapshot> = {
  name: 'name',
  mobile: 'mobile',
  address: 'address',
  email: 'email',
  ward: 'ward',
}

export function classifyFields(
  fields: ServiceField[],
  profile: ProfileSnapshot,
): ClassifiedField[] {
  return fields.map((f) => {
    if (f.category === 'C') return { ...f, provenance: 'unavailable', status: 'sensitive' }
    if (f.category === 'D') return { ...f, provenance: 'unavailable', status: 'needs-human' }
    if (f.category === 'E') return { ...f, provenance: 'unavailable', status: 'missing' }

    const key = PROFILE_KEY[f.id]
    const fromProfile = key ? profile[key] : undefined
    if (f.category === 'A' && fromProfile) {
      return { ...f, provenance: 'profile', value: fromProfile, status: 'available' }
    }
    // Category A with no profile value, or Category B → user input required
    return { ...f, provenance: 'unavailable', status: 'missing' }
  })
}

/** The next field the citizen must act on (B/C/D/E), in registry order. */
export function nextActionable(fields: ClassifiedField[]): ClassifiedField | null {
  return fields.find((f) => f.status === 'missing' || f.status === 'sensitive' || f.status === 'needs-human') ?? null
}

/** Never allow secrets/verification answers into logs or replay. */
export function redact(field: ClassifiedField, value: string): string {
  if (field.category === 'C' || field.category === 'D') return '••••••'
  return value
}