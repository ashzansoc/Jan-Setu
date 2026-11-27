import {
  computeMissing,
  emptyExtraction,
  mergeExtractions,
  type Extraction,
  type MissingField,
} from '@/lib/ai/engine'
import { analyzeInput } from '@/lib/ai/remote'
import { useConversation, useAudioLevel } from '@/state/conversation'
import { useComplaints, draftFromExtraction } from '@/state/complaints'
import { useSettings } from '@/state/settings'
import { Capacitor } from '@capacitor/core'
import { isAsrSupported, isSecureContextOk, startAsr, type AsrHandlers, type AsrSession } from '@/lib/voice/asr'
import { isNativeAsrSupported, startNativeAsr } from '@/lib/voice/native-asr'
import {
  startRecorderAsr,
  isRecorderSupported,
  isNonSpeechTranscript,
  type RecorderSession,
} from '@/lib/voice/recorder-asr'
import { isElevenLabsActive, loadVoiceConfig } from '@/services/elevenlabs'
import { startLevels, type LevelSession } from '@/lib/voice/levels'
import { cancelSpeech, speak } from '@/lib/voice/tts'
import { CATEGORY_LABEL, type UiLang } from '@/lib/complaints/types'
import { CATEGORY_LEXICON } from '@/lib/ai/lexicon'
import { forPastDuration } from '@/lib/format'
import { dictFor } from '@/lib/i18n'

/**
 * The conversation controller.
 *
 * Kept outside React so a listening turn survives re-renders and route changes.
 * Every UI surface calls these four functions and reads state from the store.
 */

let asrSession: AsrSession | null = null
/** Used where the Web Speech API does not exist (the packaged iOS app). */
let recorderSession: RecorderSession | null = null
let levelSession: LevelSession | null = null
let navigate: ((to: string) => void) | null = null
let pendingFinal = ''
/** Last utterance we actually processed, with its time — used to drop repeats. */
let lastIngest = { text: '', at: 0 }
/**
 * What JANSETU last said aloud. On a speakerphone the microphone hears it and
 * the recogniser transcribes it, which would start another turn from our own
 * words — an endless echo. Anything the app said itself is ignored.
 */
let lastSpoken = { text: '', at: 0 }
/**
 * How the current turn began. A typed turn must not reopen the microphone:
 * doing so made the app re-listen after every typed answer and pick its own
 * voice back up, which is why typing produced the same audio on repeat.
 */
let turnOrigin: 'voice' | 'text' = 'voice'

export function bindNavigate(fn: (to: string) => void): void {
  navigate = fn
}

function normaliseSpeech(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when a transcript is really the app's own voice coming back. */
function isSelfEcho(text: string): boolean {
  if (!lastSpoken.text) return false
  // Only the tail of our own speech can be echoing right now.
  if (Date.now() - lastSpoken.at > 10000) return false
  const heard = normaliseSpeech(text)
  if (heard.length < 3) return false
  const spoken = normaliseSpeech(lastSpoken.text)
  return spoken.includes(heard)
}

function state() {
  return useConversation.getState()
}

function uiLang(): UiLang {
  return useSettings.getState().uiLang
}

function speechLang() {
  return useSettings.getState().speechLang
}

function dict() {
  return dictFor(uiLang())
}

/**
 * Greetings, acknowledgements and "can you hear me" checks are conversation,
 * not complaints. Answering them with "what exactly is the issue — garbage,
 * water, streetlight?" is what made the app look broken.
 */
const CONVERSATIONAL =
  /\b(hello|hi|hey|namaste|namaskar|good morning|good evening|good night|can you hear me|can you hear|are you there|are you listening|are you working|test|testing|thanks|thank you|dhanyavaad|shukriya|okay|ok)\b/i

function hasProblemTerm(text: string): boolean {
  const lower = text.toLowerCase()
  return Object.values(CATEGORY_LEXICON).some((terms) =>
    terms.some((entry) => lower.includes(entry.term.toLowerCase())),
  )
}

function isConversational(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length > 7) return false
  if (!CONVERSATIONAL.test(text)) return false
  // A real problem report always names something from the category lexicon.
  return !hasProblemTerm(text)
}

/** The language epoch the in-flight extraction was captured under. */
let extractionEpoch = useSettings.getState().languageEpoch

