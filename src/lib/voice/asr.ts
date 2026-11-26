/**
 * Speech recognition wrapper.
 *
 * The Web Speech API is the only zero-credential option that works on Indian
 * phones, so it is the primary path. Everything is wrapped so the UI only ever
 * deals with four states: interim text, final text, an error code, and end.
 */

export type AsrErrorCode =
  | 'denied'
  | 'unavailable'
  | 'no-speech'
  | 'busy'
  | 'network'
  | 'aborted'
  | 'unknown'

interface AlternativeLike {
  transcript: string
  confidence: number
}
interface ResultLike {
  isFinal: boolean
  length: number
  [index: number]: AlternativeLike
}
interface ResultListLike {
  length: number
  [index: number]: ResultLike
}
interface RecognitionEventLike extends Event {
  resultIndex: number
  results: ResultListLike
}
interface RecognitionErrorEventLike extends Event {
  error: string
  message?: string
}
interface RecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: RecognitionEventLike) => void) | null
  onerror: ((event: RecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  onnomatch: (() => void) | null
}
type RecognitionCtor = new () => RecognitionLike

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isAsrSupported(): boolean {
  return getCtor() !== null
}

export function isSecureContextOk(): boolean {
  if (typeof window === 'undefined') return false
  return window.isSecureContext || window.location.hostname === 'localhost'
}

export interface AsrHandlers {
  onStart?: () => void
  onInterim?: (text: string) => void
  onFinal?: (text: string) => void
  onError?: (code: AsrErrorCode, raw?: string) => void
  onEnd?: (reason: 'user' | 'silence' | 'error') => void
}

export interface AsrSession {
  stop: () => void
  abort: () => void
}

function mapError(raw: string): AsrErrorCode {
  switch (raw) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied'
    case 'no-speech':
      return 'no-speech'
    case 'audio-capture':
      return 'unavailable'
    case 'network':
      return 'network'
    case 'aborted':
      return 'aborted'
    case 'language-not-supported':
      return 'unavailable'
    default:
      return 'unknown'
  }
}

/**
 * Starts a single continuous listening session.
 *
 * Chrome ends the session after a few seconds of silence; we restart it while
 * the user still wants to listen so the conversation feels unbroken. The caller
 * decides when the turn is over by calling `stop()`.
 */
export function startAsr(options: {
  lang: string
  handlers: AsrHandlers
  /** Stop automatically once this much trailing silence passes. */
  silenceMs?: number
}): AsrSession {
  const Ctor = getCtor()
  const { lang, handlers, silenceMs = 2200 } = options

  if (!Ctor) {
    queueMicrotask(() => {
      handlers.onError?.('unavailable', 'no-recognition-constructor')
      handlers.onEnd?.('error')
    })
    return { stop() {}, abort() {} }
  }

  let wantListening = true
  let sawAnyResult = false
  let finishedText = ''
  let recognition: RecognitionLike | null = null
  let restartTimer: number | undefined
  let silenceTimer: number | undefined
  let startupTimer: number | undefined
  let started = false
  let hadError = false
  /**
   * Index of the first result that has not been finalised yet.
   *
   * WebKit (and some Chromium builds) report `event.resultIndex = 0` on every
   * event even with `continuous = true`, which made earlier finals get appended
   * again — the "Test Test Test…" transcript loop. This pointer makes the
   * accumulation monotonic regardless of what the browser reports.
   */
  let finalisedUpTo = 0

  const clearSilence = () => {
    if (silenceTimer !== undefined) {
      window.clearTimeout(silenceTimer)
      silenceTimer = undefined
    }
  }

  const armSilence = () => {
    clearSilence()
    if (!wantListening) return
    silenceTimer = window.setTimeout(() => {
      // Nothing was said for a while: close the turn cleanly.
      if (!sawAnyResult) {
        handlers.onError?.('no-speech')
        handlers.onEnd?.('silence')
        stop()
      } else {
        stop()
      }
    }, silenceMs)
  }

  const build = () => {
    const instance = new Ctor()
    instance.lang = lang
    instance.continuous = true
    instance.interimResults = true
    instance.maxAlternatives = 1

    instance.onstart = () => {
      started = true
      if (startupTimer !== undefined) window.clearTimeout(startupTimer)
      handlers.onStart?.()
      armSilence()
    }

    instance.onresult = (event) => {
      sawAnyResult = true
      armSilence()
      let interim = ''
      let final = ''
      const start = Math.max(event.resultIndex ?? 0, finalisedUpTo)
      for (let i = start; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) {
          // Only ever consume a final result once.
          if (i >= finalisedUpTo) {
            final += text
            finalisedUpTo = i + 1
          }
        } else {
          interim += text
        }
      }
      if (final) {
        finishedText = `${finishedText} ${final}`.trim()
      }
      if (interim) handlers.onInterim?.(`${finishedText} ${interim}`.trim())
      else if (final) handlers.onInterim?.(finishedText)
    }

    instance.onerror = (event) => {
      hadError = true
      const code = mapError(event.error)
      // 'no-speech' and 'aborted' are normal lifecycle events, not failures.
      if (code !== 'no-speech' && code !== 'aborted') {
        handlers.onError?.(code, event.error)
      }
      if (code === 'denied' || code === 'unavailable') wantListening = false
    }

    instance.onend = () => {
      clearSilence()
      if (!wantListening) {
        if (finishedText.trim()) handlers.onFinal?.(finishedText.trim())
        handlers.onEnd?.(hadError ? 'error' : 'user')
        return
      }
      // The browser cut the session (usually silence). Restart to keep listening.
      restartTimer = window.setTimeout(() => {
        if (!wantListening) return
        try {
          instance.start()
        } catch {
          wantListening = false
          if (finishedText.trim()) handlers.onFinal?.(finishedText.trim())
          handlers.onEnd?.('silence')
        }
      }, 160)
    }

    return instance
  }

  const stop = () => {
    if (!wantListening) return
    wantListening = false
    clearSilence()
    if (startupTimer !== undefined) window.clearTimeout(startupTimer)
    if (restartTimer !== undefined) window.clearTimeout(restartTimer)
    try {
      recognition?.stop()
    } catch {
      /* already stopped */
    }
  }

  const abort = () => {
    wantListening = false
    clearSilence()
    if (startupTimer !== undefined) window.clearTimeout(startupTimer)
    if (restartTimer !== undefined) window.clearTimeout(restartTimer)
    try {
      recognition?.abort()
    } catch {
      /* already stopped */
    }
    handlers.onEnd?.('user')
  }

  recognition = build()
  try {
    recognition.start()
  } catch {
    // start() throws if a session is already active; treat as busy.
    handlers.onError?.('busy', 'start-failed')
    handlers.onEnd?.('error')
    wantListening = false
  }

  startupTimer = window.setTimeout(() => {
    if (started || !wantListening) return
    hadError = true
    wantListening = false
    handlers.onError?.('unavailable', 'no-start')
    try {
      recognition?.abort()
    } catch {
      /* ignore */
    }
    handlers.onEnd?.('error')
  }, 4500)

  return { stop, abort }
}
