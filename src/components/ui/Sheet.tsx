import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { IconX } from '@tabler/icons-react'
import { cn } from '@/lib/cn'
import { useDict } from '@/lib/i18n'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Hide the close affordance for consent-style confirmations. */
  dismissible?: boolean
  className?: string
  labelledBy?: string
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  className,
  labelledBy,
}: SheetProps) {
  const d = useDict()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus({ preventScroll: true })
    }, 120)

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) onClose()
      if (event.key !== 'Tab' || !panelRef.current) return
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null)
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = originalOverflow
      restoreFocusRef.current?.focus?.({ preventScroll: true })
    }
  }, [open, onClose, dismissible])

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
            onClick={dismissible ? onClose : undefined}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className={cn(
              'relative w-full max-w-[560px] rounded-t-sheet bg-ivory px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_60px_-20px_rgba(23,23,29,0.4)]',
              className,
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag={dismissible ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose()
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" aria-hidden />
            {(title || dismissible) && (
              <div className="mb-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 id={labelledBy} className="text-[1.1875rem] font-bold leading-snug text-ink">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-[0.84375rem] leading-relaxed text-muted">{description}</p>
                  )}
                </div>
                {dismissible && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={d.actions.close}
                    className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-all hover:bg-black/[0.05] hover:text-ink active:scale-90"
                  >
                    <IconX size={18} />
                  </button>
                )}
              </div>
            )}
            <div className="max-h-[60svh] overflow-y-auto overscroll-contain">{children}</div>
            {footer && <div className="mt-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
