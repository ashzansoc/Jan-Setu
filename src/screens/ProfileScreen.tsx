import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconCheck, IconChevronRight, IconHeart, IconHome, IconListCheck, IconLanguage, IconLock, IconMicrophone, IconPencil, IconPhoneCall, IconTrash, IconUsers, IconVolume } from '@tabler/icons-react'
import { Avatar } from '@/components/Avatar'
import { Logo } from '@/components/Logo'
import { LanguageSheet } from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { useComplaints } from '@/state/complaints'
import { useSettings, type LanguageChoice } from '@/state/settings'
import { useDict } from '@/lib/i18n'
import { localRepository } from '@/lib/complaints/repository'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/firebase/useAuth'
import { uploadAvatar } from '@/lib/firebase/sync'

const SPEAKING: { key: 'slow' | 'normal' | 'fast'; value: number }[] = [
  { key: 'slow', value: 0.85 },
  { key: 'normal', value: 1 },
  { key: 'fast', value: 1.15 },
]

const I_SPEAK: { key: 'hindi' | 'hinglish' | 'english' | 'bengali' | 'tamil' | 'marathi'; value: LanguageChoice }[] = [
  { key: 'hindi', value: 'hi' },
  { key: 'hinglish', value: 'hinglish' },
  { key: 'english', value: 'en' },
  { key: 'bengali', value: 'bn' },
  { key: 'tamil', value: 'ta' },
  { key: 'marathi', value: 'mr' },
]

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'flex h-6 w-12 flex-shrink-0 items-center rounded-full p-0.5 transition-colors',
        on ? 'bg-orange' : 'bg-[#D1D5DB]',
      )}
    >
      <span
        className={cn(
          'h-5 w-5 rounded-full bg-white shadow-md transition-transform',
          on && 'translate-x-[18px]',
        )}
      />
    </button>
  )
}

function Row({
  icon,
  iconClass,
  title,
  sub,
  href,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  iconClass: string
  title: string
  sub: string
  href?: string
  onClick?: () => void
  danger?: boolean
}) {
  const inner = (
    <>
      <div className="flex items-center space-x-3.5">
        <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl', iconClass)}>
          {icon}
        </div>
        <div>
          <div className={cn('text-sm font-bold', danger ? 'text-red-500' : 'text-gray-900')}>{title}</div>
          <div className="text-xs text-gray-400">{sub}</div>
        </div>
      </div>
      <IconChevronRight className="h-4 w-4 text-gray-300" stroke={2.5} />
    </>
  )
  const cls = 'flex items-center justify-between rounded-2xl p-3 transition-colors active:scale-[0.99]'
  return href ? (
    <a href={href} className={cn(cls, 'hover:bg-gray-50')}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cn(cls, 'w-full text-left hover:bg-gray-50')}>
      {inner}
    </button>
  )
}

