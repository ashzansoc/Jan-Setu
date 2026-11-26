import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconCheck, IconChevronDown, IconLanguage } from '@tabler/icons-react'
import { Avatar } from '@/components/Avatar'
import { Logo } from '@/components/Logo'
import { Sheet } from '@/components/ui/Sheet'
import { useDict } from '@/lib/i18n'
import { useSettings, type LanguageChoice } from '@/state/settings'
import { cn } from '@/lib/cn'

const OPTIONS: { id: LanguageChoice; key: 'hindi' | 'english' | 'hinglish' | 'bengali' | 'tamil' | 'marathi'; hintKey?: 'hinglishHint' | 'voiceOnlyHint'; native: string }[] = [
  { id: 'hi', key: 'hindi', native: 'हिन्दी' },
  { id: 'en', key: 'english', native: 'English' },
  { id: 'hinglish', key: 'hinglish', hintKey: 'hinglishHint', native: 'Hinglish' },
  { id: 'bn', key: 'bengali', hintKey: 'voiceOnlyHint', native: 'বাংলা' },
  { id: 'ta', key: 'tamil', hintKey: 'voiceOnlyHint', native: 'தமிழ்' },
  { id: 'mr', key: 'marathi', hintKey: 'voiceOnlyHint', native: 'मराठी' },
]

const SCRIPT_CLASS: Record<LanguageChoice, string> = {
  hi: 'deva',
  en: '',
  hinglish: '',
  bn: 'beng',
  ta: 'tamil',
  mr: 'deva',
}

export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useDict()
  const current = useSettings((s) => s.languageChoice)
  const setLanguage = useSettings((s) => s.setLanguage)

  return (
    <Sheet open={open} onClose={onClose} title={d.header.changeLanguage} labelledBy="language-sheet-title">
      <ul className="mt-1 space-y-1.5 pb-1">
        {OPTIONS.map((option) => {
          const selected = current === option.id
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  setLanguage(option.id)
                  onClose()
                }}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-2xl border px-3.5 py-3.5 text-left transition-colors',
                  selected
                    ? 'border-orange/35 bg-[#FFF3EA]'
                    : 'border-line bg-white hover:bg-[#FFFBF7]',
                )}
              >
                <span
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl text-[0.9375rem] font-semibold',
                    selected ? 'bg-white text-orange' : 'bg-peach text-ink/70',
                    SCRIPT_CLASS[option.id],
                  )}
                >
                  {option.native.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[0.96875rem] font-semibold text-ink', SCRIPT_CLASS[option.id])}>
                    {option.native}
                  </span>
                  {option.hintKey && (
                    <span className="mt-0.5 block text-[0.78125rem] leading-snug text-muted">
                      {d.languages[option.hintKey]}
                    </span>
                  )}
                </span>
                {selected && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-orange text-white">
                    <IconCheck size={14} stroke={3} />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 px-1 pb-1 text-[0.75rem] leading-relaxed text-muted">
        {d.profile.voiceSupportBody}
      </p>
    </Sheet>
  )
}

export function LanguagePill() {
  const d = useDict()
  const [open, setOpen] = useState(false)
  const uiLang = useSettings((s) => s.uiLang)
  const speechLang = useSettings((s) => s.speechLang)

  // The voice language leads (it is the product's promise); the interface
  // language trails it. This is the state the reference shows: हिन्दी · EN.
  const voice =
    speechLang.startsWith('hi')
      ? { label: 'हिन्दी', deva: true }
      : speechLang.startsWith('bn')
        ? { label: 'বাংলা', deva: false }
        : speechLang.startsWith('ta')
          ? { label: 'தமிழ்', deva: false }
          : { label: 'EN', deva: false }
  const ui =
    uiLang === 'hi'
      ? { label: 'हिन्दी', deva: true }
      : uiLang === 'hinglish'
        ? { label: 'Hinglish', deva: false }
        : { label: 'EN', deva: false }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={d.header.changeLanguage}
        aria-haspopup="dialog"
        className="flex h-[38px] items-center gap-1.5 rounded-full bg-white pl-1 pr-2 shadow-chip transition-transform active:scale-[0.97]"
      >
        <span className="flex size-[26px] items-center justify-center rounded-full bg-lavender text-indigo">
          <IconLanguage size={14} stroke={2.2} />
        </span>
        <span className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'text-[0.78125rem] font-bold text-ink',
              voice.deva ? 'deva' : 'tracking-[0.02em]',
            )}
          >
            {voice.label}
          </span>
          {ui.label !== voice.label && (
            <>
              <span className="text-[0.75rem] text-muted/70">·</span>
              <span
                className={cn(
                  'text-[0.75rem] font-medium text-muted',
                  ui.deva ? 'deva' : 'tracking-[0.02em]',
                )}
              >
                {ui.label}
              </span>
            </>
          )}
        </span>
        <IconChevronDown size={12} className="text-muted" stroke={2.4} />
      </button>
      <LanguageSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function Header() {
  const name = useSettings((s) => s.name)
  const d = useDict()

  return (
    <header className="safe-x flex items-center justify-between gap-2 pb-1 pt-[max(14px,env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-2.5">
        <Logo size={44} variant="transparent" />
        <div className="truncate whitespace-nowrap text-[1.09375rem] font-extrabold leading-none tracking-[0.05em] text-ink">
          <span className="deva text-[1.3125rem]">जन</span>SETU
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <LanguagePill />
        <Link
          to="/profile"
          aria-label={name ? `${d.header.profile} — ${name}` : d.header.profile}
          className="rounded-full transition-transform active:scale-[0.96]"
        >
          <Avatar size={40} />
        </Link>
      </div>
    </header>
  )
}
