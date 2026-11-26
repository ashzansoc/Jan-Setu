import { API_BASE, isElevenLabsActive } from './config'

/**
 * Batch speech-to-text through the API proxy.
 *
 * Records the microphone with MediaRecorder, posts the audio to
 * `/api/voice/transcribe`, and resolves with the transcript. Returns null when
 * ElevenLabs is not configured so the caller can use the Web Speech recogniser.
 */
export async function transcribeWithElevenLabs(
  lang?: string,
  options: { maxMs?: number } = {},
): Promise<string | null> {
  if (!isElevenLabsActive()) return null
  if (typeof MediaRecorder === 'undefined') return null

  const { maxMs = 20000 } = options

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
  if (!stream) return null

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream)
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })

  recorder.start()
  await new Promise((r) => setTimeout(r, maxMs))
  recorder.stop()
  await stopped
  stream.getTracks().forEach((track) => track.stop())

  const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
  if (blob.size === 0) return null

  const form = new FormData()
  form.append('file', blob, 'clip.webm')
  if (lang) form.append('language_code', lang)

  try {
    const response = await fetch(`${API_BASE}/api/voice/transcribe`, { method: 'POST', body: form })
    if (response.status === 501) return null
    if (!response.ok) {
      console.warn('[jansetu voice] ElevenLabs STT failed', response.status)
      return null
    }
    const data = (await response.json()) as { ok?: boolean; text?: string }
    return typeof data.text === 'string' && data.text.trim() ? data.text.trim() : null
  } catch {
    return null
  }
}
