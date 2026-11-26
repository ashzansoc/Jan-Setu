import { apiUrl } from '@/lib/api-base'

/**
 * Speech recognition that works where the Web Speech API does not.
 *
 * WKWebView — i.e. the packaged iOS app — exposes no `SpeechRecognition`, so
 * the browser recogniser is unavailable there even with microphone permission.
 * This path records a clip with MediaRecorder and sends it to the API's
 * ElevenLabs transcriber, which does work inside the native shell.
 *
 * Trade-off, stated plainly: there is no live interim transcript while the user
 * speaks. The text arrives once the turn ends.
 */

export type RecorderErrorCode = 'denied' | 'unavailable' | 'busy' | 'network' | 'empty'

export interface RecorderHandlers {
  onStart?: () => void
  onFinal?: (text: string) => void
  onError?: (code: RecorderErrorCode) => void
  onEnd?: (reason: 'user' | 'silence' | 'error') => void
}

export interface RecorderSession {
  stop: () => void
  abort: () => void
}

function mapMediaError(error: unknown): RecorderErrorCode {
  const name = (error as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'unavailable'
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'busy'
  return 'unavailable'
}

/**
 * Recognisers annotate audio they cannot understand — "[beep]", "[music]",
 * "[बीप की आवाज़]". Those are not utterances and must never become a turn.
 */
export function isNonSpeechTranscript(text: string): boolean {
  const value = text.trim()
  if (!value) return true
  if (value.length < 3) return true
  // A fully bracketed stage direction, e.g. "[बीप की आवाज़]".
  if (/^[\[(][^\])]*[\])]$/.test(value)) return true
  // Bracketed annotation anywhere with little else around it.
  const stripped = value.replace(/[\[(][^\])]*[\])]/g, '').trim()
  if (stripped.length < 3) return true
  return false
}

export function isRecorderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

/**
 * Records until `stop()` is called (or `silenceMs` of quiet passes), then
 * transcribes the clip. Mirrors the AsrSession lifecycle so the caller can swap
 * between the two without branching everywhere.
 */
export function startRecorderAsr(options: {
  lang: string
  handlers: RecorderHandlers
  /** Live 0..1 input level, so the orb and level meter react to the real mic. */
  onLevel?: (level: number) => void
  silenceMs?: number
  maxMs?: number
}): RecorderSession {
  const { lang, handlers, onLevel, silenceMs = 2200, maxMs = 30000 } = options

  let stream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let stopping = false
  let finished = false
  let silenceTimer: number | undefined
  let maxTimer: number | undefined
  let audioContext: AudioContext | null = null
  let analyserFrame = 0
  /** Did the clip ever contain speech-level energy? Silence must not be sent. */
  let sawSpeech = false
  /** How long speech-level energy was actually present, in ms. */
  let speechMs = 0
  let speechSince = 0

  const cleanup = () => {
    onLevel?.(0)
    if (silenceTimer !== undefined) window.clearTimeout(silenceTimer)
    if (maxTimer !== undefined) window.clearTimeout(maxTimer)
    if (analyserFrame) cancelAnimationFrame(analyserFrame)
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    if (audioContext) {
      void audioContext.close().catch(() => {})
      audioContext = null
    }
  }

  const finish = async (reason: 'user' | 'silence' | 'error') => {
    if (finished) return
    finished = true
    cleanup()

    if (reason === 'error' || !chunks.length) {
      handlers.onEnd?.(reason)
      return
    }

    // Never transcribe silence: the recogniser will happily invent words for an
    // empty clip, which is what produced a turn from no speech at all.
    if (!sawSpeech || speechMs < 350) {
      handlers.onError?.('empty')
      handlers.onEnd?.('silence')
      return
    }

    const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })
    if (blob.size < 1200) {
      // Too short to contain speech — treat as an empty turn, not an error.
      handlers.onError?.('empty')
      handlers.onEnd?.('silence')
      return
    }

    const form = new FormData()
    form.append('file', blob, 'clip.webm')
    if (lang) form.append('language_code', lang)

    try {
      const response = await fetch(apiUrl('/api/voice/transcribe'), { method: 'POST', body: form })
      if (!response.ok) {
        handlers.onError?.(response.status === 501 ? 'unavailable' : 'network')
        handlers.onEnd?.('error')
        return
      }
      const data = (await response.json()) as { ok?: boolean; text?: string }
      const text = (data.text ?? '').trim()
      if (!text || isNonSpeechTranscript(text)) {
        handlers.onError?.('empty')
        handlers.onEnd?.('silence')
        return
      }
      handlers.onFinal?.(text)
      handlers.onEnd?.('user')
    } catch {
      handlers.onError?.('network')
      handlers.onEnd?.('error')
    }
  }

  const armSilence = () => {
    if (silenceTimer !== undefined) window.clearTimeout(silenceTimer)
    silenceTimer = window.setTimeout(() => stop(), silenceMs)
  }

  const stop = () => {
    if (stopping || finished) return
    stopping = true
    try {
      recorder?.stop()
    } catch {
      void finish('user')
    }
  }

  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (stopping) {
        cleanup()
        return
      }
      recorder = new MediaRecorder(stream)
      chunks = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => void finish('user')
      recorder.start()
      handlers.onStart?.()

      // Silence detection from the live level, so the turn ends on its own.
      try {
        audioContext = new AudioContext()
        const input = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        input.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        let quietSince = Date.now()
        const tick = () => {
          if (!analyser || finished) return
          analyser.getByteTimeDomainData(data)
          let peak = 0
          for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i] - 128) / 128)
          onLevel?.(Math.min(1, peak))
          if (peak > 0.05) {
            quietSince = Date.now()
            if (!sawSpeech) speechSince = Date.now()
            sawSpeech = true
          }
          if (sawSpeech && speechSince) speechMs += 16
          if (Date.now() - quietSince > silenceMs) {
            stop()
            return
          }
          analyserFrame = requestAnimationFrame(tick)
        }
        analyserFrame = requestAnimationFrame(tick)
      } catch {
        // No silence detection; the max timer still closes the turn.
        armSilence()
      }

      maxTimer = window.setTimeout(() => stop(), maxMs)
    } catch (error) {
      cleanup()
      handlers.onError?.(mapMediaError(error))
      handlers.onEnd?.('error')
    }
  })()

  return {
    stop,
    abort: () => {
      stopping = true
      finished = true
      try {
        recorder?.stop()
      } catch {
        /* already stopped */
      }
      cleanup()
    },
  }
}