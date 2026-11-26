import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  extractWithModel,
  isLlmConfigured,
  extractionSchema,
  runAgent,
  inferNameTraits,
  ModelUnavailableError,
} from './llm.js'
import {
  startFiling,
  provideInput,
  approveAndSubmit,
  getSession,
  isFilingConfigured,
} from './filing/orchestrator.js'
import {
  voiceConfig,
  synthesize,
  transcribe,
  isVoiceConfigured,
} from './voice/elevenlabs.js'
import { reverseGeocode } from './geo/reverse.js'
import { ORGANISATIONS } from './action/org-registry.js'
import { discover, toPublicOrganisation } from './action/discover.js'
import { playwrightProvider, sessionInfo, listSessions } from './browser/playwright-provider.js'
import {
  requestApproval,
  decideApproval,
  getApproval,
  consumeApproval,
  listApprovals,
} from './action/approval.js'
import {
  saveSession,
  markSessionClosed,
  getSession as getPersistedSession,
  listPersistedSessions,
  recordEvent,
  listEvents,
  saveEvidence,
  listEvidence,
} from './db/sessions.js'
import { searchServices } from './action/discovery.js'
import { createBrowserSession, runBrowserTask } from './action/tools/browser.js'
import { isEmailConfigured, sendEmail } from './action/tools/email.js'
import { runHttp } from './action/tools/http.js'

/**
 * Optional API process.
 *
 * The web app is fully functional without this server. Run it only to route the
 * intent step through a real model (see .env.example). Keys stay here, never in
 * the browser bundle.
 */

const app = new Hono()

app.use('/api/*', cors({ origin: (origin) => origin ?? '*' }))

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    llm: isLlmConfigured() ? 'configured' : 'not-configured',
    filing: isFilingConfigured() ? 'configured' : 'not-configured',
    voice: isVoiceConfigured() ? 'configured' : 'not-configured',
    browser: isFilingConfigured() ? 'configured' : 'not-configured',
    email: isEmailConfigured() ? 'configured' : 'not-configured',
  }),
)

// ---- Government service discovery (verified registry only) ----
app.get('/api/discovery/services', (c) => {
  const query = c.req.query('query') ?? ''
  const location = c.req.query('location')
  return c.json({ ok: true, services: searchServices(query, location) })
})

// ---- Browser tool (Skyvern) ----
app.post('/api/tools/browser/session', async (c) => {
  const result = await createBrowserSession()
  if (!result.ok) {
    return c.json({ ok: false, reason: result.reason ?? 'browser-unavailable' }, result.reason === 'not-configured' ? 501 : 502)
  }
  return c.json(result)
})

app.post('/api/tools/browser/task', async (c) => {
  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ ok: false, reason: 'bad-json' }, 400)
  }
  const url = typeof body.url === 'string' ? body.url : ''
  const objective = typeof body.objective === 'string' ? body.objective : ''
  if (!url || !objective) return c.json({ ok: false, reason: 'bad-request' }, 400)

  const result = await runBrowserTask({
    objective,
    url,
    sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    fields: (body.fields as Record<string, string> | undefined) ?? undefined,
    expect: (body.expect as 'reference' | 'status' | 'confirmation' | 'none' | undefined) ?? 'none',
  })
  if (result.reason === 'not-configured') {
    return c.json({ ok: false, reason: 'not-configured' }, 501)
  }
  return c.json(result, result.ok ? 200 : 502)
})

// ---- Email tool (Gmail API) ----
app.post('/api/tools/email/send', async (c) => {
  if (!isEmailConfigured()) {
    return c.json({ ok: false, reason: 'not-configured' }, 501)
  }
  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ ok: false, reason: 'bad-json' }, 400)
  }
  const result = await sendEmail({
    action: (body.action as 'draft' | 'send' | 'status' | undefined) ?? 'send',
    to: typeof body.to === 'string' ? body.to : '',
    subject: typeof body.subject === 'string' ? body.subject : '',
    body: typeof body.body === 'string' ? body.body : '',
    messageId: typeof body.messageId === 'string' ? body.messageId : undefined,
  })
  return c.json(result, result.ok ? 200 : 502)
})

