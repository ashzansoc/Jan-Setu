import { useEffect, useState } from 'react'
import { IconCheck, IconInfoCircle } from '@tabler/icons-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import type { Complaint } from '@/lib/complaints/types'
import { displayTitle } from '@/lib/complaints/display'
import { useComplaints } from '@/state/complaints'
import { useSettings } from '@/state/settings'
import { useDict, useUiLang } from '@/lib/i18n'
import { speak } from '@/lib/voice/tts'

type Step = 'ask' | 'reference' | 'done'

/**
 * Assisted filing, closed loop. The citizen filed on the helpline themselves;
 * we record their word — explicitly *not* a government verification — and let
 * them keep whatever reference the helpline gave them.
 */
export function AssistedFiledSheet({
  complaint,
  onClose,
}: {
  complaint: Complaint | null
  onClose: () => void
}) {
  const d = useDict()
  const lang = useUiLang()
  const speechLang = useSettings((s) => s.speechLang)
  const voiceSpeed = useSettings((s) => s.voiceSpeed)
  const confirmUserFiled = useComplaints((s) => s.confirmUserFiled)

  const [step, setStep] = useState<Step>('ask')
  const [reference, setReference] = useState('')

  useEffect(() => {
    if (!complaint) {
      setStep('ask')
      setReference('')
    }
  }, [complaint])

  if (!complaint) return null

  const save = () => {
    confirmUserFiled(complaint.id, reference)
    setStep('done')
    void speak(d.sheets.filedSaved, { lang: speechLang, rate: voiceSpeed })
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={d.sheets.filedTitle}
      description={step === 'ask' ? d.sheets.filedBody : undefined}
      labelledBy="filed-sheet-title"
      footer={
        step === 'ask' ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="md" onClick={onClose}>
              {d.sheets.filedNo}
            </Button>
            <Button
              size="md"
              data-testid="filed-yes"
              onClick={() => setStep('reference')}
              icon={<IconCheck size={16} stroke={3} />}
            >
              {d.sheets.filedYes}
            </Button>
          </div>
        ) : step === 'reference' ? (
          <Button full size="lg" data-testid="filed-save" onClick={save}>
            {d.sheets.filedConfirm}
          </Button>
        ) : (
          <Button full size="lg" onClick={onClose}>
            {d.actions.done}
          </Button>
        )
      }
    >
      <div className="pb-1">
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-[0.90625rem] font-bold leading-snug text-ink">
            {displayTitle(complaint, lang)}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-muted">{complaint.location.label}</p>
        </div>

        {step === 'reference' && (
          <>
            <label
              htmlFor="filed-ref"
              className="mt-3 block text-[0.75rem] font-semibold text-ink/80"
            >
              {d.sheets.filedRefLabel}
            </label>
            <input
              id="filed-ref"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder={d.sheets.filedRefPlaceholder}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[0.875rem] tabular text-ink placeholder:text-muted/70 focus:border-orange/50 focus:outline-none"
              autoComplete="off"
            />
          </>
        )}

        {step === 'done' && (
          <div className="mt-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#E4F7EE]">
              <IconCheck size={26} stroke={3} className="text-success" />
            </div>
            <p className="mt-3 text-[0.84375rem] font-semibold text-ink">{d.sheets.filedSaved}</p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">
              {d.detail.followUpNote}
            </p>
          </div>
        )}

        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[#FFF8E9] px-3 py-2 text-[0.71875rem] leading-relaxed text-[#7A5A22]">
          <IconInfoCircle size={13} stroke={2.3} className="mt-[1px] shrink-0" />
          {d.profile.simulatedBody}
        </p>
      </div>
    </Sheet>
  )
}
