import { Link } from 'react-router-dom'
import { IconTrafficCone, IconDroplet, IconFileText, IconBulb, IconMapPin, IconPlayerPlay, IconTrash, IconVolume, IconWaveSine, IconBolt } from '@tabler/icons-react'
import type { Category, Complaint } from '@/lib/complaints/types'
import { stageOf } from '@/lib/complaints/status'
import { displayTitle } from '@/lib/complaints/display'
import { ProgressTracker } from '@/components/ProgressTracker'
import { VerificationBanner } from '@/components/VerificationBanner'
import { Button } from '@/components/ui/Button'
import { useDict, useUiLang } from '@/lib/i18n'
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
  streetlight: 'bg-[#FFF1D6] text-[#B57314]',
  water: 'bg-[#E5EDFF] text-[#2F5BC4]',
  road: 'bg-[#FFEADD] text-[#D2551F]',
  drainage: 'bg-[#E7ECFA] text-[#2F5BC4]',
  electricity: 'bg-[#FFF4D9] text-[#B57314]',
  other: 'bg-[#EFEDF6] text-[#5B5670]',
}

export function ActiveComplaintCard({
  complaint,
  onReplay,
  onHear,
  hearing,
  className,
}: {
  complaint: Complaint
  onReplay: () => void
  onHear: () => void
  hearing?: boolean
  className?: string
}) {
  const d = useDict()
  const lang = useUiLang()
  const Icon = CATEGORY_ICON[complaint.category]
  const title = displayTitle(complaint, lang)
  const stage = stageOf(complaint.status)

  return (
    <div
      className={cn(
        'rounded-card bg-card px-4 pb-4 pt-4 shadow-card',
        className,
      )}
    >
      <Link
        to={`/complaints/${complaint.id}`}
        className="block rounded-2xl outline-offset-2"
        aria-label={`${title} — ${complaint.location.label}`}
      >
        <div className="flex items-start gap-3">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-[12px]', CATEGORY_TONE[complaint.category])}>
            <Icon size={19} stroke={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[0.96875rem] font-bold leading-tight text-ink">{title}</h3>
              {complaint.isDemo && (
                <span className="shrink-0 rounded-md bg-[#F1EDE7] px-1.5 py-[2px] text-[0.5625rem] font-bold uppercase tracking-[0.08em] text-[#8A8279]">
                  {d.complaints.demo}
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1 text-[0.78125rem] leading-snug text-muted">
              <IconMapPin size={12.5} stroke={2.2} className="shrink-0" />
              <span className="truncate">{complaint.location.label}</span>
            </p>
          </div>
        </div>
      </Link>

      {stage && (
        <div className="mt-4">
          <ProgressTracker stage={stage} />
        </div>
      )}

      <VerificationBanner complaint={complaint} className="mt-4" />

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <Button
          variant="ink"
          size="md"
          nowrap
          className="gap-2 px-2.5 text-[0.84375rem]"
          icon={<IconPlayerPlay size={15} fill="currentColor" stroke={0} />}
          onClick={onReplay}
        >
          {d.actions.actionReplay}
        </Button>
        <Button
          variant="secondary"
          size="md"
          nowrap
          className="gap-2 px-2.5 text-[0.84375rem]"
          onClick={onHear}
          aria-pressed={hearing}
          icon={
            <IconVolume
              size={16}
              stroke={2.2}
              className={cn('text-orange', hearing && 'animate-pulse')}
            />
          }
        >
          {d.actions.hearStatus}
        </Button>
      </div>
    </div>
  )
}
