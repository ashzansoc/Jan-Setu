import { useEffect, useState } from 'react'
import { IconCheck, IconMicrophone, IconSquare, IconVolume } from '@tabler/icons-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import type { Complaint } from '@/lib/complaints/types'
import { readAmendment } from '@/lib/complaints/amend'
import { displayTitle } from '@/lib/complaints/display'
import { useComplaints } from '@/state/complaints'
import { useSettings } from '@/state/settings'
import { useDict, useUiLang } from '@/lib/i18n'
import { useDictation } from '@/lib/voice/useDictation'
import { cancelSpeech, speak } from '@/lib/voice/tts'
import { cn } from '@/lib/cn'

/**
 * Conversational edit. The citizen says what to add and the amendment engine
 * folds it into the existing draft — nothing they already told us is replaced.
 */
export function EditSheet({
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
  const amend = useComplaints((s) => s.amend)

  const [text, setText] = useState('')

  const dictation = useDictation({
    lang: complaint?.speechLang ?? speechLang,
    silenceMs: 1800,
    onFinal: (spoken) => setText((current) => (current ? `${current} ${spoken}` : spoken)),
  })

  useEffect(() => {
    if (complaint) setText('')
    else cancelSpeech()
  }, [complaint])

  useEffect(() => () => cancelSpeech(), [])

  if (!complaint) return null

  const preview = readAmendment(text || ' ', complaint)
  const canSave = text.trim().length > 2

  const save = async () => {
    const amendment = readAmendment(text, complaint)
    amend(complaint.id, {
      note: amendment.note,
      severity: amendment.severity,
      location: amendment.location,
    })
    dictation.stop()
    onClose()
    void speak(d.sheets.editSaved, { lang: speechLang, rate: voiceSpeed })
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={d.sheets.editTitle}
      description={d.sheets.editHint}
      labelledBy="edit-sheet-title"
      footer={
        <Button
          full
          size="lg"
          data-testid="edit-save"
          disabled={!canSave}
          onClick={() => void save()}
          icon={<IconCheck size={17} stroke={2.8} />}
        >
          {d.sheets.editSave}
        </Button>
      }
    >
      <div className="pb-1">
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-[0.65625rem] font-bold uppercase tracking-[0.13em] text-muted">
            {d.complaints.draft}
          </p>
          <p className="mt-1 text-[0.90625rem] font-bold leading-snug text-ink">
            {displayTitle(complaint, lang)}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-muted">{complaint.location.label}</p>
        </div>

        <div className="mt-2.5">
          <label htmlFor="edit-text" className="sr-only">
            {d.sheets.editTitle}
          </label>
          <textarea
            id="edit-text"
            value={dictation.listening && dictation.interim ? dictation.interim : text}
            onChange={(event) => setText(event.target.value)}
            readOnly={dictation.listening}
            rows={3}
            placeholder={d.sheets.editPlaceholder}
            className={cn(
              'w-full resize-none rounded-2xl border bg-white px-3.5 py-3 text-[0.875rem] leading-relaxed text-ink placeholder:text-muted/70 focus:outline-none',
              dictation.listening ? 'border-orange/45' : 'border-line focus:border-orange/50',
            )}
          />

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
              aria-pressed={dictation.listening}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full px-4 text-[0.8125rem] font-semibold text-white transition-transform active:scale-95',
                dictation.listening ? 'bg-coral' : 'bg-gradient-to-br from-orange-bright to-coral',
              )}
              style={
                dictation.listening
                  ? { transform: `scale(${1 + dictation.level * 0.05})` }
                  : undefined
              }
            >
              {dictation.listening ? (
                <IconSquare size={12} fill="currentColor" stroke={0} />
              ) : (
                <IconMicrophone size={15} stroke={2.4} />
              )}
              {dictation.listening ? d.actions.cancel : d.complaints.edit}
            </button>

            {canSave && (
              <span className="flex items-center gap-1.5 text-[0.71875rem] text-muted">
                <IconVolume size={13} stroke={2.2} />
                {preview.changes.length > 1
                  ? `${d.complaints.edit}: ${preview.changes.map((change) => change.field).join(', ')}`
                  : d.sheets.editSave}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-[#FFF8F2] px-3.5 py-2.5">
          <p className="text-[0.65625rem] font-bold uppercase tracking-[0.13em] text-muted">
            {d.understand.youSaid}
          </p>
          <p className="mt-1 line-clamp-3 text-[0.75rem] italic leading-relaxed text-ink/70">
            “{complaint.transcript.slice(0, 140)}…”
          </p>
        </div>
      </div>
    </Sheet>
  )
}
