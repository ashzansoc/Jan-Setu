import { useState } from 'react'
import { IconCircleCheck, IconKeyboard } from '@tabler/icons-react'
import { useSettings, type LanguageChoice } from '@/state/settings'
import { primary } from '@/lib/onboarding/copy'
import { SpeakingChip } from './OnboardingChrome'
import { cn } from '@/lib/cn'

interface LanguageOption {
  id: LanguageChoice
  glyph: string
  label: string
  script?: string
}

const OPTIONS: LanguageOption[] = [
  { id: 'hi', glyph: 'हि', label: 'हिन्दी', script: 'deva' },
  { id: 'en', glyph: 'EN', label: 'English' },
  { id: 'hinglish', glyph: 'H+E', label: 'Hinglish' },
  { id: 'bn', glyph: 'বাं', label: 'বাংলা', script: 'beng' },
  { id: 'mr', glyph: 'म', label: 'मराठी', script: 'deva' },
  { id: 'ta', glyph: 'த', label: 'தமிழ்', script: 'tamil' },
]

/** Step 2 — अपनी भाषा चुनें. */
export function LanguageStep({ lang, onNext }: { lang: 'hi' | 'en'; onNext: () => void }) {
  const choice = useSettings((s) => s.languageChoice)
  const setLanguage = useSettings((s) => s.setLanguage)
  const [picked, setPicked] = useState<LanguageChoice>(choice)
  const t = (key: Parameters<typeof primary>[0]) => primary(key, lang)

  return (
    <div className="px-4 pb-10">
      <div className="flex flex-col items-center pb-6 pt-4 text-center">
        <div className="relative my-4 flex items-center justify-center">
          <span className="absolute size-28 animate-ping rounded-full bg-primary/15 opacity-60" />
          <span className="absolute size-24 animate-pulse rounded-full bg-primary-fixed-dim/40" />
          <button
            type="button"
            aria-label="Replay spoken prompt"
            className="relative z-10 flex size-20 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl transition-transform active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="size-8 fill-current" aria-hidden>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </button>
        </div>

        <SpeakingChip lang={lang} />
        <h1 className={cn('mt-2 text-[22px] font-bold leading-tight text-on-surface', lang === 'hi' && 'deva')}>
          {t('chooseLanguage')}
        </h1>
        <p className="mt-1 text-[14px] text-on-surface-variant">{t('languageHint')}</p>
      </div>

      <div role="radiogroup" aria-label="Language selection" className="grid grid-cols-2 gap-3">
        {OPTIONS.map((option) => {
          const selected = picked === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPicked(option.id)}
              className={cn(
                'relative flex items-center justify-between rounded-2xl bg-surface-lowest p-4 shadow-sm transition-all active:scale-[0.98]',
                selected ? 'border-2 border-primary shadow-md shadow-primary/10' : 'border-2 border-transparent',
              )}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                    selected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface',
                    option.script,
                  )}
                >
                  {option.glyph}
                </span>
                <span className={cn('text-[15px] font-bold text-on-surface', option.script)}>
                  {option.label}
                </span>
              </span>
              <IconCircleCheck
                size={20}
                strokeWidth={2}
                className={selected ? 'text-primary' : 'text-transparent'}
              />
            </button>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-2 pt-8">
        <button
          type="button"
          data-testid="language-next"
          onClick={() => {
            setLanguage(picked)
            onNext()
          }}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]"
        >
          <span className="text-[15px] font-bold">{t('next')}</span>
        </button>
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:text-primary"
        >
          <IconKeyboard size={17} strokeWidth={2} />
          {t('typeInstead')}
        </button>
      </div>
    </div>
  )
}
