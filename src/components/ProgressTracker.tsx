import { IconCheck } from '@tabler/icons-react'
import type { Stage } from '@/lib/complaints/types'
import { STAGE_ORDER } from '@/lib/complaints/types'
import { useDict } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const ACCENT: Record<Stage, string> = {
  prepared: '#FF762F',
  submitted: '#E24B5C',
  acknowledged: '#34349B',
  resolved: '#16A477',
}

/**
 * Four evenly spaced nodes joined by segments. Completed stages are filled with
 * their accent and a check; the current stage carries a halo; future stages
 * stay hollow. Nothing here is decorative state — it is driven by the complaint.
 */
export function ProgressTracker({
  stage,
  className,
  size = 'md',
}: {
  stage: Stage
  className?: string
  size?: 'sm' | 'md'
}) {
  const d = useDict()
  const currentIndex = STAGE_ORDER.indexOf(stage)
  const nodeSize = size === 'sm' ? 22 : 30
  const lineTop = nodeSize / 2 - 1.25

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-start">
        {STAGE_ORDER.map((item, index) => {
          const done = index <= currentIndex
          const isCurrent = index === currentIndex
          const accent = ACCENT[item]
          return (
            <div key={item} className="relative flex flex-1 flex-col items-center">
              {index > 0 && (
                <span
                  className="absolute h-[2.5px] w-full rounded-full"
                  style={{
                    top: lineTop,
                    right: '50%',
                    background:
                      index <= currentIndex
                        ? `linear-gradient(90deg, ${ACCENT[STAGE_ORDER[index - 1]]} 0%, ${accent} 100%)`
                        : '#E7E1DA',
                  }}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  'relative z-10 flex items-center justify-center rounded-full border-2 transition-all duration-300',
                  isCurrent && 'shadow-[0_0_0_4px_rgba(52,52,155,0.12)]',
                )}
                style={{
                  width: nodeSize,
                  height: nodeSize,
                  background: done ? accent : '#FFFFFF',
                  borderColor: done ? accent : '#E3DDD6',
                  boxShadow: isCurrent ? `0 0 0 4px ${accent}1F` : undefined,
                }}
                aria-hidden
              >
                {done && <IconCheck size={size === 'sm' ? 12 : 15} stroke={3.4} className="text-white animate-pop" />}
                {!done && <span className="size-[5px] rounded-full bg-[#D9D2C9]" />}
              </span>
              <span
                className={cn(
                  'mt-2 text-center leading-tight',
                  size === 'sm' ? 'text-[0.625rem]' : 'text-[0.71875rem]',
                  isCurrent ? 'font-bold' : done ? 'font-semibold text-ink/70' : 'font-medium text-muted',
                )}
                style={isCurrent ? { color: accent } : undefined}
              >
                {d.stages[item]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
