import { useEffect, useRef } from 'react'
import { IconArrowRight, IconCircleCheck, IconBulb, IconMapPin, IconWaveform, IconShieldLock, IconIdBadge } from '@tabler/icons-react'
import { usePlaces } from '@/state/places'
import { useSettings } from '@/state/settings'
import { OB, primary } from '@/lib/onboarding/copy'
import { cn } from '@/lib/cn'

/**
 * Step 5 — everything verified, ready to speak.
 *
 * The recap only lists what the profile actually holds: a ward is shown when a
 * home place exists, and the name when the citizen gave one. Nothing here is
 * implied.
 */
export function ReadyStep({
  lang,
  onFinish,
  onSample,
}: {
  lang: 'hi' | 'en'
  onFinish: () => void
  onSample: () => void
}) {
  const name = useSettings((s) => s.name)
  const places = usePlaces()
  const home = places.places.find((place) => place.isDefault) ?? places.places[0]
  const anchorRef = useRef<HTMLDivElement>(null)

  // The celebration from the reference, drawn only when motion is allowed.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const anchor = anchorRef.current
    if (!anchor) return
    const colors = ['#aa3000', '#006c53', '#8d4b00', '#95f1d0', '#ffb59f']
    for (let index = 0; index < 18; index += 1) {
      const dot = document.createElement('span')
      const size = 4 + Math.floor(Math.random() * 6)
      dot.className = 'absolute rounded-full pointer-events-none'
      dot.style.width = `${size}px`
      dot.style.height = `${size}px`
      dot.style.left = `${Math.floor(Math.random() * 100)}%`
      dot.style.top = '-10px'
      dot.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
      dot.style.opacity = '0.9'
      dot.style.transition = `all ${1.2 + Math.random() * 1.2}s cubic-bezier(0.25, 1, 0.5, 1)`
      anchor.appendChild(dot)
      window.setTimeout(() => {
        dot.style.transform = `translateY(${15 + Math.floor(Math.random() * 30)}px) scale(0.6)`
        dot.style.opacity = '0'
      }, 100 + index * 40)
    }
  }, [])

  const t = (key: Parameters<typeof primary>[0]) => primary(key, lang)
  const heading = OB.ready(name)[lang]

  return (
    <div className="px-4 pb-10">
      <div ref={anchorRef} className="relative h-4 w-full overflow-hidden pointer-events-none" />

      <div className="my-3 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary-container px-3.5 py-1.5 text-on-secondary-container shadow-sm">
          <span className="size-1.5 animate-pulse rounded-full bg-secondary" />
          <span className="text-[10.5px] font-bold tracking-wide">चरण 5 / 5 • अंतिम चरण (Final Step)</span>
        </span>
      </div>

      <div className="relative mt-4 flex flex-col items-center overflow-hidden rounded-xl bg-surface-lowest p-6 text-center shadow-sm">
        <span className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-primary-fixed/20" />
        <span className="pointer-events-none absolute -bottom-10 -left-10 size-28 rounded-full bg-secondary-fixed/30" />

        <div className="relative mb-4 flex size-20 items-center justify-center rounded-full bg-secondary-container shadow-md">
          <span className="absolute inset-0 animate-ping rounded-full bg-secondary opacity-15 scale-125" />
          <svg viewBox="0 0 24 24" className="size-10 fill-secondary" aria-hidden>
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
          </svg>
        </div>

        <h1 className={cn('mb-1 text-[26px] font-extrabold tracking-tight text-on-surface', lang === 'hi' && 'deva')}>
          {heading}
        </h1>
        <p className="mb-4 text-[15px] font-medium text-on-surface-variant">
          All set & verified, ready for civic action.
        </p>

        <div className="mt-1 w-full max-w-xs rounded-lg bg-surface-low px-2 py-2.5 text-on-surface">
          <p className={cn('text-[14px] leading-snug', lang === 'hi' && 'deva')}>
            अब आप केवल <span className="font-semibold text-primary">बोलकर</span> अपनी नागरिक समस्या दर्ज कर सकती
            हैं — पानी, सड़क, बिजली या सफाई।
          </p>
          <p className="mt-1 text-[12px] text-on-surface-variant">{t('speakToFile')}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant">
            {t('verifiedDetails')}
          </span>
          <span className="flex items-center gap-0.5 text-[10.5px] font-semibold text-secondary">
            <IconCircleCheck size={13} strokeWidth={2.4} />
            {t('active')}
          </span>
        </div>

        {home && (
          <div className="flex items-center justify-between rounded-xl bg-surface-lowest p-3.5 shadow-sm">
            <span className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
                <IconMapPin size={19} strokeWidth={2} />
              </span>
              <span className="flex flex-col text-left">
                <span className={cn('text-[13.5px] font-semibold text-on-surface', lang === 'hi' && 'deva')}>
                  {home.locality}
                  {home.ward ? `, वार्ड ${home.ward}` : ''}
                </span>
                <span className="text-[12px] text-on-surface-variant">दक्षिण दिल्ली नगर निगम (MCD)</span>
              </span>
            </span>
            <IconCircleCheck size={19} strokeWidth={2} className="shrink-0 text-secondary" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2.5 rounded-xl bg-surface-lowest p-3 shadow-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-secondary">
              <IconWaveform size={17} strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[12.5px] font-semibold text-on-surface">🗣️ हिन्दी</span>
              <span className="truncate text-[11px] text-on-surface-variant">Hindi Voice</span>
            </span>
          </div>
          {name && (
            <div className="flex items-center gap-2.5 rounded-xl bg-surface-lowest p-3 shadow-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-tertiary">
                <IconIdBadge size={17} strokeWidth={2} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={cn('truncate text-[12.5px] font-semibold text-on-surface', lang === 'hi' && 'deva')}>
                  {name}
                </span>
                <span className="truncate text-[11px] text-on-surface-variant">98110•••••</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 w-full rounded-xl bg-surface-container p-4">
        <span className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wide text-on-surface-variant">
          <IconBulb size={17} strokeWidth={2} className="text-primary" />
          {t('sampleCommand')}
        </span>
        <button
          type="button"
          onClick={onSample}
          className="mt-2 flex w-full items-center justify-between rounded-lg bg-surface-lowest px-4 py-3 text-left shadow-sm transition-transform active:scale-[0.98]"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
              <svg viewBox="0 0 24 24" className="size-[18px] fill-current" aria-hidden>
                <path d="M12 14c1.66 0 3-1.34 3-3V5a3 3 0 1 0-6 0v6c0 1.66 1.34 3 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
              </svg>
            </span>
            <span className="flex flex-col">
              <span className={cn('text-[13px] font-semibold text-on-surface', lang === 'hi' && 'deva')}>
                {t('sampleGarbage')}
              </span>
              <span className="text-[11.5px] text-on-surface-variant">{OB.sampleGarbage.en}</span>
            </span>
          </span>
          <svg viewBox="0 0 24 24" className="size-5 fill-primary" aria-hidden>
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          data-testid="onboarding-finish"
          onClick={onFinish}
          className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full bg-primary text-on-primary shadow-md transition-all active:scale-[0.99]"
        >
          <span className="text-[16px] font-bold">{t('start')}</span>
          <span className="text-[13px] font-normal opacity-80">
            | {lang === 'hi' ? 'Enter JANSETU' : 'जनसेतु शुरू करें'}
          </span>
          <IconArrowRight size={22} strokeWidth={2.2} />
        </button>
        <span className="flex items-center justify-center gap-1.5 text-[12px] text-on-surface-variant">
          <IconShieldLock size={16} strokeWidth={2} className="text-secondary" />
          {t('dataSafe')}
        </span>
      </div>
    </div>
  )
}