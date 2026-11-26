import type { ActionEvent, ActionTask, ComplaintDraft, PlanStep } from './types'
import { useActions } from './store'
import { resolveDepartment } from '@/lib/complaints/departments'
import { analyze } from '@/lib/ai/engine'
import { useSettings } from '@/state/settings'
import { CATEGORY_LABEL } from '@/lib/complaints/types'
import { callTool } from './tools'
import { checkStepGate, payloadFingerprint } from './permissions'
import { aggregateVerification, verifyStep } from './verify'
import { classifyFailure, explainFailure, isIrreversible, isRetryable, retryDelayMs } from './recovery'
import { canTransition, isTerminal } from './status'

/**
 * The execution engine.
 *
 * A persistent loop over the plan: pick the next runnable step, check its gate,
 * call the tool, verify the result, record it, repeat. Every transition and every
 * step result is written to the store immediately, so the task can be resumed
 * after a restart from the last verified step.
 */

const running = new Set<string>()
const MAX_ITERATIONS = 60

function task(taskId: string): ActionTask | undefined {
  return useActions.getState().get(taskId)
}

function patch(id: string, extra: Partial<ActionTask>): void {
  useActions.getState().patchTask(id, extra)
}

function step(id: string, stepId: string, changes: Partial<PlanStep>): void {
  useActions.getState().updateStep(id, stepId, changes)
}

type EventKind = ActionEvent['kind']

function event(
  id: string,
  kind: EventKind,
  title: string,
  status: ActionEvent['status'] = 'ok',
  detail?: string,
  source?: string,
): void {
  useActions.getState().pushEvent(id, { kind, title, status, detail, source })
}

/** Builds the complaint draft a create step will file. */
function buildDraft(current: ActionTask): ComplaintDraft | null {
  const intent = current.intent
  if (!intent) return null
  const extraction = analyze(intent.originalRequest, { speechLang: intent.speechLang }).extraction
  const category = intent.goals[0]?.category ?? extraction.category
  const label = extraction.location ?? current.values.location ?? ''
  if (!label) return null
  const department = resolveDepartment(category, label)
  return {
    category,
    problem: CATEGORY_LABEL[category].en,
    description: '',
    location: { label },
    durationDays: extraction.durationDays ?? undefined,
    urgency: extraction.urgency,
    department,
    speechLang: intent.speechLang,
    transcript: intent.originalRequest,
  }
}

/** A usable subject when the citizen did not dictate one. */
function defaultSubject(current: ActionTask): string {
  return current.intent?.goals[0]?.description ?? 'JANSETU'
}

/** Values a step cannot proceed without, and who must supply them. */
const REQUIRED_INPUTS: Record<
  string,
  { field: string; type: 'recipient' | 'user_input'; reason: string }[]
> = {
  draft_email: [
    {
      field: 'recipient',
      type: 'recipient',
      reason: 'An official email address is needed before a message can be drafted.',
    },
  ],
  send_email: [
    {
      field: 'recipient',
      type: 'recipient',
      reason: 'An official email address is needed before a message can be sent.',
    },
  ],
}

