import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SpeechLang, UiLang } from '@/lib/complaints/types'

export type LanguageChoice = 'hi' | 'en' | 'hinglish' | 'bn' | 'ta' | 'mr'
export type AvatarId = 'kamla' | 'arjun' | 'meera' | 'photo'

interface SettingsState {
  uiLang: UiLang
  speechLang: SpeechLang
  languageChoice: LanguageChoice
  voiceSpeed: number
  textScale: number
  reduceMotion: boolean
  readAloud: boolean
  highContrast: boolean
  vibrate: boolean
  mixedLanguages: boolean
  /** Bumped on every language change so in-flight flows can react. */
  languageEpoch: number
  name: string | null
  avatarId: AvatarId
  avatarPhoto: string | null
  /** Name the memoji was last inferred from, so we infer at most once per name. */
  avatarInferredForName: string | null
  onboarded: boolean
  setLanguage: (choice: LanguageChoice) => void
  setName: (name: string) => void
  setAvatar: (id: AvatarId) => void
  setAvatarPhoto: (dataUrl: string | null) => void
  markAvatarInferred: (name: string) => void
  setVoiceSpeed: (speed: number) => void
  setTextScale: (scale: number) => void
  setReduceMotion: (value: boolean) => void
  setReadAloud: (value: boolean) => void
  setHighContrast: (value: boolean) => void
  setVibrate: (value: boolean) => void
  setMixedLanguages: (value: boolean) => void
  completeOnboarding: () => void
  resetOnboarding: () => void
}

const LANGUAGE_MAP: Record<LanguageChoice, { uiLang: UiLang; speechLang: SpeechLang }> = {
  hi: { uiLang: 'hi', speechLang: 'hi-IN' },
  en: { uiLang: 'en', speechLang: 'en-IN' },
  // Hinglish is the Roman-script Hindi interface with Hindi speech.
  hinglish: { uiLang: 'hinglish', speechLang: 'hi-IN' },
  bn: { uiLang: 'en', speechLang: 'bn-IN' },
  ta: { uiLang: 'en', speechLang: 'ta-IN' },
  mr: { uiLang: 'en', speechLang: 'mr-IN' },
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      uiLang: 'en',
      speechLang: 'hi-IN',
      languageChoice: 'hinglish',
      voiceSpeed: 1,
      textScale: 1,
      reduceMotion: false,
      readAloud: true,
      highContrast: false,
      vibrate: true,
      mixedLanguages: true,
      languageEpoch: 0,
      name: null,
      avatarId: 'kamla',
      avatarPhoto: null,
      avatarInferredForName: null,
      onboarded: false,

      setLanguage: (choice) => {
        const mapped = LANGUAGE_MAP[choice]
        set((state) => ({
          languageChoice: choice,
          uiLang: mapped.uiLang,
          speechLang: mapped.speechLang,
          languageEpoch: state.languageEpoch + 1,
        }))
      },
      setName: (name) => set({ name: name.trim() || null }),
      setAvatar: (avatarId) => set({ avatarId }),
      setAvatarPhoto: (avatarPhoto) =>
        set({ avatarPhoto, avatarId: avatarPhoto ? 'photo' : 'kamla', avatarInferredForName: null }),
      markAvatarInferred: (avatarInferredForName) => set({ avatarInferredForName }),
      setVoiceSpeed: (voiceSpeed) => set({ voiceSpeed }),
      setTextScale: (textScale) => set({ textScale }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setReadAloud: (readAloud) => set({ readAloud }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setVibrate: (vibrate) => set({ vibrate }),
      setMixedLanguages: (mixedLanguages) => set({ mixedLanguages }),
      completeOnboarding: () => set({ onboarded: true }),
      resetOnboarding: () => set({ onboarded: false }),
    }),
    {
      name: 'jansetu.settings.v1',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v1 stored Hinglish as English chrome; v2 gives it a real interface.
      migrate: (persisted, version) => {
        if (version < 2 && persisted && typeof persisted === 'object') {
          const state = persisted as Partial<SettingsState>
          if (state.languageChoice === 'hinglish') {
            return { ...state, uiLang: 'hinglish' } as SettingsState
          }
        }
        return persisted as SettingsState
      },
    },
  ),
)
