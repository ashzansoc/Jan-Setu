import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { IconChevronDown, IconChevronRight, IconMicrophone, IconAdjustmentsHorizontal, IconX } from '@tabler/icons-react'
import { Avatar } from '@/components/Avatar'
import { SummaryCards } from '@/components/complaints/SummaryCards'
import { FilterPills } from '@/components/complaints/FilterPills'
import { VoiceSearchBar } from '@/components/complaints/VoiceSearchBar'
import { SectionHeader } from '@/components/complaints/parts'
import {
  ActiveComplaintItem,
  AssistedFilingCard,
  DraftCard,
  ResolvedCard,
} from '@/components/complaints/ComplaintCards'
import { ApproveSheet } from '@/components/complaints/ApproveSheet'
import { EditSheet } from '@/components/complaints/EditSheet'
import { AssistedFiledSheet } from '@/components/complaints/AssistedFiledSheet'
import { ReopenSheet } from '@/components/complaints/ReopenSheet'
import { SortFilterSheet, type SortOrder } from '@/components/complaints/SortFilterSheet'
import type { FilterKey } from '@/components/complaints/filters'
import type { Complaint, StatusGroup } from '@/lib/complaints/types'
import { groupOf } from '@/lib/complaints/status'
import { parseComplaintQuery, applyQuery, describeQuery } from '@/lib/complaints/search'
import { displayTitle } from '@/lib/complaints/display'
import { useComplaints, countByGroup } from '@/state/complaints'
import { useSettings } from '@/state/settings'
import { useDict, useUiLang } from '@/lib/i18n'
import { speak, cancelSpeech } from '@/lib/voice/tts'
import { startWith } from '@/lib/flow'
import { cn } from '@/lib/cn'

type SheetState =
  | { kind: 'approve' | 'edit' | 'filed' | 'reopen'; id: string }
  | null

const RESOLVED_PREVIEW = 2

