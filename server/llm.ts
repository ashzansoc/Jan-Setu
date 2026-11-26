import { z } from 'zod'

/**
 * Optional upgrade path.
 *
 * The shipped product runs entirely on the deterministic engine in
 * src/lib/ai/engine.ts — no network, no key, no quota. If an OpenAI-compatible
 * endpoint is configured, this module lets the same structured extraction be
 * produced by a model instead, and the client validates it against the identical
 * schema before using it.
 *
 * Nothing here is required for the demo to work.
 */

export const extractionSchema = z.object({
  category: z.enum(['sanitation', 'streetlight', 'water', 'road', 'drainage', 'other']),
  categoryConfidence: z.number().min(0).max(1),
  problemEn: z.string().min(3).max(120),
  problemHi: z.string().min(2).max(120),
  location: z.string().max(120).nullable(),
  locationConfidence: z.number().min(0).max(1),
  durationDays: z.number().min(0).max(3650).nullable(),
  urgency: z.enum(['normal', 'high']),
  // Models often omit this; the caller only needs a usable value.
  language: z.enum(['hi', 'en', 'mixed', 'bn', 'ta']).default('mixed'),
})

export type ModelExtraction = z.infer<typeof extractionSchema>

const SYSTEM_PROMPT = `You convert a citizen's spoken complaint about a municipal problem in India into structured JSON.

Rules:
- Understand Hindi (Devanagari), romanised Hindi, Hinglish and English.
- category must be one of: sanitation, streetlight, water, road, drainage, other.
- location: only a place the citizen actually named (locality, sector, street, pincode). Never invent one. Use null if absent.
- durationDays: convert "teen hafte" to 21. Use null if absent.
- urgency: "high" only for stated danger or emergency.
- problemEn / problemHi: one short factual phrase each.
- categoryConfidence and locationConfidence are your honest 0..1 estimates.
Return JSON only.`

interface Config {
  baseUrl: string
  apiKey: string
  model: string
  agentModel: string
  referer?: string
  title?: string
}

function readConfig(): Config | null {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) return null
  return {
    baseUrl: (process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey,
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    agentModel: process.env.AI_AGENT_MODEL ?? process.env.AI_MODEL ?? 'gpt-4o-mini',
    referer: process.env.AI_REFERER,
    title: process.env.AI_TITLE,
  }
}

export function isLlmConfigured(): boolean {
  return readConfig() !== null
}

/** Strip ```json fences a model may wrap around JSON. */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start >= 0 && end > start ? text.slice(start, end + 1) : text
}

/** Thrown when the model provider refuses the request, so the route can say why. */
export class ModelUnavailableError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ModelUnavailableError'
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Low-level OpenRouter/OpenAI-compatible chat call.
 * `model` defaults to the conversational model; pass the agent model for
 * actions/planning. Never called from the browser — keys stay server-side.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { model?: string; json?: boolean; temperature?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  const config = readConfig()
  if (!config) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${config.apiKey}`,
  }
  if (config.referer) headers['HTTP-Referer'] = config.referer
  if (config.title) headers['X-Title'] = config.title

  const body = (withJson: boolean) =>
    JSON.stringify({
      model: opts.model ?? config.model,
      temperature: opts.temperature ?? 0.2,
      ...(withJson ? { response_format: { type: 'json_object' } } : {}),
      messages,
    })

  try {
    const send = (withJson: boolean) =>
      fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: body(withJson),
      })

    // Try JSON mode first; some free models reject response_format — retry bare.
    let response = await send(!!opts.json)
    if (!response.ok && opts.json) response = await send(false)
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200)
      console.warn('[ai] chat failed', response.status, detail)
      // 429 is a quota/rate limit, not a broken model — surface it as such.
      throw new ModelUnavailableError(
        response.status,
        response.status === 429 ? 'rate-limited' : `upstream-${response.status}`,
      )
    }
    const read = async (res: Response): Promise<string | null> => {
      const payload = (await res.json().catch(() => ({}))) as {
        choices?: { message?: { content?: string; refusal?: string } }[]
      }
      const message = payload.choices?.[0]?.message
      const content = message?.content?.trim()
      if (content) return content
      // Some providers answer 200 with an empty body or a refusal instead of
      // rejecting response_format — retry bare before giving up.
      if (message?.refusal) console.warn('[ai] model refused:', message.refusal.slice(0, 120))
      return null
    }

    const first = await read(response)
    if (first) return first
    if (opts.json) {
      const retry = await send(false)
      if (retry.ok) {
        const second = await read(retry)
        if (second) return second
      }
    }
    console.warn('[ai] model returned no content')
    return null
  } catch (e) {
    if (e instanceof ModelUnavailableError) throw e
    // A timeout is an unavailable model, not a malformed response.
    if ((e as { name?: string }).name === 'AbortError') {
      console.warn('[ai] chat timeout')
      throw new ModelUnavailableError(408, 'model-timeout')
    }
    console.warn('[ai] chat error', (e as Error).message)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function extractWithModel(text: string): Promise<ModelExtraction | null> {
  const config = readConfig()
  if (!config) return null

  const content = await chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    { model: config.model, json: true, temperature: 0, timeoutMs: 25_000 },
  )
  if (!content) return null
  try {
    const parsed = extractionSchema.safeParse(JSON.parse(stripFences(content)))
    if (parsed.success) return parsed.data
    console.warn('[ai] schema mismatch:', parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
    console.warn('[ai] raw content:', content.slice(0, 300))
    return null
  } catch (error) {
    console.warn('[ai] unparseable content:', (error as Error).message, '|', content.slice(0, 200))
    return null
  }
}

/**
 * Agentic reasoning (actions, planning, filing steps) — uses the agent model
 * (NVIDIA Nemotron via OpenRouter). Returns raw text; callers parse as needed.
 */
export async function runAgent(system: string, user: string, json = false): Promise<string | null> {
  const config = readConfig()
  if (!config) return null
  const content = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { model: config.agentModel, json, temperature: 0.2, timeoutMs: 25_000 },
  )
  return content ? (json ? stripFences(content) : content) : null
}

// ---- Avatar traits from a name (gender + age guess) ----

export const nameTraitsSchema = z.object({
  gender: z.enum(['male', 'female', 'unknown']),
  age: z.number().min(1).max(110),
})

export type NameTraits = z.infer<typeof nameTraitsSchema>

const NAME_SYSTEM_PROMPT = `You infer two demographic traits from a person's given name so the app can pick a friendly avatar.
Rules:
- Names are mostly Indian (Hindi, Sanskrit, Muslim, Sikh, South Indian) or common English names.
- gender: "male", "female", or "unknown" only when the name is genuinely used by both.
- age: your best single integer estimate (1..110) of how old a typical person with this name is today. Traditional/older-era names skew older (50+); modern/trendy names skew younger (18-30); common names of all eras sit mid-range (30-40).
- Judge from the name alone; never invent certainty.
Return JSON only: {"gender":"female","age":34}`

export async function inferNameTraits(name: string): Promise<NameTraits | null> {
  const config = readConfig()
  if (!config) return null
  const content = await chat(
    [
      { role: 'system', content: NAME_SYSTEM_PROMPT },
      { role: 'user', content: `Name: ${name}` },
    ],
    { model: config.model, json: true, temperature: 0.1, timeoutMs: 12_000 },
  )
  if (!content) return null
  try {
    const parsed = nameTraitsSchema.safeParse(JSON.parse(stripFences(content)))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