function stopLevels() {
  levelSession?.stop()
  levelSession = null
  useAudioLevel.getState().setLevel(0)
}

function stopAsr() {
  asrSession?.stop()
  asrSession = null
  recorderSession?.stop()
  recorderSession = null
}

export function stopEverything(): void {
  stopAsr()
  stopLevels()
  cancelSpeech()
}

/** Stops capture but lets a spoken sentence finish across a route change. */
export function stopCapture(): void {
  stopAsr()
  stopLevels()
}

/** Spoken summary of what was understood, used right before clarifying. */
function summarize(extraction: Extraction): string {
  const cat = CATEGORY_LABEL[extraction.category][uiLang()]
  const parts = [cat]
  if (extraction.location) parts.push(extraction.location)
  if (extraction.durationDays) {
    parts.push(forPastDuration(extraction.durationDays, uiLang()).replace(/^for the past /, '').replace(/^पिछले /, '').replace(/ से$/, ''))
  }
  return parts.join(' · ')
}

export async function beginListening(): Promise<void> {
  turnOrigin = 'voice'
  if (!isSecureContextOk()) {
    state().setError('insecure')
    return
  }
  // Web Speech is absent in WKWebView (the packaged iOS app). When ElevenLabs
  // is configured, record a clip and transcribe it server-side instead — voice
  // then works in the native shell rather than reporting "unavailable".
  // The packaged iOS app runs in WKWebView, whose SpeechRecognition does not
  // track real microphone input — it returns a canned transcript that never
  // changes. Prefer recording + server-side transcription whenever we are in the
  // native shell, and keep Web Speech for real browsers.
  const native = Capacitor.isNativePlatform()
  // The startup probe can fail on a cold launch, and a bundled app may reach
  // the API a moment later. Retry once before telling the citizen voice is
  // unavailable — a transient miss must not disable the microphone.
  if (!isElevenLabsActive()) await loadVoiceConfig()
  const useWebSpeech = isAsrSupported() && !native
  const useRecorder = isRecorderSupported() && isElevenLabsActive() && (native || !isAsrSupported())
  // With no transcription service reachable, fall back to the device's own
  // recogniser so a packaged app can still take a spoken turn offline.
  const useNativeAsr = native && !useRecorder && isNativeAsrSupported()
  if (!useWebSpeech && !useRecorder && !useNativeAsr) {
    // Distinguish "this browser cannot record" from "the voice service could
    // not be reached", so the message tells the citizen what to do next.
    state().setError(isRecorderSupported() || isNativeAsrSupported() ? 'voiceUnavailable' : 'micUnavailable')
    return
  }

  stopEverything()
  const store = state()
  store.setError(null)
  store.setPhase('listening')
  store.setInterim('')

  const epoch = useSettings.getState().languageEpoch
  const switched = epoch !== extractionEpoch
  extractionEpoch = epoch

  // A language switch invalidates the captured speech language: keep the
  // transcript but let the next listen re-detect in the new language.
  const lang = switched ? speechLang() : (store.extraction?.speechLang ?? speechLang())

  // The recorder exposes its own analyser; opening a second capture stream for
  // the level meter makes iOS hand back a dead track, so only start one when the
  // Web Speech path is in use.
  if (!levelSession && !useRecorder) {
    void startLevels((value) => useAudioLevel.getState().setLevel(value)).then((session) => {
      // Only keep it if we are still listening by the time permission resolves.
      if (useConversation.getState().phase === 'listening') levelSession = session
      else session.stop()
    })
  }

  if (useRecorder) {
    recorderSession = startRecorderAsr({
      lang,
      onLevel: (level) => useAudioLevel.getState().setLevel(level),
      handlers: {
        onFinal: (text) => {
          pendingFinal = text
        },
        onError: (code) => {
          if (code === 'empty') return
          stopLevels()
          // Say what actually happened — a bare "something went wrong" gives
          // the citizen nothing they can act on.
          const key =
            code === 'denied'
              ? 'micDenied'
              : code === 'unavailable'
                ? 'micNotFound'
                : code === 'busy'
                  ? 'micBusy'
                  : code === 'network'
                    ? 'noNetwork'
                    : 'generic'
          state().setError(key, code)
        },
        onEnd: (reason) => {
          stopLevels()
          recorderSession = null
          const text = pendingFinal.trim()
          pendingFinal = ''
          if (useConversation.getState().phase !== 'listening') return
          if (reason === 'error') return
          if (!text || isSelfEcho(text)) {
            if (useConversation.getState().errorKey === null) {
              state().setPhase('idle')
              state().setInterim('')
            }
            return
          }
          void ingest(text)
        },
      },
    })
    return
  }

  const asrHandlers: AsrHandlers = {
    onInterim: (text) => {
      if (useConversation.getState().phase === 'listening') {
        useConversation.getState().setInterim(text)
      }
    },
    onFinal: (text) => {
      pendingFinal = text
    },
    onError: (code) => {
      if (code === 'no-speech') return
      stopLevels()
      const key =
        code === 'denied'
          ? 'micDenied'
          : code === 'unavailable'
            ? 'micNotFound'
            : code === 'busy'
              ? 'micBusy'
              : 'generic'
      state().setError(key, code)
    },
    onEnd: (reason) => {
      stopLevels()
      const text = pendingFinal.trim()
      pendingFinal = ''
      if (useConversation.getState().phase !== 'listening') return
      if (reason === 'error') return
      if (!text || isSelfEcho(text)) {
        if (useConversation.getState().errorKey === null) {
          state().setPhase('idle')
          state().setInterim('')
        }
        return
      }
      void ingest(text)
    },
  }

  if (useNativeAsr) {
    asrSession = startNativeAsr({ lang, handlers: asrHandlers })
    return
  }

  asrSession = startAsr({ lang, handlers: asrHandlers })
}

