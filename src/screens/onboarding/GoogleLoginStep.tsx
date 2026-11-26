import { useState } from 'react'
import { Logo } from '@/components/Logo'
import { GoogleMark } from '@/components/GoogleMark'
import { useAuth } from '@/lib/firebase/useAuth'
import { useSettings } from '@/state/settings'
import { OB, primary } from '@/lib/onboarding/copy'
import { cn } from '@/lib/cn'

/**
 * Step 1 — Simple Google Login.
 *
 * Real Google sign-in through the existing Firebase auth hook. When no account
 * is configured the citizen can continue without one: the app works offline and
 * this screen says so rather than blocking.
 */
export function GoogleLoginStep({
  lang,
  onNext,
}: {
  lang: 'hi' | 'en'
  onNext: () => void
}) {
  const auth = useAuth()
  const t = (key: Parameters<typeof primary>[0]) => primary(key, lang)
  const setLanguage = useSettings((s) => s.setLanguage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    setBusy(true)
    setError(null)
    try {
      await auth.signInGoogle()
      onNext()
    } catch {
      setError(t('signInFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 pb-10">
      <div className="mb-8 mt-6 flex flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center gap-1 px-3.5 py-1.5 shadow-sm rounded-full bg-surface-container">
          <span className="size-2 animate-pulse rounded-full bg-secondary" />
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-on-surface-variant">
            {t('brand')}
          </span>
        </span>

        <div className="relative mb-5 flex items-center justify-center">
          <div className="relative z-10 flex size-20 items-center justify-center rounded-2xl bg-surface-lowest shadow-md">
            <Logo size={56} />
          </div>
          <span className="absolute -bottom-1 -right-1 z-20 flex size-7 items-center justify-center rounded-full bg-secondary text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
            </svg>
          </span>
        </div>

        <h1 className="mb-2 text-[26px] font-extrabold tracking-tight text-on-surface">
          नमस्ते <span className="font-normal text-primary">•</span> Welcome
        </h1>
        <p className="font-medium text-on-surface-variant text-headline-sm">{t('speakOpen')}</p>
        <p className="mt-0.5 text-[14px] text-outline">{t('voiceAction')}</p>
      </div>

      <div className="flex w-full flex-col items-center rounded-3xl bg-surface-lowest p-6 shadow-lg shadow-on-surface/5">
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={busy}
          data-testid="google-signin"
          className="flex min-h-[58px] w-full items-center justify-center gap-3.5 rounded-2xl bg-surface-low px-5 py-3.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <GoogleMark />
          <span className="flex flex-col text-left">
            <span className="text-[15px] font-bold leading-tight text-on-surface">
              Continue with Google
            </span>
            <span className="text-[12px] leading-tight text-on-surface-variant">
              {t('googleSub')}
            </span>
          </span>
        </button>

        <p className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-secondary">
          <svg viewBox="0 0 24 24" className="size-[18px] fill-current" aria-hidden>
            <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6z" />
          </svg>
          {t('noPassword')}
        </p>

        <div className="mt-6 flex w-full items-center justify-center gap-2 border-t border-outline-variant/40 pt-5">
          <span className="size-1.5 rounded-full bg-outline-variant" />
          <span className="size-1.5 rounded-full bg-outline-variant" />
          <span className="size-1.5 rounded-full bg-outline-variant" />
        </div>

        <div className="mt-4 flex w-full items-center justify-between rounded-xl bg-surface-container p-3.5">
          <span className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" className="size-5 fill-primary" aria-hidden>
              <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8.5v2H1v2h11.17A15.44 15.44 0 0 1 8.2 9.73a5.44 5.44 0 0 1-1.2-2.06H5.5a7.45 7.45 0 0 0 1.79 3.46L4 12.72V21h2v-7.03l2.6-2.6 2.66 2.66L9.32 21h11.36L12.87 15.07z" />
            </svg>
            <span className="text-[13px] font-semibold text-on-surface">{t('preferredLanguage')}</span>
          </span>
          <span className="flex items-center rounded-lg bg-surface-lowest p-0.5 shadow-sm">
            {(['hi', 'en'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLanguage(option)}
                aria-pressed={lang === option}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors',
                  lang === option
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface',
                  option === 'hi' && 'deva',
                )}
              >
                {option === 'hi' ? 'हिन्दी' : 'EN'}
              </button>
            ))}
          </span>
        </div>
      </div>

{error && (
          <p className="mt-4 rounded-xl bg-error-container/40 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-on-error-container">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onNext}
          data-testid="skip-signin"
          className="mt-3 min-h-[44px] w-full text-center text-[13px] font-semibold text-on-surface-variant transition-colors hover:text-primary"
        >
          {OB.signedOut.en}
        </button>

      <div className="mt-6 flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary-container px-3 py-1.5 text-on-secondary-container shadow-sm">
          <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
            <path d="M12 2L4 5v6.09c0 5.05 3.41 9.77 8 10.91 4.59-1.14 8-5.86 8-10.91V5l-8-3z" />
          </svg>
          <span className="text-[10.5px] font-bold tracking-tight">{t('govIntegrated')}</span>
        </span>
        <p className="mt-2 max-w-xs text-[12px] text-outline">
          {t('encrypted')}
        </p>
      </div>
    </div>
  )
}