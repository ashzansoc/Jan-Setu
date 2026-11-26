import { Link } from 'react-router-dom'
import {IconChevronRight} from '@tabler/icons-react'
import type { ActionTask } from '@/lib/action/types'
import { currentStep, progressOf } from '@/lib/action/status'
import { TaskStateBadge } from './TaskStateBadge'
import { useDict } from '@/lib/i18n'
import { cn } from '@/lib/cn'

export function ActionTaskCard({ task }: { task: ActionTask }) {
  const d = useDict()
  const progress = Math.round(progressOf(task) * 100)
  const step = currentStep(task)
  const stepLabel = step ? (d.action.steps[step.labelKey] ?? step.labelKey) : null

  return (
    <Link
      to={`/actions/${task.id}`}
      data-testid="action-task-card"
      data-state={task.state}
      className="block rounded-card bg-white px-4 py-3.5 shadow-card transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-bold leading-snug text-ink">
            {task.intent?.goals[0]?.description ?? d.action.newTask}
          </h3>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {stepLabel ?? d.action.states[task.state]}
          </p>
        </div>
        <TaskStateBadge state={task.state} className="mt-0.5" />
        <IconChevronRight size={15} className="mt-1 shrink-0 text-muted/50" />
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F1EDE7]">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500',
              task.state === 'failed'
                ? 'bg-[#C0394A]'
                : task.state === 'completed'
                  ? 'bg-success'
                  : 'bg-gradient-to-r from-orange to-coral',
            )}
            style={{ width: `${Math.max(4, progress)}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular text-muted">{progress}%</span>
      </div>
    </Link>
  )
}