import { getDb } from './index.js'
import type { BrowserSessionInfo } from '../browser/provider.js'

/**
 * Durable records for portal sessions, browser events and evidence.
 *
 * Sessions survive an API restart (the browser itself does not — it is
 * relaunched lazily), so the app can still explain what happened on a task even
 * after a restart.
 */

export function saveSession(info: BrowserSessionInfo): void {
  getDb()
    .prepare(
      `INSERT INTO portal_sessions (id, user_id, organisation_id, provider, status, current_url, created_at, last_activity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         current_url = excluded.current_url,
         last_activity = excluded.last_activity`,
    )
    .run(
      info.id,
      info.userId,
      info.organisationId ?? null,
      info.provider,
      info.status,
      info.currentUrl,
      info.createdAt,
      info.lastActivity,
    )
}

export function markSessionClosed(id: string): void {
  getDb()
    .prepare('UPDATE portal_sessions SET status = ?, closed_at = ? WHERE id = ?')
    .run('closed', new Date().toISOString(), id)
}

export function getSession(id: string): BrowserSessionInfo | null {
  const row = getDb().prepare('SELECT * FROM portal_sessions WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) return null
  return {
    id: String(row.id),
    userId: String(row.user_id),
    organisationId: (row.organisation_id as string) ?? undefined,
    provider: row.provider as BrowserSessionInfo['provider'],
    status: row.status as BrowserSessionInfo['status'],
    currentUrl: (row.current_url as string) ?? null,
    createdAt: String(row.created_at),
    lastActivity: String(row.last_activity),
  }
}

export function listPersistedSessions(limit = 50): BrowserSessionInfo[] {
  const rows = getDb()
    .prepare('SELECT * FROM portal_sessions ORDER BY last_activity DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[]
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    organisationId: (row.organisation_id as string) ?? undefined,
    provider: row.provider as BrowserSessionInfo['provider'],
    status: row.status as BrowserSessionInfo['status'],
    currentUrl: (row.current_url as string) ?? null,
    createdAt: String(row.created_at),
    lastActivity: String(row.last_activity),
  }))
}

/** Every browser action is recorded — this is the Action Replay source. */
export function recordEvent(input: {
  sessionId: string
  type: string
  url?: string | null
  detail?: Record<string, unknown>
}): void {
  getDb()
    .prepare('INSERT INTO browser_events (session_id, type, url, detail, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(
      input.sessionId,
      input.type,
      input.url ?? null,
      input.detail ? JSON.stringify(input.detail).slice(0, 4000) : null,
      new Date().toISOString(),
    )
}

export interface StoredEvent {
  id: number
  sessionId: string
  type: string
  url: string | null
  detail: string | null
  createdAt: string
}

export function listEvents(sessionId: string, limit = 200): StoredEvent[] {
  const rows = getDb()
    .prepare('SELECT * FROM browser_events WHERE session_id = ? ORDER BY id ASC LIMIT ?')
    .all(sessionId, limit) as Record<string, unknown>[]
  return rows.map((row) => ({
    id: Number(row.id),
    sessionId: String(row.session_id),
    type: String(row.type),
    url: (row.url as string) ?? null,
    detail: (row.detail as string) ?? null,
    createdAt: String(row.created_at),
  }))
}

/** Evidence: a page snapshot, an extracted value, or a screenshot reference. */
export function saveEvidence(input: {
  sessionId: string
  kind: 'snapshot' | 'screenshot' | 'extraction' | 'receipt'
  url?: string | null
  label?: string
  body?: string
}): number {
  const result = getDb()
    .prepare('INSERT INTO evidence (session_id, kind, url, label, body, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      input.sessionId,
      input.kind,
      input.url ?? null,
      input.label ?? null,
      input.body?.slice(0, 20000) ?? null,
      new Date().toISOString(),
    )
  return Number(result.lastInsertRowid)
}

export function listEvidence(sessionId: string): {
  id: number
  kind: string
  url: string | null
  label: string | null
  createdAt: string
}[] {
  const rows = getDb()
    .prepare('SELECT id, kind, url, label, created_at FROM evidence WHERE session_id = ? ORDER BY id ASC')
    .all(sessionId) as Record<string, unknown>[]
  return rows.map((row) => ({
    id: Number(row.id),
    kind: String(row.kind),
    url: (row.url as string) ?? null,
    label: (row.label as string) ?? null,
    createdAt: String(row.created_at),
  }))
}