export function finishListening(): void {
  stopAsr()
}

/** Runs one utterance through the pipeline. Used by voice, typing and chips. */
export async function ingest(rawText: string): Promise<void> {
  const text = rawText.trim()
  if (!text) return

  // A recogniser annotation ("[बीप की आवाज़]") is not a citizen's words. Never
  // let it become a draft, a complaint or a turn.
  if (isNonSpeechTranscript(text)) {
    state().setInterim('')
    if (state().phase === 'listening') state().setPhase('idle')
    return
  }

  // A recogniser that re-emits, or a double onEnd, must not re-run the same turn.
  const now = Date.now()
  if (text === lastIngest.text && now - lastIngest.at < 4000) {
    return
  }
  lastIngest = { text, at: now }

  // Conversation first: a greeting gets an answer, not a category demand.
  if (isConversational(text)) {
    const reply = dict().conversational.reply
    state().addTurn('user', text)
    state().addTurn('assistant', reply)
    state().setInterim('')
    state().setPhase('idle')
    await speak(reply, { lang: speechLang(), rate: useSettings.getState().voiceSpeed })
    return
  }

  const store = state()
  stopAsr()
  stopLevels()

  store.addTurn('user', text)
  store.setInterim('')
  store.setPhase('processing')

  const previous = store.extraction ?? emptyExtraction(speechLang())
  const result = await analyzeInput(text, { speechLang: previous.speechLang })
  const merged = mergeExtractions(previous, result.extraction)

  // If we just asked "which area is this?", the answer *is* the location —
  // whatever words the citizen used. Taking them at their word is the honest
  // reading; inventing one from a sentence is not.
  const askedFor = store.question
  if (askedFor === 'location' && (!merged.location || merged.locationConfidence < 0.55)) {
    const cleaned = text.replace(/[.,।!?]+$/g, '').trim()
    if (cleaned) {
      merged.location = cleaned
      merged.locationConfidence = 0.8
    }
  }
  // A fresh complaint must not inherit the previous one's transcript, or the
  // citizen's words appear twice on the understanding screen.
  const livePhase = useConversation.getState().phase
  const priorTranscript = livePhase === 'idle' || livePhase === 'error' ? '' : store.transcript
  const transcript = priorTranscript ? `${priorTranscript} ${text}`.trim() : text

  store.setTranscript(transcript)
  const mergedMissing = computeMissing(merged)
  store.setExtraction(merged, mergedMissing)

  await new Promise((resolve) => window.setTimeout(resolve, 420))

  // Read `asked` from the live store, not the snapshot captured at the top of
  // this turn — the snapshot is stale, which let the same field be asked again
  // and replayed identical audio.
  const asked = useConversation.getState().asked
  const queue = mergedMissing.filter((field) => !asked.includes(field))

  // A field is ever asked at most once. When nothing new is missing the turn
  // ends, so the loop provably terminates instead of repeating a question.
  if (queue.length > 0) {
    await ask(queue[0], merged)
    return
  }

  if (!merged.location) {
    store.setError('emptySpeech')
    return
  }

  await finalize(merged, transcript)
}