/** Maps a plan step to the payload its tool expects. */
function buildInput(current: ActionTask, planStep: PlanStep): Record<string, unknown> {
  const values = current.values
  const draftOutput = current.plan?.steps.find((item) => item.action === 'draft_email')?.output

  switch (planStep.action) {
    case 'identify_department':
    case 'check_online_channel':
      return { query: current.intent?.originalRequest ?? '', location: values.location }
    case 'find_official_contact':
      return { query: current.intent?.originalRequest ?? '', location: values.location }
    case 'prepare_complaint': {
      const draft = buildDraft(current)
      return draft ? { action: 'create', draft: draft as unknown as Record<string, unknown> } : {}
    }
    case 'prepare_follow_up': {
      const draft = buildDraft(current)
      return draft ? { action: 'create', draft: draft as unknown as Record<string, unknown> } : {}
    }
    case 'submit_complaint':
    case 'submit_follow_up':
      return { action: 'submit', id: current.complaintId ?? '' }
    case 'read_status':
      return current.complaintId
        ? { action: 'status', id: current.complaintId }
        : { query: current.intent?.originalRequest ?? '' }
    case 'verify_reference':
      return current.complaintId ? { action: 'status', id: current.complaintId } : {}
    case 'draft_email':
      return {
        action: 'draft',
        to: values.recipient ?? '',
        subject: values.subject ?? defaultSubject(current),
        body: values.body ?? '',
      }
    case 'send_email':
      return {
        action: 'send',
        to: values.recipient ?? (draftOutput?.to as string | undefined) ?? '',
        subject:
          values.subject ?? (draftOutput?.subject as string | undefined) ?? defaultSubject(current),
        body: values.body ?? (draftOutput?.body as string | undefined) ?? '',
      }
    case 'verify_email':
      return { action: 'status', messageId: current.emailMessageId ?? '' }
    case 'open_portal':
    case 'fill_form':
    case 'submit_form':
    case 'extract_reference':
    case 'upload_documents':
    case 'verify_upload':
      return {
        objective: planStep.labelKey.replace(/_/g, ' '),
        url: values.portalUrl ?? '',
        fields: values.fields ? JSON.parse(values.fields) as Record<string, string> : undefined,
        expect:
          planStep.action === 'extract_reference'
            ? 'reference'
            : planStep.action === 'submit_form'
              ? 'confirmation'
              : 'none',
        ...(current.browserSessionId ? { sessionId: current.browserSessionId } : {}),
      }
    case 'collect_documents':
      return { name: values.documentName ?? 'document', dataUrl: values.documentDataUrl ?? '' }
    case 'collect_missing':
      return { fields: Object.keys(values) }
    case 'notify_user':
      return { title: 'JANSETU', body: current.intent?.goals[0]?.description ?? 'Task update' }
    case 'request_approval':
      return {}
    default:
      return {}
  }
}

async function failTask(id: string, reason: string, kind: 'failed' | 'partially_completed'): Promise<void> {
  event(id, 'error', reason, 'failed')
  useActions.getState().transition(id, 'verifying', reason)
  useActions.getState().transition(id, kind, reason)
}

