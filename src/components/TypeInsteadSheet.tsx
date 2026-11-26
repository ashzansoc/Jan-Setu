import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { IconChevronRight, IconMicrophone, IconX } from '@tabler/icons-react'
import { useDict } from '@/lib/i18n'
import { ingestText } from '@/lib/flow'
import { cn } from '@/lib/cn'

const MAX = 300

/**
 * Text fallback, mirroring the Stitch "text-input-drawer" design exactly.
 * It goes through the identical intent pipeline, so a user who cannot speak
 * gets the same complaint.
 */
export function TypeInsteadSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const d = useDict()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    setValue('')
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 260)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = originalOverflow
      restoreFocusRef.current?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  const submit = () => {
    const text = value.trim()
    if (!text) return
    onClose()
    ingestText(text)
  }

  const append = (phrase: string) => {
    setValue((current) => {
      const base = current.trim()
      if (!base) return phrase
      return `${base} ${phrase}`
    })
    inputRef.current?.focus()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-[#1B140F]/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="type-instead-title"
            className="relative z-10 flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-sheet border-t border-line bg-ivory pb-[max(24px,env(safe-area-inset-bottom))] shadow-[0_-18px_60px_-20px_rgba(23,23,29,0.4)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="flex w-full cursor-grab justify-center pb-1 pt-2.5">
              <div className="h-1 w-10 rounded-full bg-stone-300" />
            </div>

            <div className="flex items-start justify-between border-b border-stone-100 px-5 pb-3 pt-1">
              <div>
                <h2
                  id="type-instead-title"
                  className="deva flex items-center gap-1.5 text-lg font-bold tracking-tight text-stone-900"
                >
                  {d.textInput.title}
                  <span className="rounded-full border border-orange-200/60 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-600">
                    {d.textInput.badge}
                  </span>
                </h2>
                <p className="mt-0.5 text-xs font-normal text-stone-500">
                  {d.textInput.hint}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={d.actions.close}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-all hover:bg-stone-200/70 active:scale-90"
              >
                <IconX size={16} stroke={2.5} />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="relative rounded-2xl border border-stone-200/80 bg-[#FAF6F0] p-3.5 transition-all focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-200">
                <label htmlFor="type-input" className="sr-only">
                  {d.textInput.title}
                </label>
                <textarea
                  id="type-input"
                  ref={inputRef}
                  value={value}
                  onChange={(event) => setValue(event.target.value.slice(0, MAX))}
                  placeholder={d.textInput.placeholder}
                  rows={4}
                  className="w-full resize-none border-none bg-transparent p-0 text-sm font-normal leading-relaxed text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-0"
                />
                <div className="mt-2 flex items-center justify-between border-t border-stone-200/50 pt-2 text-[0.6875rem] text-stone-400">
                  <div className="flex items-center gap-1.5 text-stone-500">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{d.textInput.autoDetect}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setValue('')}
                      className="transition-colors hover:text-stone-700"
                    >
                      {d.textInput.clear}
                    </button>
                    <span className="font-medium">
                      {value.length}/{MAX}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-stone-400">
                    {d.textInput.quick}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {d.textInput.suggestions.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => append(phrase)}
                      className={cn(
                        'rounded-full border border-stone-200 bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 transition-all hover:bg-stone-200/80 active:scale-95',
                      )}
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!value.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F4511E] px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-500/30 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <span>{d.textInput.continue}</span>
                  <IconChevronRight size={16} stroke={2.5} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50"
                >
                  <IconMicrophone size={16} className="text-orange-600" fill="currentColor" />
                  <span>{d.textInput.backToVoice}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}