import type { ComplaintDraft, Stage, VerificationMode } from '@/lib/complaints/types'

/**
 * Every external action goes through this interface. Swapping the sandbox for a
 * real municipal API later means implementing these three methods and nothing
 * else in the app has to change.
 */
export interface SubmitResult {
  ok: boolean
  reference: string | null
  mode: VerificationMode
  /** Named system that produced this result. Only ever a mock name in sandbox. */
  source: string
  message?: 'offline' | 'no-online-channel' | 'rejected' | 'unknown'
}

export interface StatusResult {
  ok: boolean
  stage: Stage
  mode: VerificationMode
  source: string
  updatedAt: string
}

export interface Connector {
  id: string
  label: string
  /** True when results are simulated. The UI must label these honestly. */
  sandboxed: boolean
  /** False when the body has no online filing channel at all. */
  onlineFiling: boolean
  submit(draft: ComplaintDraft): Promise<SubmitResult>
  status(reference: string): Promise<StatusResult>
}
