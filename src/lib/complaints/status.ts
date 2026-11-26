import type { ComplaintStatus, Stage, StatusGroup } from './types'

/**
 * The lifecycle is a directed graph, not a free-form field. Every mutation goes
 * through `canTransition`, so no screen can invent a state the system cannot
 * justify — which is the whole point of a civic complaint tracker.
 */
const ALLOWED: Record<ComplaintStatus, ComplaintStatus[]> = {
  draft: ['awaiting_approval', 'rejected'],
  awaiting_approval: ['approved', 'rejected', 'draft'],
  approved: ['submitted', 'failed', 'assisted_filing'],
  submitted: ['acknowledged', 'in_progress', 'resolved', 'failed'],
  acknowledged: ['in_progress', 'resolved'],
  in_progress: ['resolved', 'reopened'],
  resolved: ['reopened'],
  reopened: ['submitted', 'acknowledged'],
  assisted_filing: ['user_confirmed_submission', 'rejected'],
  user_confirmed_submission: ['acknowledged', 'in_progress', 'resolved', 'reopened'],
  rejected: [],
  failed: ['awaiting_approval', 'rejected'],
}

export function canTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  if (from === to) return true
  return ALLOWED[from]?.includes(to) ?? false
}

export function isTerminal(status: ComplaintStatus): boolean {
  return ALLOWED[status].length === 0
}

/** Filter bucket for a status. Kept exhaustive so a new state is a type error. */
export function groupOf(status: ComplaintStatus): StatusGroup {
  switch (status) {
    case 'draft':
    case 'awaiting_approval':
      return 'approval'
    case 'assisted_filing':
    case 'user_confirmed_submission':
    case 'approved':
    case 'submitted':
    case 'acknowledged':
    case 'in_progress':
    case 'reopened':
      return 'active'
    case 'resolved':
      return 'resolved'
    case 'rejected':
    case 'failed':
      return 'closed'
  }
}

/** Progress tracker position. `null` means this record has no meaningful stage. */
export function stageOf(status: ComplaintStatus): Stage | null {
  switch (status) {
    case 'draft':
    case 'awaiting_approval':
    case 'approved':
      return 'prepared'
    case 'submitted':
    case 'reopened':
    case 'user_confirmed_submission':
      return 'submitted'
    case 'acknowledged':
    case 'in_progress':
      return 'acknowledged'
    case 'resolved':
      return 'resolved'
    case 'assisted_filing':
    case 'rejected':
    case 'failed':
      return null
  }
}

/** Complaint defers to a human channel because no online filing exists. */
export function needsAssistedFiling(status: ComplaintStatus): boolean {
  return status === 'assisted_filing'
}

/** A record the citizen still has to act on. */
export function needsApproval(status: ComplaintStatus): boolean {
  return groupOf(status) === 'approval'
}
