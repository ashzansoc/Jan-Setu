import { Link } from 'react-router-dom'
import { IconChevronRight, IconMapPin } from '@tabler/icons-react'
import type { Complaint } from '@/lib/complaints/types'
import { stageOf } from '@/lib/complaints/status'
import { displayTitle } from '@/lib/complaints/display'
import { ProgressTracker } from '@/components/ProgressTracker'
import { StatusBadge } from '@/components/complaints/parts'
import { useDict, useUiLang } from '@/lib/i18n'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/cn'

export function ComplaintRow({
  complaint,
  to,
  showTracker = false,
}: {
  complaint: Complaint
  to: string
  showTracker?: boolean
}) {
  const d = useDict()
  const lang = useUiLang()
  const stage = stageOf(complaint.status)

  return (
    <Link
      to={to}
      className="block rounded-card bg-white px-4 py-3.5 shadow-card transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className={cn('text-[0.9375rem] font-bold leading-snug text-ink', lang === 'hi' && 'deva')}>
              {displayTitle(complaint, lang)}
            </h3>
            {complaint.isDemo && (
              <span className="shrink-0 rounded-md bg-[#F1EDE7] px-1.5 py-[2px] text-[0.5625rem] font-bold uppercase tracking-[0.08em] text-[#8A8279]">
                {d.complaints.demo}
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-[0.78125rem] text-muted">
            <IconMapPin size={12} stroke={2.2} className="shrink-0" />
            <span className="truncate">{complaint.location.label}</span>
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="truncate text-[0.71875rem] font-medium tabular text-ink/55">
              {complaint.reference ?? d.verification.pendingRef}
            </span>
            <span className="text-[0.6875rem] text-muted/60">·</span>
            <span className="shrink-0 text-[0.6875rem] text-muted/85">
              {relativeTime(complaint.updatedAt, d)}
            </span>
            <StatusBadge status={complaint.status} className="ml-auto" />
          </div>
        </div>
        <IconChevronRight size={16} className="mt-1.5 shrink-0 text-muted/50" />
      </div>

      {showTracker && stage && (
        <div className="mt-3.5 border-t border-line/70 pt-3.5">
          <ProgressTracker stage={stage} size="sm" />
        </div>
      )}
    </Link>
  )
}
