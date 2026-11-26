import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconFileText, IconPlayerPlay, IconShare, IconTrash } from '@tabler/icons-react'
import type { Complaint } from '@/lib/complaints/types'
import { displayTitle, shortLocation } from '@/lib/complaints/display'
import { useComplaints } from '@/state/complaints'
import { useDict, useUiLang } from '@/lib/i18n'
import { formatClock } from '@/lib/format'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/cn'

/**
 * The Replay tab, styled to the Stitch Action Replay shell: warm canvas,
 * sticky breadcrumb header, and one dark player card per replayable complaint.
 */
export function ReplayListScreen() {
  const d = useDict()
  const lang = useUiLang()
  const navigate = useNavigate()
  const complaints = useComplaints((s) => s.complaints)

  const replayable = complaints
    .filter((complaint) => complaint.timeline.length > 1)
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const shareAll = async () => {
    const text = replayable
      .map((complaint) => `${displayTitle(complaint, lang)} — ${complaint.location.label}`)
      .join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: d.replay.title, text })
        return
      }
      await navigator.clipboard.writeText(text)
    } catch {
      /* user dismissed the share sheet */
    }
  }

  return (
    <div className="app-bloom min-h-svh">
      <div className="mx-auto w-full max-w-[560px] pb-[calc(112px+env(safe-area-inset-bottom))]">
        <header className="safe-x sticky top-0 z-30 flex items-center justify-between gap-2 bg-ivory/85 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur-md">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label={d.actions.back}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#2B2B33] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
          >
            <IconArrowLeft size={20} stroke={2.2} />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="deva text-[0.6875rem] font-semibold leading-tight tracking-wide text-[#E65100]">
              {d.replay.eyebrow}
            </p>
            <h1 className="truncate text-[1.25rem] font-bold leading-tight tracking-tight text-[#17171D]">
              {d.replay.title}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => void shareAll()}
            aria-label={d.replay.share}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#2B2B33] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
          >
            <IconShare size={19} stroke={2} />
          </button>
        </header>

        <main className="safe-x pt-2">
          <p className="mb-6 text-center text-[0.75rem] font-medium text-[#8A8580]">{d.replay.helper}</p>

          {replayable.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D8D2CA] bg-white/70 px-5 py-10 text-center">
              <p className={cn('text-[0.875rem] leading-relaxed text-[#8A8580]', lang === 'hi' && 'deva')}>
                {d.complaints.empty}
              </p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-4 rounded-2xl bg-[#1C1C24] px-4 py-3 text-sm font-semibold text-white shadow-md transition-transform active:scale-95"
              >
                {d.home.tapToSpeak}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {replayable.map((complaint) => (
                <ReplayCard key={complaint.id} complaint={complaint} onOpen={() => navigate(`/replay/${complaint.id}`)} />
              ))}
            </div>
          )}

          <section className="mb-6 mt-8 grid grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={() => navigate('/complaints')}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#1C1C24] px-4 py-3.5 text-sm font-semibold text-white shadow-md transition-transform active:scale-95"
            >
              <IconFileText size={16} stroke={2} />
              {d.nav.complaints}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-2 rounded-2xl border border-[#E7E2DA] bg-white px-4 py-3.5 text-sm font-semibold text-[#2B2B33] shadow-sm transition-transform active:scale-95"
            >
              {d.home.tapToSpeak}
            </button>
          </section>
        </main>
      </div>
    </div>
  )
}

function ReplayCard({ complaint, onOpen }: { complaint: Complaint; onOpen: () => void }) {
  const d = useDict()
  const lang = useUiLang()
  const last = complaint.timeline[complaint.timeline.length - 1]

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-3xl bg-[#1C1C24] p-5 text-left text-white shadow-xl shadow-black/10 transition-transform active:scale-[0.99]"
    >
      <div className="mb-4 flex items-center gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#28322E]">
          <IconTrash className="size-5 text-[#2DD4BF]" stroke="currentColor" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold tracking-tight text-white">{displayTitle(complaint, lang)}</h2>
          <p className="mt-0.5 truncate text-[0.75rem] text-[#B6B6C2]">
            {shortLocation(complaint.location.label)}
            {complaint.reference ? ` · ${complaint.reference}` : ''}
          </p>
        </div>
        <Logo size={24} variant="transparent" />
      </div>

      <div className="flex items-center gap-4">
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF5722] to-[#FF7043] shadow-[0_10px_24px_-8px_rgba(255,87,34,0.7)]">
          <IconPlayerPlay className="ml-0.5 size-5 fill-white text-white" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex h-7 items-center gap-[3px]" aria-hidden>
            {[8, 20, 28, 16, 24, 28, 12, 20, 24, 16, 20, 12, 8].map((height, bar) => (
              <span
                key={bar}
                className={cn('w-[3px] rounded-full', bar < 5 ? 'bg-gradient-to-t from-[#FF5722] to-[#FF7043]' : 'bg-[#424254]')}
                style={{ height }}
              />
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between text-[0.6875rem] text-[#9A9AA6]">
            <span className="tabular">
              {d.replay.stepCounter(complaint.timeline.length, complaint.timeline.length)}
              {last ? ` · ${formatClock(last.at, lang)}` : ''}
            </span>
            <span className="tabular">{d.lifecycle[complaint.status]}</span>
          </div>
        </div>
      </div>
    </button>
  )
}