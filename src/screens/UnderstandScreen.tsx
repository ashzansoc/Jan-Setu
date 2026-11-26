import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { IconArrowRight, IconPencil } from '@tabler/icons-react'
import { ScreenShell } from '@/components/layout/ScreenShell'
import { Button } from '@/components/ui/Button'
import { useConversation } from '@/state/conversation'
import { useDict, useUiLang } from '@/lib/i18n'
import { CATEGORY_LABEL, type Category } from '@/lib/complaints/types'
import { formatDurationDays } from '@/lib/format'
import { cn } from '@/lib/cn'

const EDITABLE: Category[] = ['sanitation', 'streetlight', 'water', 'road', 'drainage']

export function UnderstandScreen() {
  const d = useDict()
  const lang = useUiLang()
  const navigate = useNavigate()
  const draft = useConversation((s) => s.draft)
  const extraction = useConversation((s) => s.extraction)
  const question = useConversation((s) => s.question)
  const updateDraft = useConversation((s) => s.updateDraft)

  useEffect(() => {
    if (!draft) navigate('/', { replace: true })
  }, [draft, navigate])

  if (!draft) return null

  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: d.understand.fields.intent, value: d.understand.intentValue },
    { label: d.understand.fields.category, value: CATEGORY_LABEL[draft.category][lang], accent: true },
    {
      label: d.understand.fields.problem,
      value:
        lang === 'hi'
          ? extraction?.problemHi ?? draft.problem
          : extraction?.problemEn ?? draft.problem,
    },
    { label: d.understand.fields.location, value: draft.location.label, accent: true },
    {
      label: d.understand.fields.duration,
      value: draft.durationDays
        ? formatDurationDays(draft.durationDays, lang)
        : lang === 'hi'
          ? 'नहीं बताया गया'
          : 'Not stated',
    },
    {
      label: d.understand.fields.urgency,
      value: draft.urgency === 'high' ? d.understand.urgencyHigh : d.understand.urgencyNormal,
    },
    {
      label: d.understand.fields.department,
      value: `${draft.department.name} · ${draft.department.jurisdiction}`,
    },
    {
      label: d.understand.fields.language,
      value: extraction?.language === 'hi' ? 'हिन्दी' : extraction?.language === 'mixed' ? 'Hinglish' : extraction?.language === 'bn' ? 'বাংলা' : extraction?.language === 'ta' ? 'தமிழ்' : 'English',
    },
    { label: d.understand.fields.missing, value: question ? d.clarify[question] : d.understand.nothingMissing },
  ]

  return (
    <ScreenShell title={d.understand.title} subtitle={d.understand.subtitle} backTo="/">
      <div className="safe-x">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-card bg-white px-4 py-3.5 shadow-card"
        >
          <p className="text-[0.65625rem] font-bold uppercase tracking-[0.15em] text-muted">
            {d.understand.youSaid}
          </p>
          <p
            className={cn(
              'mt-1.5 text-[0.9375rem] italic leading-relaxed text-ink/85',
              lang === 'hi' && 'deva not-italic',
            )}
          >
            “{draft.transcript}”
          </p>
        </motion.div>

        <ul className="mt-4 overflow-hidden rounded-card bg-white shadow-card">
          {rows.map((row, index) => (
            <motion.li
              key={row.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + index * 0.045, duration: 0.3 }}
              className="flex items-start gap-3 border-b border-line/70 px-4 py-3 last:border-b-0"
            >
              <span className="w-[104px] shrink-0 pt-[2px] text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-muted">
                {row.label}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 text-[0.90625rem] leading-snug text-ink',
                  row.accent && 'font-semibold',
                  lang === 'hi' && 'deva',
                )}
              >
                {row.value}
              </span>
            </motion.li>
          ))}
        </ul>

        <div className="mt-4 rounded-card border border-line bg-white/70 p-4">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-[0.12em] text-muted">
            <IconPencil size={12.5} stroke={2.4} />
            {d.actions.edit}
          </p>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {EDITABLE.map((category) => {
              const selected = draft.category === category
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => updateDraft({ category, problem: CATEGORY_LABEL[category].en })}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[0.78125rem] font-semibold transition-colors',
                    selected
                      ? 'border-orange bg-[#FFF1E6] text-[#B4501C]'
                      : 'border-line-strong bg-white text-ink/70',
                  )}
                >
                  {CATEGORY_LABEL[category][lang]}
                </button>
              )
            })}
          </div>

          <label htmlFor="draft-location" className="sr-only">
            {d.understand.fields.location}
          </label>
          <input
            id="draft-location"
            value={draft.location.label}
            onChange={(event) => updateDraft({ location: { label: event.target.value } })}
            placeholder={d.understand.fields.location}
            className="mt-3 h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[0.875rem] text-ink focus:border-orange/50 focus:outline-none"
          />
        </div>
      </div>

      <div
        className="safe-x mt-5"
        style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
      >
        <Button
          full
          size="lg"
          onClick={() => navigate('/preview')}
          disabled={!draft.location.label.trim()}
          iconRight={<IconArrowRight size={18} stroke={2.4} />}
        >
          {d.understand.looksRight}
        </Button>
      </div>
    </ScreenShell>
  )
}
