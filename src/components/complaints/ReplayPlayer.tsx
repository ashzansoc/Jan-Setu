import { IconInfoCircle, IconPlayerPause, IconPlayerPlay, IconTrash } from '@tabler/icons-react'
import type { Complaint, TimelineStep } from '@/lib/complaints/types'
import { displayTitle, shortLocation } from '@/lib/complaints/display'
import { useDict, useUiLang } from '@/lib/i18n'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/cn'

const BAR_COUNT = 13
const BAR_HEIGHTS = [8, 20, 28, 16, 24, 28, 12, 20, 24, 16, 20, 12, 8]

const TONE: Record<TimelineStep, string> = {
  request: 'bg-[#28322E]',
  understanding: 'bg-[#28322E]',
  location: 'bg-[#28322E]',
  department: 'bg-[#28322E]',
  generation: 'bg-[#28322E]',
  consent: 'bg-[#28322E]',
  submission: 'bg-[#28322E]',
  acknowledgement: 'bg-[#28322E]',
  in_progress: 'bg-[#28322E]',
  resolution: 'bg-[#28322E]',
  reopened: 'bg-[#28322E]',
  amendment: 'bg-[#28322E]',
  assisted_filing: 'bg-[#3A2E1E]',
  user_confirmed: 'bg-[#28322E]',
}

function clock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export interface PlayerProps {
  complaint: Complaint
  index: number
  playing: boolean
  elapsed: number
  total: number
  progress: number
  lang: 'hi' | 'en' | 'bn'
  speed: number
  onToggle: () => void
  onLang: (lang: 'hi' | 'en' | 'bn') => void
  onSpeed: () => void
  stepCount: number
}

/**
 * The hero player from the design: a dark card with the complaint identity, a
 * real play/pause over the narrated timeline, a played/unplayed waveform, and
 * per-replay language and speed controls.
 */
export function ReplayPlayer({
  complaint,
  index,
  playing,
  elapsed,
  total,
  progress,
  lang,
  speed,
  onToggle,
  onLang,
  onSpeed,
  stepCount,
}: PlayerProps) {
  const d = useDict()
  const uiLang = useUiLang()
  const playedBars = Math.round(progress * BAR_COUNT)
  const activeBar = Math.min(BAR_COUNT - 1, playedBars)

  return (
    <section
      className="rounded-[26px] bg-[#1C1C24] p-5 text-white shadow-[0_18px_40px_-18px_rgba(23,23,29,0.55)]"
      aria-label={d.replay.title}
    >
      <div className="mb-5 flex items-center gap-3.5">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl',
            TONE[complaint.timeline[0]?.step ?? 'request'],
          )}
          aria-hidden
        >
          <IconTrash className="size-5 text-[#2DD4BF]" stroke="currentColor" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[1rem] font-bold tracking-tight text-white">
            {displayTitle(complaint, uiLang)}
          </h2>
          <p className="mt-0.5 truncate text-[0.75rem] text-[#B6B6C2]">
            {shortLocation(complaint.location.label)}
            {complaint.reference ? ` · ${complaint.reference}` : ''}
          </p>
        </div>
        <Logo size={24} variant="transparent" />
      </div>

      <div className="mb-4 flex items-center gap-4">
        <button
          type="button"
          data-testid="replay-toggle"
          onClick={onToggle}
          aria-label={playing ? d.replay.pause : d.replay.play}
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF5722] to-[#FF7043] shadow-[0_10px_24px_-8px_rgba(255,87,34,0.7)] transition-transform active:scale-95"
        >
          {playing ? (
            <IconPlayerPause size={20} className="fill-white text-white" stroke={0} />
          ) : (
            <IconPlayerPlay size={20} className="ml-0.5 fill-white text-white" stroke={0} />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex h-7 items-center gap-[3px]" aria-hidden>
            {BAR_HEIGHTS.map((height, bar) => (
              <span
                key={bar}
                className={cn(
                  'w-[3px] rounded-full transition-colors duration-200',
                  bar < playedBars
                    ? 'bg-gradient-to-t from-[#FF5722] to-[#FF7043]'
                    : 'bg-[#424254]',
                  playing && bar === activeBar && 'animate-pulse',
                )}
                style={{ height }}
              />
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between text-[0.6875rem] text-[#9A9AA6]">
            <span data-testid="replay-counter" className="tabular">
              {d.replay.stepCounter(Math.min(index + 1, stepCount), stepCount)} · {clock(elapsed)}
            </span>
            <span className="tabular">{clock(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div
          className="inline-flex rounded-full bg-[#2B2B36] p-1 text-[0.75rem] font-medium"
          role="group"
          aria-label={d.profile.voiceLanguage}
        >
          {(
            [
              { id: 'hi', label: d.languages.hindi },
              { id: 'en', label: d.languages.english },
              { id: 'bn', label: d.languages.bengali },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onLang(option.id)}
              aria-pressed={lang === option.id}
              className={cn(
                'rounded-full px-3 py-1 transition-colors',
                lang === option.id
                  ? 'bg-white font-semibold text-[#17171D] shadow-sm'
                  : 'text-[#9A9AA6] hover:text-white',
                option.id === 'hi' && 'deva',
                option.id === 'bn' && 'beng',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onSpeed}
          aria-label={d.profile.voiceSpeed}
          className="flex items-center gap-1 rounded-full bg-[#2B2B36] px-2.5 py-1.5 text-[0.75rem] font-medium text-[#C9C9D2] transition-all hover:bg-[#343442] active:scale-90"
        >
          <span className="tabular">{speed}x</span>
          <IconInfoCircle className="size-3.5 text-[#9A9AA6]" aria-hidden />
        </button>
      </div>
    </section>
  )
}