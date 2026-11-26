import { motion } from 'framer-motion'
import type { Counts } from '@/state/complaints'
import type { FilterKey } from './filters'
import { FILTERS } from './filters'
import { useDict } from '@/lib/i18n'
import { cn } from '@/lib/cn'

/**
 * Status filters. Horizontally scrollable so the row never wraps or clips on a
 * 360px phone, and the active pill slides rather than jumping.
 */
export function FilterPills({
  active,
  counts,
  onChange,
}: {
  active: FilterKey
  counts: Counts
  onChange: (key: FilterKey) => void
}) {
  const d = useDict()

  return (
    <div
      className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-0.5"
      role="tablist"
      aria-label={d.complaints.filterMenu}
    >
      {FILTERS.map((key) => {
        const selected = active === key
        const label =
          key === 'all'
            ? `${d.complaints.filters.all} · ${counts.all}`
            : d.complaints.filters[key]

        return (
          <button
            key={key}
            type="button"
            role="tab"
            data-testid={`filter-${key}`}
            aria-selected={selected}
            onClick={() => onChange(key)}
            className={cn(
              'relative h-9 shrink-0 rounded-full px-4 text-[0.8125rem] font-semibold transition-colors duration-200',
              selected ? 'text-white' : 'border border-line bg-white text-[#5F5B63] hover:bg-[#FFFBF7]',
            )}
          >
            {selected && (
              <motion.span
                layoutId="filter-pill"
                className="absolute inset-0 rounded-full bg-orange shadow-[0_4px_10px_-6px_rgba(255,118,47,0.7)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative whitespace-nowrap">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
