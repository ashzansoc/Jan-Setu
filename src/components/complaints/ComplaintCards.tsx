import { motion } from 'framer-motion'
import { IconAlertCircle, IconCheck, IconChevronRight, IconMapPin, IconMicrophone, IconPhoneCall, IconPlayerPlay, IconRotateClockwise, IconShieldCheck, IconShieldQuestion, IconVolume } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import type { Complaint } from '@/lib/complaints/types'
import { displayTitle, metaLine, sourceLabel } from '@/lib/complaints/display'
import { relativeTime } from '@/lib/format'
import { useDict, useUiLang } from '@/lib/i18n'
import { CategoryIcon, Divider, MetaLine, StatusBadge } from './parts'
import { cn } from '@/lib/cn'

const CARD = 'rounded-card bg-white px-4 py-4 shadow-card'

/* ------------------------------------------------------------------ */
/* 1. Waiting for your yes                                             */
/* ------------------------------------------------------------------ */

export function DraftCard({
  complaint,
  onApprove,
  onEdit,
}: {
  complaint: Complaint
  onApprove: () => void
  onEdit: () => void
}) {
  const d = useDict()
  const lang = useUiLang()
  const excerpt = complaint.transcript.trim().slice(0, 150)

  return (
    <motion.article
      layout
      data-testid="complaint-card"
      data-status={complaint.status}
      data-category={complaint.category}
      data-reference={complaint.reference ?? ''}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="safe-x"
    >
      <div className="rounded-[26px] p-[1.5px]" style={{ background: 'linear-gradient(135deg, #FF9A4D 0%, #F45162 100%)' }}>
        <div className="rounded-[24.5px] bg-white px-4 py-4">
          <div className="flex items-start gap-3">
            <CategoryIcon category={complaint.category} />
            <div className="min-w-0 flex-1">
              <h3 className="text-[1rem] font-bold leading-tight text-ink">
                {displayTitle(complaint, lang)}
              </h3>
              <MetaLine icon={<IconMapPin size={12} stroke={2.3} />} className="mt-1">
                {metaLine(complaint, lang, d)}
              </MetaLine>
            </div>
            <StatusBadge status={complaint.status} />
          </div>

          <div className="mt-3 rounded-[14px] bg-[#FFF8F2] px-3.5 py-3">
            <p className="line-clamp-3 text-[0.8125rem] italic leading-relaxed text-ink/75">
              “{excerpt}…”
            </p>
            <p className="mt-1.5 text-[0.71875rem] font-medium text-muted">
              {d.complaints.preparedAgo(relativeTime(complaint.preparedAt, d))}
              <span className="mx-1.5 text-muted/50">·</span>
              {d.complaints.notSubmitted}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-[1.55fr_1fr] gap-2.5">
            <button
              type="button"
              data-testid="draft-approve"
              onClick={onApprove}
              className="flex h-[46px] items-center justify-center gap-2 rounded-[14px] bg-ink text-[0.84375rem] font-semibold text-white transition-transform active:scale-[0.98]"
            >
              <IconVolume size={16} stroke={2.3} />
              {d.complaints.hearApprove}
            </button>
            <button
              type="button"
              data-testid="draft-edit"
              onClick={onEdit}
              className="flex h-[46px] items-center justify-center gap-2 rounded-[14px] border border-line-strong bg-white text-[0.84375rem] font-semibold text-ink transition-colors hover:bg-[#FFFBF7] active:scale-[0.98]"
            >
              <IconMicrophone size={16} stroke={2.3} className="text-orange" />
              {d.complaints.edit}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

/* ------------------------------------------------------------------ */
/* 2. In progress                                                       */
/* ------------------------------------------------------------------ */

export function ActiveComplaintItem({
  complaint,
  onReplay,
}: {
  complaint: Complaint
  onReplay: () => void
}) {
  const d = useDict()
  const lang = useUiLang()
  const live = complaint.verification.mode === 'live'
  const when = complaint.verification.verifiedAt
    ? relativeTime(complaint.verification.verifiedAt, d)
    : null

  return (
    <motion.article
      layout
      data-testid="complaint-card"
      data-status={complaint.status}
      data-category={complaint.category}
      data-reference={complaint.reference ?? ''}
      className={cn('safe-x', CARD)}
    >
      <Link to={`/complaints/${complaint.id}`} className="block rounded-xl">
        <div className="flex items-start gap-3">
          <CategoryIcon category={complaint.category} />
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.96875rem] font-bold leading-tight text-ink">
              {displayTitle(complaint, lang)}
            </h3>
            <MetaLine icon={<IconMapPin size={12} stroke={2.3} />} className="mt-1">
              {metaLine(complaint, lang, d)}
            </MetaLine>
            <StatusBadge status={complaint.status} className="mt-2" />
          </div>
          <IconChevronRight size={16} className="mt-1 shrink-0 text-muted/50" />
        </div>
      </Link>

      <Divider className="my-3" />

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.75rem] font-semibold tabular text-ink/70">
            {complaint.reference ?? d.verification.pendingRef}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[0.71875rem] leading-snug text-muted">
            {live ? (
              <IconShieldCheck size={13} stroke={2.3} className="shrink-0 text-success" />
            ) : (
              <IconShieldQuestion size={13} stroke={2.3} className="shrink-0 text-[#C08A45]" />
            )}
            <span className="truncate">
              {live
                ? d.complaints.verifiedOn(sourceLabel(complaint.verification.source, lang), when ?? '')
                : d.complaints.demoVerified(when ?? '')}
            </span>
          </p>
        </div>

        <button
          type="button"
          data-testid="card-replay"
          onClick={onReplay}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#FFF3EA] px-3 text-[0.75rem] font-semibold text-[#B4501C] transition-transform active:scale-95"
        >
          <IconPlayerPlay size={12} fill="currentColor" stroke={0} />
          {d.complaints.replay}
        </button>
      </div>
    </motion.article>
  )
}

