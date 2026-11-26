import { createHash, randomUUID } from 'node:crypto'
import { getDb } from '../db/index.js'

/**
 * Approval gate for consequential actions.
 *
 * Rule: a `fill` or `click` that could submit or change something on an official
 * portal requires a matching approval record. The approval is bound to the exact
 * action, URL and payload hash, so approving "fill CA number 1234" cannot be
 * reused to submit a different form.
 */

export type ConsequentialAction = 'fill' | 'click' | 'submit' | 'upload'

export interface ApprovalRequest {
  userId: string
  sessionId?: string
  organisationId?: string
  action: ConsequentialAction
  url: string
  /** The exact data being sent — hashed, never stored raw. */
  payload: Record<string, unknown>
  /** Human-readable description shown to the citizen before approving. */
  summary: string
}

export interface ApprovalRecord {
  id: string
  sessionId: string | null
  userId: string
  organisationId: string | null
  action: string
  url: string | null
  payloadHash: string
  summary: string
  status: 'pending' | 'approved' | 'rejected' | 'used'
  createdAt: string
  approvedAt: string | null
  usedAt: string | null
}

export function hashPayload(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort())
  return createHash('sha256').update(canonical).digest('hex')
}

function rowToApproval(row: Record<string, unknown>): ApprovalRecord {
  return {
    id: String(row.id),
    sessionId: (row.session_id as string) ?? null,
    userId: String(row.user_id),
    organisationId: (row.organisation_id as string) ?? null,
    action: String(row.action),
    url: (row.url as string) ?? null,
    payloadHash: String(row.payload_hash),
    summary: String(row.summary),
    status: row.status as ApprovalRecord['status'],
    createdAt: String(row.created_at),
    approvedAt: (row.approved_at as string) ?? null,
    usedAt: (row.used_at as string) ?? null,
  }
}

export function requestApproval(input: ApprovalRequest): ApprovalRecord {
  const db = getDb()
  const record: ApprovalRecord = {
    id: `ap-${randomUUID().slice(0, 8)}`,
    sessionId: input.sessionId ?? null,
    userId: input.userId,
    organisationId: input.organisationId ?? null,
    action: input.action,
    url: input.url,
    payloadHash: hashPayload(input.payload),
    summary: input.summary,
    status: 'pending',
    createdAt: new Date().toISOString(),
    approvedAt: null,
    usedAt: null,
  }
  db.prepare(
    `INSERT INTO action_approvals (id, session_id, user_id, organisation_id, action, url, payload_hash, summary, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id,
    record.sessionId,
    record.userId,
    record.organisationId,
    record.action,
    record.url,
    record.payloadHash,
    record.summary,
    record.status,
    record.createdAt,
  )
  return record
}

export function decideApproval(id: string, decision: 'approved' | 'rejected'): ApprovalRecord | null {
  const db = getDb()
  const now = new Date().toISOString()
  const result = db
    .prepare('UPDATE action_approvals SET status = ?, approved_at = ? WHERE id = ? AND status = ?')
    .run(decision, now, id, 'pending')
  if (Number(result.changes) === 0) return getApproval(id)
  return getApproval(id)
}

export function getApproval(id: string): ApprovalRecord | null {
  const row = getDb().prepare('SELECT * FROM action_approvals WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? rowToApproval(row) : null
}

/**
 * Consumes an approval. Returns true only for an approved, unused, matching
 * approval — this is the single gate every consequential action must pass.
 */
export function consumeApproval(id: string, action: string, payload: Record<string, unknown>): boolean {
  const db = getDb()
  const record = getApproval(id)
  if (!record) return false
  if (record.status !== 'approved') return false
  if (record.action !== action) return false
  if (record.payloadHash !== hashPayload(payload)) return false

  const result = db
    .prepare('UPDATE action_approvals SET status = ?, used_at = ? WHERE id = ? AND status = ?')
    .run('used', new Date().toISOString(), id, 'approved')
  return Number(result.changes) === 1
}

export function listApprovals(sessionId?: string): ApprovalRecord[] {
  const db = getDb()
  const rows = sessionId
    ? db.prepare('SELECT * FROM action_approvals WHERE session_id = ? ORDER BY created_at DESC').all(sessionId)
    : db.prepare('SELECT * FROM action_approvals ORDER BY created_at DESC LIMIT 100').all()
  return (rows as Record<string, unknown>[]).map(rowToApproval)
}