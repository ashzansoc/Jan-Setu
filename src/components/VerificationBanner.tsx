import { IconShieldCheck, IconShieldQuestion } from '@tabler/icons-react'
import type { Complaint } from '@/lib/complaints/types'
import { useDict, useUiLang } from '@/lib/i18n'
import { relativeTime } from '@/lib/format'
import { sourceLabel } from '@/lib/complaints/display'
import { cn } from '@/lib/cn'

/**
 * The honesty strip. A sandbox record can never read as an official
 * verification, so the copy and icon both change with verification.mode.
 */
export function VerificationBanner({
  complaint,
  className,
}: {
  complaint: Complaint
  className?: string
}) {
  const d = useDict()
  const lang = useUiLang()
  const live = complaint.verification.mode === 'live'
  const pending = complaint.verification.mode === 'none'
  const byUser = complaint.verification.mode === 'user' || complaint.verification.mode === 'assisted'
  const when = complaint.verification.verifiedAt
    ? relativeTime(complaint.verification.verifiedAt, d)
    : null

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3.5 py-2.5',
        live ? 'bg-[#EFFAF4]' : 'bg-[#FFF6EE]',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          live ? 'bg-[#D8F3E6] text-success' : 'bg-[#FFE9D6] text-[#C97A35]',
        )}
        aria-hidden
      >
        {live ? <IconShieldCheck size={17} stroke={2.3} /> : <IconShieldQuestion size={17} stroke={2.3} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[0.75rem] font-medium leading-snug text-ink/75">
          {live
            ? d.verification.liveSource(sourceLabel(complaint.verification.source, lang))
            : pending
              ? d.complaints.notSubmitted
              : byUser
                ? sourceLabel(complaint.verification.source, lang)
                : d.verification.sandbox}
        </div>
        <div className="mt-0.5 text-[0.75rem] font-semibold tabular text-ink/85">
          {complaint.reference ? (
            <>
              {d.verification.ref} <span className="text-ink">{complaint.reference}</span>
            </>
          ) : (
            <span className="font-medium text-muted">{d.verification.pendingRef}</span>
          )}
          {when && <span className="font-normal text-ink/45"> · {when}</span>}
        </div>
      </div>
    </div>
  )
}
