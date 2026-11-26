import { IconTrafficCone, IconDroplet, IconBulb, IconTrash } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useDict } from '@/lib/i18n'
import { cn } from '@/lib/cn'

const ICONS = [IconTrash, IconBulb, IconDroplet, IconTrafficCone]
const TONES = [
  'bg-[#E3F6EE] text-[#0E8A62]',
  'bg-[#FFF1D6] text-[#B57314]',
  'bg-[#E5EDFF] text-[#2F5BC4]',
  'bg-[#FFEADD] text-[#D2551F]',
] as const

/**
 * Tapping a chip runs exactly the same pipeline as speaking it — it is a
 * shortcut into the agent, not a canned answer.
 */
export function SuggestCards({ onPick }: { onPick: (utterance: string) => void }) {
  const d = useDict()

  return (
    <div className="relative">
      <div
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1.5 pt-1"
        role="group"
        aria-label={d.home.trySaying}
      >
        {d.suggestions.map((utterance, index) => {
          const Icon = ICONS[index]
          return (
            <motion.button
              key={utterance}
              type="button"
              onClick={() => onPick(utterance)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-[74vw] max-w-[285px] shrink-0 snap-start items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left shadow-chip transition-transform active:scale-[0.985]"
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
                  TONES[index],
                )}
                aria-hidden
              >
                <Icon size={17} stroke={2.1} />
              </span>
              <span className="line-clamp-2 text-[0.84375rem] font-medium leading-[1.45] text-[#3B3840]">
                “{utterance}”
              </span>
            </motion.button>
          )
        })}
        <span className="w-1 shrink-0" aria-hidden />
      </div>
    </div>
  )
}
