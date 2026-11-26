import type { ActionPlan } from '@/lib/action/types'
import { StepDot } from './TaskStateBadge'
import { useDict } from '@/lib/i18n'
import { cn } from '@/lib/cn'

/** The plan as a checklist: done, current, pending, failed. */
export function ActionPlanList({ plan, currentStepId }: { plan: ActionPlan; currentStepId: string | null }) {
  const d = useDict()

  return (
    <ol className="relative" data-testid="action-plan">
      <span className="absolute bottom-4 left-[7px] top-4 w-[2px] rounded-full bg-line" aria-hidden />
      {plan.steps.map((step) => {
        const state =
          step.status === 'done'
            ? 'done'
            : step.status === 'failed' || step.status === 'unknown'
              ? 'failed'
              : step.id === currentStepId || step.status === 'running'
                ? 'current'
                : 'pending'
        return (
          <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
            <span className="relative z-10 mt-0.5 bg-ivory">
              <StepDot status={state} />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-[13.5px] leading-snug',
                  state === 'pending' ? 'text-muted' : 'font-medium text-ink',
                )}
              >
                {d.action.steps[step.labelKey] ?? step.labelKey}
              </p>
              {step.error && <p className="mt-0.5 text-[11.5px] text-[#A63A2C]">{step.error}</p>}
              {step.verification && (
                <p className="mt-0.5 text-[11px] text-muted">
                  {d.action.verification[step.verification.status]} · {step.verification.method}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}