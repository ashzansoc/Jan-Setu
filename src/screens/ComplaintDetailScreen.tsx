import { IconCheck, IconChevronLeft, IconCopy, IconHistory, IconMapPin, IconShieldCheck, IconShieldQuestion, IconVolume } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProgressTracker } from '@/components/ProgressTracker'
import { StatusBadge } from '@/components/complaints/parts'
import { Button } from '@/components/ui/Button'
import type { Complaint } from '@/lib/complaints/types'
import { stageOf } from '@/lib/complaints/status'
import { displayTitle, metaLine } from '@/lib/complaints/display'
import { useComplaints } from '@/state/complaints'
import { useSettings } from '@/state/settings'
import { useDict, useUiLang } from '@/lib/i18n'
import { formatClock, relativeTime } from '@/lib/format'
import { speak, cancelSpeech } from '@/lib/voice/tts'
import { cn } from '@/lib/cn'

/**
 * Full record view. It is the audit trail rather than a dashboard: status,
 * provenance, the formal text, and every action in order.
 */
export function ComplaintDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const d = useDict()
  const lang = useUiLang()
  const speechLang = useSettings((s) => s.speechLang)
  const voiceSpeed = useSettings((s) => s.voiceSpeed)
  const complaint = useComplaints((s) => s.complaints.find((c) => c.id === id))
  const refresh = useComplaints((s) => s.refresh)
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (id) void refresh(id)
  }, [id, refresh])

  useEffect(() => () => cancelSpeech(), [])

  if (!complaint) {
    return (
      <div className="app-bloom min-h-svh px-5 pt-[max(16px,env(safe-area-inset-top))]">
        <BackRow onBack={() => navigate('/complaints')} label={d.complaints.title} />
        <p className="mt-10 text-center text-[0.875rem] text-muted">{d.sheets.noComplaint}</p>
      </div>
    )
  }

  const stage = stageOf(complaint.status)
  const live = complaint.verification.mode === 'live'

  const copyReference = async () => {
    if (!complaint.reference) return
    try {
      await navigator.clipboard.writeText(complaint.reference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — the number is on screen anyway */
    }
  }

  const followUp = async () => {
    setChecking(true)
    await refresh(complaint.id)
    const latest = useComplaints.getState().complaints.find((c) => c.id === complaint.id)
    const stageLabel = d.lifecycle[latest?.status ?? complaint.status]
    await speak(
      complaint.reference
        ? d.tts.status(stageLabel, complaint.reference)
        : d.tts.statusNoRef(stageLabel),
      { lang: speechLang, rate: voiceSpeed },
    )
    setChecking(false)
  }

  return (
    <div className="app-bloom min-h-svh">
      <div className="mx-auto w-full max-w-[560px] pb-[calc(28px+env(safe-area-inset-bottom))]">
        <div className="safe-x flex items-center gap-2 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
          <BackRow onBack={() => navigate('/complaints')} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.0625rem] font-bold leading-tight text-ink">
              {displayTitle(complaint, lang)}
            </h1>
            <p className="truncate text-[0.78125rem] text-muted">{metaLine(complaint, lang, d)}</p>
          </div>
        </div>

        <div className="safe-x">
          <div className="rounded-card bg-white px-4 pb-4 pt-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 text-[0.78125rem] text-muted">
                <IconMapPin size={12.5} stroke={2.2} className="shrink-0" />
                <span className="truncate">{complaint.location.label}</span>
              </p>
              <StatusBadge status={complaint.status} />
            </div>

            {stage && (
              <div className="mt-4">
                <ProgressTracker stage={stage} />
              </div>
            )}

            <div className="mt-4 rounded-2xl bg-[#FFF6EE] px-3.5 py-2.5">
              <p className="flex items-start gap-2 text-[0.75rem] font-medium leading-snug text-ink/75">
                {live ? (
                  <IconShieldCheck size={15} stroke={2.3} className="mt-[1px] shrink-0 text-success" />
                ) : (
                  <IconShieldQuestion size={15} stroke={2.3} className="mt-[1px] shrink-0 text-[#C08A45]" />
                )}
                <span className="min-w-0">
                  {complaint.verification.mode === 'none'
                    ? d.complaints.notSubmitted
                    : complaint.verification.mode === 'live'
                      ? d.complaints.verifiedOn(
                          complaint.verification.source,
                          complaint.verification.verifiedAt
                            ? relativeTime(complaint.verification.verifiedAt, d)
                            : '',
                        )
                      : complaint.verification.mode === 'user' || complaint.verification.mode === 'assisted'
                        ? complaint.verification.source
                        : d.complaints.demoVerified(
                            complaint.verification.verifiedAt
                              ? relativeTime(complaint.verification.verifiedAt, d)
                              : '',
                          )}
                </span>
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[0.75rem] font-semibold tabular text-ink">
                  {complaint.reference
                    ? `${d.complaints.ref} ${complaint.reference}`
                    : d.verification.pendingRef}
                </p>
                {complaint.reference && (
                  <button
                    type="button"
                    onClick={() => void copyReference()}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[0.6875rem] font-semibold text-[#A85822]"
                  >
                    {copied ? <IconCheck size={11} stroke={3} /> : <IconCopy size={11} stroke={2.4} />}
                    {copied ? d.detail.copied : d.detail.copyRef}
                  </button>
                )}
              </div>
            </div>

            {complaint.department.helpline && complaint.status === 'assisted_filing' && (
              <p className="mt-2.5 rounded-xl bg-[#FFF8E9] px-3 py-2 text-[0.71875rem] leading-relaxed text-[#7A5A22]">
                {d.complaints.assistedBody(complaint.department.jurisdiction, complaint.department.helpline)}
              </p>
            )}

            <p className="mt-3 text-[0.71875rem] text-muted">
              {d.verification.updated(relativeTime(complaint.updatedAt, d))}
            </p>
          </div>

          <h2 className="mt-5 px-1 text-[0.71875rem] font-bold uppercase tracking-[0.14em] text-muted">
            {d.detail.timeline}
          </h2>
          <ul className="mt-2 overflow-hidden rounded-card bg-white shadow-card">
            {complaint.timeline.map((event) => (
              <li
                key={`${event.step}-${event.at}`}
                className="flex items-start gap-3 border-b border-line/70 px-4 py-2.5 last:border-b-0"
              >
                <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-orange" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[0.84375rem] font-medium text-ink/85', lang === 'hi' && 'deva')}>
                    {d.replay.steps[event.step]}
                  </span>
                  {event.note && (
                    <span className="mt-0.5 block truncate text-[0.6875rem] text-muted">{event.note}</span>
                  )}
                </span>
                <span className="shrink-0 text-[0.6875rem] tabular text-muted">
                  {formatClock(event.at, lang)}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="mt-5 px-1 text-[0.71875rem] font-bold uppercase tracking-[0.14em] text-muted">
            {d.preview.complaintText}
          </h2>
          <div className="mt-2 rounded-card bg-white p-4 shadow-card">
            <p
              className={cn(
                'whitespace-pre-wrap text-[0.78125rem] leading-relaxed text-ink/75',
                lang === 'hi' && 'deva',
              )}
            >
              {complaint.description}
            </p>
          </div>

          <div className="mt-4 grid gap-2.5 pb-2">
            <Button
              full
              size="lg"
              icon={<IconHistory size={17} stroke={2.2} />}
              onClick={() => navigate(`/replay/${complaint.id}`)}
            >
              {d.actions.actionReplay}
            </Button>
            <Button
              full
              variant="secondary"
              size="lg"
              disabled={checking}
              onClick={() => void followUp()}
              icon={
                <IconVolume
                  size={17}
                  stroke={2.2}
                  className={cn('text-orange', checking && 'animate-pulse')}
                />
              }
            >
              {d.detail.followUp}
            </Button>
            <Link
              to="/complaints"
              className="mt-1 text-center text-[0.78125rem] font-semibold text-indigo"
            >
              {d.complaints.title}
            </Link>
          </div>
          <p className="mt-1 px-1 text-center text-[0.6875rem] leading-relaxed text-muted">
            {d.detail.followUpNote}
          </p>
        </div>
      </div>
    </div>
  )
}

function BackRow({ onBack, label }: { onBack: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={label ?? 'Back'}
      className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-black/[0.05]"
    >
      <IconChevronLeft size={21} stroke={2.2} />
    </button>
  )
}

export type { Complaint }
