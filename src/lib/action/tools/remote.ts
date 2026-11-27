import type { LocalToolResult } from './local'

/**
 * Tools that must run on the server, because they need credentials or a real
 * browser. The client never holds a key and never receives one.
 *
 * Every failure is reported honestly: an unconfigured service produces a
 * `not_configured` error the UI can explain, never a fabricated success.
 */

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
}

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await response.json().catch(() => null)) as T | null
    if (!response.ok) {
      const reason =
        (data as { reason?: string } | null)?.reason ??
        (response.status === 501 ? 'not-configured' : `http-${response.status}`)
      return { ok: false, status: response.status, data, error: reason }
    }
    return { ok: true, status: response.status, data }
  } catch (error) {
    return { ok: false, status: 0, data: null, error: (error as Error).message || 'network' }
  }
}

export async function runBrowserTool(
  input: Record<string, unknown>,
  mode: 'session' | 'task',
): Promise<LocalToolResult> {
  const path = mode === 'session' ? '/api/tools/browser/session' : '/api/tools/browser/task'
  const result = await post<Record<string, unknown>>(path, input)
  if (!result.ok || !result.data) {
    return {
      ok: false,
      output: {},
      error: result.error === 'not-configured' ? 'not-configured' : (result.error ?? 'Browser tool failed.'),
    }
  }
  return { ok: true, output: result.data }
}

export async function runEmailTool(input: Record<string, unknown>): Promise<LocalToolResult> {
  const result = await post<Record<string, unknown>>('/api/tools/email/send', input)
  if (!result.ok || !result.data) {
    return {
      ok: false,
      output: {},
      error: result.error === 'not-configured' ? 'not-configured' : (result.error ?? 'Email tool failed.'),
    }
  }
  return { ok: true, output: result.data }
}

export async function runHttpTool(input: Record<string, unknown>): Promise<LocalToolResult> {
  const result = await post<Record<string, unknown>>('/api/tools/http', input)
  if (!result.ok || !result.data) {
    return { ok: false, output: {}, error: result.error ?? 'HTTP tool failed.' }
  }
  return { ok: true, output: result.data }
}

export async function runDiscoveryTool(input: Record<string, unknown>): Promise<LocalToolResult> {
  const query = encodeURIComponent(String(input.query ?? ''))
  const location = input.location ? `&location=${encodeURIComponent(String(input.location))}` : ''
  try {
    const response = await fetch(`${apiBase()}/api/discovery/services?query=${query}${location}`)
    if (!response.ok) {
      return { ok: false, output: { services: [] }, error: 'The service registry is unavailable.' }
    }
    const data = (await response.json()) as { services?: Record<string, unknown>[] }
    return { ok: true, output: { services: data.services ?? [] } }
  } catch {
    return {
      ok: false,
      output: { services: [] },
      error: 'The service registry could not be reached.',
    }
  }
}