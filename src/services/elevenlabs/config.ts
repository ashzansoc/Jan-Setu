import { API_BASE } from '@/lib/api-base'
/**
 * Client-side view of the voice configuration.
 *
 * This mirrors the shape returned by `GET /api/voice/config`. The API key is
 * never part of it — the browser only learns whether ElevenLabs is wired up.
 */
export interface VoiceConfig {
  configured: boolean
  provider: 'elevenlabs' | 'webspeech'
  voiceId: string
  ttsModel: string
  sttModel: string
  /** Set when a key is missing, so the fallback can be explained. */
  issue?: string
}

/**
 * Absolute API origin for builds that have no dev-server proxy.
 *
 * The web build uses relative `/api` paths through the Vite proxy. A bundled
 * native app has no proxy, so it targets the API on the host directly —
 * the iOS Simulator shares the host's network stack, so 127.0.0.1 resolves.
 */
export { API_BASE }

const FALLBACK: VoiceConfig = {
  configured: false,
  provider: 'webspeech',
  voiceId: 'P1bg08DkjqiVEzOn76yG',
  ttsModel: 'eleven_v4_turbo',
  sttModel: 'scribe_v3_live',
  issue: 'voice config unavailable',
}

let cached: VoiceConfig | null = null
let inflight: Promise<VoiceConfig> | null = null

/**
 * Asks the API process whether ElevenLabs is wired up. The API key itself is
 * never sent to the browser — only this capability descriptor.
 */
export async function loadVoiceConfig(): Promise<VoiceConfig> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/voice/config`, { headers: { accept: 'application/json' } })
      if (!response.ok) {
        console.info('[jansetu voice] ElevenLabs config unavailable — using Web Speech.')
        return { ...FALLBACK }
      }
      const data = (await response.json()) as VoiceConfig
      cached = data
      if (!data.configured) {
        console.info('[jansetu voice] ElevenLabs not configured — using Web Speech.', data.issue ?? '')
      } else {
        console.info(`[jansetu voice] ElevenLabs active (voice ${data.voiceId}).`)
      }
      return data
    } catch {
      console.info('[jansetu voice] ElevenLabs config request failed — using Web Speech.')
      return { ...FALLBACK }
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/** Synchronous read for call sites that cannot await. */
export function peekVoiceConfig(): VoiceConfig {
  return cached ?? FALLBACK
}

export function isElevenLabsActive(): boolean {
  return peekVoiceConfig().configured
}