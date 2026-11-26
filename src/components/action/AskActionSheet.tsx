import { useEffect, useRef, useState } from 'react'
import { IconArrowRight } from '@tabler/icons-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { useDict } from '@/lib/i18n'

/**
 * Ask JANSETU to do something. The text goes to the intent engine, which decides
 * the plan — the citizen never has to name a tool or a department.
 */
export function AskActionSheet({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (text: string) => void
  submitting?: boolean
}) {
  const d = useDict()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    setValue('')
    const timer = window.setTimeout(() => inputRef.current?.focus(), 240)
    return () => window.clearTimeout(timer)
  }, [open])

  const send = () => {
    const text = value.trim()
    if (!text) return
    onSubmit(text)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={d.action.newTask}
      description={d.action.subtitle}
      labelledBy="ask-action-title"
      footer={
        <Button
          full
          size="lg"
          data-testid="ask-submit"
          disabled={!value.trim() || submitting}
          onClick={send}
          iconRight={<IconArrowRight size={17} strokeWidth={2.4} />}
        >
          {d.actions.continue}
        </Button>
      }
    >
      <label htmlFor="ask-action-input" className="sr-only">
        {d.action.newTask}
      </label>
      <textarea
        id="ask-action-input"
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={3}
        placeholder={d.textInput.placeholder}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') send()
        }}
        className="w-full resize-none rounded-2xl border border-line bg-white px-3.5 py-3 text-[14.5px] leading-relaxed text-ink placeholder:text-muted/70 focus:border-orange/50 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {d.suggestions.slice(0, 3).map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => setValue(phrase)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink/70"
          >
            {phrase}
          </button>
        ))}
      </div>
    </Sheet>
  )
}