import { useEffect, useRef, useState } from 'react'
import { IconSearch, IconX } from '@tabler/icons-react'
import { IconMicrophone } from '@tabler/icons-react'
import { isAsrSupported, isSecureContextOk, startAsr, type AsrSession } from '@/lib/voice/asr'
import { startLevels, type LevelSession } from '@/lib/voice/levels'
import { useDict } from '@/lib/i18n'
import { cn } from '@/lib/cn'

type SearchState = 'idle' | 'listening' | 'error'

/**
 * Voice search over the citizen's own records. It uses the same recogniser as
 * the complaint flow, so Hindi/Hinglish speech works identically here.
 */
export function VoiceSearchBar({
  value,
  onChange,
  onSubmit,
  onError,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onError: (message: string | null) => void
}) {
  const d = useDict()
  const [state, setState] = useState<SearchState>('idle')
  const [interim, setInterim] = useState('')
  const [level, setLevel] = useState(0)
  const sessionRef = useRef<AsrSession | null>(null)
  const levelsRef = useRef<LevelSession | null>(null)
  const finalRef = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      sessionRef.current?.abort()
      levelsRef.current?.stop()
    }
  }, [])

  const stop = () => {
    sessionRef.current?.stop()
    sessionRef.current = null
    levelsRef.current?.stop()
    levelsRef.current = null
    setLevel(0)
  }

  const begin = async () => {
    onError(null)
    if (!isSecureContextOk()) {
      setState('error')
      onError(d.errors.insecure)
      return
    }
    if (!isAsrSupported()) {
      setState('error')
      onError(d.errors.micUnavailable)
      return
    }

    stop()
    finalRef.current = ''
    setInterim('')
    setState('listening')

    void startLevels((next) => setLevel(next)).then((session) => {
      if (session.live) levelsRef.current = session
      else session.stop()
    })

    sessionRef.current = startAsr({
      lang: 'hi-IN',
      silenceMs: 1800,
      handlers: {
        onInterim: (text) => setInterim(text),
        onFinal: (text) => {
          finalRef.current = text
        },
        onError: (code) => {
          stop()
          setState('error')
          onError(
            code === 'denied'
              ? d.errors.micDenied
              : code === 'unavailable'
                ? d.errors.micNotFound
                : d.errors.generic,
          )
        },
        onEnd: () => {
          stop()
          setState('idle')
          const text = finalRef.current.trim()
          setInterim('')
          if (text) {
            onChange(text)
            onSubmit(text)
          }
        },
      },
    })
  }

  const listening = state === 'listening'
  const display = listening ? interim || d.complaints.searchListening : null

  return (
    <div className="safe-x">
      <div
        className={cn(
          'flex h-[54px] items-center gap-2.5 rounded-[18px] border bg-white pl-4 pr-1.5 transition-shadow',
          listening
            ? 'border-orange/40 shadow-[0_0_0_4px_rgba(255,118,47,0.10)]'
            : 'border-transparent shadow-chip',
        )}
      >
        <IconSearch size={18} stroke={2.3} className="shrink-0 text-muted/80" aria-hidden />

        {listening ? (
          <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink/80" aria-live="polite">
            {display}
          </span>
        ) : (
          <label htmlFor="complaint-search" className="min-w-0 flex-1">
            <span className="sr-only">{d.complaints.searchLabel}</span>
            <input
              id="complaint-search"
              ref={inputRef}
              value={value}
              onChange={(event) => {
                onChange(event.target.value)
                if (event.target.value.trim()) onSubmit(event.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSubmit(value)
              }}
              placeholder={d.complaints.searchPlaceholder}
              className="w-full bg-transparent text-[0.875rem] text-ink placeholder:text-muted/75 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}

        {value && !listening && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              onError(null)
              inputRef.current?.focus()
            }}
            aria-label={d.complaints.clearSearch}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/[0.05]"
          >
            <IconX size={15} stroke={2.4} />
          </button>
        )}

        <button
          type="button"
          onClick={() => (listening ? stop() : void begin())}
          aria-label={listening ? d.actions.cancel : d.complaints.searchLabel}
          aria-pressed={listening}
          className="relative flex size-[42px] shrink-0 items-center justify-center rounded-[14px] text-white transition-transform active:scale-[0.94]"
          style={{
            background: 'linear-gradient(140deg, #FF9A4D 0%, #FF762F 42%, #F45152 100%)',
            boxShadow: listening
              ? '0 0 0 5px rgba(255,118,47,0.16), 0 8px 18px -8px rgba(244,81,98,0.75)'
              : '0 8px 18px -10px rgba(244,81,98,0.8)',
            transform: listening ? `scale(${1 + level * 0.06})` : undefined,
          }}
        >
          {listening && (
            <span
              className="pointer-events-none absolute inset-0 rounded-[14px] border-2 border-white/40"
              style={{ animation: 'ripple-out 1.9s ease-out infinite' }}
              aria-hidden
            />
          )}
          <IconMicrophone size={18} stroke={2.4} />
        </button>
      </div>
    </div>
  )
}
