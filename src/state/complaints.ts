import { create } from 'zustand'
import type {
  Category,
  Complaint,
  ComplaintDraft,
  StatusGroup,
  TimelineStep,
  Verification,
} from '@/lib/complaints/types'
import { CATEGORY_LABEL } from '@/lib/complaints/types'
import { resolveDepartment } from '@/lib/complaints/departments'
import { composeComplaint } from '@/lib/complaints/compose'
import { localRepository } from '@/lib/complaints/repository'
import { getConnector } from '@/lib/complaints/connectors/registry'
import { canTransition, groupOf, stageOf } from '@/lib/complaints/status'
import type { Stage } from '@/lib/complaints/types'
import type { Extraction } from '@/lib/ai/engine'

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

export interface SubmitOutcome {
  ok: boolean
  status: Complaint['status']
  reference: string | null
  message?: string
}

interface ComplaintsState {
  complaints: Complaint[]
  hydrated: boolean
  hydrate: () => void
  createAwaitingApproval: (draft: ComplaintDraft) => Complaint
  submit: (id: string) => Promise<SubmitOutcome>
  reject: (id: string) => void
  amend: (id: string, addition: { note: string; severity?: 'high'; location?: string }) => void
  reopen: (id: string) => Promise<SubmitOutcome>
  confirmResolution: (id: string) => void
  confirmUserFiled: (id: string, reference?: string) => void
  recordDeferred: (id: string) => void
  refresh: (id: string) => Promise<void>
  remove: (id: string) => void
  clearAll: () => void
  get: (id: string) => Complaint | undefined
}

const USER_ID = 'local-user'

function draftFromComplaint(complaint: Complaint): ComplaintDraft {
  return {
    category: complaint.category,
    problem: complaint.problem,
    description: complaint.description,
    location: complaint.location,
    durationDays: complaint.durationDays,
    urgency: complaint.urgency,
    department: complaint.department,
    speechLang: complaint.speechLang,
    transcript: complaint.transcript,
  }
}