export function ProfileScreen() {
  const d = useDict()
  const navigate = useNavigate()
  const settings = useSettings()
  const clearAll = useComplaints((s) => s.clearAll)
  const auth = useAuth()
  const [langOpen, setLangOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadPhoto = (file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 2_500_000) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string') return
      // Show immediately from the data URL, then push to Storage if signed in.
      settings.setAvatarPhoto(dataUrl)
      if (auth.user) {
        uploadAvatar(auth.user.uid, dataUrl)
          .then((url) => settings.setAvatarPhoto(url))
          .catch(() => {})
      }
    }
    reader.readAsDataURL(file)
  }

  const exportData = () => {
    const blob = new Blob([localRepository.exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `jansetu-data-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  // Stitch's slider runs 1–100; the app stores a 1–1.3 text scale.
  const sliderValue = Math.round(((settings.textScale - 1) / 0.3) * 100)
  const sizeLabel =
    sliderValue > 66 ? d.profile.sizeLarge : sliderValue > 33 ? d.profile.sizeMedium : d.profile.sizeSmall

  return (
      <div className="app-bloom min-h-svh pb-[calc(28px+env(safe-area-inset-bottom))]">
        <div className="safe-x mx-auto max-w-[560px] pt-[max(32px,env(safe-area-inset-top))]">
        {/* ---- Header ---- */}
        <header className="mb-5 flex items-start justify-between">
          <div>
            <span className="mb-0.5 block text-sm font-semibold tracking-wide text-orange">
              प्रोफ़ाइल
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Profile</h1>
          </div>
          <button
            type="button"
            aria-label={d.profile.voiceSearch}
            onClick={() => navigate('/')}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm transition-all hover:bg-gray-50 active:scale-95"
          >
            <IconMicrophone className="h-5 w-5 text-orange" stroke={2.2} />
          </button>
        </header>

        {/* ---- IconUser card ---- */}
        <section className="mb-6 rounded-card border border-line bg-card p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="relative h-16 w-16 flex-shrink-0">
                <Avatar size={64} ring={false} className="h-16 w-16 rounded-full border-2 border-orange-100" />
                <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#059669] p-0.5 text-white ring-2 ring-white">
                  <IconCheck className="h-3.5 w-3.5" stroke={3} />
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold leading-snug text-gray-900">
                  {settings.name ?? 'Kamla Devi'}
                </h2>
                <div className="mt-0.5 flex items-center space-x-1.5 text-xs font-medium text-gray-500">
                  <span>+91 98••••421</span>
                  <span>·</span>
                  <span className="font-bold text-[#059669]">{d.profile.otpVerified}</span>
                </div>
                <div className="mt-1 flex items-center text-xs text-gray-400">
                  <IconHome className="mr-1 h-3.5 w-3.5 flex-shrink-0" />
                  <span className="max-w-[155px] truncate">Greater Kailash 2, New D...</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label={d.profile.editProfile}
              onClick={() => fileRef.current?.click()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100/80 text-gray-500 hover:text-gray-700"
            >
              <IconPencil className="h-3.5 w-3.5" stroke={2.5} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) uploadPhoto(file)
                event.target.value = ''
              }}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 divide-x divide-gray-200/80 rounded-2xl bg-gray-50/70 px-2 pb-3 pt-3 text-center">
            <div>
              <div className="text-xl font-bold leading-none text-gray-900">8</div>
              <div className="mt-1.5 text-[0.6875rem] font-medium text-gray-400">{d.profile.stats.filed}</div>
            </div>
            <div>
              <div className="text-xl font-bold leading-none text-[#059669]">5</div>
              <div className="mt-1.5 text-[0.6875rem] font-medium text-gray-400">{d.profile.stats.resolved}</div>
            </div>
            <div>
              <div className="text-xl font-bold leading-none text-[#1E3A8A]">2:40</div>
              <div className="mt-1.5 text-[0.6875rem] font-medium text-gray-400">{d.profile.stats.avgMin}</div>
            </div>
          </div>
        </section>

        {/* ---- Account (Firebase auth) ---- */}
        <section className="mb-6 rounded-card border border-line bg-card p-4 shadow-card">
          {auth.user ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[0.6875rem] font-bold uppercase tracking-widest text-muted">Account</div>
                <div className="truncate text-[0.875rem] font-semibold text-ink">
                  {auth.user.email ?? (auth.user.isAnonymous ? 'Guest (synced)' : 'Signed in')}
                </div>
                <div className="text-[0.75rem] text-muted">Complaints & places synced to the cloud</div>
              </div>
              <button
                type="button"
                onClick={() => void auth.signOut()}
                className="shrink-0 rounded-btn border border-line-strong px-3 py-2 text-[0.8125rem] font-semibold text-ink active:scale-95"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <div className="text-[0.6875rem] font-bold uppercase tracking-widest text-muted">Account</div>
                <div className="text-[0.8125rem] text-muted">Sign in to back up your complaints & places.</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={auth.loading}
                  onClick={() => void auth.signInGoogle()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-btn bg-ink px-3 py-2.5 text-[0.84375rem] font-semibold text-white active:scale-95 disabled:opacity-60"
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  disabled={auth.loading}
                  onClick={() => void auth.signInGuest()}
                  className="rounded-btn border border-line-strong px-3 py-2.5 text-[0.84375rem] font-semibold text-ink active:scale-95 disabled:opacity-60"
                >
                  Guest
                </button>
              </div>
              {auth.error && <p className="text-[0.75rem] text-coral">{auth.error}</p>}
            </div>
          )}
        </section>

        {/* ---- Language ---- */}
        <div className="mb-2.5 px-1 text-[0.6875rem] font-bold uppercase tracking-widest text-gray-400">
          {d.profile.sectionLanguage}
        </div>
        <section className="mb-6 space-y-4 rounded-card border border-line bg-card p-5 shadow-card">
          <div>
            <h3 className="mb-2.5 text-sm font-bold text-gray-800">{d.profile.iSpeak}</h3>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              {I_SPEAK.map((option) => {
                const active = settings.languageChoice === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => settings.setLanguage(option.value)}
                    className={cn(
                      'flex items-center rounded-full px-3.5 py-1.5 transition-colors',
                      active
                        ? 'bg-orange text-white shadow-xs'
                        : 'border border-gray-200 text-gray-700 hover:border-gray-300',
                    )}
                  >
                    {active && <IconCheck className="mr-1 h-3.5 w-3.5" stroke={3} />}
                    {d.languages[option.key]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3.5">
            <div>
              <div className="text-sm font-semibold text-gray-900">{d.profile.repliesIn}</div>
              <div className="text-xs text-gray-400">{d.profile.repliesInSub}</div>
            </div>
            <button
              type="button"
              onClick={() => setLangOpen(true)}
              className="flex items-center space-x-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-bold text-gray-800"
            >
              <span>{settings.speechLang.startsWith('hi') ? 'हिंदी' : settings.speechLang.startsWith('bn') ? 'বাংলা' : settings.speechLang.startsWith('ta') ? 'தமிழ்' : 'English'}</span>
              <IconChevronRight className="h-3.5 w-3.5 rotate-90 text-gray-500" stroke={2.5} />
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3.5">
            <div>
              <div className="text-sm font-semibold text-gray-900">{d.profile.mixedLanguages}</div>
              <div className="text-xs text-gray-400">{d.profile.mixedLanguagesSub}</div>
            </div>
            <Toggle
              on={settings.mixedLanguages}
              onChange={settings.setMixedLanguages}
              label={d.profile.mixedLanguages}
            />
          </div>
        </section>

        {/* ---- Accessibility ---- */}
        <div className="mb-2.5 px-1 text-[0.6875rem] font-bold uppercase tracking-widest text-gray-400">
          {d.profile.sectionAccessibility}
        </div>
        <section className="mb-6 space-y-4 rounded-card border border-line bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange">
                <IconVolume className="h-5 w-5" stroke={2} />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight text-gray-900">{d.profile.readAloud}</div>
                <div className="mt-0.5 text-xs text-gray-400">{d.profile.readAloudSub}</div>
              </div>
            </div>
            <Toggle on={settings.readAloud} onChange={settings.setReadAloud} label={d.profile.readAloud} />
          </div>

          <div className="border-t border-gray-100 pt-3">
            <span className="mb-2 block text-xs font-semibold text-gray-800">{d.profile.speakingSpeed}</span>
            <div className="flex items-center rounded-2xl bg-gray-100/80 p-1 text-xs font-medium text-gray-600">
              {SPEAKING.map((option) => {
                const active = Math.abs(settings.voiceSpeed - option.value) < 0.01
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => settings.setVoiceSpeed(option.value)}
                    className={cn(
                      'flex-1 rounded-xl py-2 text-center transition-colors',
                      active ? 'bg-white font-bold text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800',
                    )}
                  >
                    {d.profile[option.key]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <IconLanguage className="h-4 w-4" stroke={2.5} />
                </div>
                <span className="text-sm font-semibold text-gray-900">{d.profile.textSize}</span>
              </div>
              <span className="text-xs font-medium text-gray-400">{sizeLabel}</span>
            </div>
            <div className="flex items-center space-x-3 px-1">
              <span className="text-xs font-semibold text-gray-400">A</span>
              <input
                type="range"
                min={1}
                max={100}
                value={sliderValue}
                aria-label={d.profile.textSizeAdjust}
                onChange={(event) => settings.setTextScale(1 + (Number(event.target.value) / 100) * 0.3)}
                style={{ '--slider-fill': `${sliderValue}%` } as React.CSSProperties}
                className="slider-track h-1.5 w-full cursor-pointer appearance-none rounded-lg focus:outline-none"
              />
              <span className="text-base font-black text-gray-800">A</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3.5">
            <div className="flex items-center space-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gray-100 text-gray-700">
                <span className="h-4 w-4 rounded-full border-[3px] border-current" />
              </div>
              <span className="text-sm font-semibold text-gray-900">{d.profile.highContrast}</span>
            </div>
            <Toggle on={settings.highContrast} onChange={settings.setHighContrast} label={d.profile.highContrast} />
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3.5">
            <div className="flex items-center space-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <IconPhoneCall className="h-4 w-4" stroke={2} />
              </div>
              <span className="text-sm font-semibold text-gray-900">{d.profile.vibrate}</span>
            </div>
            <Toggle on={settings.vibrate} onChange={settings.setVibrate} label={d.profile.vibrate} />
          </div>
        </section>

        {/* ---- Action Centre ---- */}
        <div className="mb-2.5 px-1 text-[0.6875rem] font-bold uppercase tracking-widest text-gray-400">
          {d.action.title}
        </div>
        <section className="mb-6 divide-y divide-gray-100 rounded-card border border-line bg-card p-2 shadow-card">
          <Row
            icon={<IconListCheck className="h-5 w-5" />}
            iconClass="bg-orange-50 text-orange"
            title={d.action.title}
            sub={d.action.subtitle}
            onClick={() => navigate('/actions')}
          />
        </section>

        {/* ---- Places & family ---- */}
        <div className="mb-2.5 px-1 text-[0.6875rem] font-bold uppercase tracking-widest text-gray-400">
          {d.profile.sectionPlaces}
        </div>
        <section className="mb-6 divide-y divide-gray-100 rounded-card border border-line bg-card p-2 shadow-card">
          <Row
            icon={<IconHome className="h-5 w-5" fill="currentColor" />}
            iconClass="bg-orange-50 text-orange"
            title={d.profile.places.home}
            sub={d.profile.places.homeSub}
            onClick={() => navigate('/places')}
          />
          <Row
            icon={<IconHeart className="h-5 w-5" fill="currentColor" />}
            iconClass="bg-indigo-50 text-indigo-700"
            title={d.profile.places.daughter}
            sub={d.profile.places.daughterSub}
            onClick={() => navigate('/places')}
          />
          <Row
            icon={<IconUsers className="h-5 w-5" fill="currentColor" />}
            iconClass="bg-emerald-50 text-emerald-600"
            title={d.profile.places.helper}
            sub={d.profile.places.helperSub}
            onClick={() => navigate('/places')}
          />
        </section>

        {/* ---- Privacy & consent ---- */}
        <div className="mb-2.5 px-1 text-[0.6875rem] font-bold uppercase tracking-widest text-gray-400">
          {d.profile.sectionPrivacy}
        </div>
        <section className="mb-6 divide-y divide-gray-100 rounded-card border border-line bg-card p-2 shadow-card">
          <div className="flex items-center justify-between rounded-2xl p-3">
            <div className="flex items-center space-x-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                <IconLock className="h-5 w-5" fill="currentColor" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{d.profile.privacy.alwaysAsk}</div>
                <div className="text-xs text-gray-400">{d.profile.privacy.alwaysAskSub}</div>
              </div>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <IconLock className="h-3.5 w-3.5" fill="currentColor" />
            </div>
          </div>
          <Row
            icon={<IconMicrophone className="h-5 w-5" stroke={2} />}
            iconClass="bg-orange-50 text-orange"
            title={d.profile.privacy.recordings}
            sub={d.profile.privacy.recordingsSub}
            href="#recordings"
          />
          <Row
            icon={<IconCheck className="h-5 w-5" stroke={2} />}
            iconClass="bg-gray-100 text-gray-700"
            title={d.profile.privacy.history}
            sub={d.profile.privacy.historySub}
            href="#history"
          />
          <Row
            icon={<IconTrash className="h-5 w-5" stroke={2} />}
            iconClass="bg-red-50 text-red-500"
            title={d.profile.privacy.delete}
            sub={d.profile.privacy.deleteSub}
            danger
            onClick={() => setConfirmDelete(true)}
          />
        </section>

        {/* ---- Help banner ---- */}
        <div className="mb-5 flex items-center justify-between rounded-card bg-ink p-3.5 text-white shadow-card">
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange to-red-500">
              <Logo size={30} variant="transparent" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">{d.profile.helpTitle}</div>
              <div className="mt-0.5 text-xs text-gray-400">{d.profile.helpSub}</div>
            </div>
          </div>
          <button
            type="button"
            aria-label={d.profile.activateVoiceHelp}
            onClick={() => navigate('/')}
            className="p-2 text-orange hover:text-orange-400"
          >
            <IconMicrophone className="h-5 w-5" fill="currentColor" />
          </button>
        </div>

        {/* ---- Sign out ---- */}
        <div className="mb-8 text-center">
          <button
            type="button"
            onClick={exportData}
            className="flex w-full items-center justify-center space-x-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-xs transition-all hover:bg-gray-50 active:scale-[0.99]"
          >
            <IconArrowLeft className="h-4 w-4 rotate-180 text-gray-600" stroke={2} />
            <span>{d.profile.exportData}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              settings.resetOnboarding()
              navigate('/welcome', { replace: true })
            }}
            className="mt-2.5 flex w-full items-center justify-center space-x-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-xs transition-all hover:bg-gray-50 active:scale-[0.99]"
          >
            <IconArrowLeft className="h-4 w-4 text-gray-600" stroke={2} />
            <span>{d.profile.signOut}</span>
          </button>
          <p className="mt-4 text-[0.6875rem] font-normal leading-relaxed text-gray-400">
            {d.profile.footer}
          </p>
        </div>
      </div>

      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-[#1B140F]/45 backdrop-blur-[2px]"
            onClick={() => setConfirmDelete(false)}
          />
          <div className="relative w-full max-w-sm rounded-card bg-ivory p-5 shadow-xl">
            <p className="text-[0.875rem] leading-relaxed text-ink">{d.profile.deleteConfirm}</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Button variant="secondary" size="md" onClick={() => setConfirmDelete(false)}>
                {d.actions.cancel}
              </Button>
              <Button
                size="md"
                className="from-[#E24B5C] to-[#C0394A]"
                onClick={() => {
                  clearAll()
                  setConfirmDelete(false)
                  navigate('/')
                }}
              >
                {d.profile.deleteAll}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}