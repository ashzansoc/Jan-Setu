import { IconCheck } from '@tabler/icons-react'
import { Sheet } from '@/components/ui/Sheet'
import { useDict } from '@/lib/i18n'
import { cn } from '@/lib/cn'

export type SortOrder = 'newest' | 'oldest'

/** The header's sliders button opens this — real controls, not decoration. */
export function SortFilterSheet({
  open,
  onClose,
  sort,
  onSort,
  hideDemo,
  onHideDemo,
  demoCount,
}: {
  open: boolean
  onClose: () => void
  sort: SortOrder
  onSort: (order: SortOrder) => void
  hideDemo: boolean
  onHideDemo: (value: boolean) => void
  demoCount: number
}) {
  const d = useDict()

  const options: { value: SortOrder; label: string }[] = [
    { value: 'newest', label: d.sheets.sortNewest },
    { value: 'oldest', label: d.sheets.sortOldest },
  ]

  return (
    <Sheet open={open} onClose={onClose} title={d.sheets.sortTitle} labelledBy="sort-sheet-title">
      <div className="space-y-1.5 pb-1">
        {options.map((option) => {
          const selected = sort === option.value
          return (
            <button
              key={option.value}
              type="button"
              data-testid={`sort-${option.value}`}
              onClick={() => {
                onSort(option.value)
                onClose()
              }}
              aria-pressed={selected}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors',
                selected ? 'border-orange/35 bg-[#FFF3EA]' : 'border-line bg-white',
              )}
            >
              <span className="flex-1 text-[0.90625rem] font-medium text-ink">{option.label}</span>
              {selected && (
                <span className="flex size-6 items-center justify-center rounded-full bg-orange text-white">
                  <IconCheck size={14} stroke={3} />
                </span>
              )}
            </button>
          )
        })}

        <label className="mt-1 flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-3.5 py-3">
          <span className="min-w-0">
            <span className="block text-[0.90625rem] font-medium text-ink">{d.sheets.hideDemo}</span>
            <span className="block text-[0.71875rem] text-muted">{demoCount}</span>
          </span>
          <input
            type="checkbox"
            data-testid="hide-demo"
            checked={hideDemo}
            onChange={(event) => onHideDemo(event.target.checked)}
            className="size-5 shrink-0 accent-[#FF762F]"
          />
        </label>
      </div>
    </Sheet>
  )
}