export const useComplaints = create<ComplaintsState>((set, get) => {
  /** Applies a status change only if the lifecycle allows it. */
  function transition(
    id: string,
    to: Complaint['status'],
    extra: Partial<Complaint> = {},
    event?: { step: TimelineStep; note?: string },
  ): boolean {
    const current = get().complaints.find((c) => c.id === id)
    if (!current) return false
    if (!canTransition(current.status, to)) {
      if (import.meta.env.DEV) {
        console.warn(`[jansetu] blocked transition ${current.status} → ${to} for ${id}`)
      }
      return false
    }

    const now = new Date().toISOString()
    const timeline = event
      ? [...current.timeline, { step: event.step, at: now, ...(event.note ? { note: event.note } : {}) }]
      : current.timeline

    set((state) => ({
      complaints: state.complaints.map((complaint) =>
        complaint.id === id
          ? { ...complaint, ...extra, status: to, updatedAt: now, timeline }
          : complaint,
      ),
    }))
    localRepository.save(get().complaints)
    return true
  }

  function patch(id: string, extra: Partial<Complaint>): void {
    set((state) => ({
      complaints: state.complaints.map((complaint) =>
        complaint.id === id
          ? { ...complaint, ...extra, updatedAt: new Date().toISOString() }
          : complaint,
      ),
    }))
    localRepository.save(get().complaints)
  }

  return {
    complaints: [],
    hydrated: false,

    hydrate: () => {
      if (get().hydrated) return
      set({ complaints: localRepository.load(), hydrated: true })
    },

    createAwaitingApproval: (draft) => {
      const now = new Date().toISOString()
      const { body } = composeComplaint(
        {
          category: draft.category,
          locationLabel: draft.location.label,
          durationDays: draft.durationDays ?? null,
          urgency: draft.urgency,
          department: draft.department,
          transcript: draft.transcript,
        },
        'en',
      )

      const complaint: Complaint = {
        id: nextId('cmp'),
        userId: USER_ID,
        category: draft.category,
        title:
          draft.category === 'water' && draft.durationDays
            ? `No water supply · ${draft.durationDays} days`
            : CATEGORY_LABEL[draft.category].en,
        problem: draft.problem,
        description: body,
        transcript: draft.transcript,
        language: 'en',
        speechLang: draft.speechLang,
        location: draft.location,
        department: draft.department,
        durationDays: draft.durationDays,
        urgency: draft.urgency,
        createdAt: now,
        preparedAt: now,
        submittedAt: null,
        resolvedAt: null,
        updatedAt: now,
        reference: null,
        status: 'awaiting_approval',
        approval: 'pending',
        verification: { mode: 'none', source: '', verifiedAt: null },
        resolutionSource: null,
        userConfirmedResolution: false,
        isDemo: false,
        timeline: [
          { step: 'request', at: now },
          { step: 'understanding', at: now },
          { step: 'location', at: now },
          { step: 'department', at: now },
          { step: 'generation', at: now },
        ],
      }

      set((state) => ({ complaints: [complaint, ...state.complaints] }))
      localRepository.save(get().complaints)
      return complaint
    },

    /**
     * Consent → connector → verified status. Falls back to assisted filing when
     * the department has no online channel, rather than faking a submission.
     */
    submit: async (id) => {
      const complaint = get().complaints.find((c) => c.id === id)
      if (!complaint) return { ok: false, status: 'failed', reference: null }
      if (!canTransition(complaint.status, 'approved')) {
        return { ok: false, status: complaint.status, reference: null, message: 'invalid-state' }
      }

      transition(
        id,
        'approved',
        { approval: 'approved' },
        { step: 'consent', note: complaint.location.label },
      )

      const department = complaint.department

      if (!department.onlineFiling) {
        const verification: Verification = {
          mode: 'assisted',
          source: `${department.jurisdiction} helpline ${department.helpline ?? ''}`.trim(),
          verifiedAt: null,
        }
        transition(
          id,
          'assisted_filing',
          { verification },
          { step: 'assisted_filing', note: department.helpline },
        )
        return { ok: true, status: 'assisted_filing', reference: null }
      }

      const connector = getConnector(department.connectorId)
      try {
        const result = await connector.submit(draftFromComplaint(complaint))
        if (result.ok && result.reference) {
          const submittedAt = new Date().toISOString()
          transition(
            id,
            'submitted',
            {
              reference: result.reference,
              submittedAt,
              verification: {
                mode: result.mode,
                source: result.source,
                verifiedAt: submittedAt,
              },
            },
            { step: 'submission', note: result.reference },
          )
          return { ok: true, status: 'submitted', reference: result.reference }
        }

        transition(id, 'failed', {}, { step: 'submission' })
        return {
          ok: false,
          status: 'failed',
          reference: null,
          message: result.message ?? 'unknown',
        }
      } catch {
        transition(id, 'failed', {}, { step: 'submission' })
        return { ok: false, status: 'failed', reference: null, message: 'unknown' }
      }
    },

    reject: (id) => {
      transition(id, 'rejected', { approval: 'rejected' }, { step: 'consent' })
    },

    recordDeferred: (id) => {
      const complaint = get().complaints.find((c) => c.id === id)
      if (!complaint) return
      patch(id, {
        timeline: [...complaint.timeline, { step: 'consent', at: new Date().toISOString() }],
      })
    },

    /**
     * Conversational edit. Appends to what exists — never replaces it — so a
     * citizen can refine a complaint without losing their own words.
     */
    amend: (id, addition) => {
      const complaint = get().complaints.find((c) => c.id === id)
      if (!complaint) return
      if (complaint.status !== 'awaiting_approval' && complaint.status !== 'draft') return

      const note = addition.note.trim()
      if (!note) return

      const description = `${complaint.description}\n\nAdditional detail from the citizen:\n“${note}”`
      const transcript = `${complaint.transcript} ${note}`.trim()

      set((state) => ({
        complaints: state.complaints.map((item) =>
          item.id === id
            ? {
                ...item,
                description,
                transcript,
                urgency: addition.severity === 'high' ? 'high' : item.urgency,
                location: addition.location
                  ? { label: addition.location }
                  : item.location,
                department: addition.location
                  ? resolveDepartment(item.category, addition.location)
                  : item.department,
                updatedAt: new Date().toISOString(),
                timeline: [
                  ...item.timeline,
                  { step: 'amendment', at: new Date().toISOString(), note },
                ],
              }
            : item,
        ),
      }))
      localRepository.save(get().complaints)
    },

    /** Reopening re-files through the same connector and records why. */
    reopen: async (id) => {
      const complaint = get().complaints.find((c) => c.id === id)
      if (!complaint) return { ok: false, status: 'failed', reference: null }
      if (!canTransition(complaint.status, 'reopened')) {
        return { ok: false, status: complaint.status, reference: null, message: 'invalid-state' }
      }

      transition(
        id,
        'reopened',
        {
          resolutionSource: null,
          userConfirmedResolution: false,
          resolvedAt: null,
        },
        { step: 'reopened' },
      )

      const reopened = get().complaints.find((c) => c.id === id)
      if (!reopened) return { ok: false, status: 'failed', reference: null }

      if (!reopened.department.onlineFiling) {
        transition(id, 'assisted_filing', {}, { step: 'assisted_filing' })
        return { ok: true, status: 'assisted_filing', reference: null }
      }

      const connector = getConnector(reopened.department.connectorId)
      try {
        const result = await connector.submit(draftFromComplaint(reopened))
        if (result.ok && result.reference) {
          const submittedAt = new Date().toISOString()
          transition(
            id,
            'submitted',
            {
              reference: result.reference,
              submittedAt,
              verification: { mode: result.mode, source: result.source, verifiedAt: submittedAt },
            },
            { step: 'submission', note: result.reference },
          )
          return { ok: true, status: 'submitted', reference: result.reference }
        }
        transition(id, 'failed', {}, { step: 'submission' })
        return { ok: false, status: 'failed', reference: null }
      } catch {
        transition(id, 'failed', {}, { step: 'submission' })
        return { ok: false, status: 'failed', reference: null }
      }
    },

    /** The citizen says the problem is gone — recorded as user evidence only. */
    confirmResolution: (id) => {
      const complaint = get().complaints.find((c) => c.id === id)
      if (!complaint || complaint.resolutionSource !== 'official') return
      patch(id, {
        userConfirmedResolution: true,
        timeline: [
          ...complaint.timeline,
          { step: 'user_confirmed', at: new Date().toISOString() },
        ],
      })
    },

    /** Assisted filing: the citizen filed it themselves on the helpline. */
    confirmUserFiled: (id, reference) => {
      const complaint = get().complaints.find((c) => c.id === id)
      if (!complaint) return
      const clean = reference?.trim() || null
      transition(
        id,
        'user_confirmed_submission',
        {
          reference: clean,
          submittedAt: new Date().toISOString(),
          verification: {
            mode: 'user',
            source: clean ? 'Reported by you' : 'Confirmed by you',
            verifiedAt: new Date().toISOString(),
          },
        },
        { step: 'user_confirmed', note: clean ?? undefined },
      )
    },

    /** Asks the connector for the authoritative stage. Never invents one. */
    refresh: async (id) => {
      const complaint = get().complaints.find((c) => c.id === id)
      if (!complaint?.reference) return
      if (complaint.verification.mode === 'user' || complaint.verification.mode === 'assisted') return
      const connector = getConnector(complaint.department.connectorId)
      try {
        const status = await connector.status(complaint.reference)
        if (!status.ok) return
        const next = stageToStatus(status.stage)
        if (next && canTransition(complaint.status, next) && complaint.status !== next) {
          const event: TimelineStep | undefined =
            next === 'acknowledged'
              ? 'acknowledgement'
              : next === 'in_progress'
                ? 'in_progress'
                : next === 'resolved'
                  ? 'resolution'
                  : undefined
          transition(id, next, {}, event ? { step: event } : undefined)
        }
      } catch {
        /* the connector is a sandbox; a failure just means no update */
      }
    },

    remove: (id) => {
      set((state) => {
        const complaints = state.complaints.filter((c) => c.id !== id)
        localRepository.save(complaints)
        return { complaints }
      })
    },

    clearAll: () => {
      localRepository.clear()
      set({ complaints: [] })
    },

    get: (id) => get().complaints.find((c) => c.id === id),
  }
})

