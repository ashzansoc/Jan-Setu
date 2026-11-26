import { useDict, useUiLang } from '@/lib/i18n'
import { useSettings } from '@/state/settings'
import { cn } from '@/lib/cn'

export function Greeting() {
  const d = useDict()
  const lang = useUiLang()
  const name = useSettings((s) => s.name)

  return (
    <div className="safe-x mt-5 text-center">
      <p className={cn('text-[1.03125rem] font-semibold leading-snug text-[#3C3941]', lang === 'hi' && 'deva')}>
        {d.greeting.namaste(name)}
      </p>
      <h1
        className={cn(
          'mt-1 text-[clamp(29px,8.2vw,41px)] font-bold leading-[1.3] tracking-[-0.004em] text-ink',
          lang === 'hi' && 'deva',
        )}
      >
        {d.greeting.headline}
      </h1>
      <p className="mx-auto mt-3 max-w-[330px] text-[0.9375rem] leading-[1.62] text-[#56535B]">
        {d.home.subline1}
        <br />
        {d.home.subline2}
      </p>
    </div>
  )
}