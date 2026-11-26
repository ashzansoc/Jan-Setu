import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { IconArrowRight, IconCheck, IconClock, IconExternalLink, IconPhoneCall, IconVolume } from '@tabler/icons-react'
import { ScreenShell } from '@/components/layout/ScreenShell'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { ProgressTracker } from '@/components/ProgressTracker'
import { VerificationBanner } from '@/components/VerificationBanner'
import { composeComplaint, draftToComposeInput } from '@/lib/complaints/compose'
import { stageOf } from '@/lib/complaints/status'
import { useComplaints } from '@/state/complaints'
import { useConversation } from '@/state/conversation'
import { useSettings } from '@/state/settings'
import { useDict, useUiLang } from '@/lib/i18n'
import { speak, cancelSpeech } from '@/lib/voice/tts'
import { cn } from '@/lib/cn'

type Outcome = 'idle' | 'submitting' | 'submitted' | 'assisted' | 'failed'

/**
 * The consent gate for a complaint prepared by the conversation.
 * Submission happens here and nowhere else.
 */
export function PreviewScreen() {
  const d = useDict()
  const lang = useUiLang()
  const navigate = useNavigate()
  const draft = useConversation((s) => s.draft)
  const complaintId = useConversation((s) => s.complaintId)
  const speechLang = useSettings((s) => s.speechLang)
  const voiceSpeed = useSettings((s) => s.voiceSpeed)

  const complaints = useComplaints((s) => s.complaints)
  const submit = useComplaints((s) => s.submit)
  const createAwaitingApproval = useComplaints((s) => s.createAwaitingApproval)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const complaint = useMemo(
    () => (complaintId ? complaints.find((item) => item.id === complaintId) : undefined),
    [complaintId, complaints],
  )

  useEffect(() => {
    if (!draft) navigate('/', { replace: true })
  }, [draft, navigate])

  useEffect(() => () => cancelSpeech(), [])

  const composed = useMemo(
    () => (draft ? composeComplaint(draftToComposeInput(draft), lang) : null),
    [draft, lang],
  )

  if (!draft || !composed) return null

  const stage = complaint ? stageOf(complaint.status) : null
  const helpline = draft.department.helpline ?? '1916'

  const readAloud = async () => {
    setReading(true)
    await speak(composed.body, { lang: speechLang, rate: voiceSpeed })
    setReading(false)
  }

  const approve = async () => {
    setConfirmOpen(false)
    setOutcome('submitting')
    setError(null)

    // The record normally already exists (awaiting approval). If someone deep
    // links here without one, create it now so the lifecycle stays honest.
    const id = complaint?.id ?? createAwaitingApproval(draft).id
    const result = await submit(id)

    if (result.status === 'submitted') {
      setOutcome('submitted')
      void speak(d.tts.submitted(result.reference ?? ''), { lang: speechLang, rate: voiceSpeed })
    } else if (result.status === 'assisted_filing') {
      setOutcome('assisted')
    } else {
      setOutcome('failed')
      setError(d.errors.generic)
    }
  }

  /* ---------------- Receipt ---------------- */
  if (outcome === 'submitted' && complaint) {
    return (
      <ScreenShell title={d.preview.submittedTitle} backTo="/">
        <div className="safe-x">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-card bg-white p-5 text-center shadow-card"
          >
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#E4F7EE]">
              <IconCheck size={30} stroke={3} className="text-success" />
            </div>
            <h2 className="mt-4 text-[1.1875rem] font-bold text-ink">{d.preview.submittedTitle}</h2>
            <p className="mt-1.5 text-[0.84375rem] leading-relaxed text-muted">{d.preview.submittedBody}</p>

            <div className="mt-4 rounded-2xl bg-[#FFF6EE] px-4 py-3">
              <p className="text-[0.65625rem] font-bold uppercase tracking-[0.15em] text-muted">
                {d.preview.reference}
              </p>
              <p className="mt-1 text-[1.125rem] font-bold tabular text-ink">{complaint.reference}</p>
            </div>

            {stage && (
              <div className="mt-4">
                <ProgressTracker stage={stage} />
              </div>
            )}

            <VerificationBanner complaint={complaint} className="mt-4 text-left" />

            <div className="mt-4 grid gap-2.5">
              <Button
                full
                size="lg"
                onClick={() => navigate(`/replay/${complaint.id}`)}
                iconRight={<IconArrowRight size={18} stroke={2.4} />}
              >
                {d.preview.viewReplay}
              </Button>
              <Button full variant="secondary" size="md" onClick={() => navigate('/', { replace: true })}>
                {d.preview.backHome}
              </Button>
            </div>
          </motion.div>

          <p className="mt-4 px-2 text-center text-[0.71875rem] leading-relaxed text-muted">
            {d.verification.sandboxNote}
          </p>
        </div>
      </ScreenShell>
    )
  }

  /* ---------------- Assisted filing outcome ---------------- */
  if (outcome === 'assisted') {
    return (
      <ScreenShell title={d.complaints.assisted} backTo="/">
        <div className="safe-x">
          <div className="rounded-card bg-white p-5 shadow-card">
            <p className="text-[0.9375rem] font-bold text-ink">
              {d.complaints.call(helpline)}
            </p>
            <p className="mt-2 rounded-2xl border border-[#F3DFB6] bg-[#FFF8E9] px-3.5 py-3 text-[0.78125rem] leading-relaxed text-[#7A5A22]">
              {d.complaints.assistedBody(draft.department.jurisdiction, helpline)}
            </p>
            <div className="mt-4 grid gap-2.5">
              <a
                href={`tel:${helpline}`}
                className="flex h-[52px] items-center justify-center gap-2 rounded-btn bg-ink text-[0.9375rem] font-semibold text-white"
              >
                <IconPhoneCall size={16} stroke={2.4} />
                {d.complaints.call(helpline)}
              </a>
              <Button
                full
                variant="secondary"
                size="md"
                onClick={() => navigate(complaint ? `/complaints/${complaint.id}` : '/complaints')}
              >
                {d.actions.done}
              </Button>
            </div>
          </div>
        </div>
      </ScreenShell>
    )
  }

  /* ---------------- Review ---------------- */
  return (
    <ScreenShell title={d.preview.title} subtitle={d.preview.subtitle} backTo="/understand">
      <div className="safe-x">
        <div className="rounded-card bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-muted">
            <IconClock size={12.5} stroke={2.4} />
            {d.preview.toDepartment}
          </div>
          <p className="mt-1.5 text-[0.90625rem] font-semibold leading-snug text-ink">
            {draft.department.name}
          </p>
          <p className="text-[0.78125rem] text-muted">{draft.department.jurisdiction}</p>

          <div className="my-3.5 h-px bg-line" />

          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-muted">
            {d.understand.fields.problem}
          </p>
          <p
            className={cn(
              'mt-1.5 w-full rounded-xl bg-[#FFFBF7] px-3 py-2.5 text-[0.875rem] font-semibold leading-snug text-ink',
              lang === 'hi' && 'deva',
            )}
          >
            {composed.subject}
          </p>

          <div className="mt-3">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-muted">
              {d.preview.complaintText}
            </p>
            <div
              aria-label={d.preview.complaintText}
              className={cn(
                'mt-1.5 w-full whitespace-pre-wrap rounded-xl border border-line bg-[#FFFDFB] px-3.5 py-3 text-[0.78125rem] leading-relaxed text-ink/80',
                lang === 'hi' && 'deva',
              )}
            >
              {composed.body}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void readAloud()}
            aria-pressed={reading}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.8125rem] font-semibold text-indigo transition-colors hover:bg-indigo/[0.06]"
          >
            <IconVolume size={16} stroke={2.2} className={cn(reading && 'animate-pulse text-orange')} />
            {d.actions.readAloud}
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-[#FDECEA] px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-[#8A3A2E]">
            {error}
          </p>
        )}

        <div className="mt-4 rounded-2xl border border-dashed border-line-strong px-3.5 py-3">
          <p className="text-[0.71875rem] leading-relaxed text-muted">{d.verification.sandboxNote}</p>
        </div>
      </div>

      <div className="safe-x mt-4 space-y-2.5" style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
        <Button
          full
          variant="secondary"
          size="md"
          icon={<IconExternalLink size={16} stroke={2.2} />}
          onClick={() => navigate('/portal-login')}
        >
          Open govt portal (AI-assisted)
        </Button>
        <Button
          full
          size="lg"
          disabled={outcome === 'submitting'}
          onClick={() => setConfirmOpen(true)}
        >
          {outcome === 'submitting' ? d.sheets.submitting : d.actions.approve}
        </Button>
      </div>

      <Sheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={d.preview.consentTitle}
        description={d.preview.consentBody}
        labelledBy="consent-title"
        footer={
          <div className="grid gap-2.5">
            <Button full size="lg" onClick={() => void approve()}>
              {d.preview.consentYes}
            </Button>
            <Button full variant="ghost" size="md" onClick={() => setConfirmOpen(false)}>
              {d.preview.consentNo}
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl bg-white px-4 py-3">
          <p className="text-[0.78125rem] font-semibold text-ink/80">{draft.department.name}</p>
          <p className="mt-0.5 text-[0.75rem] text-muted">{draft.location.label}</p>
          <p className="mt-2 text-[0.75rem] text-muted">{d.verification.sandboxNote}</p>
        </div>
      </Sheet>
    </ScreenShell>
  )
}
