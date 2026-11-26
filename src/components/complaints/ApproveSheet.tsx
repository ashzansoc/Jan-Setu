import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { IconArrowRight, IconCheck, IconPhoneCall, IconSquare, IconVolume } from '@tabler/icons-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import type { Complaint } from '@/lib/complaints/types'
import { composeComplaint, draftToComposeInput } from '@/lib/complaints/compose'
import { displayTitle } from '@/lib/complaints/display'
import { useComplaints } from '@/state/complaints'
import { useSettings } from '@/state/settings'
import { useDict, useUiLang } from '@/lib/i18n'
import { cancelSpeech, speak } from '@/lib/voice/tts'
import { cn } from '@/lib/cn'

type Step = 'review' | 'submitting' | 'submitted' | 'assisted' | 'failed'

/**
 * Consent is the gate between "prepared" and "sent". Nothing leaves this sheet
 * without an explicit tap, and the outcome shown is whatever the connector
 * actually returned.
 */
export function ApproveSheet({
  complaint,
  onClose,
  onEdit,
}: {
  complaint: Complaint | null
  onClose: () => void
  onEdit: (complaint: Complaint) => void
}) {
  const d = useDict()
  const lang = useUiLang()
  const navigate = useNavigate()
  const speechLang = useSettings((s) => s.speechLang)
  const voiceSpeed = useSettings((s) => s.voiceSpeed)
  const submit = useComplaints((s) => s.submit)
  const recordDeferred = useComplaints((s) => s.recordDeferred)
  const reject = useComplaints((s) => s.reject)

  const [step, setStep] = useState<Step>('review')
  const [reading, setReading] = useState(false)
  const [hasRead, setHasRead] = useState(false)
  const [reference, setReference] = useState<string | null>(null)
  const [assistedId, setAssistedId] = useState<string | null>(null)

  const open = complaint !== null
  const autoReadFor = useRef<string | null>(null)

  // All hooks run unconditionally: the sheet is mounted for every complaint
  // (and null), so an early return above them would change the hook order.
  const composed = useMemo(
    () => (complaint ? composeComplaint(draftToComposeInput(complaint), lang) : null),
    [complaint, lang],
  )

  const listen = useCallback(async () => {
    if (!composed || !complaint) return
    setReading(true)
    await speak(composed.body, { lang: complaint.speechLang ?? speechLang, rate: voiceSpeed })
    setReading(false)
    setHasRead(true)
  }, [composed, complaint, speechLang, voiceSpeed])

  const stopPlayback = useCallback(() => {
    cancelSpeech()
    setReading(false)
  }, [])

  useEffect(() => {
    if (!open) {
      cancelSpeech()
      setStep('review')
      setReading(false)
      setReference(null)
      setAssistedId(null)
      setHasRead(false)
      autoReadFor.current = null
      return
    }
    // Opening the sheet is itself the gesture: read the complaint straight away.
    if (complaint && autoReadFor.current !== complaint.id) {
      autoReadFor.current = complaint.id
      void listen()
    }
  }, [open, complaint, listen])

  useEffect(() => () => cancelSpeech(), [])

  if (!complaint || !composed) return null

  const helpline = complaint.department.helpline ?? '1916'

  const approve = async () => {
    cancelSpeech()
    setStep('submitting')
    const outcome = await submit(complaint.id)
    if (outcome.status === 'submitted') {
      setReference(outcome.reference)
      setStep('submitted')
      void speak(d.tts.submitted(outcome.reference ?? ''), { lang: speechLang, rate: voiceSpeed })
    } else if (outcome.status === 'assisted_filing') {
      setAssistedId(complaint.id)
      setStep('assisted')
    } else {
      setStep('failed')
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        cancelSpeech()
        onClose()
      }}
      title={step === 'submitted' ? d.sheets.submittedTitle : d.sheets.approveTitle}
      description={step === 'review' ? d.sheets.approveBody : undefined}
      labelledBy="approve-sheet-title"
      dismissible={step !== 'submitting'}
      footer={
        step === 'review' ? (
          <div className="grid gap-2">
            <Button
              full
              size="lg"
              data-testid="approve-submit"
              onClick={() => void approve()}
              icon={<IconCheck size={17} stroke={2.8} />}
            >
              {d.sheets.submit}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="md"
                data-testid="approve-notnow"
                onClick={() => {
                  cancelSpeech()
                  recordDeferred(complaint.id)
                  onClose()
                }}
              >
                {d.sheets.notNow}
              </Button>
              <Button
                variant="ghost"
                size="md"
                data-testid="approve-edit"
                onClick={() => onEdit(complaint)}
                className="text-indigo"
              >
                {d.sheets.editInstead}
              </Button>
            </div>
          </div>
        ) : step === 'submitted' ? (
          <div className="grid gap-2">
            <Button
              full
              size="lg"
              onClick={() => navigate(`/replay/${complaint.id}`)}
              iconRight={<IconArrowRight size={17} stroke={2.4} />}
            >
              {d.preview.viewReplay}
            </Button>
            <Button variant="secondary" size="md" full onClick={onClose}>
              {d.actions.done}
            </Button>
          </div>
        ) : step === 'assisted' ? (
          <div className="grid gap-2">
            <a
              href={`tel:${helpline}`}
              className="flex h-[52px] items-center justify-center gap-2 rounded-btn bg-ink text-[0.9375rem] font-semibold text-white"
            >
              <IconPhoneCall size={16} stroke={2.4} />
              {d.complaints.call(helpline)}
            </a>
            <Button variant="secondary" size="md" full onClick={() => {
              onClose()
              if (assistedId) navigate(`/complaints/${assistedId}`)
            }}>
              {d.actions.done}
            </Button>
          </div>
        ) : step === 'failed' ? (
          <Button full size="lg" onClick={() => setStep('review')}>
            {d.actions.retry}
          </Button>
        ) : undefined
      }
    >
      <div className="pb-1">
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-[0.9375rem] font-bold leading-snug text-ink">
            {displayTitle(complaint, lang)}
          </p>
          <p className="mt-0.5 text-[0.78125rem] text-muted">{complaint.location.label}</p>
          <p className="mt-1.5 text-[0.75rem] text-muted">
            {complaint.department.name} · {complaint.department.jurisdiction}
          </p>
        </div>

        {step === 'review' && (
          <>
            <button
              type="button"
              onClick={() => (reading ? stopPlayback() : void listen())}
              aria-pressed={reading}
              className={cn(
                'mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-[0.84375rem] font-semibold transition-colors',
                reading ? 'text-orange' : 'text-indigo',
              )}
            >
              {reading ? (
                <IconSquare size={12} stroke={0} fill="currentColor" />
              ) : (
                <IconVolume size={16} stroke={2.3} />
              )}
              {reading
                ? d.sheets.stopListening
                : hasRead
                  ? d.sheets.listenAgain
                  : d.sheets.listen}
            </button>

            <div className="mt-2.5 max-h-[22svh] overflow-y-auto rounded-2xl border border-line bg-[#FFFDFB] px-3.5 py-3">
              <p
                className={cn(
                  'whitespace-pre-wrap text-[0.78125rem] leading-relaxed text-ink/75',
                  lang === 'hi' && 'deva',
                )}
              >
                {composed.body}
              </p>
            </div>

            <p className="mt-2.5 px-1 text-[0.71875rem] leading-relaxed text-muted">
              {d.verification.sandboxNote}
            </p>

            <button
              type="button"
              onClick={() => {
                reject(complaint.id)
                onClose()
              }}
              className="mt-3 w-full text-center text-[0.75rem] font-medium text-[#A65A50] underline decoration-dotted underline-offset-2"
            >
              {d.sheets.discard}
            </button>
          </>
        )}

        {step === 'submitting' && (
          <p className="mt-6 text-center text-[0.875rem] font-medium text-muted">
            {d.sheets.submitting}
          </p>
        )}

        {step === 'submitted' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#E4F7EE]">
              <IconCheck size={26} stroke={3} className="text-success" />
            </div>
            <p className="mt-3 text-[0.8125rem] text-muted">{d.sheets.submittedBody}</p>
            <div className="mt-3 rounded-2xl bg-[#FFF6EE] px-4 py-3">
              <p className="text-[0.65625rem] font-bold uppercase tracking-[0.14em] text-muted">
                {d.preview.reference}
              </p>
              <p className="mt-0.5 text-[1.0625rem] font-bold tabular text-ink">{reference}</p>
            </div>
            <p className="mt-2.5 text-[0.6875rem] text-muted">{d.verification.sandboxNote}</p>
          </motion.div>
        )}

        {step === 'assisted' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
            <p className="rounded-2xl border border-[#F3DFB6] bg-[#FFF8E9] px-3.5 py-3 text-[0.78125rem] leading-relaxed text-[#7A5A22]">
              {d.sheets.assistedReady}
            </p>
          </motion.div>
        )}

        {step === 'failed' && (
          <p className="mt-4 rounded-2xl bg-[#FDECEA] px-3.5 py-3 text-[0.78125rem] leading-relaxed text-[#8A3A2E]">
            {d.errors.generic}
          </p>
        )}
      </div>
    </Sheet>
  )
}
