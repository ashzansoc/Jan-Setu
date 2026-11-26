/**
 * Speech synthesis with per-language voice selection.
 *
 * Chrome truncates long utterances and some platforms ship no queue handling,
 * so text is chunked at sentence boundaries and spoken in sequence.
 */

import {
  speakWithElevenLabs,
  cancelElevenLabsSpeech,
  isElevenLabsActive,
} from '@/services/elevenlabs'
import { useSpeakingLevel } from '@/state/conversation'

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let cachedVoices: SpeechSynthesisVoice[] = []

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isTtsSupported()) return Promise.resolve([])
  const existing = window.speechSynthesis.getVoices()
  if (existing.length) {
    cachedVoices = existing
    return Promise.resolve(existing)
  }
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      cachedVoices = window.speechSynthesis.getVoices()
      window.speechSynthesis.removeEventListener('voiceschanged', finish)
      resolve(cachedVoices)
    }
    window.speechSynthesis.addEventListener('voiceschanged', finish)
    window.setTimeout(finish, 1200)
  })
}

const LANG_PREFIX: Record<string, string> = {
  'hi-IN': 'hi',
  'en-IN': 'en',
  'bn-IN': 'bn',
  'ta-IN': 'ta',
  'mr-IN': 'mr',
}

/**
 * Picks the best available voice: exact locale first, then the language family,
 * preferring local (offline) voices because they do not need network calls.
 */
export function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis?.getVoices() ?? []
  if (!voices.length) return null
  const prefix = LANG_PREFIX[lang] ?? lang.slice(0, 2)
  const exact = voices.filter((v) => v.lang.toLowerCase() === lang.toLowerCase())
  const family = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix))
  const pool = exact.length ? exact : family
  if (!pool.length) return null
  return pool.find((v) => v.localService) ?? pool[0]
}

function chunk(text: string, maxLength = 180): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean ? [clean] : []

  const sentences = clean.split(/(?<=[.!?।])\s+/)
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (!sentence) continue
    if ((current + ' ' + sentence).trim().length > maxLength && current) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current = `${current} ${sentence}`.trim()
    }
    while (current.length > maxLength) {
      const slice = current.slice(0, maxLength)
      const cut = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf(','), 40)
      chunks.push(current.slice(0, cut).trim())
      current = current.slice(cut).trim()
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

export interface SpeakOptions {
  lang: string
  rate?: number
  onStart?: () => void
  onEnd?: () => void
  onBoundary?: () => void
  /** 0..1 amplitude from the ElevenLabs analyser, when that provider is active. */
  onLevel?: (level: number) => void
}

let activeToken = 0

export function cancelSpeech(): void {
  cancelElevenLabsSpeech()
  if (!isTtsSupported()) return
  activeToken += 1
  window.speechSynthesis.cancel()
}

/** Resolves when speaking finishes or is cancelled. Never rejects. */
export async function speak(text: string, options: SpeakOptions): Promise<void> {
  // Once ElevenLabs is configured it is the only voice the user should hear.
  // Falling back would switch speakers mid-app, so a failure ends the turn
  // rather than changing the selected voice.
  if (isElevenLabsActive()) {
    const handled = await speakWithElevenLabs(text, {
      lang: options.lang,
      rate: options.rate,
      onStart: options.onStart,
      onEnd: options.onEnd,
      onLevel: (level) => {
        useSpeakingLevel.getState().setLevel(level)
        options.onLevel?.(level)
      },
    })
    useSpeakingLevel.getState().setLevel(0)
    if (handled) {
      console.info('[jansetu voice] spoke via ElevenLabs')
      return
    }
    console.warn('[jansetu voice] ElevenLabs playback failed — no audio played')
    options.onStart?.()
    options.onEnd?.()
    return
  }

  console.info('[jansetu voice] ElevenLabs not configured — using Web Speech')
  if (!isTtsSupported()) {
    options.onStart?.()
    options.onEnd?.()
    return Promise.resolve()
  }

  cancelSpeech()
  const token = (activeToken += 1)
  const parts = chunk(text)
  if (!parts.length) {
    options.onStart?.()
    options.onEnd?.()
    return Promise.resolve()
  }

  const voice = pickVoice(options.lang)

  return new Promise<void>((resolve) => {
    let index = 0
    let started = false

    const finish = () => {
      if (token !== activeToken) return
      options.onEnd?.()
      resolve()
    }

    const next = () => {
      if (token !== activeToken) {
        resolve()
        return
      }
      if (index >= parts.length) {
        finish()
        return
      }
      const utterance = new SpeechSynthesisUtterance(parts[index])
      utterance.lang = options.lang
      utterance.rate = options.rate ?? 1
      utterance.pitch = 1
      if (voice) utterance.voice = voice
      utterance.onstart = () => {
        if (!started) {
          started = true
          options.onStart?.()
        }
      }
      utterance.onboundary = () => options.onBoundary?.()
      utterance.onend = () => {
        index += 1
        next()
      }
      utterance.onerror = () => {
        index += 1
        next()
      }
      window.speechSynthesis.speak(utterance)
    }

    next()
  })
}