// ---- Allowlisted HTTP tool ----
app.post('/api/tools/http', async (c) => {
  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ ok: false, reason: 'bad-json' }, 400)
  }
  const url = typeof body.url === 'string' ? body.url : ''
  if (!url) return c.json({ ok: false, reason: 'bad-request' }, 400)
  const result = await runHttp({
    url,
    method: body.method === 'POST' ? 'POST' : 'GET',
    body: (body.body as Record<string, unknown> | undefined) ?? undefined,
    authRef: typeof body.authRef === 'string' ? body.authRef : undefined,
  })
  return c.json(result, result.ok ? 200 : 502)
})

// ---- Agentic reasoning (NVIDIA Nemotron via OpenRouter) ----
app.post('/api/agent', async (c) => {
  if (!isLlmConfigured()) return c.json({ ok: false, reason: 'llm-not-configured' }, 501)
  let body: { system?: unknown; prompt?: unknown; json?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, reason: 'bad-json' }, 400)
  }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) return c.json({ ok: false, reason: 'bad-prompt' }, 400)
  const system =
    typeof body.system === 'string' && body.system.trim()
      ? body.system
      : 'You are JANSETU, an agentic assistant for Indian civic services. Be concise and factual.'
  const text = await runAgent(system, prompt, body.json === true)
  if (text === null) return c.json({ ok: false, reason: 'model-failed' }, 502)
  return c.json({ ok: true, text })
})

// ---- Avatar: infer gender + age from a name (OpenRouter) ----
app.post('/api/avatar', async (c) => {
  if (!isLlmConfigured()) return c.json({ ok: false, reason: 'llm-not-configured' }, 501)
  let body: { name?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, reason: 'bad-json' }, 400)
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 80) return c.json({ ok: false, reason: 'bad-name' }, 400)
  const traits = await inferNameTraits(name)
  if (!traits) return c.json({ ok: false, reason: 'model-failed' }, 502)
  return c.json({ ok: true, ...traits })
})

// ---- Assisted Filing Engine (Skyvern) ----
app.post('/api/filing/start', async (c) => {
  let body: { request?: unknown; profile?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, reason: 'bad-json' }, 400)
  }
  const request = typeof body.request === 'string' ? body.request.trim() : ''
  if (!request) return c.json({ ok: false, reason: 'bad-request' }, 400)
  const profile = (body.profile ?? {}) as Record<string, string>
  const session = await startFiling(request, profile)
  return c.json({ ok: true, session })
})

app.post('/api/filing/:id/input', async (c) => {
  let body: { fieldId?: unknown; value?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, reason: 'bad-json' }, 400)
  }
  const fieldId = typeof body.fieldId === 'string' ? body.fieldId : ''
  const value = typeof body.value === 'string' ? body.value : ''
  const session = await provideInput(c.req.param('id'), fieldId, value)
  if (!session) return c.json({ ok: false, reason: 'no-session' }, 404)
  return c.json({ ok: true, session })
})

app.post('/api/filing/:id/approve', async (c) => {
  const session = await approveAndSubmit(c.req.param('id'))
  if (!session) return c.json({ ok: false, reason: 'no-session' }, 404)
  return c.json({ ok: true, session })
})

app.get('/api/filing/:id', (c) => {
  const session = getSession(c.req.param('id'))
  if (!session) return c.json({ ok: false, reason: 'no-session' }, 404)
  return c.json({ ok: true, session })
})

