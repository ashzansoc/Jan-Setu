import { useState } from 'react'
import { IconMail, IconMicrophone, IconPencil, IconPhone, IconShieldLock, IconIdBadge } from '@tabler/icons-react'
import { Avatar } from '@/components/Avatar'
import { GoogleMark } from '@/components/GoogleMark'
import { useAuth } from '@/lib/firebase/useAuth'
import { useSettings } from '@/state/settings'
import { useDictation } from '@/lib/voice/useDictation'
import { primary } from '@/lib/onboarding/copy'
import { cn } from '@/lib/cn'

interface FieldRowProps {
  icon: React.ReactNode
  label: string
  value: string
  note?: string
  editable: boolean
  onEdit: () => void
  editLabel: string
}

function FieldRow({ icon, label, value, note, editable, onEdit, editLabel }: FieldRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-lowest p-4 shadow-sm">
      <div className="min-w-0 flex-1 pr-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-on-surface-variant">
          <span className="text-tertiary">{icon}</span>
          {label}
        </span>
        <span className="mt-1 block truncate text-[15px] font-semibold text-on-surface">{value}</span>
        {note && <span className="mt-0.5 block text-[11px] text-on-surface-variant">{note}</span>}
      </div>
      {editable ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-low text-on-surface-variant transition-colors active:bg-primary-fixed active:text-primary"
        >
          <IconPencil size={18} strokeWidth={2} />
        </button>
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-secondary">
          <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden>
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
          </svg>
        </span>
      )}
    </div>
  )
}

/**
 * Step 4 — confirm the details the account provides.
 *
 * Name and phone are editable, because a government complaint must not be filed
 * with a details line the citizen never checked. Email comes from the connected
 * account and is never editable here.
 */
