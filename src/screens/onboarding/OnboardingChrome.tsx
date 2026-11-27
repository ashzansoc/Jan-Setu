import type { ReactNode } from 'react'
import { IconArrowLeft, IconArrowRight, IconUser } from '@tabler/icons-react'
import { primary } from '@/lib/onboarding/copy'
import { cn } from '@/lib/cn'

/** Onboarding surfaces sit on the reference's warm stone background. */
export const OB_SURFACE = 'bg-surface'

/**
 * Fixed header from the reference: back affordance, centred step counter,
 * and a neutral identity chip. The counter is a pill on some steps and a bare
 * label on others, so the pill is opt-in.
 */
export function ObHeader({
  step,
  total,
  onBack,
  lang = 'en',
  variant = 'default',
}: {
  step: number
  total: number
  onBack?: () => void
  lang?: 'hi' | 'en'
  variant?: 'default' | 'pill'
}) {
  const stepLabel = lang === 'hi' ? `चरण ${step} / ${total}` : `Step ${step} of ${total}`

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-surface/85 pt-safe backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex h-16 w-full max-w-[560px] items-center justify-between px-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <IconArrowLeft size={22} strokeWidth={2} />
          </button>
        ) : (
          <span className="size-11" aria-hidden />
        )}

        {variant === 'pill' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 text-on-surface-variant">
            <span className="size-2 rounded-full bg-primary" />
            <span className="text-[11.5px] font-bold tracking-wide">{stepLabel}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant">
            <span className="size-2 rounded-full bg-primary" />
            {stepLabel}
          </span>
        )}

        <span className="flex size-9 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant">
          <IconUser size={18} strokeWidth={2} />
        </span>
      </div>

      {variant === 'default' && (
        <div className="mx-auto w-full max-w-[560px] px-4 pb-2">
          <div className="mx-auto flex max-w-xs items-center gap-1.5">
            {Array.from({ length: total }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  index < step ? 'bg-primary' : 'bg-surface-container-highest',
                )}
              />
            ))}
          </div>
        </div>
      )}
    </header>
  )
}

/** "सुनें • Listen" pill that reads the current step aloud. */
export function ListenButton({ onClick, lang = 'hi' }: { onClick: () => void; lang?: 'hi' | 'en' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary-fixed px-3.5 py-1.5 text-on-primary-fixed transition-transform active:scale-95"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden>
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
      <span className="text-[13px] font-semibold text-primary">{primary('listen', lang)}</span>
    </button>
  )
}

/** Primary full-width call to action from the reference. */
export function ObPrimaryButton({
  children,
  onClick,
  disabled,
  testId,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  testId?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-50',
      )}
    >
      <span className="text-[15px] font-bold">{children}</span>
      <IconArrowRight size={22} strokeWidth={2.2} />
    </button>
  )
}

/** Rounded pill variant used by the final step. */
export function ObPillButton({
  children,
  onClick,
  trailingIcon,
  testId,
}: {
  children: ReactNode
  onClick: () => void
  trailingIcon?: ReactNode
  testId?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full bg-primary text-on-primary shadow-md transition-all active:scale-[0.99]"
    >
      <span className="text-[16px] font-bold">{children}</span>
      {trailingIcon}
    </button>
  )
}

/** "जनसेतु बोल रहा है" chip with the three bouncing bars. */
export function SpeakingChip({ lang = 'hi' }: { lang?: 'hi' | 'en' }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-secondary-container/50 px-3 py-1 text-on-secondary-container">
      <span className="flex items-end gap-0.5">
        <span className="h-2.5 w-1 animate-bounce rounded-full bg-secondary" />
        <span className="h-3.5 w-1 animate-bounce rounded-full bg-secondary [animation-delay:150ms]" />
        <span className="h-2 w-1 animate-bounce rounded-full bg-secondary [animation-delay:300ms]" />
      </span>
      <span className="text-[11px] font-bold tracking-tight">{primary('speaking', lang)}</span>
    </span>
  )
}

/** "सुन रहे हैं... • Listening" chip. */
export function ListeningChip({ lang = 'hi' }: { lang?: 'hi' | 'en' }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-secondary-container/50 px-3 py-1 text-on-secondary-container">
      <span className="flex items-end gap-0.5">
        <span className="h-2.5 w-1 animate-bounce rounded-full bg-secondary" />
        <span className="h-4 w-1 animate-bounce rounded-full bg-secondary [animation-delay:150ms]" />
        <span className="h-3 w-1 animate-bounce rounded-full bg-secondary [animation-delay:300ms]" />
      </span>
      <span className="text-[13px] font-medium">{primary('listening', lang)}</span>
    </span>
  )
}