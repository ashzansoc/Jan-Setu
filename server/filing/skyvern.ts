/**
 * Skyvern Integration Service — the ONLY module that talks to Skyvern.
 *
 * The rest of JANSETU depends on the `SkyvernAdapter` interface, never on
 * Skyvern's wire format. Credentials live only here, read from env:
 *
 *   SKYVERN_BASE_URL   e.g. https://api.skyvern.com  (or self-hosted origin)
 *   SKYVERN_API_KEY    Skyvern Cloud API key
 *   SKYVERN_MODE       "cloud" | "self-hosted"  (default: cloud)
 *
 * When credentials are absent the adapter reports `configured: false` and the
 * orchestrator surfaces a clear "needs setup" state — it NEVER fakes a
 * browser session or a successful submission.
 *
 * Docs: https://www.skyvern.com/developers
 * Repo: https://github.com/Skyvern-AI/skyvern  (AGPL-3.0 — review before
 *        incorporating into a proprietary backend.)
 *
 * NOTE: Skyvern's REST schema evolves. The calls below are isolated behind
 * this adapter so they can be updated in one place against the current
 * OpenAPI spec without touching the engine.
 */

export interface SkyvernConfig {
  baseUrl: string
  apiKey: string
  mode: 'cloud' | 'self-hosted'
}

export function getSkyvernConfig(): SkyvernConfig | null {
  const baseUrl = process.env.SKYVERN_BASE_URL?.trim()
  const apiKey = process.env.SKYVERN_API_KEY?.trim()
  if (!baseUrl || !apiKey) return null
  const mode = process.env.SKYVERN_MODE === 'self-hosted' ? 'self-hosted' : 'cloud'
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, mode }
}

export interface BrowserSession {
  sessionId: string
  liveViewUrl?: string
}

export interface RunTaskResult {
  status: 'completed' | 'failed' | 'pending'
  extracted?: unknown
  screenshotUrl?: string
  finalUrl?: string
  error?: string
}

export interface SkyvernAdapter {
  readonly configured: boolean
  createSession(): Promise<BrowserSession>
  runTask(sessionId: string, prompt: string, dataSchema?: unknown): Promise<RunTaskResult>
  screenshot(sessionId: string): Promise<string | undefined>
  closeSession(sessionId: string): Promise<void>
}

class HttpSkyvernAdapter implements SkyvernAdapter {
  readonly configured = true
  constructor(private cfg: SkyvernConfig) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.cfg.apiKey}`,
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`skyvern ${path} → ${res.status}: ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  }

  async createSession(): Promise<BrowserSession> {
    // Skyvern browser session creation (cloud) — see docs for self-hosted.
    const data = await this.call<{ browser_session_id?: string; id?: string; live_view_url?: string }>(
      '/v1/browser_sessions',
      { method: 'POST', body: JSON.stringify({ mode: this.cfg.mode }) },
    )
    const sessionId = data.browser_session_id ?? data.id
    if (!sessionId) throw new Error('skyvern: no session id in response')
    return { sessionId, liveViewUrl: data.live_view_url }
  }

  async runTask(sessionId: string, prompt: string, dataSchema?: unknown): Promise<RunTaskResult> {
    const data = await this.call<{
      status?: string
      extracted_information?: unknown
      screenshot_url?: string
      final_url?: string
      failure_reason?: string
    }>('/v1/run/tasks', {
      method: 'POST',
      body: JSON.stringify({
        browser_session_id: sessionId,
        prompt,
        ...(dataSchema ? { data_extraction_schema: dataSchema } : {}),
      }),
    })
    const status =
      data.status === 'completed' ? 'completed' : data.status === 'failed' ? 'failed' : 'pending'
    return {
      status,
      extracted: data.extracted_information,
      screenshotUrl: data.screenshot_url,
      finalUrl: data.final_url,
      error: data.failure_reason,
    }
  }

  async screenshot(sessionId: string): Promise<string | undefined> {
    const data = await this.call<{ screenshot_url?: string }>(
      `/v1/browser_sessions/${sessionId}/screenshot`,
    )
    return data.screenshot_url
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.call(`/v1/browser_sessions/${sessionId}`, { method: 'DELETE' }).catch(() => {})
  }
}

class UnconfiguredSkyvernAdapter implements SkyvernAdapter {
  readonly configured = false
  private fail(): never {
    throw new Error('skyvern-not-configured')
  }
  createSession(): Promise<BrowserSession> {
    return this.fail()
  }
  runTask(): Promise<RunTaskResult> {
    return this.fail()
  }
  screenshot(): Promise<string | undefined> {
    return this.fail()
  }
  closeSession(): Promise<void> {
    return Promise.resolve()
  }
}

let cached: SkyvernAdapter | null = null

/** Singleton adapter — real HTTP when configured, inert otherwise. */
export function getSkyvern(): SkyvernAdapter {
  if (cached) return cached
  const cfg = getSkyvernConfig()
  cached = cfg ? new HttpSkyvernAdapter(cfg) : new UnconfiguredSkyvernAdapter()
  return cached
}