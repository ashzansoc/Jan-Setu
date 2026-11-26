import { useEffect, useState } from 'react'
import { IconCheck, IconMapPin, IconRefresh } from '@tabler/icons-react'
import { usePlaces, type Place } from '@/state/places'
import { primary } from '@/lib/onboarding/copy'
import { ListeningChip } from './OnboardingChrome'
import { requestLocation } from '@/lib/permissions'
import { reverseGeocode } from '@/lib/geo'
import { cn } from '@/lib/cn'

type Choice = 'home' | 'elsewhere'
type DetectState = 'idle' | 'locating' | 'found' | 'denied' | 'unavailable'

/**
 * Step 3 — क्या आप अभी अपने घर पर हैं?
 *
 * The location is really detected: GPS → reverse geocode → a locality the
 * citizen confirms. When detection fails (permission denied, no fix, offline)
 * the card says so and offers the saved places or manual entry — it never shows
 * a sample address as if it were the citizen's own.
 */
export function HomeCheckStep({
  lang,
  onNext,
  onElsewhere,
}: {
  lang: 'hi' | 'en'
  onNext: () => void
  onElsewhere: () => void
}) {
  const places = usePlaces()
  const [choice, setChoice] = useState<Choice>('home')
  const [detect, setDetect] = useState<DetectState>('idle')
  const [detected, setDetected] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const t = (key: Parameters<typeof primary>[0]) => primary(key, lang)

  const locate = async () => {
    setDetect('locating')
    const result = await requestLocation()
    if (result.state !== 'granted') {
      setDetect(result.state === 'denied' ? 'denied' : 'unavailable')
      return
    }
    setCoords(result.coords)
    const address = await reverseGeocode(result.coords)
    if (address?.locality || address?.label) {
      setDetected(address.locality ?? address.label)
      setDetect('found')
    } else {
      // Coordinates without a readable address: keep the pincode-level fallback.
      setDetected(`${result.coords.latitude.toFixed(3)}, ${result.coords.longitude.toFixed(3)}`)
      setDetect('found')
    }
  }

  // Detect once when the step opens.
  useEffect(() => {
    void locate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saved = places.places.find((place) => place.isDefault) ?? places.places[0]
  const wardLabel = detected ?? saved?.ward ?? saved?.locality ?? null

  /** Persist the confirmed area so the action engine files in the right ward. */
  const confirm = () => {
    if (!wardLabel) return
    const existing = places.places.find((place) => place.isDefault)
    if (existing) {
      places.updatePlace(existing.id, {
        locality: wardLabel,
        geoVerified: detect === 'found',
        ...(coords ? { line1: `${wardLabel}, ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` } : {}),
      })
    } else {
      const place: Omit<Place, 'id'> = {
        nickname: wardLabel,
        alias: wardLabel,
        line1: wardLabel,
        locality: wardLabel,
        pincode: '',
        zone: '',
        ward: '',
        geoVerified: detect === 'found',
        isDefault: true,
        tone: 'orange',
        shortcut: true,
      }
      places.addPlace(place)
    }
    onNext()
  }

  const statusLine = (() => {
    if (detect === 'locating') return lang === 'hi' ? 'आपकी जगह पता कर रहे हैं…' : 'Finding your area…'
    if (detect === 'found') return `${wardLabel} — ${t('wardDetected')}`
    if (detect === 'denied') return lang === 'hi' ? 'लोकेशन की अनुमति बंद है' : 'Location permission is off'
    if (detect === 'unavailable') return lang === 'hi' ? 'आपकी जगह पता नहीं चल सकी' : 'Could not detect your area'
    return t('chooseWard')
  })()

  return (
    <div className="px-4 pb-10">
      <div className="mb-6 mt-4 flex flex-col items-center text-center">
        <h1 className={cn('text-[22px] font-bold leading-tight text-on-surface', lang === 'hi' && 'deva')}>
          {t('atHome')}
        </h1>
        <p className="mt-1 text-[14px] text-on-surface-variant">
          {lang === 'hi' ? 'Are you at home right now?' : 'क्या आप अभी अपने घर पर हैं?'}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-4">
        <div className="relative flex size-28 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/10 opacity-75" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-primary-fixed-dim/30" />
          <button
            type="button"
            aria-label="Toggle voice listening"
            className="relative z-10 flex size-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-transform active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="size-7 fill-current" aria-hidden>
              <path d="M12 14c1.66 0 3-1.34 3-3V5a3 3 0 1 0-6 0v6c0 1.66 1.34 3 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
            </svg>
          </button>
        </div>
        <div className="mt-3">
          <ListeningChip lang={lang} />
        </div>
      </div>

      <div role="radiogroup" aria-label="Location options" className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={choice === 'home'}
          onClick={() => setChoice('home')}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-xl bg-surface-lowest p-4 text-left shadow-sm transition-all',
            choice === 'home' ? 'ring-2 ring-primary' : 'border-2 border-transparent hover:bg-surface-low',
          )}
        >
          <span className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden>
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={cn('text-[15px] font-semibold text-on-surface', lang === 'hi' && 'deva')}>
                {t('yesAtHome')}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[11.5px] font-bold text-primary">
                <IconMapPin size={13} strokeWidth={2.4} />
                <span className="truncate">{statusLine}</span>
              </span>
              {saved && !detected && detect !== 'locating' && (
                <span className="mt-0.5 text-[11px] text-on-surface-variant">
                  {lang === 'hi' ? 'सहेजा हुआ पता' : 'Saved address'}: {saved.locality}
                </span>
              )}
            </span>
          </span>
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full',
              choice === 'home'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-high text-on-surface-variant opacity-40',
            )}
          >
            {choice === 'home' ? (
              <IconCheck size={17} strokeWidth={3} />
            ) : (
              <span className="size-3 rounded-full border-2 border-current" />
            )}
          </span>
        </button>

        {(detect === 'denied' || detect === 'unavailable') && (
          <button
            type="button"
            onClick={() => void locate()}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-surface-container text-[13px] font-semibold text-on-surface-variant"
          >
            <IconRefresh size={15} strokeWidth={2.2} />
            {lang === 'hi' ? 'फिर पता लगाएँ' : 'Try detecting again'}
          </button>
        )}

        <button
          type="button"
          role="radio"
          aria-checked={choice === 'elsewhere'}
          onClick={() => {
            setChoice('elsewhere')
            onElsewhere()
          }}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-xl bg-surface-lowest p-4 text-left shadow-sm transition-all',
            choice === 'elsewhere' ? 'ring-2 ring-primary' : 'border-2 border-transparent hover:bg-surface-low',
          )}
        >
          <span className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant">
              <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
              </svg>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={cn('text-[15px] font-semibold text-on-surface', lang === 'hi' && 'deva')}>
                {t('elsewhere')}
              </span>
              <span className="text-[12px] text-on-surface-variant">
                {lang === 'hi' ? 'Somewhere else' : 'कहीं और'}
              </span>
            </span>
          </span>
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full',
              choice === 'elsewhere'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-high text-on-surface-variant opacity-40',
            )}
          >
            {choice === 'elsewhere' ? (
              <IconCheck size={17} strokeWidth={3} />
            ) : (
              <span className="size-3 rounded-full border-2 border-current" />
            )}
          </span>
        </button>
      </div>

      <div className="pt-8">
        <button
          type="button"
          data-testid="home-check-next"
          onClick={confirm}
          disabled={!wardLabel || detect === 'locating'}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <span className="text-[15px] font-bold">{t('next')}</span>
        </button>
      </div>
    </div>
  )
}