export function ComplaintsScreen() {
  const d = useDict()
  const lang = useUiLang()
  // describeQuery only knows the two written scripts; Hinglish uses the English interface.
  const queryLang: 'hi' | 'en' = lang === 'hi' ? 'hi' : 'en'
  const navigate = useNavigate()
  const speechLang = useSettings((s) => s.speechLang)
  const voiceSpeed = useSettings((s) => s.voiceSpeed)

  const complaints = useComplaints((s) => s.complaints)
  const hydrate = useComplaints((s) => s.hydrate)
  const confirmResolution = useComplaints((s) => s.confirmResolution)
  const refresh = useComplaints((s) => s.refresh)

  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOrder>('newest')
  const [hideDemo, setHideDemo] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [showAllResolved, setShowAllResolved] = useState(false)
  const [sheet, setSheet] = useState<SheetState>(null)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => () => cancelSpeech(), [])

  // Ask the connector for any status movement on records that have a reference.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      complaints
        .filter((complaint) => complaint.reference && complaint.verification.mode !== 'user')
        .slice(0, 6)
        .forEach((complaint) => void refresh(complaint.id))
    }, 900)
    return () => window.clearTimeout(timer)
    // Refresh once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleBase = useMemo(
    () => (hideDemo ? complaints.filter((complaint) => !complaint.isDemo) : complaints),
    [complaints, hideDemo],
  )

  const counts = useMemo(() => countByGroup(visibleBase), [visibleBase])
  const demoCount = useMemo(() => complaints.filter((c) => c.isDemo).length, [complaints])

  const parsed = useMemo(() => (query.trim() ? parseComplaintQuery(query) : null), [query])

  const sorted = useMemo(() => {
    const list = [...visibleBase].sort((a, b) => {
      const delta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return sort === 'newest' ? delta : -delta
    })
    return list
  }, [visibleBase, sort])

  const searched = useMemo(() => (parsed ? applyQuery(sorted, parsed) : null), [parsed, sorted])

  const group = (status: StatusGroup): Complaint[] =>
    sorted.filter((complaint) => groupOf(complaint.status) === status)

  const searching = Boolean(parsed && !parsed.empty)
  const approval = searching ? [] : filter === 'approval' || filter === 'all' ? group('approval') : []
  const active = searching ? [] : filter === 'active' || filter === 'all' ? group('active') : []
  const resolved = searching ? [] : filter === 'resolved' || filter === 'all' ? group('resolved') : []

  const resolvedShown =
    filter === 'resolved' || showAllResolved ? resolved : resolved.slice(0, RESOLVED_PREVIEW)

  const sheetComplaint: Complaint | null = sheet
    ? complaints.find((complaint) => complaint.id === sheet.id) ?? null
    : null

  const speakAnswer = (text: string) => {
    void speak(text, { lang: speechLang, rate: voiceSpeed })
  }

  const submitQuery = (raw: string) => {
    const next = parseComplaintQuery(raw)
    if (next.empty) return
    const results = applyQuery(visibleBase, next)
    if (next.asksCount) {
      speakAnswer(
        d.complaints.voiceCount({
          approval: counts.approval,
          active: counts.active,
          resolved: counts.resolved,
        }),
      )
      return
    }
    const summary = describeQuery(next, queryLang)
    speakAnswer(
      results.length === 0
        ? d.complaints.voiceNoMatch
        : d.complaints.voiceFound(results.length, summary),
    )
  }

  const replay = (complaint: Complaint) => navigate(`/replay/${complaint.id}`)

  const confirm = (complaint: Complaint) => {
    confirmResolution(complaint.id)
    speakAnswer(d.complaints.feedbackThanks)
  }

  const startNew = () => {
    startWith()
    navigate('/')
  }

  const nothingVisible =
    (searching ? searched?.length === 0 : approval.length + active.length + resolved.length === 0)

  return (
    <div className="app-bloom min-h-svh">
      <div className="mx-auto w-full max-w-[560px] pb-[calc(108px+env(safe-area-inset-bottom))]">
        {/* ---------------- Header ---------------- */}
        <header className="safe-x flex items-start justify-between gap-3 pb-1 pt-[max(16px,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <p
              className={cn(
                'text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-muted',
                lang === 'en' && 'deva text-[0.75rem] normal-case tracking-normal',
              )}
            >
              {d.complaints.eyebrow}
            </p>
            <h1 className="mt-0.5 text-[1.625rem] font-extrabold leading-tight tracking-[-0.015em] text-ink">
              {d.complaints.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-testid="open-sort"
              onClick={() => setSortOpen(true)}
              aria-label={d.complaints.filterMenu}
              className="flex size-[42px] items-center justify-center rounded-full bg-white text-ink shadow-chip transition-transform active:scale-95"
            >
              <IconAdjustmentsHorizontal size={18} stroke={2.2} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label={d.header.profile}
              className="rounded-full transition-transform active:scale-95"
            >
              <Avatar size={42} />
            </button>
          </div>
        </header>

        {/* ---------------- Voice search ---------------- */}
        <div className="mt-3">
          <VoiceSearchBar
            value={query}
            onChange={(value) => {
              setQuery(value)
              setSearchError(null)
            }}
            onSubmit={submitQuery}
            onError={setSearchError}
          />
        </div>

        {searchError && (
          <p className="safe-x mt-1.5 text-[0.71875rem] leading-relaxed text-[#A65A50]">{searchError}</p>
        )}

        {/* ---------------- Summary ---------------- */}
        <div className="mt-3">
          <SummaryCards
            counts={counts}
            active={filter}
            onPick={(key) => {
              setFilter(key)
              setQuery('')
              setSearchError(null)
            }}
          />
        </div>

        {/* ---------------- Filters ---------------- */}
        <div className="mt-3">
          <FilterPills
            active={filter}
            counts={counts}
            onChange={(key) => {
              setFilter(key)
              setQuery('')
              setSearchError(null)
            }}
          />
        </div>

        {/* ---------------- IconSearch status ---------------- */}
        <AnimatePresence initial={false}>
          {searching && parsed && (
            <motion.div
              key="results-hint"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="safe-x overflow-hidden"
            >
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#FFF3EA] px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-[0.75rem] font-medium text-[#8A4A20]">
                  {d.complaints.resultsFor(describeQuery(parsed, queryLang) ?? parsed.raw, searched?.length ?? 0)}
                </p>
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={d.actions.close}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#8A4A20]"
                >
                  <IconX size={13} stroke={2.6} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---------------- IconSearch results ---------------- */}
        {searching && searched && (
          <section className="mt-4" aria-live="polite">
            <SectionHeader>{d.complaints.sections.results}</SectionHeader>
            <div className="safe-x space-y-3">
              {searched.length === 0 ? (
                <p className="rounded-card border border-dashed border-line-strong bg-white/60 px-4 py-6 text-center text-[0.8125rem] leading-relaxed text-muted">
                  {d.complaints.noResults(parsed?.raw ?? '')}
                </p>
              ) : (
                searched.map((complaint) => (
                  <ResultRow key={complaint.id} complaint={complaint} onOpen={() => navigate(`/complaints/${complaint.id}`)} />
                ))
              )}
            </div>
          </section>
        )}

        {/* ---------------- Waiting for your yes ---------------- */}
        {!searching && approval.length > 0 && (
          <section className="mt-5">
            <SectionHeader>{d.complaints.sections.awaiting}</SectionHeader>
            <div className="safe-x space-y-3">
              {approval.map((complaint) => (
                <DraftCard
                  key={complaint.id}
                  complaint={complaint}
                  onApprove={() => setSheet({ kind: 'approve', id: complaint.id })}
                  onEdit={() => setSheet({ kind: 'edit', id: complaint.id })}
                />
              ))}
            </div>
          </section>
        )}

        {/* ---------------- In progress ---------------- */}
        {!searching && active.length > 0 && (
          <section className="relative mt-5">
            <div className="safe-x mb-2 flex items-center justify-between gap-3">
              <h2 className="text-[0.6875rem] font-bold uppercase leading-tight tracking-[0.15em] text-muted">
                {d.complaints.sections.active}
              </h2>
              <motion.button
                type="button"
                data-testid="new-complaint"
                onClick={startNew}
                whileTap={{ scale: 0.94 }}
                aria-label={d.complaints.newComplaint}
                className="-mb-1 -mt-1 flex size-[52px] shrink-0 items-center justify-center rounded-full text-white"
                style={{
                  background:
                    'radial-gradient(120% 110% at 30% 20%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 45%), linear-gradient(148deg, #FF9C4F 0%, #FF7A36 40%, #F4515F 100%)',
                  boxShadow:
                    '0 14px 30px -10px rgba(244,81,98,0.6), 0 4px 10px -6px rgba(255,118,47,0.6)',
                }}
              >
                <IconMicrophone size={21} stroke={2.5} />
              </motion.button>
            </div>

            <div className="safe-x space-y-3">
              {active.map((complaint) =>
                complaint.status === 'assisted_filing' ? (
                  <AssistedFilingCard
                    key={complaint.id}
                    complaint={complaint}
                    onFiled={() => setSheet({ kind: 'filed', id: complaint.id })}
                  />
                ) : (
                  <ActiveComplaintItem key={complaint.id} complaint={complaint} onReplay={() => replay(complaint)} />
                ),
              )}
            </div>
          </section>
        )}

        {/* ---------------- Resolved ---------------- */}
        {!searching && resolved.length > 0 && (
          <section className="mt-5">
            <SectionHeader
              action={
                resolved.length > RESOLVED_PREVIEW ? (
                  <button
                    type="button"
                    data-testid="resolved-see-all"
                    onClick={() => setShowAllResolved((value) => !value)}
                    className="flex items-center gap-0.5 text-[0.78125rem] font-semibold text-indigo"
                  >
                    {showAllResolved ? d.complaints.seeFewer : d.complaints.seeAll(resolved.length)}
                    <IconChevronDown
                      size={14}
                      stroke={2.6}
                      className={cn('transition-transform', showAllResolved && 'rotate-180')}
                    />
                  </button>
                ) : undefined
              }
            >
              {d.complaints.sections.resolved}
            </SectionHeader>

            <div className="safe-x space-y-3">
              {resolvedShown.map((complaint) => (
                <ResolvedCard
                  key={complaint.id}
                  complaint={complaint}
                  onReplay={() => replay(complaint)}
                  onConfirm={() => confirm(complaint)}
                  onReopen={() => setSheet({ kind: 'reopen', id: complaint.id })}
                />
              ))}
            </div>
          </section>
        )}

        {/* ---------------- Empty ---------------- */}
        {nothingVisible && !searching && (
          <div className="safe-x mt-5">
            <div className="rounded-card border border-dashed border-line-strong bg-white/60 px-5 py-9 text-center">
              <p className="text-[0.84375rem] leading-relaxed text-muted">
                {complaints.length === 0 ? d.complaints.empty : d.complaints.emptyFilter}
              </p>
              <button
                type="button"
                onClick={startNew}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[0.8125rem] font-semibold text-white"
              >
                <IconMicrophone size={15} stroke={2.4} />
                {d.complaints.newComplaint}
              </button>
            </div>
          </div>
        )}

        <p className="safe-x mt-6 px-3 text-center text-[0.71875rem] leading-relaxed text-muted">
          {d.complaints.footerNote}
        </p>
      </div>

      {/* ---------------- Sheets ---------------- */}
      <SortFilterSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        sort={sort}
        onSort={setSort}
        hideDemo={hideDemo}
        onHideDemo={setHideDemo}
        demoCount={demoCount}
      />

      <ApproveSheet
        complaint={sheetComplaint}
        onClose={() => setSheet(null)}
        onEdit={(complaint) => setSheet({ kind: 'edit', id: complaint.id })}
      />

      <EditSheet
        complaint={sheet?.kind === 'edit' ? sheetComplaint : null}
        onClose={() => setSheet(null)}
      />

      <AssistedFiledSheet
        complaint={sheet?.kind === 'filed' ? sheetComplaint : null}
        onClose={() => setSheet(null)}
      />

      <ReopenSheet
        complaint={sheet?.kind === 'reopen' ? sheetComplaint : null}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}

/** Compact row used only when a search is active. */
function ResultRow({ complaint, onOpen }: { complaint: Complaint; onOpen: () => void }) {
  const d = useDict()
  const lang = useUiLang()
  return (
    <button
      type="button"
      data-testid="search-result"
      data-category={complaint.category}
      data-status={complaint.status}
      data-reference={complaint.reference ?? ''}
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-card bg-white px-4 py-3 text-left shadow-card transition-transform active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.90625rem] font-bold text-ink">
          {displayTitle(complaint, lang)}
        </p>
        <p className="mt-0.5 truncate text-[0.75rem] text-muted">
          {complaint.reference ?? complaint.location.label}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-[#F4EFE9] px-2 py-1 text-[0.65625rem] font-bold text-ink/70">
        {d.lifecycle[complaint.status]}
      </span>
      <IconChevronRight size={15} className="shrink-0 text-muted/50" />
    </button>
  )
}
