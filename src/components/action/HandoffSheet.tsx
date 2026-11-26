import { useEffect, useRef, useState } from 'react'
import {IconCheck, IconShieldExclamation, IconUpload} from '@tabler/icons-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import type { ActionTask } from '@/lib/action/types'
import { provideDocument, provideHandoffValue, approveStep } from '@/lib/action/executor'
import { useDict } from '@/lib/i18n'

/**
 * The human-in-the-loop surface.
 *
 * Secrets are handled differently from everything else: passwords and OTPs use
 * masked or numeric entry, are never echoed back, never stored on the task and
 * never spoken. A CAPTCHA pauses the run and shows the real challenge.
 */
export function HandoffSheet({ task }: { task: ActionTask }) {
  const d = useDict()
  const handoff = task.handoff
  const [value, setValue] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const open = handoff?.status === 'open'

  useEffect(() => {
    setValue('')
  }, [handoff?.id])

  if (!handoff) return null

  const isApproval = handoff.type === 'approval'
  const isDocument = handoff.type === 'document'
  const isSecret = handoff.type === 'password' || handoff.type === 'otp'
  const inputType = isSecret ? (handoff.type === 'password' ? 'password' : 'text') : 'text'

  const submit = () => {
    if (!value.trim()) return
    void provideHandoffValue(task.id, value.trim())
  }

  const pickFile = (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void provideDocument(task.id, file.name, reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <Sheet
      open={open}
      onClose={() => undefined}
      dismissible={false}
      title={d.action.handoff[handoff.type]}
      description={isApproval ? d.action.approveBody : handoff.reason}
      labelledBy="handoff-title"
      footer={
        isApproval ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="md" onClick={() => void provideHandoffValue(task.id, 'not now')}>
              {d.actions.cancel}
            </Button>
            <Button
              size="md"
              data-testid="approve-step"
              onClick={() => void approveStep(task.id, handoff.stepId)}
              icon={<IconCheck size={16} strokeWidth={3} />}
            >
              {d.action.approveStep}
            </Button>
          </div>
        ) : isDocument ? (
          <Button full size="lg" onClick={() => fileRef.current?.click()} icon={<IconUpload size={16} strokeWidth={2.3} />}>
            {d.action.handoff.document}
          </Button>
        ) : (
          <Button full size="lg" onClick={submit} disabled={!value.trim()}>
            {d.action.provide}
          </Button>
        )
      }
    >
      <div className="pb-1">
        <div className="flex items-start gap-2.5 rounded-2xl bg-[#FFF6EE] px-3.5 py-3">
          <IconShieldExclamation size={16} strokeWidth={2.3} className="mt-0.5 shrink-0 text-[#C08018]" />
          <p className="text-[12.5px] leading-relaxed text-[#7A5A22]">{handoff.reason}</p>
        </div>

        {isApproval && (
          <div className="mt-3 rounded-2xl border border-line bg-white px-4 py-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">
              {d.action.plan}
            </p>
            <p className="mt-1 text-[14px] font-semibold text-ink">
              {d.action.steps[handoff.prompt] ?? handoff.prompt}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {task.intent?.entities.department ?? task.intent?.goals[0]?.description}
            </p>
          </div>
        )}

        {!isApproval && !isDocument && (
          <>
            <label htmlFor="handoff-input" className="sr-only">
              {d.action.handoff[handoff.type]}
            </label>
            <input
              id="handoff-input"
              type={inputType}
              inputMode={handoff.type === 'otp' ? 'numeric' : 'text'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
              autoComplete={handoff.type === 'password' ? 'current-password' : 'off'}
              placeholder={d.action.handoff[handoff.type]}
              className="mt-3 h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-muted/70 focus:border-orange/50 focus:outline-none"
            />
            {isSecret && (
              <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted">
                {handoff.type === 'password'
                  ? d.action.handoff.password
                  : d.action.handoff.otp}
              </p>
            )}
          </>
        )}

        {isDocument && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) pickFile(file)
                event.target.value = ''
              }}
            />
            <p className="mt-3 rounded-xl border border-dashed border-line-strong px-3.5 py-3 text-center text-[12px] text-muted">
              {d.action.handoff.document}
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}