app.post('/api/understand', async (c) => {
  if (!isLlmConfigured()) {
    // 501 is the signal for the client to use its local engine. It is not an error.
    return c.json({ ok: false, reason: 'llm-not-configured' }, 501)
  }

  let body: { text?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, reason: 'bad-json' }, 400)
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > 1200) {
    return c.json({ ok: false, reason: 'bad-text' }, 400)
  }

  let extraction
  try {
    extraction = await extractWithModel(text)
  } catch (error) {
    // A rate limit or outage is not a bad request: say which, so the client can
    // fall back to the local engine and the operator can see the real cause.
    const failure = error as { message?: string; status?: number }
    if (failure instanceof ModelUnavailableError) {
      return c.json({ ok: false, reason: failure.message, status: failure.status }, failure.status === 429 ? 429 : 502)
    }
    throw error
  }
  if (!extraction) {
    return c.json({ ok: false, reason: 'model-failed' }, 502)
  }

  const validated = extractionSchema.safeParse(extraction)
  if (!validated.success) {
    return c.json({ ok: false, reason: 'schema-mismatch' }, 502)
  }

  return c.json({ ok: true, extraction: validated.data })
})

// ---- Organisation & service discovery ----
app.get('/api/action/organisations', (c) => c.json({ ok: true, organisations: ORGANISATIONS.map(toPublicOrganisation) }))

app.post('/api/action/discover', async (c) => {
  let body: { category?: unknown; locality?: unknown; providerHint?: unknown; purpose?: unknown }
  try { body = await c.req.json() } catch { return c.json({ ok: false, reason: 'bad-json' }, 400) }
  const category = String(body.category ?? '')
  if (!category) return c.json({ ok: false, reason: 'bad-category' }, 400)
  const outcome = discover({
    category: category as never,
    locality: typeof body.locality === 'string' ? body.locality : undefined,
    providerHint: typeof body.providerHint === 'string' ? body.providerHint : undefined,
    purpose: typeof body.purpose === 'string' ? (body.purpose as never) : undefined,
  })
  if (outcome.status === 'resolved') {
    return c.json({
      ok: true,
      status: 'resolved',
      basis: outcome.basis,
      organisation: toPublicOrganisation(outcome.organisation),
      service: outcome.service.id,
    })
  }
  if (outcome.status === 'ambiguous') {
    return c.json({
      ok: true,
      status: 'ambiguous',
      questionKey: outcome.questionKey,
      candidates: outcome.candidates.map(toPublicOrganisation),
    })
  }
  return c.json({ ok: true, status: 'unsupported', category: outcome.category })
})

// ---- Managed browser (deterministic reads; no submission) ----
app.post('/api/browser/sessions', async (c) => {
  let body: { userId?: unknown; organisationId?: unknown } = {}
  try { body = await c.req.json() } catch { /* default */ }
  const userId = typeof body.userId === 'string' && body.userId ? body.userId : 'anonymous'
  try {
    const info = await playwrightProvider.createSession({
      userId,
      organisationId: typeof body.organisationId === 'string' ? body.organisationId : undefined,
    })
    saveSession(info)
    recordEvent({ sessionId: info.id, type: 'session-created', detail: { organisationId: info.organisationId } })
    return c.json({ ok: true, session: info })
  } catch (error) {
    return c.json({ ok: false, reason: (error as Error).message }, 500)
  }
})

app.post('/api/browser/:id/open', async (c) => {
  let body: { url?: unknown } = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, reason: 'bad-json' }, 400) }
  const url = typeof body.url === 'string' ? body.url : ''
  if (!url) return c.json({ ok: false, reason: 'bad-url' }, 400)
  if (!sessionInfo(c.req.param('id'))) return c.json({ ok: false, reason: 'no-session' }, 404)
  try {
    const page = await playwrightProvider.open(c.req.param('id'), url)
    recordEvent({ sessionId: c.req.param('id'), type: 'page-opened', url: page.url })
    saveEvidence({
      sessionId: c.req.param('id'),
      kind: 'snapshot',
      url: page.url,
      label: page.title || page.url,
      body: page.text,
    })
    const persisted = getPersistedSession(c.req.param('id'))
    if (persisted) saveSession({ ...persisted, status: page.looksLikeLogin ? 'login-required' : persisted.status, currentUrl: page.url })
    return c.json({ ok: true, page })
  } catch (error) {
    const reason = (error as Error).message
    const status = reason === 'host-not-approved' ? 403 : reason === 'private-host-blocked' ? 403 : 502
    return c.json({ ok: false, reason }, status)
  }
})

