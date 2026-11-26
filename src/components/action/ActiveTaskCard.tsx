import { Link } from 'react-router-dom'
import { IconArrowRight } from '@tabler/icons-react'
import type { ActionTask } from '@/lib/action/types'
import { currentStep, progressOf } from '@/lib/action/status'
import { TaskStateBadge } from './TaskStateBadge'
import { useDict } from '@/lib/i18n'

/**
 * Compact entry point on Home. It appears only while a task is running, so the
 * home screen keeps its single primary action: speak.
 */
export function ActiveTaskCard({ task }: { task: ActionTask }) {
  const d = useDict()
  const step = currentStep(task)
  const progress = Math.round(progressOf(task) * 100)

  return (
    <Link
      to={`/actions/${task.id}`}
      data-testid="active-task-card"
      className="safe-x mt-6 block"
    >
      <div className="rounded-card bg-white px-4 py-3.5 shadow-card">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
            {d.action.activeTask}
          </p>
          <TaskStateBadge state={task.state} />
        </div>
        <p className="mt-1.5 truncate text-[14.5px] font-semibold text-ink">
          {step ? (d.action.steps[step.labelKey] ?? step.labelKey) : d.action.states[task.state]}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F1EDE7]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange to-coral transition-[width] duration-500"
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-semibold tabular text-muted">{progress}%</span>
          <IconArrowRight size={14} className="shrink-0 text-muted/60" />
        </div>
      </div>
    </Link>
  )
}