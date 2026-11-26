import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  IconArrowLeft,
  IconBrain,
  IconBuilding,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconFileText,
  IconFlag,
  IconHeart,
  IconMapPin,
  IconMessage2,
  IconPencil,
  IconPhoneCall,
  IconRotateClockwise,
  IconSend,
  IconShare,
  IconShieldCheck,
  IconVolume,
} from '@tabler/icons-react'
import type { Complaint, ComplaintStatus, TimelineStep } from '@/lib/complaints/types'
import { displayTitle, shortLocation } from '@/lib/complaints/display'
import { ReplayPlayer } from '@/components/complaints/ReplayPlayer'
import { Sheet } from '@/components/ui/Sheet'
import { useComplaints } from '@/state/complaints'
import { useSettings } from '@/state/settings'
import { useDict, useUiLang } from '@/lib/i18n'
import { formatClock, formatDurationDays } from '@/lib/format'
import { cancelSpeech, speak } from '@/lib/voice/tts'
import { cn } from '@/lib/cn'

/** Per-step colour, taken from the design. */
const STEP_COLOR: Record<TimelineStep, string> = {
  request: '#E85D30',
  understanding: '#E55B32',
  location: '#E5395A',
  department: '#D81B60',
  generation: '#3949AB',
  consent: '#283593',
  submission: '#3F51B5',
  acknowledgement: '#00897B',
  in_progress: '#00897B',
  resolution: '#16A477',
  reopened: '#E5395A',
  amendment: '#D81B60',
  assisted_filing: '#B57314',
  user_confirmed: '#16A477',
}

const LINE_COLOR: Record<TimelineStep, string> = {
  request: '#E87A5D',
  understanding: '#D86868',
  location: '#BD5D7E',
  department: '#86599B',
  generation: '#4E56B4',
  consent: '#4A4EA7',
  submission: '#2D7398',
  acknowledgement: '#2E9C83',
  in_progress: '#2E9C83',
  resolution: '#2E9C83',
  reopened: '#BD5D7E',
  amendment: '#86599B',
  assisted_filing: '#C9A227',
  user_confirmed: '#2E9C83',
}

/** The next step each status is still waiting on. */
const PENDING_NEXT: Partial<Record<ComplaintStatus, TimelineStep>> = {
  draft: 'consent',
  awaiting_approval: 'consent',
  approved: 'submission',
  submitted: 'acknowledgement',
  reopened: 'submission',
  acknowledged: 'resolution',
  in_progress: 'resolution',
  assisted_filing: 'user_confirmed',
}

/** Step glyphs, all from Tabler. The pending step uses a flag, never a check. */
const STEP_ICON: Record<TimelineStep, typeof IconMessage2> = {
  request: IconMessage2,
  understanding: IconBrain,
  location: IconMapPin,
  department: IconBuilding,
  generation: IconVolume,
  consent: IconHeart,
  submission: IconSend,
  acknowledgement: IconShieldCheck,
  in_progress: IconRotateClockwise,
  resolution: IconCircleCheck,
  reopened: IconRotateClockwise,
  amendment: IconPencil,
  assisted_filing: IconPhoneCall,
  user_confirmed: IconCircleCheck,
}

function estimateSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(2.4, Math.round((words / 2.5) * 10) / 10)
}