/** Speaks a clarifying question, then reopens the microphone hands-free. */
async function ask(field: MissingField, extraction: Extraction): Promise<void> {
  const store = state()
  const d = dict()
  const question = d.clarify[field]

  const current = useConversation.getState()
  store.setQuestion(field, [...current.asked, field])
  store.setPhase('clarifying')

  const lead = d.tts.gotIt(summarize(extraction))
  const spoken = `${lead} ${question}`
  store.addTurn('assistant', spoken)

  const speed = useSettings.getState().voiceSpeed
  lastSpoken = { text: spoken, at: Date.now() }
  await speak(spoken, { lang: extraction.speechLang, rate: speed })

  if (useConversation.getState().phase !== 'clarifying') return
  // Typed turns stay on screen: the citizen types the answer or taps the mic.
  if (turnOrigin === 'text') return
  await beginListening()
}

/**
 * Re-asks the pending clarification in the new language. Called when the user
 * switches language mid-flow: queued speech is cut, the captured speech
 * language is dropped, and the current question is spoken again.
 */
export async function restartTurnForLanguage(): Promise<void> {
  const store = state()
  const current = useConversation.getState()

  stopEverything()
  extractionEpoch = useSettings.getState().languageEpoch

  if (current.extraction) {
    store.setExtraction({ ...current.extraction, speechLang: speechLang() }, current.missing)
  }

  if (current.phase !== 'clarifying' || !current.question) return

  const d = dict()
  const question = d.clarify[current.question]
  const spoken = `${d.tts.gotIt(summarize(current.extraction!))} ${question}`
  store.addTurn('assistant', spoken)

  const speed = useSettings.getState().voiceSpeed
  lastSpoken = { text: spoken, at: Date.now() }
  await speak(spoken, { lang: speechLang(), rate: speed })

  if (useConversation.getState().phase !== 'clarifying') return
  await beginListening()
}

async function finalize(extraction: Extraction, transcript: string): Promise<void> {
  const store = state()
  const draft = draftFromExtraction(extraction, transcript)
  if (!draft) {
    store.setError('emptySpeech')
    return
  }

  // The record is created in `awaiting_approval` — never submitted — so an
  // abandoned conversation lands in "Waiting for your yes" rather than vanishing,
  // and nothing reaches a department without consent.
  const complaint = useComplaints.getState().createAwaitingApproval(draft)
  store.setDraft(draft, complaint.id)
  store.setQuestion(null, store.asked)
  store.setPhase('ready')

  const d = dict()
  store.addTurn('assistant', d.tts.readyToSend)
  void speak(d.tts.readyToSend, {
    lang: extraction.speechLang,
    rate: useSettings.getState().voiceSpeed,
  })

  navigate?.('/understand')
}

/** Text fallback and suggestion chips share this entry point. */
export function ingestText(text: string): void {
  turnOrigin = 'text'
  const store = state()
  if (store.phase === 'idle' || store.phase === 'error') {
    store.setError(null)
    store.setPhase('processing')
  }
  void ingest(text)
}

/** Starts a fresh conversation seeded with an example utterance. */
export function startWith(text?: string): void {
  const store = state()
  stopEverything()
  store.reset()
  store.setPhase(text ? 'processing' : 'listening')
  if (text) {
    void ingest(text)
  } else {
    void beginListening()
  }
}

export function cancelConversation(): void {
  stopEverything()
  const store = state()
  if (store.phase !== 'ready' && store.phase !== 'submitting') {
    store.reset()
  } else {
    store.setPhase('idle')
  }
}

export function resetConversation(): void {
  stopEverything()
  state().reset()
}

/** Replays a step of the timeline aloud. */
export function speakStatus(text: string): Promise<void> {
  return speak(text, {
    lang: speechLang(),
    rate: useSettings.getState().voiceSpeed,
  })
}
