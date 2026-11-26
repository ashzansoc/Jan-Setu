import { API_BASE, isElevenLabsActive } from './config'

export interface ElevenLabsSpeakOptions {
  lang?: string
  rate?: number
  onStart?: () => void
  onEnd?: () => void
  /** Called ~20x/second with 0..1 amplitude so the orb can react to real audio. */
  onLevel?: (level: number) => void
}

/**
 * One persistent element + AudioContext, reused for every utterance.
 *
 * Re-creating them per call re-triggers the browser's autoplay gate, so the
 * second line of a turn would be rejected and the app would fall back to Web
 * Speech mid-conversation. Unlocking playback once keeps the whole turn on the
 * selected ElevenLabs voice.
 */
let element: HTMLAudioElement | null = null
let context: AudioContext | null = null
let analyser: AnalyserNode | null = null
let source: MediaElementAudioSourceNode | null = null
let raf = 0
let token = 0
let unlocked = false

/**
 * A ~10ms silent WAV. Playing it inside a real user gesture unlocks the
 * element, because iOS rejects a programmatic play() that happens after an
 * `await` (the gesture context is gone by then).
 */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

function ensureElement(): HTMLAudioElement {
  if (element) return element
  element = new Audio()
  element.preload = 'auto'
  return element
}

/** Call from a user gesture so later programmatic plays are permitted. */
export function unlockElevenLabsAudio() {
  if (unlocked) return
  const el = ensureElement()
  el.src = SILENT_WAV
  el.play().then(
    () => {
      unlocked = true
      el.pause()
    },
    () => {
      unlocked = false
    },
  )
}

function stopLevelLoop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

export function cancelElevenLabsSpeech() {
  token += 1
  stopLevelLoop()
  if (element) {
    element.pause()
    element.removeAttribute('src')
    element.load()
  }
}

export function isElevenLabsSpeaking(): boolean {
  return element !== null && !element.paused
}

/**
 * Streams `text` to the API's TTS proxy and plays the MP3 as it arrives.
 * Resolves true when the user heard ElevenLabs, false when the caller should
 * fall back. Never rejects.
 */
export async function speakWithElevenLabs(
  text: string,
  options: ElevenLabsSpeakOptions = {},
): Promise<boolean> {
  if (!isElevenLabsActive()) return false

  const myToken = (token += 1)
  stopLevelLoop()
  element?.pause()

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/voice/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, lang: options.lang, rate: options.rate }),
    })
  } catch {
    return false
  }

  // 501 is the "not configured" signal — let the caller fall back.
  if (response.status === 501) return false
  if (!response.ok) {
    console.warn('[jansetu voice] ElevenLabs TTS failed', response.status)
    return false
  }

  const blob = await response.blob()
  if (myToken !== token) return false

  const el = ensureElement()
  const url = URL.createObjectURL(blob)
  el.src = url
  element = el

  options.onStart?.()

  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (handled: boolean) => {
      if (settled) return
      settled = true
      if (myToken !== token) return
      URL.revokeObjectURL(url)
      stopLevelLoop()
      options.onLevel?.(0)
      options.onEnd?.()
      resolve(handled)
    }

    el.onended = () => finish(true)
    el.onerror = () => {
      console.warn('[jansetu voice] ElevenLabs audio playback failed — falling back')
      finish(false)
    }

    const play = () =>
      el.play().then(
        () => attachAnalyser(el, options.onLevel),
        () => {
          // One retry covers a transient autoplay rejection; a second failure
          // means the browser is refusing audio outright.
          el.play().then(
            () => attachAnalyser(el, options.onLevel),
            () => {
              console.warn('[jansetu voice] ElevenLabs playback rejected twice')
              finish(false)
            },
          )
        },
      )

    void play()
  })
}

/** Best-effort amplitude feed for the orb. Never affects playback. */
function attachAnalyser(el: HTMLAudioElement, onLevel?: (level: number) => void) {
  if (!onLevel || analyser) {
    if (analyser && onLevel) startLevelLoop(onLevel)
    return
  }
  try {
    context = new AudioContext()
    analyser = context.createAnalyser()
    analyser.fftSize = 256
    source = context.createMediaElementSource(el)
    source.connect(analyser)
    analyser.connect(context.destination)
    startLevelLoop(onLevel)
  } catch {
    // The orb simply won't pulse; playback is unaffected.
    analyser = null
  }
}

function startLevelLoop(onLevel: (level: number) => void) {
  if (!analyser) return
  const data = new Uint8Array(analyser.frequencyBinCount)
  const tick = () => {
    if (!analyser) return
    analyser.getByteTimeDomainData(data)
    let peak = 0
    for (let i = 0; i < data.length; i += 1) {
      peak = Math.max(peak, Math.abs(data[i] - 128) / 128)
    }
    onLevel(Math.min(1, peak))
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}