async function loop(taskId: string): Promise<void> {
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const current = task(taskId)
    if (!current || isTerminal(current.state)) return
    // A pause takes effect at the next step boundary, never mid-action: an
    // irreversible step that has started must be allowed to finish.
    if (current.paused) return

    if (!current.plan) {
      const { buildPlan } = await import('./planner')
      const plan = buildPlan(current.intent!, taskId)
      useActions.getState().attachPlan(taskId, plan)
      useActions.getState().transition(taskId, 'planning')
      useActions.getState().transition(taskId, 'ready_to_execute')
      continue
    }

    const steps = current.plan.steps
    const next = steps.find(
      (candidate) =>
        (candidate.status === 'ready' || candidate.status === 'blocked') &&
        candidate.dependsOn.every(
          (dependency) => steps.find((item) => item.id === dependency)?.status === 'done',
        ),
    )

    if (!next) {
      const pending = steps.filter((item) => item.status === 'running')
      if (pending.length > 0) return
      const verifications = steps
        .map((item) => item.verification)
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
      useActions.getState().transition(taskId, 'verifying')
      useActions.getState().finish(taskId, aggregateVerification(verifications), {
        complaintId: current.complaintId,
        emailMessageId: current.emailMessageId,
      })
      return
    }

    // A blocked step whose tool is now available becomes runnable.
    if (next.status === 'blocked') {
      const gate = checkStepGate(current, next)
      if (!gate.ok && !gate.reason?.includes('approval')) {
        await failTask(taskId, gate.reason ?? 'A required tool is unavailable.', 'failed')
        return
      }
      step(taskId, next.id, { status: 'ready' })
    }

    // The approval marker hands control to the citizen for the next risky step.
    if (next.action === 'request_approval') {
      const target = current.plan.steps.find(
        (candidate) => candidate.risk >= 2 && candidate.status !== 'done',
      )
      step(taskId, next.id, { status: 'done' })
      if (target) {
        useActions.getState().openHandoff(taskId, {
          taskId,
          stepId: target.id,
          type: 'approval',
          prompt: target.labelKey.replace(/_/g, ' '),
          inputType: 'confirm',
          reason: 'This step contacts an external service and needs your explicit approval.',
        })
        event(taskId, 'handoff', 'Waiting for your approval', 'waiting', target.labelKey, 'citizen')
      }
      continue
    }

    const gate = checkStepGate(current, next)
    if (!gate.ok) {
      // An unavailable tool is a configuration gap, not a task failure: record it
      // and move on so the remaining goals can still complete.
      if (gate.reason?.includes('not configured') || gate.reason?.includes('unavailable')) {
        step(taskId, next.id, {
          status: 'skipped',
          error: gate.reason,
          finishedAt: new Date().toISOString(),
        })
        event(taskId, 'error', `${next.labelKey.replace(/_/g, ' ')} skipped`, 'unknown', gate.reason, next.tool)
        continue
      }
      if (gate.reason?.includes('approval')) {
        useActions.getState().openHandoff(taskId, {
          taskId,
          stepId: next.id,
          type: 'approval',
          prompt: next.labelKey.replace(/_/g, ' '),
          inputType: 'confirm',
          reason: gate.reason,
        })
        event(taskId, 'handoff', 'Waiting for your approval', 'waiting', next.labelKey, 'citizen')
        return
      }
      await failTask(taskId, gate.reason ?? 'A required tool is unavailable.', 'failed')
      return
    }

    // Some steps need a value only the citizen can give (an email address, for
    // example). Ask for it here rather than letting the tool fail.
    const required = REQUIRED_INPUTS[next.action]
    const missingInput = required?.find((field) => !current.values[field.field])
    if (missingInput) {
      step(taskId, next.id, { status: 'blocked' })
      useActions.getState().openHandoff(taskId, {
        taskId,
        stepId: next.id,
        type: missingInput.type,
        field: missingInput.field,
        prompt: missingInput.field,
        inputType: missingInput.type === 'recipient' ? 'text' : 'text',
        reason: missingInput.reason,
      })
      event(taskId, 'handoff', `Needed: ${missingInput.field}`, 'waiting', missingInput.reason, next.tool)
      return
    }

    // ---- execute ----
    useActions.getState().transition(taskId, 'executing')
    step(taskId, next.id, {
      status: 'running',
      attempts: next.attempts + 1,
      startedAt: new Date().toISOString(),
    })
    patch(taskId, { currentStepId: next.id })
    event(taskId, 'tool_call', next.labelKey.replace(/_/g, ' '), 'ok', next.tool, next.tool)

    const input = buildInput(current, next)
    const outcome = await callTool(next.tool, input)

    if (!outcome.ok) {
      const message = outcome.error ?? 'The tool failed.'
      const kind = classifyFailure(new Error(message))

      if (kind === 'not_configured') {
        // Prefer the tool's own explanation, which names what to configure.
        const { toolUnavailableReason } = await import('./registry')
        const stripped = message.replace(/^not-configured:?\s*/, '').trim()
        const reason =
          toolUnavailableReason(next.tool) ??
          (stripped || `${next.tool} is not configured on the server.`)
        step(taskId, next.id, { status: 'failed', error: reason, finishedAt: new Date().toISOString() })
        await failTask(taskId, reason, 'failed')
        return
      }

      if (kind === 'human_required') {
        step(taskId, next.id, { status: 'blocked', error: message })
        useActions.getState().openHandoff(taskId, {
          taskId,
          stepId: next.id,
          type: 'captcha',
          prompt: 'Complete the verification challenge to continue',
          inputType: 'image',
          reason: explainFailure(kind),
        })
        event(taskId, 'handoff', 'A verification step needs you', 'waiting', message, next.tool)
        return
      }

      const tool = next.tool
      const maxAttempts = tool === 'email' || tool === 'http' ? 2 : 1
      if (isRetryable(kind) && next.attempts < maxAttempts) {
        event(taskId, 'recovery', `Retrying after ${explainFailure(kind)}`, 'waiting', message, next.tool)
        await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs(next.attempts, 800)))
        step(taskId, next.id, { status: 'ready' })
        continue
      }

      if (isIrreversible(next.action) || kind === 'duplicate_risk') {
        step(taskId, next.id, {
          status: 'unknown',
          error: message,
          finishedAt: new Date().toISOString(),
        })
        event(
          taskId,
          'recovery',
          'Not retried: the outcome is uncertain',
          'unknown',
          explainFailure(kind),
          next.tool,
        )
        await failTask(taskId, explainFailure(kind), 'partially_completed')
        return
      }

      step(taskId, next.id, { status: 'failed', error: message, finishedAt: new Date().toISOString() })
      await failTask(taskId, explainFailure(kind), 'failed')
      return
    }

    const verification = verifyStep(next.tool, outcome.output)
    step(taskId, next.id, {
      status: verification.status === 'failed' ? 'failed' : 'done',
      output: outcome.output,
      verification,
      finishedAt: new Date().toISOString(),
    })

    if (next.action === 'prepare_complaint' || next.action === 'prepare_follow_up') {
      const id = typeof outcome.output.id === 'string' ? outcome.output.id : null
      if (id) patch(taskId, { complaintId: id })
    }
    if (next.action === 'send_email') {
      const messageId = typeof outcome.output.messageId === 'string' ? outcome.output.messageId : null
      if (messageId) patch(taskId, { emailMessageId: messageId })
    }
    if (next.action === 'open_portal' && typeof outcome.output.sessionId === 'string') {
      patch(taskId, { browserSessionId: outcome.output.sessionId } as Partial<ActionTask>)
    }

    event(
      taskId,
      'tool_result',
      `${next.labelKey.replace(/_/g, ' ')} — ${verification.status}`,
      verification.status === 'verified' ? 'ok' : verification.status === 'failed' ? 'failed' : 'unknown',
      verification.reason,
      next.tool,
    )

    if (verification.status === 'failed') {
      await failTask(taskId, verification.reason ?? 'Verification failed.', 'failed')
      return
    }
  }
}

