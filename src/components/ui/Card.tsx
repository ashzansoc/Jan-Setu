import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Small all-caps section label used down the home screen. */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        'text-[0.71875rem] font-bold uppercase tracking-[0.16em] text-muted',
        className,
      )}
    >
      {children}
    </h2>
  )
}
