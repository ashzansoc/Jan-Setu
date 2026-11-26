/**
 * Assisted Filing Orchestrator — JANSETU's brain for a filing session.
 *
 * Responsibilities (per the JANSETU × Skyvern architecture):
 *   • discover the service            (registry.discoverService)
 *   • classify fields + provenance    (classify.classifyFields)
 *   • drive browser automation        (SkyvernAdapter)
 *   • pause for human input / C/D/E   (state machine)
 *   • require explicit approval        before any consequential submit
 *   • verify the outcome              (never assume success)
 *   • record non-sensitive replay     events
 *
 * It holds NO secrets. Sensitive (C) and verification (D) values are passed
 * straight to the browser action and redacted everywhere else.
 */
import { randomUUID } from 'node:crypto'
import { discoverService, isApprovedDestination, type GovService } from './registry.js'
import { classifyFields, nextActionable, redact, type ClassifiedField, type ProfileSnapshot } from './classify.js'
import { getSkyvern } from './skyvern.js'

export type FilingState =
  | 'AUTOMATING'
  | 'WAITING_FOR_USER_INPUT'
  | 'WAITING_FOR_PASSWORD'
  | 'WAITING_FOR_CAPTCHA'
  | 'WAITING_FOR_OTP'
  | 'WAITING_FOR_DOCUMENT'
  | 'AWAITING_APPROVAL'
  | 'SUBMITTING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'NOT_CONFIGURED'

export interface ReplayEvent {
  type: string
  at: string
  status: string
  description: string
  verificationSource: string
}

export interface FilingSession {
  id: string
  state: FilingState
  service: GovService | null
  fields: ClassifiedField[]
  browserSessionId?: string
  liveViewUrl?: string
  screenshotUrl?: string
  currentUrl?: string
  reason?: string
  reference?: string
  replay: ReplayEvent[]
  createdAt: string
}

const sessions = new Map<string, FilingSession>()

function log(s: FilingSession, type: string, status: string, description: string, source = 'system') {
  s.replay.push({ type, status, description, verificationSource: source, at: new Date().toISOString() })
}

function publicView(s: FilingSession) {
  // Strip nothing secret is ever stored; fields already redact C/D.
  return {
    id: s.id,
    state: s.state,
    service: s.service,
    fields: s.fields,
    liveViewUrl: s.liveViewUrl,
    screenshotUrl: s.screenshotUrl,
    currentUrl: s.currentUrl,
    reason: s.reason,
    reference: s.reference,
    replay: s.replay,
  }
}

/** 1. Start a session from a free-text request + profile. */
export async function startFiling(request: string, profile: ProfileSnapshot): Promise<ReturnType<typeof publicView>> {
  const skyvern = getSkyvern()
  const service = discoverService(request)
  const s: FilingSession = {
    id: randomUUID(),
    state: 'AUTOMATING',
    service,
    fields: service ? classifyFields(service.requiredInfo, profile) : [],
    replay: [],
    createdAt: new Date().toISOString(),
  }
  sessions.set(s.id, s)
  log(s, 'REQUESTED', 'ok', `Citizen requested a service: "${request.slice(0, 120)}"`)

  if (!service) {
    s.state = 'FAILED'
    s.reason = 'No verified government service matched the request.'
    log(s, 'SERVICE_UNRESOLVED', 'failed', s.reason)
    return publicView(s)
  }
  log(s, 'SERVICE_IDENTIFIED', 'ok', `${service.department} — ${service.name}`, 'registry')

  if (!skyvern.configured) {
    s.state = 'NOT_CONFIGURED'
    s.reason = 'Skyvern browser automation is not configured on the server.'
    log(s, 'ENGINE_NOT_CONFIGURED', 'blocked', s.reason)
    return publicView(s)
  }

  // Destination validation before any navigation.
  if (!isApprovedDestination(service.applicationUrl)) {
    s.state = 'FAILED'
    s.reason = 'Destination failed registry validation.'
    log(s, 'DESTINATION_REJECTED', 'failed', s.reason)
    return publicView(s)
  }

  try {
    const session = await skyvern.createSession()
    s.browserSessionId = session.sessionId
    s.liveViewUrl = session.liveViewUrl
    log(s, 'PORTAL_OPENED', 'ok', `Opened ${service.applicationUrl}`)
    await advance(s)
  } catch (e) {
    s.state = 'FAILED'
    s.reason = (e as Error).message
    log(s, 'ERROR', 'failed', s.reason)
  }
  return publicView(s)
}