/* ------------------------------------------------------------------ */
/* 3. Assisted filing                                                   */
/* ------------------------------------------------------------------ */

export function AssistedFilingCard({
  complaint,
  onFiled,
}: {
  complaint: Complaint
  onFiled: () => void
}) {
  const d = useDict()
  const lang = useUiLang()
  const helpline = complaint.department.helpline ?? '1916'

  return (
    <motion.article
      layout
      data-testid="complaint-card"
      data-status={complaint.status}
      data-category={complaint.category}
      data-reference={complaint.reference ?? ''}
      className={cn('safe-x', CARD)}
    >
      <div className="flex items-start gap-3">
        <CategoryIcon category={complaint.category} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.96875rem] font-bold leading-tight text-ink">
            {displayTitle(complaint, lang)}
          </h3>
          <MetaLine icon={<IconMapPin size={12} stroke={2.3} />} className="mt-1">
            {metaLine(complaint, lang, d)}
          </MetaLine>
          <StatusBadge status={complaint.status} className="mt-2" />
        </div>
      </div>

      <div className="mt-3 flex gap-2.5 rounded-[14px] border border-[#F3DFB6] bg-[#FFF8E9] px-3 py-2.5">
        <IconAlertCircle size={16} stroke={2.2} className="mt-0.5 shrink-0 text-[#C08018]" />
        <p className="text-[0.75rem] leading-[1.5] text-[#7A5A22]">
          {d.complaints.assistedBody(complaint.department.jurisdiction, helpline)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <a
          href={`tel:${helpline}`}
          className="flex h-[46px] items-center justify-center gap-2 rounded-[14px] bg-ink text-[0.84375rem] font-semibold text-white transition-transform active:scale-[0.98]"
        >
          <IconPhoneCall size={15} stroke={2.4} />
          {d.complaints.call(helpline)}
        </a>
        <button
          type="button"
          data-testid="assisted-filed"
          onClick={onFiled}
          className="flex h-[46px] items-center justify-center gap-2 rounded-[14px] border border-line-strong bg-white text-[0.84375rem] font-semibold text-ink transition-colors hover:bg-[#FFFBF7] active:scale-[0.98]"
        >
          <IconCheck size={15} stroke={3} className="text-success" />
          {d.complaints.iveFiled}
        </button>
      </div>
    </motion.article>
  )
}

