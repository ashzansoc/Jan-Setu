import type { ComplaintDraft, UiLang } from '@/lib/complaints/types'
import { useComplaints } from '@/state/complaints'
import { useSettings } from '@/state/settings'
import { buildUserContext, getContextField } from '../context'
import { speak } from '@/lib/voice/tts'
import { requestLocation } from '@/lib/permissions'

/**
 * Tools that run in-process. They touch only local state and the citizen's own
 * device, so they need no credentials and work offline.
 */

export interface LocalToolResult {
  ok: boolean
  output: Record<string, unknown>
  error?: string
}

const documents = new Map<string, { name: string; dataUrl: string }>()

export async function runComplaintsTool(input: Record<string, unknown>): Promise<LocalToolResult> {
  const store = useComplaints.getState()

  if (input.action === 'create') {
    const draft = input.draft as ComplaintDraft
    if (!draft?.location?.label) {
      return { ok: false, output: {}, error: 'A location is required before a complaint can be prepared.' }
    }
    const complaint = store.createAwaitingApproval(draft)
    return { ok: true, output: { id: complaint.id, status: complaint.status, mode: 'sandbox' } }
  }

  if (input.action === 'submit') {
    const id = String(input.id ?? '')
    const outcome = await store.submit(id)
    return {
      ok: outcome.ok,
      output: {
        id,
        reference: outcome.reference,
        status: outcome.status,
        mode: outcome.status === 'assisted_filing' ? 'assisted' : 'sandbox',
      },
      error: outcome.ok ? undefined : (outcome.message ?? 'Submission did not complete.'),
    }
  }

  if (input.action === 'status') {
    const id = String(input.id ?? '')
    await store.refresh(id)
    const complaint = useComplaints.getState().get(id)
    if (!complaint) return { ok: false, output: {}, error: 'That complaint is not on this device.' }
    return {
      ok: true,
      output: {
        id,
        reference: complaint.reference,
        status: complaint.status,
        mode: complaint.verification.mode,
      },
    }
  }

  return { ok: false, output: {}, error: 'Unknown complaints action.' }
}

export async function runProfileTool(input: Record<string, unknown>): Promise<LocalToolResult> {
  const context = buildUserContext()
  const requested = Array.isArray(input.fields) ? (input.fields as string[]) : Object.keys(context)
  const values: Record<string, { value: string | null; provenance: string }> = {}
  for (const field of requested) {
    const entry = getContextField(context, field)
    values[field] = { value: entry.value, provenance: entry.provenance }
  }
  return { ok: true, output: { values } }
}

export async function runVoiceTool(input: Record<string, unknown>): Promise<LocalToolResult> {
  const text = typeof input.text === 'string' ? input.text : ''
  if (!text) return { ok: false, output: { spoken: false }, error: 'Nothing to say.' }
  const lang = useSettings.getState().speechLang
  await speak(text, { lang, rate: useSettings.getState().voiceSpeed })
  return { ok: true, output: { spoken: true } }
}

export async function runLocationTool(): Promise<LocalToolResult> {
  const result = await requestLocation()
  if (result.state !== 'granted') {
    return {
      ok: false,
      output: { label: null },
      error: 'Location access was not granted, so the area could not be confirmed.',
    }
  }
  const { latitude, longitude } = result.coords
  return {
    ok: true,
    output: {
      label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      lat: latitude,
      lng: longitude,
    },
  }
}

export async function runDocumentsTool(input: Record<string, unknown>): Promise<LocalToolResult> {
  const name = String(input.name ?? 'document')
  const dataUrl = String(input.dataUrl ?? '')
  if (!dataUrl) return { ok: false, output: {}, error: 'No document was supplied.' }
  const documentId = `doc-${Date.now().toString(36)}`
  documents.set(documentId, { name, dataUrl })
  return { ok: true, output: { documentId, name } }
}

export async function runNotificationsTool(input: Record<string, unknown>): Promise<LocalToolResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, output: { shown: false }, error: 'Notifications are not supported here.' }
  }
  if (Notification.permission !== 'granted') {
    return { ok: false, output: { shown: false }, error: 'Notification permission has not been granted.' }
  }
  new Notification(String(input.title ?? 'JANSETU'), { body: String(input.body ?? '') })
  return { ok: true, output: { shown: true } }
}

export async function runReplayTool(input: Record<string, unknown>): Promise<LocalToolResult> {
  const taskId = typeof input.taskId === 'string' ? input.taskId : null
  const complaintId = typeof input.complaintId === 'string' ? input.complaintId : null

  if (complaintId) {
    const complaint = useComplaints.getState().get(complaintId)
    if (!complaint) return { ok: false, output: { events: [] }, error: 'Complaint not found.' }
    return {
      ok: true,
      output: {
        events: complaint.timeline.map((event) => ({
          step: event.step,
          at: event.at,
          note: event.note ?? '',
        })),
      },
    }
  }

  if (taskId) {
    const task = useActionsSafeGet(taskId)
    if (!task) return { ok: false, output: { events: [] }, error: 'Task not found.' }
    return {
      ok: true,
      output: {
        events: task.events.map((event) => ({
          kind: event.kind,
          at: event.at,
          title: event.title,
          status: event.status,
        })),
      },
    }
  }

  return { ok: false, output: { events: [] }, error: 'Nothing to replay.' }
}

// Imported lazily to avoid a cycle between the store and the tool layer.
import { useActions } from '../store'
function useActionsSafeGet(taskId: string) {
  return useActions.getState().get(taskId)
}

/** Human label for a UI language, used by local tools that compose copy. */
export function uiLang(): UiLang {
  return useSettings.getState().uiLang
}