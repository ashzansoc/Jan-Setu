import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { IconArrowLeft, IconArrowRight, IconWaveform, IconCircleCheck, IconBrain, IconCheck, IconFileText, IconLanguage, IconLock, IconMicrophone, IconPlayerPause, IconPlayerPlay, IconShieldCheck, IconUser, IconVolume, IconBolt } from '@tabler/icons-react'
import { useDict } from '@/lib/i18n'
import { useSettings, type LanguageChoice } from '@/state/settings'
import { cancelSpeech, speak } from '@/lib/voice/tts'
import { startLevels, type LevelSession } from '@/lib/voice/levels'
import { requestMicrophone } from '@/lib/permissions'
import { useDictation } from '@/lib/voice/useDictation'
import { cn } from '@/lib/cn'

/** Stitch's onboarding palette, kept literal so the screen matches the design. */
const C = {
  surface: '#FBF9F6',
  primary: '#AA3000',
  primaryFixed: '#FFDBD0',
  onPrimaryFixed: '#3A0A00',
  secondary: '#006C53',
  secondaryFixed: '#98F4D3',
  container: '#EFEEEB',
  containerLow: '#F5F3F0',
  containerHigh: '#EAE8E5',
  variant: '#E4E2DF',
  onSurface: '#1B1C1A',
  onVariant: '#5A4139',
  tertiaryFixed: '#FFB77D',
} as const

const TOTAL_STEPS = 3

const I_SPEAK: {
  key: 'hindi' | 'hinglish' | 'english' | 'bengali' | 'tamil' | 'marathi'
  value: LanguageChoice
}[] = [
  { key: 'hindi', value: 'hi' },
  { key: 'hinglish', value: 'hinglish' },
  { key: 'english', value: 'en' },
  { key: 'bengali', value: 'bn' },
  { key: 'tamil', value: 'ta' },
  { key: 'marathi', value: 'mr' },
]

const SUB_LABEL: Record<LanguageChoice, string> = {
  hi: 'Hindi',
  hinglish: 'मिक्स भाषा',
  en: 'Indian EN',
  bn: 'Bengali',
  ta: 'Tamil',
  mr: 'Marathi',
}

const SCRIPT: Record<LanguageChoice, string> = {
  hi: 'deva',
  en: '',
  hinglish: '',
  bn: 'beng',
  ta: 'tamil',
  mr: 'deva',
}

