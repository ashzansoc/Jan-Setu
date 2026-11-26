import type { ReactNode } from 'react'
import { IconTrafficCone, IconDroplet, IconFileText, IconBulb, IconTrash, IconWaveSine, IconBolt } from '@tabler/icons-react'
import type { Category, ComplaintStatus } from '@/lib/complaints/types'
import { useDict } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const CATEGORY_ICON: Record<Category, typeof IconTrash> = {
  sanitation: IconTrash,
  streetlight: IconBulb,
  water: IconDroplet,
  road: IconTrafficCone,
  drainage: IconWaveSine,
  electricity: IconBolt,
  other: IconFileText,
}

const CATEGORY_TONE: Record<Category, string> = {
  sanitation: 'bg-[#E3F6EE] text-[#0E8A62]',
  streetlight: 'bg-[#FFF3D9] text-[#B57314]',
  water: 'bg-[#E5EDFF] text-[#2F5BC4]',
  road: 'bg-[#F0EEE9] text-[#6B6459]',
  drainage: 'bg-[#ECEBFB] text-[#4A46B8]',
  electricity: 'bg-[#FFF4D9] text-[#B57314]',
  other: 'bg-[#EFEDF6] text-[#5B5670]',
}

export function CategoryIcon({
  category,
  size = 40,
  className,
}: {
  category: Category
  size?: number
  className?: string
}) {
  const Icon = CATEGORY_ICON[category]
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-[12px]', CATEGORY_TONE[category], className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.47)} stroke={2.1} />
    </span>
  )
}

const STATUS_TONE: Record<ComplaintStatus, string> = {
  draft: 'bg-[#FFF0E4] text-[#B4501C]',
  awaiting_approval: 'bg-[#FFF0E4] text-[#B4501C]',
  approved: 'bg-[#ECEBFB] text-indigo',
  submitted: 'bg-[#FDECEE] text-[#C0394A]',
  acknowledged: 'bg-[#ECEBFB] text-indigo',
  in_progress: 'bg-[#E9E9FB] text-[#3B3BA6]',
  resolved: 'bg-[#E4F7EE] text-[#0E8A62]',
  assisted_filing: 'bg-[#FFF4D9] text-[#9A6A10]',
  user_confirmed_submission: 'bg-[#E4F7EE] text-[#0E8A62]',
  reopened: 'bg-[#FDECEE] text-[#C0394A]',
  rejected: 'bg-[#F1EDE7] text-[#7C756C]',
  failed: 'bg-[#FDECEA] text-[#A63A2C]',
}

export function StatusBadge({
  status,
  className,
}: {
  status: ComplaintStatus
  className?: string
}) {
  const d = useDict()
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[0.65625rem] font-bold',
        STATUS_TONE[status],
        className,
      )}
    >
      {d.lifecycle[status]}
    </span>
  )
}

export function SectionHeader({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('safe-x mb-2.5 flex items-center justify-between gap-3', className)}>
      <h2 className="text-[0.6875rem] font-bold uppercase leading-tight tracking-[0.15em] text-muted">
        {children}
      </h2>
      {action}
    </div>
  )
}

/** Small meta line: pin + text, or the same shape with any leading icon. */
export function MetaLine({
  icon,
  children,
  className,
}: {
  icon: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn('flex items-center gap-1.5 text-[0.78125rem] leading-snug text-muted', className)}>
      <span className="shrink-0 text-muted/80">{icon}</span>
      <span className="truncate">{children}</span>
    </p>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line/80', className)} aria-hidden />
}