export function ReplayDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const d = useDict()
  const lang = useUiLang()
  const speechLangSetting = useSettings((s) => s.speechLang)
  const complaint = useComplaints((s) => s.complaints.find((c) => c.id === id))
  const hydrate = useComplaints((s) => s.hydrate)

  // A replay can be opened directly (from a link or a reload), so the store must
  // be read from persistence here rather than assuming another screen ran first.
  useEffect(() => {
    hydrate()
  }, [hydrate])

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [replayLang, setReplayLang] = useState<'hi' | 'en' | 'bn'>(
    speechLangSetting.startsWith('hi') ? 'hi' : speechLangSetting.startsWith('bn') ? 'bn' : 'en',
  )
  const [speed, setSpeed] = useState(1)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)

  useEffect(() => () => cancelSpeech(), [])

  // Follow the global voice language when it changes, so a mid-session switch
  // is reflected here too rather than only on first mount.
  useEffect(() => {
    setReplayLang(
      speechLangSetting.startsWith('hi') ? 'hi' : speechLangSetting.startsWith('bn') ? 'bn' : 'en',
    )
  }, [speechLangSetting])

  useEffect(() => {
    setIndex(0)
    setPlaying(false)
    setElapsed(0)
  }, [id])

  const factsFor = useCallback(
    (step: TimelineStep): { label: string; value: string }[] => {
      if (!complaint) return []
      const facts: { label: string; value: string }[] = []
      const add = (label: string, value: string | null | undefined) => {
        if (value) facts.push({ label, value })
      }
      switch (step) {
        case 'request':
          add(d.understand.youSaid, `“${complaint.transcript}”`)
          break
        case 'understanding':
          add(d.understand.fields.category, displayTitle(complaint, lang))
          if (complaint.durationDays) {
            add(d.understand.fields.duration, formatDurationDays(complaint.durationDays, lang))
          }
          add(
            d.understand.fields.urgency,
            complaint.urgency === 'high' ? d.understand.urgencyHigh : d.understand.urgencyNormal,
          )
          break
        case 'location':
          add(d.understand.fields.location, complaint.location.label)
          break
        case 'department':
          add(d.understand.fields.department, complaint.department.name)
          add(d.preview.toDepartment, complaint.department.jurisdiction)
          break
        case 'generation':
          add(d.preview.complaintText, `${displayTitle(complaint, lang)} — ${shortLocation(complaint.location.label)}`)
          break
        case 'submission':
        case 'acknowledgement':
          add(d.preview.reference, complaint.reference ?? d.verification.pendingRef)
          break
        case 'resolution':
          add(
            complaint.resolutionSource === 'user_confirmed' ? d.complaints.userClosed : d.detail.title,
            complaint.resolutionSource === 'user_confirmed' ? '' : complaint.verification.source,
          )
          break
        case 'assisted_filing':
          add(
            d.complaints.assisted,
            complaint.department.helpline ? d.complaints.call(complaint.department.helpline) : '',
          )
          break
        case 'user_confirmed':
          add(d.complaints.userClosed, '')
          break
        default:
          break
      }
      return facts
    },
    [complaint, d, lang],
  )

  const segments = useMemo(() => {
    if (!complaint) return []
    return complaint.timeline.map((event) => {
      const facts = factsFor(event.step)
      const body = facts.map((fact) => `${fact.label}: ${fact.value}`).join('. ')
      return {
        step: event.step,
        at: event.at,
        text: `${d.replay.steps[event.step]}. ${body}`.trim(),
      }
    })
  }, [complaint, factsFor, d])

  const durations = useMemo(() => segments.map((segment) => estimateSeconds(segment.text)), [segments])
  const offsets = useMemo(() => {
    let running = 0
    return durations.map((duration) => {
      const start = running
      running += duration
      return start
    })
  }, [durations])
  const total = useMemo(() => durations.reduce((sum, value) => sum + value, 0), [durations])

  // Speak the current segment; advance when it finishes.
  useEffect(() => {
    if (!playing || !segments.length) return
    const segment = segments[index]
    if (!segment) {
      setPlaying(false)
      return
    }
    let cancelled = false
    setElapsed(offsets[index] ?? 0)
    void speak(segment.text, { lang: `${replayLang}-IN`, rate: speed }).then(() => {
      if (cancelled) return
      if (index + 1 < segments.length) setIndex(index + 1)
      else {
        setPlaying(false)
        setElapsed(total)
      }
    })
    return () => {
      cancelled = true
      cancelSpeech()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, segments, replayLang, speed])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setElapsed((value) => Math.min(total, value + 0.25))
    }, 250)
    return () => window.clearInterval(timer)
  }, [playing, total])

  if (!complaint) {
    return (
      <div className="app-bloom px-5 pt-10">
        <p className="text-center text-[0.875rem] text-muted">{d.sheets.noComplaint}</p>
      </div>
    )
  }

  const pendingStep = PENDING_NEXT[complaint.status]
  const activeIndex = playing ? index : Math.max(0, segments.length - 1)
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0

  const toggle = () => {
    if (playing) {
      setPlaying(false)
      cancelSpeech()
      return
    }
    if (elapsed >= total - 0.2) {
      setIndex(0)
      setElapsed(0)
    }
    setPlaying(true)
  }

  const playStep = (target: number) => {
    setIndex(target)
    setElapsed(offsets[target] ?? 0)
    setPlaying(true)
  }

  const cycleSpeed = () => {
    const options = [1, 1.25, 1.5, 0.75]
    const next = options[(options.indexOf(speed) + 1) % options.length]
    setSpeed(next)
  }

  const share = async () => {
    const text = `${d.replay.shareTitle(displayTitle(complaint, lang))}\n${complaint.location.label}${
      complaint.reference ? ` · ${d.complaints.ref} ${complaint.reference}` : ''
    }\n${d.lifecycle[complaint.status]}`
    try {
      if (navigator.share) {
        await navigator.share({ title: d.replay.shareTitle(displayTitle(complaint, lang)), text })
        return
      }
      await navigator.clipboard.writeText(text)
      setShareNote(d.replay.copied)
      window.setTimeout(() => setShareNote(null), 1800)
    } catch {
      /* user dismissed the share sheet — nothing to report */
    }
  }

  const copyReference = async () => {
    if (!complaint.reference) return
    try {
      await navigator.clipboard.writeText(complaint.reference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked */
    }
  }

  const badgeFor = (step: TimelineStep): { label: string; tone: 'green' | 'blue' | 'indigo' | 'gray' } => {
    if (step === 'acknowledgement') return { label: d.replay.badges.acknowledgement, tone: 'blue' }
    if (step === 'generation') return { label: d.replay.badges.generation, tone: 'green' }
    if (step === 'consent') return { label: d.replay.badges.consent, tone: 'green' }
    if (step === 'submission') return { label: d.replay.badges.submission, tone: 'green' }
    if (step === 'resolution') return { label: d.replay.badges.resolution, tone: 'green' }
    if (step === 'reopened') return { label: d.replay.badges.reopened, tone: 'indigo' }
    if (step === 'amendment') return { label: d.replay.badges.amendment, tone: 'indigo' }
    if (step === 'assisted_filing') return { label: d.replay.badges.assisted_filing, tone: 'gray' }
    if (step === 'user_confirmed') return { label: d.replay.badges.user_confirmed, tone: 'green' }
    return { label: d.replay.badges[step], tone: 'green' }
  }

  const badgeTone: Record<'green' | 'blue' | 'indigo' | 'gray', string> = {
    green: 'bg-[#E6F8F0] text-[#0E8345]',
    blue: 'bg-[#E8F0FE] text-[#1D4ED8]',
    indigo: 'bg-[#EEF0FB] text-[#3B49DF]',
    gray: 'bg-[#F1EDE7] text-[#6E675E]',
  }

  return (
    <div className="app-bloom min-h-svh">
      <div className="mx-auto w-full max-w-[560px] pb-[calc(112px+env(safe-area-inset-bottom))]">
        {/* Header */}
        <header className="safe-x sticky top-0 z-30 flex items-center justify-between gap-2 bg-ivory/85 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur-md">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={d.actions.back}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#2B2B33] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
          >
            <IconArrowLeft size={20} stroke={2.2} />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="deva text-[0.6875rem] font-semibold leading-tight tracking-wide text-[#E65100]">
              {d.replay.eyebrow}
            </p>
            <h1 className="truncate text-[1.25rem] font-bold leading-tight tracking-tight text-ink">
              {d.replay.title}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => void share()}
            aria-label={d.replay.share}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#2B2B33] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
          >
            <IconShare size={19} stroke={2} />
          </button>
        </header>

        <main className="safe-x pt-2">
          <ReplayPlayer
            complaint={complaint}
            index={index}
            playing={playing}
            elapsed={elapsed}
            total={total}
            progress={progress}
            lang={replayLang}
            speed={speed}
            onToggle={toggle}
            onLang={(next) => {
              cancelSpeech()
              setReplayLang(next)
            }}
            onSpeed={cycleSpeed}
            stepCount={segments.length}
          />

          <p className="mb-6 mt-4 text-center text-[0.75rem] font-medium text-[#8A8580]">
            {d.replay.helper}
          </p>

          {/* Timeline */}
          <section className="relative px-1">
            {segments.map((segment, stepIndex) => {
              const facts = factsFor(segment.step)
              const isActive = stepIndex === activeIndex
              const isLast = stepIndex === segments.length - 1 && !pendingStep
              const badge = badgeFor(segment.step)
              const color = STEP_COLOR[segment.step]
              const StepIcon = STEP_ICON[segment.step]

              return (
                <div key={`${segment.step}-${segment.at}-${stepIndex}`} className="relative flex items-start gap-3.5 pb-4">
                  {!isLast && (
                    <span
                      className="absolute bottom-[-16px] left-[19px] top-6 w-[2px]"
                      style={{ background: LINE_COLOR[segment.step] }}
                      aria-hidden
                    />
                  )}

                  <span
                    className={cn(
                      'relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-md',
                      isActive && 'ring-4',
                    )}
                    style={{
                      background: color,
                      ...(isActive ? { boxShadow: `0 0 0 4px ${color}26, 0 6px 14px -6px ${color}80` } : {}),
                    }}
                    aria-hidden
                  >
                    <StepIcon size={19} strokeWidth={2.1} aria-hidden />
                  </span>

                  <motion.article
                    role="button"
                    tabIndex={0}
                    aria-label={`${d.replay.steps[segment.step]} — ${d.replay.helper}`}
                    onClick={() => playStep(stepIndex)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        playStep(stepIndex)
                      }
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(stepIndex, 8) * 0.04, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      'min-w-0 flex-1 cursor-pointer rounded-2xl bg-white p-4 transition-shadow',
                      isActive
                        ? 'border-2 shadow-md'
                        : 'border border-[#F0EBE4] shadow-[0_1px_2px_rgba(23,23,29,0.04)]',
                    )}
                    style={isActive ? { borderColor: '#283593' } : undefined}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <h3 className="min-w-0 truncate text-[0.875rem] font-bold text-ink">
                        {stepIndex + 1} · {d.replay.steps[segment.step]}
                      </h3>
                      {playing && isActive ? (
                        <span className="shrink-0 rounded-full bg-[#1A237E] px-2.5 py-0.5 text-[0.6875rem] font-bold text-white">
                          {d.replay.nowPlaying}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
                            badgeTone[badge.tone],
                          )}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>

                    {segment.step === 'request' ? (
                      <>
                        <p className={cn('mb-2.5 text-[0.78125rem] italic leading-relaxed text-[#5C5852]', lang === 'hi' && 'deva not-italic')}>
                          “{facts[0]?.value.replace(/^“|”$/g, '') ?? complaint.transcript}”
                        </p>
                        <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-[#E65100]">
                          <span className="text-[0.625rem]">▶</span>
                          {d.replay.playOriginal}
                        </span>
                      </>
                    ) : facts.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {facts.map((fact) => (
                          <span
                            key={fact.label + fact.value}
                            className={cn(
                              'rounded-lg border border-[#E7E2DA] bg-[#FBF9F6] px-2.5 py-1 text-[0.75rem] font-medium text-[#4A463F]',
                              lang === 'hi' && 'deva',
                            )}
                          >
                            {fact.value || fact.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.75rem] leading-relaxed text-[#6E6A64]">
                        {formatClock(segment.at, lang)}
                      </p>
                    )}
                  </motion.article>
                </div>
              )
            })}

            {pendingStep && (
              <div className="relative flex items-start gap-3.5">
                <span
                  className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#B9B3AB] bg-[#FFF9F3] text-[#B9B3AB]"
                  aria-hidden
                >
                  <IconFlag size={19} strokeWidth={2.1} aria-hidden />
                </span>
                <article className="min-w-0 flex-1 rounded-2xl border border-dashed border-[#D8D2CA] bg-white/70 p-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="min-w-0 truncate text-[0.875rem] font-bold text-[#8A8580]">
                      {segments.length + 1} · {d.replay.steps[pendingStep]}
                    </h3>
                    <span className="shrink-0 rounded-full bg-[#F1EDE7] px-2.5 py-0.5 text-[0.6875rem] font-medium text-[#6E675E]">
                      {d.replay.waiting}
                    </span>
                  </div>
                  <p className="text-[0.75rem] leading-relaxed text-[#8A8580]">{d.replay.waitingNote}</p>
                </article>
              </div>
            )}
          </section>

          {/* Actions */}
          <section className="mb-2 mt-8 grid grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={() => setReceiptOpen(true)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#1C1C24] px-4 py-3.5 text-[0.875rem] font-semibold text-white shadow-md transition-transform active:scale-95"
            >
              <IconFileText size={16} stroke={2} />
              {d.replay.receipt}
            </button>
            <button
              type="button"
              onClick={() => void share()}
              className="flex items-center justify-center gap-2 rounded-2xl border border-[#E7E2DA] bg-white px-4 py-3.5 text-[0.875rem] font-semibold text-[#2B2B33] shadow-sm transition-transform active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-[#25D366]" aria-hidden>
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
              </svg>
              {shareNote ?? d.replay.share}
            </button>
          </section>

          {(complaint.isDemo || complaint.verification.mode === 'sandbox') && (
            <p className="mt-3 rounded-xl bg-[#FFF6EE] px-3 py-2 text-[0.6875rem] leading-relaxed text-[#8A5A2B]">
              {d.replay.demoBanner}
            </p>
          )}
        </main>
      </div>

      <Sheet
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title={d.replay.receipt}
        labelledBy="receipt-title"
        footer={
          <div className="grid gap-2">
            {complaint.reference && (
              <button
                type="button"
                onClick={() => void copyReference()}
                className="flex h-12 items-center justify-center gap-2 rounded-btn bg-ink text-[0.875rem] font-semibold text-white"
              >
                {copied ? <IconCheck size={16} stroke={3} /> : <IconCopy size={16} stroke={2.3} />}
                {copied ? d.detail.copied : d.detail.copyRef}
              </button>
            )}
            <Link
              to={`/complaints/${complaint.id}`}
              onClick={() => setReceiptOpen(false)}
              className="flex h-12 items-center justify-center rounded-btn border border-[#E7E2DA] bg-white text-[0.875rem] font-semibold text-ink"
            >
              {d.detail.title}
            </Link>
          </div>
        }
      >
        <div className="space-y-2.5 pb-1">
          <div className="rounded-2xl bg-white px-4 py-3">
            <p className="text-[0.65625rem] font-bold uppercase tracking-[0.14em] text-muted">
              {d.preview.reference}
            </p>
            <p className="mt-1 text-[1.125rem] font-bold tabular text-ink">
              {complaint.reference ?? d.verification.pendingRef}
            </p>
            <p className="mt-1.5 text-[0.75rem] text-muted">
              {complaint.department.name} · {complaint.department.jurisdiction}
            </p>
            {complaint.submittedAt && (
              <p className="mt-0.5 text-[0.75rem] text-muted">{formatClock(complaint.submittedAt, lang)}</p>
            )}
          </div>
          <div className="rounded-2xl bg-[#FFF6EE] px-4 py-3">
            <p className="text-[0.75rem] leading-relaxed text-[#7A5433]">
              {complaint.verification.mode === 'live'
                ? d.complaints.verifiedOn(
                    complaint.verification.source,
                    complaint.verification.verifiedAt
                      ? relativeTimeSafe(complaint.verification.verifiedAt, d)
                      : '',
                  )
                : complaint.verification.mode === 'none'
                  ? d.complaints.notSubmitted
                  : d.complaints.demoVerified(
                      complaint.verification.verifiedAt
                        ? relativeTimeSafe(complaint.verification.verifiedAt, d)
                        : '',
                    )}
            </p>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

/** Local relative-time helper so the receipt sheet does not need the store. */
function relativeTimeSafe(iso: string, d: ReturnType<typeof useDict>): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60_000))
  if (minutes < 1) return d.verification.justNow
  if (minutes < 60) return d.verification.minutesAgo(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return d.verification.hoursAgo(hours)
  return d.verification.daysAgo(Math.floor(hours / 24))
}

export type { Complaint }
