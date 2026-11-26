/**
 * ElevenLabs voice provider — server side only.
 *
 * The API key lives here and never reaches the browser bundle. Every call the
 * app makes goes through a Hono route that proxies to ElevenLabs, so the key
 * stays on the server and the client only ever sees audio or text.
 */

const API_BASE = 'https://api.elevenlabs.io/v1'

export interface VoiceConfig {
  configured: boolean
  provider: 'elevenlabs' | 'webspeech'
  voiceId: string
  ttsModel: string
  sttModel: string
  /** Set when a key is missing, so the client can explain the fallback. */
  issue?: string
}

const apiKey = () => process.env.ELEVENLABS_API_KEY?.trim() ?? ''
const voiceId = () => process.env.ELEVENLABS_VOICE_ID?.trim() || 'P1bg08DkjqiVEzOn76yG'
const ttsModel = () => process.env.ELEVENLABS_TTS_MODEL_ID?.trim() || 'eleven_v4_turbo'
const sttModel = () => process.env.ELEVENLABS_STT_MODEL_ID?.trim() || 'scribe_v1'

export function isVoiceConfigured(): boolean {
  return apiKey().length > 0
}

export function voiceConfig(): VoiceConfig {
  const base = { voiceId: voiceId(), ttsModel: ttsModel(), sttModel: sttModel() }
  if (!apiKey()) {
    return {
      ...base,
      configured: false,
      provider: 'webspeech',
      issue: 'ELEVENLABS_API_KEY is not set',
    }
  }
  return { ...base, configured: true, provider: 'elevenlabs' }
}

/** BCP-47 → the 2-letter family ElevenLabs expects (hi-IN → hi). */
function normalizeLang(lang?: string): string | undefined {
  if (!lang) return undefined
  const family = lang.trim().split('-')[0].toLowerCase()
  return family || undefined
}

/**
 * Streams a spoken version of `text` back as MP3 bytes.
 * Returns null when ElevenLabs is not configured, so the caller can fall back.
 */
export async function synthesize(
  text: string,
  options: { lang?: string; rate?: number } = {},
): Promise<Response | null> {
  if (!isVoiceConfigured()) return null

  const url = `${API_BASE}/text-to-speech/${encodeURIComponent(voiceId())}?output_format=mp3_44100_128`
  const send = (languageCode?: string) =>
    fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey(), accept: 'audio/mpeg', 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: ttsModel(),
        ...(languageCode ? { language_code: languageCode } : {}),
        ...(options.rate ? { voice_settings: { speed: options.rate } } : {}),
      }),
    })

  let upstream = await send(normalizeLang(options.lang))

  // Some models reject a language outright. Retry once without the hint so the
  // user still hears the selected voice instead of dropping to the fallback.
  if (upstream.status === 400) {
    const detail = await upstream.clone().text().catch(() => '')
    if (detail.includes('unsupported_language') || detail.includes('does not support language_code')) {
      console.warn(`[jansetu api] voice model rejected language_code; retrying without it`)
      upstream = await send(undefined)
    }
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    throw new Error(`elevenlabs-tts-${upstream.status}: ${detail.slice(0, 200)}`)
  }
  return upstream
}

/**
 * Batch transcription. The realtime Scribe Live WebSocket relay is documented
 * separately in docs/ELEVENLABS.md and is not wired up yet.
 */
export async function transcribe(file: File, lang?: string): Promise<string | null> {
  if (!isVoiceConfigured()) return null

  const send = (languageCode?: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('model_id', sttModel())
    if (languageCode) form.append('language_code', languageCode)
    return fetch(`${API_BASE}/speech-to-text`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey(), accept: 'application/json' },
      body: form,
    })
  }

  let upstream = await send(normalizeLang(lang))

  // A rejected language code must not cost the user their recording.
  if (upstream.status === 400) {
    const detail = await upstream.clone().text().catch(() => '')
    if (detail.includes('language_code')) upstream = await send(undefined)
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    throw new Error(`elevenlabs-stt-${upstream.status}: ${detail.slice(0, 200)}`)
  }

  const data = (await upstream.json()) as { text?: string }
  return typeof data.text === 'string' ? data.text : null
}