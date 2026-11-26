import {IconCircleCheck, IconCircleDashed, IconCircleMinus, IconClock, IconX} from '@tabler/icons-react'
import type { TaskState, VerificationStatus } from '@/lib/action/types'
import { useDict } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const TONE: Record<TaskState, string> = {
  received: 'bg-[#F1EDE7] text-[#6E675E]',
  understanding: 'bg-[#FFF1E6] text-[#B4501C]',
  researching: 'bg-[#FFF1E6] text-[#B4501C]',
  planning: 'bg-[#FFF1E6] text-[#B4501C]',
  waiting_for_information: 'bg-[#FFF4D9] text-[#9A6A10]',
  ready_to_execute: 'bg-[#E5EDFF] text-[#2F5BC4]',
  executing: 'bg-[#ECEBFB] text-indigo',
  waiting_for_user: 'bg-[#FFF4D9] text-[#9A6A10]',
  waiting_for_approval: 'bg-[#FFF4D9] text-[#9A6A10]',
  verifying: 'bg-[#E5EDFF] text-[#2F5BC4]',
  completed: 'bg-[#E4F7EE] text-[#0E8A62]',
  partially_completed: 'bg-[#FFF4D9] text-[#9A6A10]',
  failed: 'bg-[#FDECEA] text-[#A63A2C]',
  cancelled: 'bg-[#F1EDE7] text-[#7C756C]',
}

export function TaskStateBadge({ state, className }: { state: TaskState; className?: string }) {
  const d = useDict()
  const label = d.action.states[state] ?? state
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[10.5px] font-bold',
        TONE[state],
        className,
      )}
    >
      {label}
    </span>
  )
}

export function VerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus
  className?: string
}) {
  const d = useDict()
  const label = d.action.verification[status] ?? status
  const Icon =
    status === 'verified'
      ? IconCircleCheck
      : status === 'failed'
        ? IconX
        : status === 'unknown'
          ? IconCircleDashed
          : IconCircleMinus
  const tone =
    status === 'verified'
      ? 'text-success'
      : status === 'failed'
        ? 'text-[#A63A2C]'
        : status === 'partially_verified'
          ? 'text-[#9A6A10]'
          : 'text-muted'
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11.5px] font-semibold', tone, className)}>
      <Icon size={13} strokeWidth={2.4} />
      {label}
    </span>
  )
}

export function StepDot({ status }: { status: 'done' | 'current' | 'pending' | 'failed' }) {
  const Icon =
    status === 'done'
      ? IconCircleCheck
      : status === 'failed'
        ? IconX
        : status === 'current'
          ? IconClock
          : IconCircleDashed
  const tone =
    status === 'done'
      ? 'text-success'
      : status === 'failed'
        ? 'text-[#A63A2C]'
        : status === 'current'
          ? 'text-orange'
          : 'text-muted/60'
  return <Icon size={16} strokeWidth={2.3} className={tone} aria-hidden />
}