export function WelcomeScreen() {
  const d = useDict()
  const navigate = useNavigate()
  const settings = useSettings()
  const [step, setStep] = useState(1)
  const [name, setNameLocal] = useState(settings.name ?? '')
  const [micState, setMicState] = useState<'idle' | 'ready' | 'blocked'>('idle')
  const [heard, setHeard] = useState<string | null>(null)
  const [demoPlaying, setDemoPlaying] = useState(false)
  const levelRef = useRef<LevelSession | null>(null)

  const dictation = useDictation({
    lang: settings.speechLang,
    onFinal: (text) => setHeard(text.trim()),
  })

  useEffect(() => () => cancelSpeech(), [])
  useEffect(
    () => () => {
      levelRef.current?.stop()
      levelRef.current = null
    },
    [],
  )

  const finish = () => {
    settings.setName(name)
    settings.completeOnboarding()
    navigate('/', { replace: true })
  }

  const allowMic = async () => {
    // Ask the OS/browser explicitly so a denial is a visible state rather than
    // a silent failure inside the level meter.
    const permission = await requestMicrophone()
    if (permission.state !== 'granted') {
      setMicState('blocked')
      return
    }
    try {
      const session = await startLevels(() => {})
      levelRef.current?.stop()
      levelRef.current = session
      setMicState('ready')
    } catch {
      setMicState('blocked')
    }
  }

  const playDemo = async () => {
    if (demoPlaying) {
      cancelSpeech()
      setDemoPlaying(false)
      return
    }
    setDemoPlaying(true)
    try {
      await speak(d.onboarding.demoLine, { lang: settings.speechLang, rate: settings.voiceSpeed })
    } finally {
      setDemoPlaying(false)
    }
  }

  const o = d.onboarding

  return (
    <div className="min-h-svh" style={{ background: C.surface }}>
      <div className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col pb-32">
        {/* ---- Header ---- */}
        <header
          className="sticky top-0 z-40 flex h-16 items-center justify-between px-4 backdrop-blur-xl"
          style={{ background: `${C.surface}CC`, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={d.actions.back}
              onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
              className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-black/5"
              style={{ color: C.onSurface }}
            >
              <IconArrowLeft size={22} stroke={2.2} />
            </button>
            <h1
              className="truncate text-[18px] font-bold leading-tight tracking-tight"
              style={{ color: C.onSurface }}
            >
              {o.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void speak(o.heroBody, { lang: settings.speechLang, rate: settings.voiceSpeed })}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-black/5"
              style={{ background: C.containerLow, color: C.onSurface }}
            >
              <IconVolume size={18} style={{ color: C.primary }} stroke={2.2} />
              <span className="text-[13px] font-semibold">
                {o.listen}{' '}
                <span className="font-normal" style={{ color: C.onVariant }}>
                  / Listen
                </span>
              </span>
            </button>
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: C.primary, color: '#fff' }}
            >
              <IconUser size={16} stroke={2.2} />
            </span>
          </div>
        </header>

        {/* ---- Progress ---- */}
        <div className="flex flex-col gap-1 px-4 pb-3 pt-2" style={{ background: C.containerLow }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: C.primary }}
              >
                {o.stepShort(step, TOTAL_STEPS)}
              </span>
              <span className="text-[12px]" style={{ color: C.onVariant }}>
                ({o.step(step, TOTAL_STEPS)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void speak(o.heroBody, { lang: settings.speechLang, rate: settings.voiceSpeed })}
                className="flex min-h-[48px] items-center gap-1.5 rounded-full px-3 py-1.5 transition-transform active:scale-95"
                style={{ background: C.containerHigh, color: C.onSurface }}
              >
                <IconVolume size={20} style={{ color: C.primary }} stroke={2.2} />
                <span className="text-[13px] font-bold" style={{ color: C.primary }}>
                  {o.listen}{' '}
                  <span className="font-normal" style={{ color: C.onVariant }}>
                    / Listen
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={finish}
                className="min-h-[48px] px-2 text-[13px] font-semibold transition-colors"
                style={{ color: C.onVariant }}
              >
                {o.skip}
              </button>
            </div>
          </div>
          <div
            className="grid w-full grid-cols-3 gap-2 pt-1"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-valuenow={step}
          >
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span
                key={i}
                className="h-2 rounded-full transition-all duration-300"
                style={{ background: i < step ? C.primary : C.variant }}
              />
            ))}
          </div>
        </div>

        {/* ---- Steps ---- */}
        <main className="flex-1 px-4 pt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col gap-4"
            >
              {step === 1 && (
                <StepSpeak
                  d={d}
                  demoPlaying={demoPlaying}
                  onPlayDemo={() => void playDemo()}
                  languageChoice={settings.languageChoice}
                  onLanguage={settings.setLanguage}
                />
              )}
              {step === 2 && (
                <StepVoice
                  d={d}
                  micState={micState}
                  onAllowMic={() => void allowMic()}
                  dictation={dictation}
                  heard={heard}
                  voiceSpeed={settings.voiceSpeed}
                  onSpeed={settings.setVoiceSpeed}
                  speechLang={settings.speechLang}
                />
              )}
              {step === 3 && (
                <StepConfirm
                  d={d}
                  name={name}
                  onName={setNameLocal}
                  languageChoice={settings.languageChoice}
                  micReady={micState === 'ready'}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ---- Bottom dock ---- */}
        <div
          className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[430px] flex-col items-center gap-1.5 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md"
          style={{ background: `${C.surface}E6`, boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}
        >
          <button
            type="button"
            onClick={() => (step < TOTAL_STEPS ? setStep(step + 1) : finish())}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full text-[18px] font-bold shadow-lg transition-all active:scale-[0.98]"
            style={{ background: C.primary, color: '#fff' }}
          >
            <span>{step < TOTAL_STEPS ? o.continue : o.finish}</span>
            <IconArrowRight size={22} stroke={2.4} />
          </button>
          <span className="text-center text-[12px]" style={{ color: C.onVariant }}>
            {o.changeNote}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Step 1: speak ---------------- */

function StepSpeak({
  d,
  demoPlaying,
  onPlayDemo,
  languageChoice,
  onLanguage,
}: {
  d: ReturnType<typeof useDict>
  demoPlaying: boolean
  onPlayDemo: () => void
  languageChoice: LanguageChoice
  onLanguage: (choice: LanguageChoice) => void
}) {
  const o = d.onboarding
  const nodes = [
    {
      icon: IconMicrophone,
      label: o.journey.voice,
      sub: o.journey.voiceSub,
      bg: C.primaryFixed,
      fg: C.onPrimaryFixed,
      round: true,
    },
    {
      icon: IconBrain,
      label: o.journey.ai,
      sub: o.journey.aiSub,
      bg: C.tertiaryFixed,
      fg: C.onPrimaryFixed,
      round: false,
    },
    {
      icon: IconCircleCheck,
      label: o.journey.govt,
      sub: o.journey.govtSub,
      bg: C.secondaryFixed,
      fg: '#002117',
      round: false,
    },
  ]
  const pillars = [
    { icon: IconWaveform, label: o.pillars.speak, sub: o.pillars.speakSub },
    { icon: IconFileText, label: o.pillars.draft, sub: o.pillars.draftSub },
    { icon: IconCircleCheck, label: o.pillars.resolve, sub: o.pillars.resolveSub },
  ]

  return (
    <>
      {/* Hero journey card */}
      <section className="relative overflow-hidden rounded-xl p-4 shadow-md" style={{ background: '#fff' }}>
        <span
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full blur-2xl"
          style={{ background: `${C.primary}1A` }}
        />
        <span
          className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full blur-2xl"
          style={{ background: `${C.secondary}1A` }}
        />

        <div className="relative flex items-center justify-between pb-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ background: C.primaryFixed, color: C.onPrimaryFixed }}
          >
            <IconBolt size={14} stroke={2.4} />
            {o.brandBadge}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.secondary }}>
            <span className="h-2 w-2 animate-ping rounded-full" style={{ background: C.secondary }} />
            {o.live}
          </span>
        </div>

        <div className="relative flex items-center justify-between gap-1 py-2">
          {nodes.map((node, i) => (
            <div key={node.label} className="flex flex-1 items-center gap-1">
              <div className="flex flex-1 flex-col items-center text-center">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  {node.round && (
                    <span
                      className="absolute inset-0 animate-ping rounded-full opacity-75"
                      style={{ background: `${C.primary}33` }}
                    />
                  )}
                  <span
                    className={cn(
                      'relative flex items-center justify-center shadow-sm',
                      node.round ? 'h-11 w-11 rounded-full' : 'h-12 w-12 rounded-xl',
                    )}
                    style={{ background: node.bg, color: node.fg }}
                  >
                    <node.icon size={node.round ? 22 : 24} stroke={2.2} />
                  </span>
                </div>
                <span className="mt-2 text-[11px] font-bold leading-tight" style={{ color: C.onSurface }}>
                  {node.label}
                </span>
                <span className="text-[11px] leading-none" style={{ color: C.onVariant }}>
                  {node.sub}
                </span>
              </div>
              {i < nodes.length - 1 && (
                <IconArrowRight size={16} style={{ color: i === 0 ? C.primary : C.secondary }} stroke={2.4} />
              )}
            </div>
          ))}
        </div>

        {/* Ward banner — local illustration instead of a stock photo */}
        <div className="mt-4 flex items-center gap-3 rounded-lg p-2.5" style={{ background: C.container }}>
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: C.secondaryFixed, color: '#002117' }}
          >
            <IconShieldCheck size={22} stroke={2.2} />
          </span>
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-[11px] font-bold" style={{ color: C.onSurface }}>
              {o.wardTitle}
            </p>
            <p className="truncate text-[11px]" style={{ color: C.onVariant }}>
              {o.wardBody}
            </p>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold" style={{ color: C.onVariant }}>
          {o.pillarsLabel}
        </span>
        <div className="grid grid-cols-3 gap-1.5 rounded-xl p-1" style={{ background: C.containerHigh }}>
          {pillars.map((p, i) => (
            <div
              key={p.label}
              className={cn(
                'flex min-h-[48px] flex-col items-center justify-center rounded-lg px-2 py-1.5 text-center transition-all',
                i === 0 ? 'shadow-sm' : 'opacity-70',
              )}
              style={i === 0 ? { background: '#fff', color: C.primary } : { color: C.onVariant }}
            >
              <span className="flex items-center gap-1 text-[11px] font-bold">
                <p.icon size={14} stroke={2.2} />
                {i + 1}. {p.label}
              </span>
              <span className="text-[10px] leading-tight" style={{ color: C.onVariant }}>
                {p.sub}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Feature card */}
      <section className="flex flex-col gap-2 rounded-xl p-4 shadow-md" style={{ background: '#fff' }}>
        <div className="flex items-start gap-2">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-sm"
            style={{ background: C.primaryFixed, color: C.onPrimaryFixed }}
          >
            <IconMicrophone size={26} stroke={2.2} />
          </span>
          <div className="flex flex-col">
            <h2 className="text-[18px] font-bold leading-snug" style={{ color: C.onSurface }}>
              {o.heroTitle}
            </h2>
          </div>
        </div>
        <p className="text-[14px] leading-relaxed" style={{ color: C.onVariant }}>
          {o.heroBody}
        </p>

        {/* Audio demo */}
        <div className="mt-1 flex flex-col gap-2 rounded-xl p-2" style={{ background: C.containerLow }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: C.onSurface }}>
              <IconPlayerPlay size={16} style={{ color: C.primary }} stroke={2.2} />
              {o.demoLabel}
            </span>
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold"
              style={{ background: C.secondaryFixed, color: '#002117' }}
            >
              {o.demoBadge}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg p-2" style={{ background: '#fff' }}>
            <button
              type="button"
              aria-label={o.demoLabel}
              onClick={onPlayDemo}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full shadow-md transition-transform active:scale-95"
              style={{ background: C.primary, color: '#fff' }}
            >
              {demoPlaying ? <IconPlayerPause size={22} stroke={2.4} /> : <IconPlayerPlay size={22} stroke={2.4} />}
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-bold" style={{ color: C.onSurface }}>
                {o.demoLine}
              </span>
              <span className="truncate text-[11px]" style={{ color: C.onVariant }}>
                {o.demoSub}
              </span>
              <div
                className={cn('flex items-center gap-1 pt-1', demoPlaying ? 'opacity-100' : 'opacity-40')}
              >
                {[2, 3, 4, 2, 5, 3, 2].map((h, i) => (
                  <span
                    key={i}
                    className={cn('w-1 rounded-full', demoPlaying && 'animate-pulse')}
                    style={{ height: h * 4, background: C.primary, animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg p-2"
            style={{ background: `${C.secondary}1A`, color: C.secondary }}
          >
            <IconCircleCheck size={18} stroke={2.4} />
            <p className="text-[11px] leading-tight" style={{ color: C.onSurface }}>
              <span className="font-bold" style={{ color: C.secondary }}>
                {o.autoCategory}:
              </span>{' '}
              {o.autoCategoryValue}
            </p>
          </div>
        </div>
      </section>

      {/* Language grid */}
      <section className="flex flex-col gap-2 rounded-xl p-4 shadow-md" style={{ background: '#fff' }}>
        <div className="flex items-center gap-2">
          <IconLanguage size={22} style={{ color: C.primary }} stroke={2.2} />
          <div className="flex flex-col">
            <h3 className="text-[18px] font-bold" style={{ color: C.onSurface }}>
              {o.languageTitle}
            </h3>
            <span className="text-[11px]" style={{ color: C.onVariant }}>
              {o.languageSub}
            </span>
          </div>
        </div>
        <div role="radiogroup" aria-label={o.languageTitle} className="grid grid-cols-3 gap-2 pt-1">
          {I_SPEAK.map((option) => {
            const active = languageChoice === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onLanguage(option.value)}
                className={cn(
                  'flex min-h-[48px] flex-col items-center justify-center rounded-xl px-2 py-2 text-center transition-all active:scale-95',
                  SCRIPT[option.value],
                )}
                style={
                  active
                    ? { background: C.primary, color: '#fff' }
                    : { background: C.container, color: C.onSurface }
                }
              >
                <span className="text-[15px] font-bold">{d.languages[option.key]}</span>
                <span
                  className="text-[11px]"
                  style={{ color: active ? 'rgba(255,255,255,0.9)' : C.onVariant }}
                >
                  {SUB_LABEL[option.value]}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 pt-2 text-[12px]" style={{ color: C.onVariant }}>
          <IconShieldCheck size={16} style={{ color: C.secondary }} stroke={2.2} />
          <span>{o.trustNote}</span>
        </div>
      </section>
    </>
  )
}

/* ---------------- Step 2: voice setup ---------------- */

type Dictation = ReturnType<typeof useDictation>

function StepVoice({
  d,
  micState,
  onAllowMic,
  dictation,
  heard,
  voiceSpeed,
  onSpeed,
  speechLang,
}: {
  d: ReturnType<typeof useDict>
  micState: 'idle' | 'ready' | 'blocked'
  onAllowMic: () => void
  dictation: Dictation
  heard: string | null
  voiceSpeed: number
  onSpeed: (speed: number) => void
  speechLang: string
}) {
  const o = d.onboarding
  const speeds: { key: 'slow' | 'normal' | 'fast'; value: number }[] = [
    { key: 'slow', value: 0.85 },
    { key: 'normal', value: 1 },
    { key: 'fast', value: 1.15 },
  ]

  return (
    <section className="flex flex-col gap-3 rounded-xl p-4 shadow-md" style={{ background: '#fff' }}>
      <div className="flex flex-col">
        <h2 className="text-[18px] font-bold leading-snug" style={{ color: C.onSurface }}>
          {o.step2Title}
        </h2>
        <p className="text-[14px] leading-relaxed" style={{ color: C.onVariant }}>
          {o.step2Body}
        </p>
      </div>

      {/* Microphone */}
      <div
        className="flex items-center justify-between gap-3 rounded-xl p-3"
        style={{ background: C.containerLow }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{
              background: micState === 'blocked' ? '#FFDAD6' : C.primaryFixed,
              color: micState === 'blocked' ? '#93000A' : C.onPrimaryFixed,
            }}
          >
            <IconMicrophone size={20} stroke={2.2} />
          </span>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold" style={{ color: C.onSurface }}>
              {o.micTitle}
            </span>
            <span className="text-[11px]" style={{ color: C.onVariant }}>
              {micState === 'ready' ? o.micAllowed : micState === 'blocked' ? o.micBlocked : o.micBody}
            </span>
          </div>
        </div>
        {micState === 'ready' ? (
          <IconCircleCheck size={20} style={{ color: C.secondary }} stroke={2.4} />
        ) : (
          <button
            type="button"
            onClick={onAllowMic}
            className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white transition-transform active:scale-95"
            style={{ background: C.primary }}
          >
            {o.micAllow}
          </button>
        )}
      </div>

      {/* Test line */}
      <div className="flex flex-col gap-2 rounded-xl p-3" style={{ background: C.containerLow }}>
        <span className="text-[11px] font-bold" style={{ color: C.onSurface }}>
          {o.testTitle}
        </span>
        <p className="text-[11px]" style={{ color: C.onVariant }}>
          {o.testBody}
        </p>
        <div className="rounded-lg p-2" style={{ background: '#fff' }}>
          <p className="min-h-[18px] text-[12px]" style={{ color: C.onSurface }}>
            {dictation.listening ? dictation.interim || '…' : heard ? `${o.testHeard}: “${heard}”` : ''}
          </p>
          {dictation.listening && (
            <div
              className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: C.variant }}
            >
              <span
                className="block h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round(dictation.level * 100))}%`,
                  background: C.primary,
                }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-full text-[13px] font-bold text-white transition-transform active:scale-95"
          style={{ background: C.primary }}
        >
          <IconMicrophone size={16} stroke={2.4} />
          {dictation.listening ? o.testStop : o.testListen}
        </button>
      </div>

      {/* Read aloud */}
      <div
        className="flex items-center justify-between gap-3 rounded-xl p-3"
        style={{ background: C.containerLow }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ background: C.primaryFixed, color: C.onPrimaryFixed }}
          >
            <IconVolume size={20} stroke={2.2} />
          </span>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold" style={{ color: C.onSurface }}>
              {o.readTitle}
            </span>
            <span className="text-[11px]" style={{ color: C.onVariant }}>
              {o.readBody}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void speak(o.heroBody, { lang: speechLang, rate: voiceSpeed })}
          className="rounded-full px-3 py-1.5 text-[11px] font-bold transition-transform active:scale-95"
          style={{ background: C.containerHigh, color: C.primary }}
        >
          {o.readTest}
        </button>
      </div>

      {/* Speed */}
      <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: C.container }}>
        <span className="text-[13px] font-semibold" style={{ color: C.onSurface }}>
          {o.speedTitle}
        </span>
        <div className="flex items-center rounded-2xl p-1" style={{ background: C.container }}>
          {speeds.map((option) => {
            const active = Math.abs(voiceSpeed - option.value) < 0.01
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => onSpeed(option.value)}
                className={cn(
                  'flex-1 rounded-xl py-2 text-center text-[12px] transition-colors',
                  active ? 'bg-white font-bold shadow-xs' : 'font-medium',
                )}
                style={{ color: active ? C.onSurface : C.onVariant }}
              >
                {d.profile[option.key]}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ---------------- Step 3: confirm ---------------- */

function StepConfirm({
  d,
  name,
  onName,
  languageChoice,
  micReady,
}: {
  d: ReturnType<typeof useDict>
  name: string
  onName: (value: string) => void
  languageChoice: LanguageChoice
  micReady: boolean
}) {
  const o = d.onboarding
  const languageKey =
    languageChoice === 'hi'
      ? 'hindi'
      : languageChoice === 'en'
        ? 'english'
        : languageChoice === 'bn'
          ? 'bengali'
          : languageChoice === 'ta'
            ? 'tamil'
            : languageChoice === 'mr'
              ? 'marathi'
              : 'hinglish'
  const languageLabel = d.languages[languageKey]

  return (
    <>
      <section className="flex flex-col gap-3 rounded-xl p-4 shadow-md" style={{ background: '#fff' }}>
        <div className="flex flex-col">
          <h2 className="text-[18px] font-bold leading-snug" style={{ color: C.onSurface }}>
            {o.step3Title}
          </h2>
          <p className="text-[14px] leading-relaxed" style={{ color: C.onVariant }}>
            {o.step3Body}
          </p>
        </div>
        <label className="flex flex-col gap-1">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: C.onVariant }}
          >
            {o.nameLabel}
          </span>
          <input
            value={name}
            onChange={(event) => onName(event.target.value)}
            placeholder={o.namePlaceholder}
            autoComplete="given-name"
            className="h-[52px] rounded-2xl px-4 text-[15px] outline-none"
            style={{ background: C.containerLow, color: C.onSurface }}
          />
        </label>
      </section>

      <section className="flex flex-col gap-2 rounded-xl p-4 shadow-md" style={{ background: '#fff' }}>
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: C.onVariant }}
        >
          {o.summaryTitle}
        </span>
        <div
          className="flex items-center justify-between rounded-xl p-3"
          style={{ background: C.containerLow }}
        >
          <span
            className="flex items-center gap-2 text-[13px] font-semibold"
            style={{ color: C.onSurface }}
          >
            <IconLanguage size={16} style={{ color: C.primary }} stroke={2.2} />
            {o.summaryLanguage}
          </span>
          <span className="text-[13px] font-bold" style={{ color: C.primary }}>
            {languageLabel}
          </span>
        </div>
        <div
          className="flex items-center justify-between rounded-xl p-3"
          style={{ background: C.containerLow }}
        >
          <span
            className="flex items-center gap-2 text-[13px] font-semibold"
            style={{ color: C.onSurface }}
          >
            <IconMicrophone size={16} style={{ color: C.primary }} stroke={2.2} />
            {o.summaryVoice}
          </span>
          <span
            className="flex items-center gap-1 text-[12px] font-bold"
            style={{ color: micReady ? C.secondary : C.onVariant }}
          >
            {micReady ? <IconCheck size={14} stroke={3} /> : <IconLock size={13} stroke={2.4} />}
            {micReady ? o.summaryVoiceReady : o.summaryVoicePending}
          </span>
        </div>
      </section>
    </>
  )
}