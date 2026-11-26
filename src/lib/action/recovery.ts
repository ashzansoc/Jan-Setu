/**
 * Failure classification and retry policy.
 *
 * The rule that matters: never retry an action that might already have happened.
 * If we cannot tell whether a submission went through, the step becomes `unknown`
 * and the citizen is told — repeating it could file a duplicate complaint.
 */

export type FailureKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'validation'
  | 'not_configured'
  | 'duplicate_risk'
  | 'human_required'
  | 'unknown'

export function classifyFailure(error: unknown): FailureKind {
  const message = (error as { message?: string } | null)?.message?.toLowerCase() ?? ''
  const code = (error as { code?: string } | null)?.code?.toLowerCase() ?? ''

  if (
    code.includes('not-configured') ||
    message.includes('not configured') ||
    message.includes('not-configured')
  ) {
    return 'not_configured'
  }
  if (message.includes('captcha') || message.includes('otp') || message.includes('password')) {
    return 'human_required'
  }
  if (message.includes('duplicate') || message.includes('already submitted')) return 'duplicate_risk'
  if (message.includes('timeout') || code === 'timeout') return 'timeout'
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('offline') ||
    code === 'unavailable'
  ) {
    return 'network'
  }
  if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('auth')) {
    return 'auth'
  }
  if (message.includes('invalid') || message.includes('validation') || message.includes('required')) {
    return 'validation'
  }
  return 'unknown'
}

/** Only transient failures are safe to repeat. */
export function isRetryable(kind: FailureKind): boolean {
  return kind === 'network' || kind === 'timeout'
}

export function retryDelayMs(attempt: number, baseMs: number): number {
  if (baseMs <= 0) return 0
  return Math.min(8_000, baseMs * 2 ** Math.max(0, attempt - 1))
}

/** What the citizen should be told, in one line. */
export function explainFailure(kind: FailureKind): string {
  switch (kind) {
    case 'not_configured':
      return 'The service is not configured on the server yet.'
    case 'human_required':
      return 'This step needs you to complete a verification challenge.'
    case 'duplicate_risk':
      return 'This may already have been submitted, so it was not repeated.'
    case 'auth':
      return 'The account used for this step is not authorised.'
    case 'validation':
      return 'The service rejected the information provided.'
    case 'network':
      return 'The network connection failed.'
    case 'timeout':
      return 'The service took too long to respond.'
    default:
      return 'The step failed for an unknown reason.'
  }
}

/** Steps that must never be auto-retried, whatever the error. */
export function isIrreversible(action: string): boolean {
  return (
    action === 'submit_complaint' ||
    action === 'send_email' ||
    action === 'submit_form' ||
    action === 'upload_documents' ||
    action === 'submit_follow_up'
  )
}