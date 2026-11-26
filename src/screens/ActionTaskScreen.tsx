import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconSquare,
  IconFileText,
  IconMail,
} from '@tabler/icons-react'
import { ScreenShell } from '@/components/layout/ScreenShell'
import { ActionPlanList } from '@/components/action/ActionPlanList'
import { HandoffSheet } from '@/components/action/HandoffSheet'
import { TaskStateBadge, VerificationBadge } from '@/components/action/TaskStateBadge'
import { Button } from '@/components/ui/Button'
import { useActions } from '@/lib/action/store'
import { cancelTask, pauseTask, resumeTask } from '@/lib/action/executor'
import { progressOf } from '@/lib/action/status'
import { useDict } from '@/lib/i18n'
import { formatClock, relativeTime } from '@/lib/format'
import { cn } from '@/lib/cn'

export function ActionTaskScreen() {
  const { id } = useParams<{ id: string }>()
  const d = useDict()
  const task = useActions((s) => s.tasks.find((item) => item.id === id))
  const hydrate = useActions((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  if (!task) {
    return (
      <ScreenShell title={d.action.title} backTo="/actions">
        <p className="safe-x py-10 text-center text-[14px] text-muted">{d.action.empty}</p>
      </ScreenShell>
    )
  }

  const progress = Math.round(progressOf(task) * 100)
  const done = task.state === 'completed' || task.state === 'partially_completed'
  const failed = task.state === 'failed'
  const canResume =
    Boolean(task.paused) || task.state === 'ready_to_execute' || task.state === 'waiting_for_user'

  return (
    <ScreenShell
      title={d.action.title}
      subtitle={d.action.states[task.state]}
      backTo="/actions"
      action={<TaskStateBadge state={task.state} className="mr-1" />}
    >
      <div className="safe-x">
        <div className="rounded-card bg-white p-4 shadow-card">
          <p className="text-[15px] font-bold leading-snug text-ink">
            {task.intent?.goals.map((goal) => goal.description).join(' + ') ?? d.action.newTask}
          </p>
          {task.intent?.entities.department && (
            <p className="mt-1 text-[12.5px] text-muted">{task.intent.entities.department}</p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F1EDE7]">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  failed ? 'bg-[#C0394A]' : done ? 'bg-success' : 'bg-gradient-to-r from-orange to-coral',
                )}
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
            <span className="shrink-0 text-[11.5px] font-semibold tabular text-muted">
              {d.action.progress} {progress}%
            </span>
          </div>

          {task.reason && (
            <p
              className={cn(
                'mt-3 rounded-xl px-3 py-2 text-[12px] leading-relaxed',
                failed ? 'bg-[#FDECEA] text-[#8A3A2E]' : 'bg-[#FFF8E9] text-[#7A5A22]',
              )}
            >
              {task.reason}
            </p>
          )}

          {task.result && (
            <div className="mt-3 rounded-xl bg-[#FFF6EE] px-3 py-2.5">
              <VerificationBadge status={task.result.status} />
              <p className="mt-1 text-[11.5px] text-muted">
                {task.result.method}
                {task.result.reason ? ` · ${task.result.reason}` : ''}
              </p>
              {Object.entries(task.result.evidence).length > 0 && (
                <dl className="mt-1.5 space-y-0.5">
                  {Object.entries(task.result.evidence).map(([key, value]) => (
                    <div key={key} className="flex gap-2 text-[11.5px]">
                      <dt className="shrink-0 text-muted">{key}</dt>
                      <dd className="min-w-0 flex-1 truncate font-semibold text-ink/85">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {(task.complaintId || task.emailMessageId) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {task.complaintId && (
                <Link
                  to={`/complaints/${task.complaintId}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-peach px-3 py-1.5 text-[12px] font-semibold text-[#A85822]"
                >
                  <IconFileText size={13} strokeWidth={2.3} />
                  {d.action.openComplaint}
                </Link>
              )}
              {task.emailMessageId && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F7EE] px-3 py-1.5 text-[12px] font-semibold text-[#0E8A62]">
                  <IconMail size={13} strokeWidth={2.3} />
                  <span className="tabular">{task.emailMessageId.slice(0, 18)}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {task.plan && (
          <>
            <h2 className="mt-5 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {d.action.plan}
            </h2>
            <div className="mt-2 rounded-card bg-white p-4 shadow-card">
              <ActionPlanList plan={task.plan} currentStepId={task.currentStepId} />
            </div>
          </>
        )}

        <h2 className="mt-5 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          {d.detail.timeline}
        </h2>
        <ul className="mt-2 overflow-hidden rounded-card bg-white shadow-card">
          {task.events.slice(-12).map((event, index) => (
            <li
              key={`${event.id}-${index}`}
              className="flex items-start gap-2.5 border-b border-line/70 px-4 py-2.5 last:border-b-0"
            >
              <span
                className={cn(
                  'mt-[6px] size-1.5 shrink-0 rounded-full',
                  event.status === 'failed'
                    ? 'bg-[#C0394A]'
                    : event.status === 'waiting'
                      ? 'bg-[#C08018]'
                      : event.status === 'unknown'
                        ? 'bg-muted'
                        : 'bg-success',
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-snug text-ink/85">
                  {event.title}
                </span>
                {event.detail && (
                  <span className="mt-0.5 block truncate text-[11px] text-muted">{event.detail}</span>
                )}
              </span>
              <span className="shrink-0 text-[10.5px] tabular text-muted">
                {formatClock(event.at, 'en')}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 px-1 text-[11px] text-muted">
          {d.verification.updated(relativeTime(task.updatedAt, d))}
        </p>

        <div className="mt-4 grid gap-2.5 pb-2">
          {canResume && (
            <Button
              full
              size="lg"
              data-testid="resume-task"
              icon={<IconPlayerPlay size={16} fill="currentColor" strokeWidth={0} />}
              onClick={() => void resumeTask(task.id)}
            >
              {d.action.resume}
            </Button>
          )}
          {!task.paused && task.state === 'executing' && (
            <Button
              full
              variant="secondary"
              size="lg"
              data-testid="pause-task"
              icon={<IconPlayerPause size={16} strokeWidth={2.3} />}
              onClick={() => pauseTask(task.id)}
            >
              {d.action.pause}
            </Button>
          )}
          {!done && !task.paused && task.state !== 'cancelled' && (
            <Button
              full
              variant="ghost"
              size="md"
              icon={<IconSquare size={13} fill="currentColor" strokeWidth={0} />}
              onClick={() => cancelTask(task.id)}
            >
              {d.action.cancelTask}
            </Button>
          )}
          {done && task.result?.status !== 'verified' && (
            <p className="px-1 text-center text-[11px] leading-relaxed text-muted">
              {d.action.sandboxNote}
            </p>
          )}
        </div>
      </div>

      <HandoffSheet task={task} />
    </ScreenShell>
  )
}