/* ------------------------------------------------------------------ */
/* 4. Resolved                                                          */
/* ------------------------------------------------------------------ */

export function ResolvedCard({
  complaint,
  onReplay,
  onConfirm,
  onReopen,
}: {
  complaint: Complaint
  onReplay: () => void
  onConfirm: () => void
  onReopen: () => void
}) {
  const d = useDict()
  const lang = useUiLang()
  const userOnly = complaint.resolutionSource === 'user_confirmed'
  const officialLive = complaint.resolutionSource === 'official' && complaint.verification.mode === 'live'

  const sourceLine = userOnly
    ? d.complaints.userClosed
    : officialLive
      ? d.complaints.closedBySource(sourceLabel(complaint.verification.source, lang), complaint.reference ?? '')
      : d.complaints.demoClosed(complaint.reference ?? '')

  return (
    <motion.article
      layout
      data-testid="complaint-card"
      data-status={complaint.status}
      data-category={complaint.category}
      data-reference={complaint.reference ?? ''}
      className={cn('safe-x', CARD)}
    >
      <div className="flex items-start gap-3">
        <CategoryIcon category={complaint.category} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.96875rem] font-bold leading-tight text-ink">
            {displayTitle(complaint, lang)}
          </h3>
          <MetaLine icon={<IconMapPin size={12} stroke={2.3} />} className="mt-1">
            {metaLine(complaint, lang, d)}
          </MetaLine>
          <StatusBadge status={complaint.status} className="mt-2" />
        </div>
        {userOnly && (
          <button
            type="button"
            onClick={onReplay}
            aria-label={d.complaints.actionReplay}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FFF3EA] text-[#B4501C] transition-transform active:scale-95"
          >
            <IconPlayerPlay size={12} fill="currentColor" stroke={0} />
          </button>
        )}
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-[0.71875rem] leading-snug text-muted">
        {userOnly ? (
          <IconShieldQuestion size={13} stroke={2.3} className="mt-[1px] shrink-0 text-[#C08A45]" />
        ) : (
          <IconShieldCheck
            size={13}
            stroke={2.3}
            className={cn('mt-[1px] shrink-0', officialLive ? 'text-success' : 'text-[#C08A45]')}
          />
        )}
        <span className="min-w-0 break-words">{sourceLine}</span>
      </p>

      {!userOnly && (
        <div className="mt-3 rounded-[14px] bg-[#FBF6EF] px-3 py-2.5">
          {complaint.userConfirmedResolution ? (
            <p className="flex items-center gap-1.5 text-[0.78125rem] font-medium text-success">
              <IconCheck size={14} stroke={3} />
              {d.complaints.feedbackThanks}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-[0.78125rem] leading-snug text-ink/75">
                {d.complaints.isItFixed}
              </p>
              <button
                type="button"
                data-testid="resolve-yes"
                onClick={onConfirm}
                className="h-8 shrink-0 rounded-[9px] bg-success px-3 text-[0.75rem] font-bold text-white transition-transform active:scale-95"
              >
                {d.complaints.yes}
              </button>
              <button
                type="button"
                data-testid="resolve-reopen"
                onClick={onReopen}
                className="h-8 shrink-0 rounded-[9px] border border-line-strong bg-white px-3 text-[0.75rem] font-semibold text-ink transition-colors hover:bg-[#FFFBF7]"
              >
                {d.complaints.reopen}
              </button>
            </div>
          )}
        </div>
      )}

      {userOnly && (
        <button
          type="button"
          data-testid="resolve-reopen"
          onClick={onReopen}
          className="mt-3 flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 text-[0.75rem] font-semibold text-ink transition-colors hover:bg-[#FFFBF7]"
        >
          <IconRotateClockwise size={13} stroke={2.4} />
          {d.complaints.reopen}
        </button>
      )}
    </motion.article>
  )
}
