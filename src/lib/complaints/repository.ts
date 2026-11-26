import type { Complaint } from './types'
import { CATEGORY_LABEL } from './types'
import { resolveDepartment } from './departments'
import { createSeedComplaints } from './seed'

const KEY = 'jansetu.complaints.v1'
const VERSION = 2

interface Envelope {
  version: number
  complaints: Complaint[]
}

/**
 * Local-first repository. Every read/write goes through here so that moving to
 * a Postgres-backed API later is a single-file change.
 */
export interface ComplaintRepository {
  load(): Complaint[]
  save(complaints: Complaint[]): void
  clear(): void
  exportJson(): string
}

type LegacyRecord = Partial<Complaint> & {
  stage?: 'prepared' | 'submitted' | 'acknowledged' | 'resolved'
}

const STAGE_TO_STATUS: Record<string, Complaint['status']> = {
  prepared: 'awaiting_approval',
  submitted: 'submitted',
  acknowledged: 'acknowledged',
  resolved: 'resolved',
}

/** Brings a v1 record forward without losing anything the citizen recorded. */
function migrateRecord(record: LegacyRecord): Complaint {
  const category = record.category ?? 'other'
  const location = record.location ?? { label: 'Location not recorded' }
  const status = record.status ?? STAGE_TO_STATUS[record.stage ?? 'prepared'] ?? 'awaiting_approval'
  const createdAt = record.createdAt ?? new Date().toISOString()
  const updatedAt = record.updatedAt ?? createdAt
  const resolved = status === 'resolved'

  return {
    id: record.id ?? `migrated-${Math.random().toString(36).slice(2, 9)}`,
    userId: record.userId ?? 'local-user',
    category,
    title: record.title ?? `${CATEGORY_LABEL[category].en} — ${location.label}`,
    problem: record.problem ?? CATEGORY_LABEL[category].en,
    description: record.description ?? '',
    transcript: record.transcript ?? '',
    language: record.language ?? 'en',
    speechLang: record.speechLang ?? 'hi-IN',
    location,
    department: resolveDepartment(category, location.label),
    durationDays: record.durationDays,
    urgency: record.urgency ?? 'normal',
    createdAt,
    preparedAt: record.preparedAt ?? createdAt,
    submittedAt: record.submittedAt ?? (record.reference ? updatedAt : null),
    resolvedAt: record.resolvedAt ?? (resolved ? updatedAt : null),
    updatedAt,
    reference: record.reference ?? null,
    status,
    approval:
      record.approval ?? (status === 'awaiting_approval' || status === 'draft' ? 'pending' : 'approved'),
    verification: record.verification ?? { mode: 'none', source: '', verifiedAt: null },
    resolutionSource: record.resolutionSource ?? (resolved ? 'official' : null),
    userConfirmedResolution: record.userConfirmedResolution ?? false,
    isDemo: record.isDemo ?? false,
    timeline: record.timeline ?? [{ step: 'request', at: createdAt }],
  }
}

function safeParse(raw: string | null): { version: number; complaints: LegacyRecord[] } | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { version?: number; complaints?: LegacyRecord[] }
    if (!parsed || !Array.isArray(parsed.complaints)) return null
    return { version: parsed.version ?? 0, complaints: parsed.complaints }
  } catch {
    return null
  }
}

export const localRepository: ComplaintRepository = {
  load() {
    if (typeof window === 'undefined') return []
    const parsed = safeParse(window.localStorage.getItem(KEY))

    // Only seed when nothing has ever been stored. Deleting all complaints
    // writes an empty envelope, which intentionally prevents re-seeding.
    if (!parsed) {
      const seeded = createSeedComplaints()
      localRepository.save(seeded)
      return seeded
    }

    if (parsed.version < VERSION) {
      // v1 shipped a single seed record. Carry forward anything the citizen
      // actually created, drop the old demo seed, and add the richer set that
      // covers every lifecycle state.
      const userRecords = parsed.complaints
        .filter((record) => record.isDemo !== true)
        .map(migrateRecord)
      const seeded = createSeedComplaints()
      const migrated = [...userRecords, ...seeded]
      localRepository.save(migrated)
      return migrated
    }

    return parsed.complaints as Complaint[]
  },

  save(complaints: Complaint[]) {
    if (typeof window === 'undefined') return
    try {
      const envelope: Envelope = { version: VERSION, complaints }
      window.localStorage.setItem(KEY, JSON.stringify(envelope))
    } catch {
      /* quota exceeded — keep the in-memory session working */
    }
  },

  clear() {
    if (typeof window === 'undefined') return
    localRepository.save([])
  },

  exportJson() {
    const complaints = localRepository.load()
    return JSON.stringify(
      { app: 'JANSETU', exportedAt: new Date().toISOString(), version: VERSION, complaints },
      null,
      2,
    )
  },
}