function stageToStatus(stage: Stage): Complaint['status'] | null {
  switch (stage) {
    case 'prepared':
      return null
    case 'submitted':
      return 'submitted'
    case 'acknowledged':
      return 'acknowledged'
    case 'resolved':
      return 'resolved'
  }
}

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

/** The complaint worth showing on Home: most actionable, most recently touched. */
export function pickActive(complaints: Complaint[]): Complaint | undefined {
  const rank = (status: Complaint['status']): number => {
    const group = groupOf(status)
    if (group === 'approval') return 0
    if (group === 'active') return 1
    return 2
  }
  if (!complaints.length) return undefined
  return [...complaints].sort((a, b) => {
    const byRank = rank(a.status) - rank(b.status)
    if (byRank !== 0) return byRank
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })[0]
}

export interface Counts {
  all: number
  approval: number
  active: number
  resolved: number
}

export function countByGroup(complaints: Complaint[]): Counts {
  const counts: Counts = { all: complaints.length, approval: 0, active: 0, resolved: 0 }
  for (const complaint of complaints) {
    const group: StatusGroup = groupOf(complaint.status)
    if (group === 'approval') counts.approval += 1
    else if (group === 'active') counts.active += 1
    else if (group === 'resolved') counts.resolved += 1
  }
  return counts
}

export function stageFor(complaint: Complaint): Stage | null {
  return stageOf(complaint.status)
}

/** Builds the draft the preview screen shows and then submits. */
export function draftFromExtraction(
  extraction: Extraction,
  transcript: string,
): ComplaintDraft | null {
  if (!extraction.location) return null
  const category: Category = extraction.category === 'other' ? 'other' : extraction.category
  const department = resolveDepartment(category, extraction.location)
  return {
    category,
    problem: CATEGORY_LABEL[category].en,
    description: '',
    location: { label: extraction.location },
    durationDays: extraction.durationDays ?? undefined,
    urgency: extraction.urgency,
    department,
    speechLang: extraction.speechLang,
    transcript,
  }
}