export function ProfileDetailsStep({
  lang,
  name,
  phone,
  email,
  onNameChange,
  onPhoneChange,
  onNext,
}: {
  lang: 'hi' | 'en'
  name: string
  phone: string
  email: string | null
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onNext: () => void
}) {
  const auth = useAuth()
  const [editing, setEditing] = useState<'name' | 'phone' | null>(null)
  const [draftName, setDraftName] = useState(name)
  const [draftPhone, setDraftPhone] = useState(phone)

  const connected = Boolean(auth.user)
  const t = (key: Parameters<typeof primary>[0]) => primary(key, lang)
  const speechLang = useSettings((s) => s.speechLang)
  const dictation = useDictation({
    lang: speechLang,
    silenceMs: 1800,
    onFinal: (text) => onNameChange(text),
  })

  // Name and phone are mandatory: a complaint cannot be filed without them.
  const nameValid = name.trim().length >= 2
  const digits = phone.replace(/\D/g, '')
  const phoneValid = digits.length === 10 || (digits.length === 12 && digits.startsWith('91'))
  const canContinue = nameValid && phoneValid
  const missing: string | null = !nameValid
    ? t('nameRequired')
    : !phoneValid
      ? digits.length === 0
        ? t('phoneRequired')
        : t('phoneInvalid')
      : null

  return (
    <div className="px-4 pb-8 pt-2">
      <div className="mb-6 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-3 py-1.5">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant">
            {t('step4of5')}
          </span>
        </span>
        <ListenPill lang={lang} />
      </div>

      <div className="mb-6 flex items-center gap-4 rounded-xl bg-surface-lowest p-4 shadow-sm">
        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden>
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className={cn('truncate text-[17px] font-semibold leading-tight text-on-surface', lang === 'hi' && 'deva')}>
            {t('confirmInfo')}
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-on-surface-variant">
            {connected ? (
              <>
                <GoogleMark size={13} />
                {t('fromGoogle')}
              </>
            ) : (
              'इन विवरणों में बदलाव कर सकती हैं'
            )}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col items-center text-center">
        <div className="relative">
          <div className="size-24 rounded-full bg-surface-container p-1 shadow-sm">
            {connected ? (
              <img
                src={auth.user?.photoURL ?? ''}
                alt=""
                className="size-full rounded-full object-cover"
              />
            ) : (
              <Avatar size={90} ring={false} />
            )}
          </div>
          {connected && (
            <span className="absolute -bottom-0 -right-0 flex size-8 items-center justify-center rounded-full bg-surface-lowest shadow-md">
              <GoogleMark size={16} />
            </span>
          )}
        </div>
        {connected && (
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-secondary-container/60 px-3 py-1 text-on-secondary-container">
            <span className="size-1.5 rounded-full bg-secondary" />
            <span className="text-[10.5px] font-bold">{t('connected')}</span>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        <FieldRow
          icon={<IconIdBadge size={14} strokeWidth={2} />}
          label={`${t('fullName')} · ${t('required')}`}
          value={name || '—'}
          editable
          editLabel="बदलें / Edit Name"
          onEdit={() => {
            setDraftName(name)
            setEditing('name')
          }}
        />

        <FieldRow
          icon={<IconMail size={14} strokeWidth={2} />}
          label={t('email')}
          value={email ?? '— ईमेल उपलब्ध नहीं • not available'}
                  editable={false}
          editLabel=""
          onEdit={() => {}}
        />

        <FieldRow
          icon={<IconPhone size={14} strokeWidth={2} />}
          label={`${t('mobile')} · ${t('required')}`}
          value={phone || '—'}
          note={t('mobileNote')}
          editable
          editLabel="बदलें / Edit Mobile Number"
          onEdit={() => {
            setDraftPhone(phone)
            setEditing('phone')
          }}
        />
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-surface-container p-3.5">
        <IconShieldLock size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-secondary" />
        <p className="text-[12px] leading-relaxed text-on-surface-variant">
          {t('privacyNote')}
        </p>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-[420px] rounded-3xl bg-surface p-5">
            <p className="mb-2 text-[13px] font-bold uppercase tracking-wider text-on-surface-variant">
              {editing === 'name' ? t('fullName') : t('mobile')}
            </p>
            <input
              autoFocus
              inputMode={editing === 'phone' ? 'numeric' : 'text'}
              value={editing === 'name' ? draftName : draftPhone}
              onChange={(event) =>
                editing === 'name'
                  ? setDraftName(event.target.value)
                  : setDraftPhone(event.target.value)
              }
              className="h-12 w-full rounded-xl border border-outline-variant bg-surface-lowest px-4 text-[15px] text-on-surface focus:border-primary focus:outline-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-12 flex-1 rounded-xl bg-surface-container text-[14px] font-semibold text-on-surface"
              >
                रद्द
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editing === 'name') onNameChange(draftName)
                  else onPhoneChange(draftPhone)
                  setEditing(null)
                }}
                className="h-12 flex-1 rounded-xl bg-primary text-[14px] font-bold text-on-primary"
              >
                सहेजें
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 pt-2">
        {missing && (
          <p
            data-testid="profile-missing"
            className="rounded-xl bg-[#FFF1E6] px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed text-[#8A4A20]"
          >
            {missing}
          </p>
        )}
        <button
          type="button"
          data-testid="profile-next"
          onClick={onNext}
          disabled={!canContinue}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/25 transition-transform active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45"
        >
          <span className="text-[15px] font-bold">{t('next')}</span>
        </button>
        <button
          type="button"
          onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
          aria-pressed={dictation.listening}
          className={cn(
            'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold shadow-sm transition-colors',
            dictation.listening ? 'bg-coral text-white' : 'bg-surface-lowest text-on-surface active:bg-surface-container',
          )}
        >
          <IconMicrophone size={18} strokeWidth={2} className={dictation.listening ? 'text-white' : 'text-primary'} />
          <span className={cn(dictation.listening && 'animate-pulse')}>
            {dictation.listening ? (lang === 'hi' ? 'सुन रहे हैं…' : 'Listening…') : t('editByVoice')}
          </span>
        </button>
      </div>
    </div>
  )
}

function ListenPill({ lang }: { lang: 'hi' | 'en' }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-primary-fixed px-3.5 py-1.5">
      <svg viewBox="0 0 24 24" className="size-[18px] fill-primary" aria-hidden>
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
      <span className="text-[13px] font-semibold text-primary">{primary('listen', lang)}</span>
    </span>
  )
}