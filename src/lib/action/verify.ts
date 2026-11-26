import type { PlanStep, ToolName, VerificationResult, VerificationStatus } from './types'

/**
 * Verification.
 *
 * A tool returning successfully is not evidence that the citizen's objective was
 * achieved. Only a source that can actually confirm the outcome produces
 * `verified` — and a sandbox connector never can.
 */

function result(
  status: VerificationStatus,
  method: string,
  evidence: Record<string, string>,
  reason?: string,
): VerificationResult {
  return { status, method, evidence, verifiedAt: new Date().toISOString(), reason }
}

export function verifyStep(
  tool: ToolName,
  output: Record<string, unknown> | undefined,
  fallbackReason?: string,
): VerificationResult {
  const out = output ?? {}

  switch (tool) {
    case 'complaints': {
      const reference = typeof out.reference === 'string' ? out.reference : null
      const mode = typeof out.mode === 'string' ? out.mode : 'none'
      if (out.ok === false) {
        return result('failed', 'connector_response', {}, fallbackReason ?? 'The connector rejected the request.')
      }
      if (reference && mode === 'live') {
        return result('verified', 'connector_reference', { reference })
      }
      if (reference) {
        // A sandbox reference is real evidence of a sandbox, nothing more.
        return result(
          'partially_verified',
          'connector_reference',
          { reference, mode },
          'The reference came from a simulated connector, not an official system.',
        )
      }
      if (out.status === 'awaiting_approval' || out.status === 'draft') {
        return result(
          'unverified',
          'prepared_not_submitted',
          { id: typeof out.id === 'string' ? out.id : '' },
          'Prepared but not submitted yet.',
        )
      }
      if (mode === 'assisted') {
        return result(
          'unverified',
          'no_online_channel',
          { mode },
          'No online filing channel exists; the citizen must file by phone.',
        )
      }
      return result('unknown', 'connector_response', {}, fallbackReason ?? 'No reference was returned.')
    }

    case 'email': {
      const messageId = typeof out.messageId === 'string' ? out.messageId : null
      if (out.status === 'sent' && messageId) {
        return result('verified', 'provider_message_id', {
          messageId,
          ...(typeof out.threadId === 'string' ? { threadId: out.threadId } : {}),
        })
      }
      if (out.status === 'failed') {
        return result('failed', 'provider_response', {}, fallbackReason ?? 'The provider rejected the send.')
      }
      return result('unknown', 'provider_response', {}, fallbackReason ?? 'No message id was returned.')
    }

    case 'browser': {
      const reference = typeof out.reference === 'string' ? out.reference : null
      const status = typeof out.status === 'string' ? out.status : 'unknown'
      if (reference) {
        return result('verified', 'portal_confirmation', {
          reference,
          ...(typeof out.finalUrl === 'string' ? { url: out.finalUrl } : {}),
        })
      }
      if (status === 'needs_human') {
        return result('unknown', 'portal_needs_human', {}, 'The portal needs the citizen to complete a step.')
      }
      if (status === 'completed') {
        return result(
          'partially_verified',
          'portal_completed',
          {},
          'The portal reported completion but no reference number was captured.',
        )
      }
      return result('failed', 'portal_failed', {}, fallbackReason ?? 'The browser task did not complete.')
    }

    case 'http': {
      const status = typeof out.status === 'number' ? out.status : 0
      if (status >= 200 && status < 300) {
        return result('verified', 'http_response', { status: String(status) })
      }
      return result('failed', 'http_response', { status: String(status) }, `HTTP ${status}`)
    }

    case 'service_discovery': {
      const services = Array.isArray(out.services) ? out.services : []
      if (services.length === 0) {
        return result('unverified', 'registry_miss', {}, 'No verified service matched the request.')
      }
      return result('verified', 'registry_match', { matches: String(services.length) })
    }

    default:
      return result('verified', 'tool_result', {}, fallbackReason)
  }
}

/** Combines step verifications into the task-level outcome. */
export function aggregateVerification(verifications: VerificationResult[]): VerificationResult {
  if (verifications.length === 0) {
    return result('unknown', 'none', {}, 'No steps produced a verification result.')
  }
  const failed = verifications.filter((item) => item.status === 'failed')
  if (failed.length > 0) {
    return result('failed', 'step_failed', {}, failed[0].reason ?? 'A step failed verification.')
  }
  const verified = verifications.filter((item) => item.status === 'verified')
  if (verified.length === verifications.length) {
    return result('verified', 'all_steps', { steps: String(verifications.length) })
  }
  // Prefer the most specific partial evidence over a generic unknown.
  const partial = verifications.find((item) => item.status === 'partially_verified')
  if (partial) {
    return result(
      'partially_verified',
      'some_partial',
      { verified: String(verified.length), total: String(verifications.length) },
      partial.reason ?? 'Some steps produced only partial evidence.',
    )
  }
  const unknown = verifications.find((item) => item.status === 'unknown')
  if (unknown) {
    return result(
      'partially_verified',
      'some_unverified',
      { verified: String(verified.length), total: String(verifications.length) },
      unknown.reason ?? 'Some steps could not be verified.',
    )
  }
  return result(
    'partially_verified',
    'some_unverified',
    { verified: String(verified.length), total: String(verifications.length) },
    'Some steps produced only partial evidence.',
  )
}

export type { PlanStep }