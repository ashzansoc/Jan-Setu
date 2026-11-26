import { useEffect, useState } from 'react'
import { IconCheck, IconRotateClockwise } from '@tabler/icons-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import type { Complaint } from '@/lib/complaints/types'
import { displayTitle } from '@/lib/complaints/display'
import { useComplaints } from '@/state/complaints'
import { useSettings } from '@/state/settings'
import { useDict, useUiLang } from '@/lib/i18n'
import { speak } from '@/lib/voice/tts'

/**
 * Reopening is a real re-filing, not a label change: it records why, then sends
 * the same complaint through the connector again for a fresh reference.
 */
export function ReopenSheet({
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
  const reopen = useComplaints((s) => s.reopen)

  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  useEffect(() => {
    if (!complaint) {
      setBusy(false)
      setDone(false)
      setReference(null)
    }
  }, [complaint])

  if (!complaint) return null

  const confirm = async () => {
    setBusy(true)
    const outcome = await reopen(complaint.id)
    setBusy(false)
    setDone(true)
    setReference(outcome.reference)
    void speak(d.sheets.reopenDone, { lang: speechLang, rate: voiceSpeed })
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={done ? d.sheets.reopenDone : d.sheets.reopenTitle}
      description={done ? undefined : d.sheets.reopenBody}
      labelledBy="reopen-sheet-title"
      dismissible={!busy}
      footer={
        done ? (
          <Button full size="lg" onClick={onClose}>
            {d.actions.done}
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="md" disabled={busy} onClick={onClose}>
              {d.sheets.reopenCancel}
            </Button>
            <Button
              size="md"
              data-testid="reopen-confirm"
              disabled={busy}
              onClick={() => void confirm()}
              icon={<IconRotateClockwise size={15} stroke={2.5} />}
            >
              {d.sheets.reopenConfirm}
            </Button>
          </div>
        )
      }
    >
      <div className="pb-1">
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-[0.90625rem] font-bold leading-snug text-ink">
            {displayTitle(complaint, lang)}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-muted">{complaint.location.label}</p>
          {complaint.reference && (
            <p className="mt-1 text-[0.71875rem] tabular text-muted/80">
              {d.complaints.ref} {complaint.reference}
            </p>
          )}
        </div>

        {done && (
          <div className="mt-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#FFF3EA]">
              <IconCheck size={26} stroke={3} className="text-orange" />
            </div>
            <p className="mt-3 text-[0.84375rem] font-semibold text-ink">{d.sheets.reopenDone}</p>
            {reference && (
              <p className="mt-1.5 rounded-xl bg-[#FFF6EE] px-3 py-2 text-[0.8125rem] font-semibold tabular text-ink">
                {d.complaints.ref} {reference}
              </p>
            )}
            <p className="mt-2 text-[0.71875rem] leading-relaxed text-muted">
              {d.verification.sandboxNote}
            </p>
          </div>
        )}
      </div>
    </Sheet>
  )
}