/** Entry point: understand the request, plan it, then execute. */
export async function startTask(raw: string): Promise<string> {
  const { understand } = await import('./intent')
  const settings = useSettings.getState()
  const intent = await understand(raw, { uiLang: settings.uiLang, speechLang: settings.speechLang })

  const created = useActions.getState().createTask(intent)
  event(created.id, 'intent', 'Request understood', 'ok', intent.goals.map((goal) => goal.description).join(' + '), 'engine')
  useActions.getState().transition(created.id, 'understanding')

  if (intent.needsClarification) {
    useActions.getState().transition(created.id, 'waiting_for_information', intent.clarification ?? null)
    return created.id
  }

  // A single-goal task whose consequential tool is not configured cannot succeed,
  // so report that before asking the citizen for content or approval. Multi-goal
  // tasks continue and report the blocked goal as partial.
  const { getTool, toolUnavailableReason } = await import('./registry')
  const { skillsForGoal } = await import('./skills')
  const onlySkill = intent.goals.length === 1 ? skillsForGoal(intent.goals[0].kind)[0] : undefined
  const unavailable = onlySkill?.tools
    .map((name) => getTool(name))
    .find((tool) => tool.risk >= 2 && !tool.available())

  if (unavailable) {
    const reason = toolUnavailableReason(unavailable.name) ?? `${unavailable.name} is unavailable.`
    event(created.id, 'error', 'Cannot start this task', 'failed', reason, unavailable.name)
    useActions.getState().transition(created.id, 'failed', reason)
    return created.id
  }

  // Collect what the citizen must supply before anything can be planned. The
  // engine asks for the missing field rather than inventing a location.
  const missing = intent.missing.find((item) => item.source === 'user')
  if (missing) {
    useActions.getState().openHandoff(created.id, {
      taskId: created.id,
      stepId: 'collect',
      type: 'user_input',
      field: missing.field,
      prompt: missing.field,
      inputType: 'text',
      reason: missing.reason,
    })
    event(created.id, 'handoff', `Needed: ${missing.field}`, 'waiting', missing.reason, 'engine')
    return created.id
  }

  const { buildPlan } = await import('./planner')
  const plan = buildPlan(intent, created.id)
  useActions.getState().attachPlan(created.id, plan)

  useActions.getState().transition(created.id, 'planning')
  useActions.getState().transition(created.id, 'ready_to_execute')

  void runTask(created.id)
  return created.id
}

