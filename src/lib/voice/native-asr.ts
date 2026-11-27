import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import type { AsrHandlers, AsrSession } from './asr'

/**
 * On-device speech recognition through Android's SpeechRecognizer.
 *
 * The packaged app normally transcribes through the API's ElevenLabs endpoint.
 * When that service cannot be reached — no API process running, no network —
 * this path keeps the microphone usable instead of reporting voice as
 * unavailable. The trade-off is the platform recogniser's own language support
 * and no server-side model, but a spoken turn still works offline.
 */

export function isNativeAsrSupported(): boolean {
  return Capacitor.isNativePlatform() && typeof SpeechRecognition?.start === 'function'
}

/** True when the device actually has a recognition service installed. */
export async function nativeAsrAvailable(): Promise<boolean> {
  if (!isNativeAsrSupported()) return false
  try {
    const { available } = await SpeechRecognition.available()
    return available === true
  } catch {
    return false
  }
}

export function startNativeAsr(options: {
  lang: string
  handlers: AsrHandlers
  /** Close the turn after this much trailing silence. */
  silenceMs?: number
}): AsrSession {
  const { lang, handlers, silenceMs = 2500 } = options

  let stopped = false
  let sawResult = false
  let finalText = ''
  let silenceTimer: number | undefined
  let maxTimer: number | undefined
  let stopFallback: number | undefined

  const clearTimers = () => {
    if (silenceTimer !== undefined) window.clearTimeout(silenceTimer)
    if (maxTimer !== undefined) window.clearTimeout(maxTimer)
    if (stopFallback !== undefined) window.clearTimeout(stopFallback)
  }

  const finish = (reason: 'user' | 'silence' | 'error') => {
    if (stopped) return
    stopped = true
    clearTimers()
    void SpeechRecognition.removeAllListeners().catch(() => {})
    if (reason === 'error') {
      handlers.onEnd?.('error')
      return
    }
    const text = finalText.trim()
    if (text) handlers.onFinal?.(text)
    handlers.onEnd?.(reason)
  }

  const armSilence = () => {
    if (silenceTimer !== undefined) window.clearTimeout(silenceTimer)
    silenceTimer = window.setTimeout(() => {
      if (!sawResult) handlers.onError?.('no-speech')
      finish('silence')
    }, silenceMs)
  }

  void (async () => {
    try {
      const permission = await SpeechRecognition.requestPermissions()
      if (permission.speechRecognition !== 'granted') {
        handlers.onError?.('denied')
        finish('error')
        return
      }

      await SpeechRecognition.addListener('partialResults', (data: { matches?: string[] }) => {
        const text = data.matches?.[0] ?? ''
        if (!text || stopped) return
        sawResult = true
        armSilence()
        handlers.onInterim?.(text)
      })

      handlers.onStart?.()
      maxTimer = window.setTimeout(() => finish('silence'), 30000)

      const result = await SpeechRecognition.start({
        language: lang,
        maxResults: 1,
        partialResults: true,
        popup: false,
      })
      finalText = result.matches?.[0] ?? finalText
      finish('user')
    } catch {
      handlers.onError?.('unavailable')
      finish('error')
    }
  })()

  return {
    stop: () => {
      if (stopped) return
      void SpeechRecognition.stop().catch(() => {})
      // The platform usually resolves start() with the final transcript; if it
      // does not, close the turn anyway rather than leaving the mic open.
      stopFallback = window.setTimeout(() => finish('user'), 1500)
    },
    abort: () => {
      if (stopped) return
      void SpeechRecognition.stop().catch(() => {})
      finish('error')
    },
  }
}