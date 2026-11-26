import { assertSafeUrl, httpAllowlist, redactSecrets, UnsafeDestinationError } from '../guard.js'

/**
 * Allowlisted HTTP tool.
 *
 * The engine may call an official endpoint, but only one on the operator's list,
 * and only with a named credential held on the server. Arbitrary URLs — from a
 * model, a webpage or an email — are refused.
 */

export interface HttpInput {
  url: string
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  authRef?: string
}

export interface HttpResult {
  ok: boolean
  status: number
  body?: unknown
  reason?: string
}

function credentialFor(authRef?: string): string | null {
  if (!authRef) return null
  // Credentials live in env under a stable name; the client only sends the name.
  const value = process.env[`ACTION_AUTH_${authRef.toUpperCase()}`]
  return value ?? null
}

export async function runHttp(input: HttpInput): Promise<HttpResult> {
  const allowlist = httpAllowlist()
  if (allowlist.length === 0) {
    return { ok: false, status: 0, reason: 'No HTTP destinations are approved on this server.' }
  }

  let url: URL
  try {
    url = assertSafeUrl(input.url, allowlist)
  } catch (error) {
    if (error instanceof UnsafeDestinationError) {
      return { ok: false, status: 0, reason: error.message }
    }
    throw error
  }

  const headers: Record<string, string> = { accept: 'application/json' }
  if (input.body) headers['content-type'] = 'application/json'
  const credential = credentialFor(input.authRef)
  if (credential) headers.authorization = `Bearer ${credential}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  try {
    const response = await fetch(url, {
      method: input.method ?? 'GET',
      headers,
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      signal: controller.signal,
    })
    const text = await response.text()
    let body: unknown = text
    try {
      body = JSON.parse(text)
    } catch {
      /* keep the raw text */
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      ...(!response.ok ? { reason: `HTTP ${response.status}` } : {}),
    }
  } catch (error) {
    return { ok: false, status: 0, reason: redactSecrets((error as Error).message) }
  } finally {
    clearTimeout(timeout)
  }
}