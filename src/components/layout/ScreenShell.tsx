import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft } from '@tabler/icons-react'
import { cn } from '@/lib/cn'
import { useDict } from '@/lib/i18n'

/**
 * Shared chrome for every screen except IconHome. Keeps the back affordance,
 * title rhythm and bottom breathing room in one place so sub-screens feel like
 * one product rather than a set of pages.
 */
export function ScreenShell({
  title,
  subtitle,
  children,
  action,
  withNav = false,
  backTo,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  action?: ReactNode
  withNav?: boolean
  backTo?: string
  className?: string
}) {
  const navigate = useNavigate()
  const d = useDict()

  return (
    <div className={cn('app-bloom min-h-svh', className)}>
      <div
        className={cn(
          'mx-auto w-full max-w-[560px]',
          withNav ? 'pb-[calc(104px+env(safe-area-inset-bottom))]' : 'pb-[calc(28px+env(safe-area-inset-bottom))]',
        )}
      >
      <div className="safe-x flex items-center gap-2 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          aria-label={d.actions.back}
          className="-ml-2 flex size-10 items-center justify-center rounded-full text-ink transition-all hover:bg-black/[0.05] active:scale-90"
        >
          <IconArrowLeft size={21} stroke={2.2} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.0625rem] font-bold leading-tight text-ink">{title}</h1>
          {subtitle && <p className="truncate text-[0.78125rem] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div>{children}</div>
      </div>
    </div>
  )
}