/** Resumes or starts the execution loop for a task. */
export async function runTask(taskId: string): Promise<void> {
  if (running.has(taskId)) return
  const current = task(taskId)
  if (!current || isTerminal(current.state) || current.paused) return
  running.add(taskId)
  try {
    if (canTransition(current.state, 'executing')) {
      useActions.getState().transition(taskId, 'executing')
    }
    await loop(taskId)
  } finally {
    running.delete(taskId)
  }
}

/** The citizen answered a handoff (text, OTP, document, CAPTCHA). */
export async function provideHandoffValue(taskId: string, value: string): Promise<void> {
  const current = task(taskId)
  const handoff = current?.handoff
  if (!current || !handoff) return

  const secret = handoff.type === 'password' || handoff.type === 'otp' || handoff.type === 'captcha'
  const field = handoff.field ?? handoff.type

  if (!secret) {
    patch(taskId, { values: { ...current.values, [field]: value } })
  }
  // The step that asked is runnable again now that the value exists.
  if (handoff.stepId && handoff.stepId !== 'collect') {
    step(taskId, handoff.stepId, { status: 'ready', error: undefined })
  }
  useActions.getState().resolveHandoff(taskId, secret ? 'Provided securely' : value.slice(0, 80))
  useActions.getState().transition(taskId, 'executing')
  void runTask(taskId)
}

/** The citizen supplied a document for an upload step. */
export async function provideDocument(taskId: string, name: string, dataUrl: string): Promise<void> {
  const current = task(taskId)
  if (!current) return
  patch(taskId, {
    values: { ...current.values, documentName: name, documentDataUrl: dataUrl },
  })
  const handoff = current.handoff
  if (handoff?.stepId) step(taskId, handoff.stepId, { status: 'ready', error: undefined })
  useActions.getState().resolveHandoff(taskId, name)
  useActions.getState().transition(taskId, 'executing')
  void runTask(taskId)
}

/** The citizen approved a specific step. */
export async function approveStep(taskId: string, stepId: string): Promise<void> {
  const current = task(taskId)
  if (!current?.plan) return
  const planStep = current.plan.steps.find((item) => item.id === stepId)
  if (!planStep) return

  useActions.getState().addApproval(taskId, {
    taskId,
    stepId,
    planHash: current.plan.planHash,
    payloadHash: payloadFingerprint(planStep),
    destination: current.intent?.entities.department ?? 'external service',
    risk: planStep.risk,
    channel: 'explicit_tap',
  })
  if (current.handoff?.type === 'approval') {
    useActions.getState().resolveHandoff(taskId, 'Approved')
  }
  useActions.getState().transition(taskId, 'executing')
  void runTask(taskId)
}

/** Pause at the next step boundary. Work already in flight is allowed to finish. */
export function pauseTask(taskId: string): void {
  const current = task(taskId)
  if (!current || isTerminal(current.state)) return
  running.delete(taskId)
  useActions.getState().patchTask(taskId, { paused: true })
  useActions.getState().pushEvent(taskId, {
    kind: 'state',
    title: 'Paused by you',
    status: 'ok',
    detail: 'Completed steps are kept; resume to continue.',
  })
}

/** Resume a paused task from its last verified step. */
export async function resumeTask(taskId: string): Promise<void> {
  const current = task(taskId)
  if (!current) return
  useActions.getState().patchTask(taskId, { paused: false })
  useActions.getState().pushEvent(taskId, { kind: 'state', title: 'Resumed', status: 'ok' })
  if (canTransition(current.state, 'executing')) {
    useActions.getState().transition(taskId, 'executing')
  }
  await runTask(taskId)
}

export function cancelTask(taskId: string): void {
  running.delete(taskId)
  useActions.getState().cancel(taskId)
}

export { isTerminal }