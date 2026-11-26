/**
 * Client bridge to the Assisted Filing Engine.
 *
 * Contract mirrors the AI step: always returns a usable result. If the API is
 * absent/unconfigured, the caller falls back to the local portal sandbox so the
 * citizen is never left at a dead end.
 */
import type { GovService } from './types'
import { API_BASE } from '@/lib/api'

const REMOTE = import.meta.env.VITE_AI_MODE === 'remote'

export interface ClassifiedField {
  id: string
  label: string
  type: string
  required: boolean
  category: 'A' | 'B' | 'C' | 'D' | 'E'
  sensitive?: boolean
  provenance: string
  value?: string
  status: 'available' | 'missing' | 'sensitive' | 'needs-human'
}

export interface FilingSession {
  id: string
  state: string
  service: GovService | null
  fields: ClassifiedField[]
  liveViewUrl?: string
  screenshotUrl?: string
  currentUrl?: string
  reason?: string
  reference?: string
  replay: { type: string; at: string; status: string; description: string }[]
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { ok?: boolean; session?: T }
    return json.ok && json.session ? json.session : null
  } catch {
    return null
  }
}

export async function startFiling(
  request: string,
  profile: Record<string, string>,
): Promise<FilingSession | null> {
  if (!REMOTE) return null
  return post<FilingSession>('/api/filing/start', { request, profile })
}

export async function provideFilingInput(
  id: string,
  fieldId: string,
  value: string,
): Promise<FilingSession | null> {
  return post<FilingSession>(`/api/filing/${id}/input`, { fieldId, value })
}

export async function approveFiling(id: string): Promise<FilingSession | null> {
  return post<FilingSession>(`/api/filing/${id}/approve`, {})
}