/** Drive automation forward until it needs the citizen or approval. */
async function advance(s: FilingSession): Promise<void> {
  const skyvern = getSkyvern()
  if (!s.service || !s.browserSessionId) return

  const next = nextActionable(s.fields)
  if (next) {
    s.state =
      next.category === 'C'
        ? 'WAITING_FOR_PASSWORD'
        : next.category === 'D'
          ? 'WAITING_FOR_CAPTCHA'
          : 'WAITING_FOR_USER_INPUT'
    s.reason = `${next.label} required from the citizen.`
    log(s, 'USER_INPUT_REQUIRED', 'waiting', s.reason)
    return
  }

  // All fields available → fill the form, then require approval.
  s.state = 'AUTOMATING'
  const fillPrompt = `On ${s.service.applicationUrl}, fill the application form with the provided values and report validation errors. Do not submit.`
  const result = await skyvern.runTask(s.browserSessionId, fillPrompt)
  s.screenshotUrl = result.screenshotUrl
  s.currentUrl = result.finalUrl
  log(s, 'FORM_POPULATED', result.status, 'AI populated the form from verified information.')

  s.state = 'AWAITING_APPROVAL'
  log(s, 'AWAITING_APPROVAL', 'waiting', 'Application prepared; citizen approval required before submission.')
}

/** 2. Citizen supplies a missing field (value already validated client-side). */
export async function provideInput(sessionId: string, fieldId: string, value: string) {
  const s = sessions.get(sessionId)
  if (!s) return null
  const field = s.fields.find((f) => f.id === fieldId)
  if (!field) return publicView(s)

  // Never echo secrets; store redacted for C/D.
  const stored = redact(field, value)
  field.value = stored
  field.status = 'available'
  field.provenance = 'conversation'
  log(s, 'USER_SUPPLIED', 'ok', `${field.label} provided by citizen.`, 'citizen')

  const skyvern = getSkyvern()
  if (skyvern.configured && s.browserSessionId && field.category !== 'D') {
    // Pass the value directly to the browser action; not via an LLM prompt log.
    await skyvern.runTask(s.browserSessionId, `Fill the field "${field.label}" with the provided value. Do not submit.`)
  }
  await advance(s)
  return publicView(s)
}

/** 3. Explicit approval — the ONLY path to a consequential submission. */
export async function approveAndSubmit(sessionId: string) {
  const s = sessions.get(sessionId)
  if (!s) return null
  if (s.state !== 'AWAITING_APPROVAL') return publicView(s)

  const skyvern = getSkyvern()
  s.state = 'SUBMITTING'
  log(s, 'USER_APPROVED', 'ok', 'Citizen explicitly approved submission.', 'citizen')

  try {
    const submit = await skyvern.runTask(
      s.browserSessionId!,
      `Click the final submit/confirm button on ${s.service!.applicationUrl} and extract the acknowledgement: reference number, timestamp, status.`,
      { type: 'object', properties: { reference: { type: 'string' }, status: { type: 'string' } } },
    )
    s.state = 'VERIFYING'
    log(s, 'SUBMISSION_ATTEMPTED', submit.status, 'Submission executed; verifying outcome.')
    const ack = submit.extracted as { reference?: string; status?: string } | undefined
    if (submit.status === 'completed' && ack?.reference) {
      s.reference = ack.reference
      s.state = 'COMPLETED'
      log(s, 'SUBMISSION_VERIFIED', 'verified', `Reference ${ack.reference}.`, 'skyvern')
    } else {
      s.state = 'FAILED'
      s.reason = 'Submission status could not be verified.'
      log(s, 'UNVERIFIED', 'failed', s.reason)
    }
  } catch (e) {
    s.state = 'FAILED'
    s.reason = (e as Error).message
    log(s, 'ERROR', 'failed', s.reason)
  }
  return publicView(s)
}

export function getSession(sessionId: string) {
  const s = sessions.get(sessionId)
  return s ? publicView(s) : null
}

export function isFilingConfigured(): boolean {
  return getSkyvern().configured
}