app.get('/api/browser/:id', async (c) => {
  const info = sessionInfo(c.req.param('id'))
  if (!info) return c.json({ ok: false, reason: 'no-session' }, 404)
  try {
    const page = await playwrightProvider.inspect(c.req.param('id'))
    return c.json({ ok: true, session: info, page })
  } catch (error) {
    return c.json({ ok: false, reason: (error as Error).message }, 502)
  }
})

app.get('/api/browser/:id/screenshot', async (c) => {
  if (!sessionInfo(c.req.param('id'))) return c.json({ ok: false, reason: 'no-session' }, 404)
  try {
    const shot = await playwrightProvider.screenshot(c.req.param('id'))
    return c.json({ ok: true, ...shot })
  } catch (error) {
    return c.json({ ok: false, reason: (error as Error).message }, 502)
  }
})

app.delete('/api/browser/:id', async (c) => {
  await playwrightProvider.close(c.req.param('id'))
  markSessionClosed(c.req.param('id'))
  recordEvent({ sessionId: c.req.param('id'), type: 'session-closed' })
  return c.json({ ok: true })
})

app.get('/api/browser', (c) => c.json({ ok: true, sessions: listSessions() }))

// ---- Evidence & events (Action Replay source) ----
app.get('/api/browser/:id/events', (c) => c.json({ ok: true, events: listEvents(c.req.param('id')) }))
app.get('/api/browser/:id/evidence', (c) => c.json({ ok: true, evidence: listEvidence(c.req.param('id')) }))
app.get('/api/sessions', (c) => c.json({ ok: true, sessions: listPersistedSessions() }))

// ---- Approval gate for consequential actions ----
app.post('/api/action/approvals', async (c) => {
  let body: {
    userId?: unknown; sessionId?: unknown; organisationId?: unknown
    action?: unknown; url?: unknown; payload?: unknown; summary?: unknown
  } = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, reason: 'bad-json' }, 400) }

  const action = String(body.action ?? '')
  if (!['fill', 'click', 'submit', 'upload'].includes(action)) {
    return c.json({ ok: false, reason: 'bad-action' }, 400)
  }
  const payload = (body.payload ?? {}) as Record<string, unknown>
  const record = requestApproval({
    userId: typeof body.userId === 'string' ? body.userId : 'anonymous',
    sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    organisationId: typeof body.organisationId === 'string' ? body.organisationId : undefined,
    action: action as never,
    url: typeof body.url === 'string' ? body.url : '',
    payload,
    summary: typeof body.summary === 'string' ? body.summary : `${action} on ${String(body.url ?? '')}`,
  })
  return c.json({ ok: true, approval: record })
})

app.get('/api/action/approvals', (c) =>
  c.json({ ok: true, approvals: listApprovals(c.req.query('sessionId') ?? undefined) }),
)

app.get('/api/action/approvals/:id', (c) => {
  const approval = getApproval(c.req.param('id'))
  if (!approval) return c.json({ ok: false, reason: 'not-found' }, 404)
  return c.json({ ok: true, approval })
})

app.post('/api/action/approvals/:id', async (c) => {
  let body: { decision?: unknown } = {}
  try { body = await c.req.json() } catch { /* default */ }
  const decision = body.decision === 'rejected' ? 'rejected' : body.decision === 'approved' ? 'approved' : null
  if (!decision) return c.json({ ok: false, reason: 'bad-decision' }, 400)
  const approval = decideApproval(c.req.param('id'), decision)
  if (!approval) return c.json({ ok: false, reason: 'not-found' }, 404)
  return c.json({ ok: true, approval })
})

