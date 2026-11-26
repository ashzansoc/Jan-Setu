import { getSkyvern } from '../../filing/skyvern.js'
import { isApprovedDestination } from '../../filing/registry.js'
import { assertSafeUrl, UnsafeDestinationError } from '../guard.js'

/**
 * Browser tool.
 *
 * A thin, explicit surface over the existing Skyvern adapter: create a session,
 * run one structured task, read the result. The destination is validated against
 * the verified registry before a browser is ever opened, and the adapter itself
 * reports `configured: false` when no credentials exist — which becomes an
 * honest NOT_CONFIGURED result rather than a simulated page.
 */

export interface BrowserSessionResult {
  ok: boolean
  sessionId?: string
  liveViewUrl?: string
  reason?: string
}

export async function createBrowserSession(): Promise<BrowserSessionResult> {
  const skyvern = getSkyvern()
  if (!skyvern.configured) {
    return { ok: false, reason: 'not-configured' }
  }
  try {
    const session = await skyvern.createSession()
    return { ok: true, sessionId: session.sessionId, liveViewUrl: session.liveViewUrl }
  } catch (error) {
    return { ok: false, reason: (error as Error).message }
  }
}

export interface BrowserTaskInput {
  objective: string
  url: string
  sessionId?: string
  fields?: Record<string, string>
  expect?: 'reference' | 'status' | 'confirmation' | 'none'
}

export interface BrowserTaskResult {
  ok: boolean
  status: 'completed' | 'failed' | 'needs_human'
  sessionId?: string
  reference?: string
  finalUrl?: string
  screenshotUrl?: string
  reason?: string
}

export async function runBrowserTask(input: BrowserTaskInput): Promise<BrowserTaskResult> {
  const skyvern = getSkyvern()
  if (!skyvern.configured) {
    return { ok: false, status: 'failed', reason: 'not-configured' }
  }

  // Destination validation happens before any navigation.
  try {
    assertSafeUrl(input.url)
  } catch (error) {
    if (error instanceof UnsafeDestinationError) {
      return { ok: false, status: 'failed', reason: error.message }
    }
    return { ok: false, status: 'failed', reason: (error as Error).message }
  }
  if (!isApprovedDestination(input.url)) {
    return {
      ok: false,
      status: 'failed',
      reason: 'That destination is not in the verified service registry.',
    }
  }

  try {
    const sessionId = input.sessionId ?? (await skyvern.createSession()).sessionId

    const fieldLines = Object.entries(input.fields ?? {})
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
    const prompt = [
      `On ${input.url}, ${input.objective}.`,
      fieldLines ? `Use exactly these values:\n${fieldLines}` : '',
      'Do not submit anything unless the objective is to submit.',
    ]
      .filter(Boolean)
      .join('\n')

    const result = await skyvern.runTask(sessionId, prompt, {
      type: 'object',
      properties: {
        reference: { type: 'string' },
        status: { type: 'string' },
      },
    })

    const extracted = (result.extracted ?? {}) as { reference?: string; status?: string }
    const completed = result.status === 'completed'

    return {
      ok: completed,
      status: completed ? 'completed' : result.status === 'pending' ? 'needs_human' : 'failed',
      sessionId,
      ...(extracted.reference ? { reference: extracted.reference } : {}),
      ...(result.finalUrl ? { finalUrl: result.finalUrl } : {}),
      ...(result.screenshotUrl ? { screenshotUrl: result.screenshotUrl } : {}),
      ...(!completed && !extracted.reference
        ? {
            reason:
              result.status === 'pending'
                ? 'The browser task is still pending; it may need the citizen.'
                : 'The portal did not confirm the action.',
          }
        : {}),
    }
  } catch (error) {
    return { ok: false, status: 'failed', reason: (error as Error).message }
  }
}