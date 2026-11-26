import { create } from 'zustand'
import type { ComplaintDraft } from '@/lib/complaints/types'
import { resolveDepartment } from '@/lib/complaints/departments'
import type { Extraction, MissingField } from '@/lib/ai/engine'
import type { AsrErrorCode } from '@/lib/voice/asr'
import type { Dictionary } from '@/lib/i18n/en'

export type Phase =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'clarifying'
  | 'ready'
  | 'submitting'
  | 'done'
  | 'error'

export type ErrorKey = keyof Dictionary['errors']

export interface Turn {
  id: string
  role: 'user' | 'assistant'
  text: string
}

interface ConversationState {
  phase: Phase
  turns: Turn[]
  transcript: string
  interim: string
  extraction: Extraction | null
  missing: MissingField[]
  question: MissingField | null
  asked: MissingField[]
  draft: ComplaintDraft | null
  complaintId: string | null
  errorKey: ErrorKey | null
  asrError: AsrErrorCode | null

  reset: () => void
  setPhase: (phase: Phase) => void
  setInterim: (text: string) => void
  addTurn: (role: Turn['role'], text: string) => void
  clearTurns: () => void
  setExtraction: (extraction: Extraction, missing: MissingField[]) => void
  setTranscript: (transcript: string) => void
  setQuestion: (question: MissingField | null, asked: MissingField[]) => void
  setDraft: (draft: ComplaintDraft | null, complaintId: string | null) => void
  updateDraft: (patch: Partial<ComplaintDraft>) => void
  setError: (key: ErrorKey | null, asrError?: AsrErrorCode | null) => void
}

let turnCounter = 0

export const useConversation = create<ConversationState>((set) => ({
  phase: 'idle',
  turns: [],
  transcript: '',
  interim: '',
  extraction: null,
  missing: [],
  question: null,
  asked: [],
  draft: null,
  complaintId: null,
  errorKey: null,
  asrError: null,

  reset: () =>
    set({
      phase: 'idle',
      turns: [],
      transcript: '',
      interim: '',
      extraction: null,
      missing: [],
      question: null,
      asked: [],
      draft: null,
      complaintId: null,
      errorKey: null,
      asrError: null,
    }),

  setPhase: (phase) => set({ phase }),
  setInterim: (interim) => set({ interim }),

  addTurn: (role, text) => {
    const cleaned = text.trim()
    if (!cleaned) return
    turnCounter += 1
    set((state) => ({
      turns: [...state.turns, { id: `t${turnCounter}`, role, text: cleaned }],
    }))
  },

  clearTurns: () => set({ turns: [] }),

  setExtraction: (extraction, missing) => set({ extraction, missing }),
  setTranscript: (transcript) => set({ transcript }),

  setQuestion: (question, asked) => set({ question, asked }),

  setDraft: (draft, complaintId) => set({ draft, complaintId }),

  updateDraft: (patch) =>
    set((state) => {
      if (!state.draft) return state
      const next: ComplaintDraft = { ...state.draft, ...patch }
      // Category or location changes can move ownership to a different body.
      const department =
        patch.category !== undefined || patch.location !== undefined
          ? resolveDepartment(next.category, next.location.label)
          : next.department
      return { draft: { ...next, department } }
    }),

  setError: (errorKey, asrError = null) => set({ errorKey, asrError, phase: errorKey ? 'error' : 'idle' }),
}))

/** Small transient store for microphone amplitude — read imperatively, never rendered. */
interface LevelState {
  level: number
  setLevel: (value: number) => void
}

export const useAudioLevel = create<LevelState>((set) => ({
  level: 0,
  setLevel: (level) => set({ level }),
}))

/**
 * Output amplitude of the active ElevenLabs playback, so the orb's speaking
 * animation follows real audio instead of a timer.
 */
export const useSpeakingLevel = create<LevelState>((set) => ({
  level: 0,
  setLevel: (level) => set({ level }),
}))