// ---- Approval-gated browser actions ----
app.post('/api/browser/:id/fill', async (c) => {
  let body: { approvalId?: unknown; selector?: unknown; value?: unknown; url?: unknown } = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, reason: 'bad-json' }, 400) }
  const sessionId = c.req.param('id')
  const selector = String(body.selector ?? '')
  const value = String(body.value ?? '')
  const approvalId = String(body.approvalId ?? '')
  if (!selector || !approvalId) return c.json({ ok: false, reason: 'missing-approval' }, 400)

  const payload = { selector, value }
  if (!consumeApproval(approvalId, 'fill', payload)) {
    return c.json({ ok: false, reason: 'approval-invalid' }, 403)
  }
  const result = await playwrightProvider.fill(sessionId, selector, value)
  recordEvent({ sessionId, type: 'field-filled', detail: { selector, approved: approvalId } })
  return c.json({ ...result })
})

app.post('/api/browser/:id/click', async (c) => {
  let body: { approvalId?: unknown; selector?: unknown } = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, reason: 'bad-json' }, 400) }
  const sessionId = c.req.param('id')
  const selector = String(body.selector ?? '')
  const approvalId = String(body.approvalId ?? '')
  if (!selector || !approvalId) return c.json({ ok: false, reason: 'missing-approval' }, 400)

  const payload = { selector }
  if (!consumeApproval(approvalId, 'click', payload)) {
    return c.json({ ok: false, reason: 'approval-invalid' }, 403)
  }
  const result = await playwrightProvider.click(sessionId, selector)
  recordEvent({ sessionId, type: 'element-clicked', detail: { selector, approved: approvalId } })
  return c.json({ ...result })
})

// ---- Reverse geocoding (coordinates -> a speakable address) ----
app.get('/api/geo/reverse', async (c) => {
  const lat = Number(c.req.query('lat'))
  const lon = Number(c.req.query('lon'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return c.json({ ok: false, reason: 'bad-coords' }, 400)
  }
  const result = await reverseGeocode(lat, lon)
  if (!result) return c.json({ ok: false, reason: 'not-found' }, 404)
  return c.json({ ok: true, ...result })
})

// ---- Voice (ElevenLabs proxy; the key never leaves the server) ----
app.get('/api/voice/config', (c) => c.json(voiceConfig()))

app.post('/api/voice/tts', async (c) => {
  let body: { text?: unknown; lang?: unknown; rate?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, reason: 'bad-json' }, 400)
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > 5000) return c.json({ ok: false, reason: 'bad-text' }, 400)
  if (!isVoiceConfigured()) return c.json({ ok: false, reason: 'voice-not-configured' }, 501)

  const lang = typeof body.lang === 'string' ? body.lang : undefined
  const rate = typeof body.rate === 'number' && body.rate > 0 ? body.rate : undefined

  try {
    const upstream = await synthesize(text, { lang, rate })
    if (!upstream) return c.json({ ok: false, reason: 'voice-not-configured' }, 501)
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 200) : 'tts-failed'
    return c.json({ ok: false, reason }, 502)
  }
})

app.post('/api/voice/transcribe', async (c) => {
  if (!isVoiceConfigured()) return c.json({ ok: false, reason: 'voice-not-configured' }, 501)

  const form = await c.req.parseBody()
  const file = form.file
  if (!(file instanceof File)) return c.json({ ok: false, reason: 'bad-file' }, 400)

  const lang = typeof form.language_code === 'string' ? form.language_code : undefined

  try {
    const text = await transcribe(file, lang)
    if (text === null) return c.json({ ok: false, reason: 'voice-not-configured' }, 501)
    return c.json({ ok: true, text })
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 200) : 'stt-failed'
    return c.json({ ok: false, reason }, 502)
  }
})

const port = Number(process.env.PORT ?? 8787)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[jansetu api] listening on http://127.0.0.1:${info.port}`)
  console.log(
    `[jansetu api] model step: ${isLlmConfigured() ? 'enabled' : 'disabled (local engine will be used)'}`,
  )
  console.log(
    `[jansetu api] voice: ${isVoiceConfigured() ? `elevenlabs (${voiceConfig().voiceId})` : 'not-configured (Web Speech fallback)'}`,
  )
})
