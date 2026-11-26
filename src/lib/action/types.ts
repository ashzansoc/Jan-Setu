import type {
  Category,
  Complaint,
  ComplaintDraft,
  Department,
  SpeechLang,
  UiLang,
} from '@/lib/complaints/types'

/**
 * Action Intelligence Engine — vocabulary.
 *
 * A task is a citizen's objective, decomposed into a plan of tool steps, each of
 * which is executed, verified and recorded. Nothing here is a mock: a step
 * either produced evidence or it did not.
 */

/** Persistent task lifecycle. Mirrors the spec's execution states. */
export type TaskState =
  | 'received'
  | 'understanding'
  | 'researching'
  | 'planning'
  | 'waiting_for_information'
  | 'ready_to_execute'
  | 'executing'
  | 'waiting_for_user'
  | 'waiting_for_approval'
  | 'verifying'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'cancelled'

export type StepStatus =
  | 'pending'
  | 'ready'
  | 'blocked'
  | 'running'
  | 'done'
  | 'failed'
  | 'skipped'
  | 'unknown'

/** 0 read-only · 1 preparation · 2 external communication · 3 high-impact. */
export type RiskLevel = 0 | 1 | 2 | 3

export type VerificationStatus =
  | 'verified'
  | 'unverified'
  | 'partially_verified'
  | 'failed'
  | 'unknown'

/** Where a piece of information came from. Never guessed. */
export type Provenance =
  | 'verified_profile'
  | 'user_confirmed'
  | 'current_conversation'
  | 'document_extracted'
  | 'ai_generated'
  | 'unknown'

export type GoalKind =
  | 'complaint_registration'
  | 'email_send'
  | 'status_check'
  | 'document_upload'
  | 'application_submit'
  | 'follow_up'
  | 'information_request'

export interface ActionGoal {
  id: string
  kind: GoalKind
  /** Plain-language objective, in the citizen's UI language. */
  description: string
  category?: Category
  /** Set when the goal is a complaint about a specific problem. */
  problem?: string
}

export interface ActionEntities {
  location: string | null
  department: string | null
  reference: string | null
  consumerNumber: string | null
}

export interface MissingInformation {
  field: string
  reason: string
  /** How the engine intends to obtain it. */
  source: 'user' | 'profile' | 'document' | 'discovery'
}

export interface ActionIntent {
  id: string
  originalRequest: string
  language: UiLang
  speechLang: SpeechLang
  goals: ActionGoal[]
  entities: ActionEntities
  missing: MissingInformation[]
  /** Skills the planner should consider, best first. */
  suggestedSkills: string[]
  confidence: number
  /** True when the request is too vague to plan safely. */
  needsClarification: boolean
  clarification?: string
}

export interface PlanStep {
  id: string
  order: number
  /** Machine-readable action id, e.g. `identify_provider`. */
  action: string
  /** Human label, rendered from the dictionary at display time. */
  labelKey: string
  tool: ToolName
  skillId?: string
  dependsOn: string[]
  risk: RiskLevel
  requiresApproval: boolean
  status: StepStatus
  attempts: number
  /** Stable key so a retry cannot double-submit. */
  idempotencyKey: string
  /** Populated on success. */
  output?: Record<string, unknown>
  verification?: VerificationResult
  error?: string
  startedAt?: string
  finishedAt?: string
}

export interface ActionPlan {
  id: string
  taskId: string
  goal: string
  steps: PlanStep[]
  createdAt: string
  /** Hash of the ordered steps — approval is bound to this. */
  planHash: string
}

export type HandoffType =
  | 'user_input'
  | 'password'
  | 'otp'
  | 'captcha'
  | 'document'
  | 'location'
  | 'recipient'
  | 'approval'
  | 'identity'

export interface HandoffRequest {
  id: string
  taskId: string
  stepId: string
  type: HandoffType
  /** Field id this answers, when applicable. */
  field?: string
  prompt: string
  inputType: 'text' | 'numeric' | 'masked' | 'file' | 'image' | 'confirm'
  reason: string
  status: 'open' | 'resolved' | 'cancelled'
  createdAt: string
  resolvedAt?: string
  /** Never populated for password / otp / captcha. */
  summary?: string
}

export interface ApprovalRecord {
  id: string
  taskId: string
  stepId: string
  planHash: string
  /** Hash of the exact payload approved. */
  payloadHash: string
  destination: string
  risk: RiskLevel
  approvedAt: string
  channel: 'explicit_tap' | 'voice_confirmation'
}

export interface VerificationResult {
  status: VerificationStatus
  /** e.g. `portal_confirmation`, `provider_message_id`, `connector_reference`. */
  method: string
  evidence: Record<string, string>
  verifiedAt: string
  /** Present when status is not `verified`. */
  reason?: string
}

/** One entry in the task's audit/replay log. */
export interface ActionEvent {
  id: string
  at: string
  kind:
    | 'request'
    | 'intent'
    | 'plan'
    | 'tool_call'
    | 'tool_result'
    | 'handoff'
    | 'approval'
    | 'verification'
    | 'error'
    | 'recovery'
    | 'state'
  title: string
  detail?: string
  status: 'ok' | 'waiting' | 'failed' | 'unknown'
  /** Never contains secrets. */
  source?: string
}

export interface ActionTask {
  id: string
  userId: string
  state: TaskState
  intent: ActionIntent | null
  plan: ActionPlan | null
  currentStepId: string | null
  handoff: HandoffRequest | null
  approvals: ApprovalRecord[]
  events: ActionEvent[]
  /** Set when the task produced a complaint. */
  complaintId: string | null
  /** Set when the task sent an email. */
  emailMessageId: string | null
  /** Citizen-supplied values keyed by field (never secrets). */
  values: Record<string, string>
  /** Browser session id, when a portal workflow is in flight. */
  browserSessionId?: string
  /** Citizen-requested pause. The plan and completed steps are kept. */
  paused?: boolean
  result: VerificationResult | null
  /** Free-text reason for failure / not-configured. */
  reason: string | null
  createdAt: string
  updatedAt: string
}

/** Tool identity and contract. Registration is data, not code. */
export type ToolName =
  | 'browser'
  | 'email'
  | 'voice'
  | 'documents'
  | 'service_discovery'
  | 'profile'
  | 'complaints'
  | 'notifications'
  | 'location'
  | 'http'
  | 'replay'

export interface ToolSpec {
  name: ToolName
  description: string
  capabilities: string[]
  /** Zod schema is attached by the registry; typed loosely here to avoid a cycle. */
  inputSchema: unknown
  outputSchema: unknown
  permissions: string[]
  requiresAuth: boolean
  risk: RiskLevel
  timeoutMs: number
  retry: { maxAttempts: number; backoffMs: number }
  verification: string
  /** False when the backing service has no credentials. */
  available: () => boolean
  /** Human explanation when unavailable. */
  unavailableReason?: string
}

/** A reusable, independently defined capability. */
export interface SkillSpec {
  id: string
  description: string
  /** Roman/Devanagari/English trigger phrases, matched before the LLM. */
  triggers: string[]
  goalKinds: GoalKind[]
  requiredInputs: string[]
  optionalInputs: string[]
  tools: ToolName[]
  /** Ordered action ids; the planner expands these into PlanSteps. */
  workflow: { action: string; tool: ToolName; risk: RiskLevel; labelKey: string }[]
  permissions: string[]
  approvalRequired: boolean
  successCriteria: string
  failureHandling: string
}

export type { Category, Complaint, ComplaintDraft, Department, SpeechLang, UiLang }