import { motion } from 'framer-motion'
import type { Counts } from '@/state/complaints'
import type { FilterKey } from './filters'
import { useDict } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const ORDER: { key: FilterKey; value: keyof Counts; label: 'inProgress' | 'needsApproval' | 'resolved' }[] = [
  { key: 'active', value: 'active', label: 'inProgress' },
  { key: 'approval', value: 'approval', label: 'needsApproval' },
  { key: 'resolved', value: 'resolved', label: 'resolved' },
]

const SKINS: Record<FilterKey, { card: string; number: string; label: string }> = {
  active: { card: 'bg-ink text-white', number: 'text-white', label: 'text-white/75' },
  approval: {
    card: 'bg-[#FFEFE3] border border-[#FFDCC6]',
    number: 'text-orange',
    label: 'text-[#7A4A2A]',
  },
  resolved: {
    card: 'bg-white border border-line',
    number: 'text-success',
    label: 'text-muted',
  },
  all: { card: 'bg-white border border-line', number: 'text-ink', label: 'text-muted' },
}

/**
 * The three counts at the top of My Complaints. Numbers are derived from the
 * records, and each card is itself a filter — tapping "Needs approval" is the
 * fastest route to the one thing the citizen has to act on.
 */
export function SummaryCards({
  counts,
  active,
  onPick,
}: {
  counts: Counts
  active: FilterKey
  onPick: (key: FilterKey) => void
}) {
  const d = useDict()

  return (
    <div className="safe-x grid grid-cols-3 gap-2.5" role="group" aria-label={d.complaints.filterMenu}>
      {ORDER.map((item, index) => {
        const selected = active === item.key
        const skin = SKINS[item.key]
        const value = counts[item.value]
        return (
          <motion.button
            key={item.key}
            type="button"
            data-testid={`summary-${item.key}`}
            onClick={() => onPick(item.key)}
            aria-pressed={selected}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative flex aspect-[1/0.92] flex-col justify-between rounded-[18px] px-3 py-2.5 text-left transition-transform active:scale-[0.98]',
              skin.card,
              selected && 'ring-2 ring-orange/60 ring-offset-2 ring-offset-ivory',
            )}
          >
            <span
              data-testid={`summary-${item.key}-value`}
              className={cn('text-[1.6875rem] font-bold leading-none tabular', skin.number)}
            >
              {value}
            </span>
            <span className={cn('text-[0.71875rem] font-medium leading-[1.25]', skin.label)}>
              {d.complaints.summary[item.label]}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
