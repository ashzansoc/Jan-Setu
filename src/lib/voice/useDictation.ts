import { useCallback, useEffect, useRef, useState } from 'react'
import { isAsrSupported, isSecureContextOk, startAsr, type AsrErrorCode, type AsrHandlers, type AsrSession } from './asr'
import { isNativeAsrSupported, startNativeAsr } from './native-asr'
import { startLevels, type LevelSession } from './levels'

/**
 * One-shot dictation for sheets and inline inputs.
 *
 * Wraps the same recogniser the home screen uses so every voice affordance in
 * the app behaves identically: tap to start, silence or tap finishes, text lands
 * in `onFinal`.
 */
export function useDictation(options: {
  lang: string
  onFinal: (text: string) => void
  silenceMs?: number
}) {
  const { lang, onFinal, silenceMs = 2200 } = options
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<AsrErrorCode | null>(null)

  const sessionRef = useRef<AsrSession | null>(null)
  const levelsRef = useRef<LevelSession | null>(null)
  const finalRef = useRef('')
  const finalCallback = useRef(onFinal)
  finalCallback.current = onFinal

  const teardown = useCallback(() => {
    sessionRef.current?.stop()
    sessionRef.current = null
    levelsRef.current?.stop()
    levelsRef.current = null
    setLevel(0)
    setListening(false)
  }, [])

  useEffect(() => () => teardown(), [teardown])

  const start = useCallback(() => {
    setError(null)
    if (!isSecureContextOk()) {
      setError('unavailable')
      return
    }
    if (!isAsrSupported() && !isNativeAsrSupported()) {
      setError('unavailable')
      return
    }

    teardown()
    finalRef.current = ''
    setInterim('')
    setListening(true)

    void startLevels((value) => setLevel(value)).then((session) => {
      if (session.live) levelsRef.current = session
      else session.stop()
    })

    const handlers: AsrHandlers = {
      onInterim: (text) => setInterim(text),
      onFinal: (text) => {
        finalRef.current = text
      },
      onError: (code) => {
        if (code === 'no-speech' || code === 'aborted') return
        teardown()
        setError(code)
      },
      onEnd: () => {
        teardown()
        setInterim('')
        const text = finalRef.current.trim()
        if (text) finalCallback.current(text)
      },
    }

    // Web Speech where it exists; otherwise the device recogniser, so dictation
    // keeps working in the packaged app with no transcription service.
    sessionRef.current =
      isAsrSupported() && !isNativeAsrSupported()
        ? startAsr({ lang, silenceMs, handlers })
        : startNativeAsr({ lang, silenceMs, handlers })
  }, [lang, silenceMs, teardown])

  return { listening, interim, level, error, start, stop: teardown }
}
