import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ObHeader } from './OnboardingChrome'
import { GoogleLoginStep } from './GoogleLoginStep'
import { LanguageStep } from './LanguageStep'
import { HomeCheckStep } from './HomeCheckStep'
import { ProfileDetailsStep } from './ProfileDetailsStep'
import { ReadyStep } from './ReadyStep'
import { useSettings } from '@/state/settings'
import { speak, cancelSpeech } from '@/lib/voice/tts'
import { OB } from '@/lib/onboarding/copy'

const STEPS = ['login', 'language', 'home', 'profile', 'ready'] as const
type StepName = (typeof STEPS)[number]

const TOTAL = STEPS.length

/**
 * The onboarding flow, assembled from the Stitch designs:
 * Google login → language → home check → profile details → ready.
 *
 * Only the first step forbids going back; the rest keep their state so a citizen
 * can correct anything before finishing. Finishing writes the language, name and
 * wallet to the existing stores — no new persistence layer.
 */
export function OnboardingFlow() {
  const navigate = useNavigate()
  const uiLang = useSettings((s) => s.uiLang)
  const lang: 'hi' | 'en' = uiLang === 'hi' ? 'hi' : 'en'
  const setName = useSettings((s) => s.setName)
  const completeOnboarding = useSettings((s) => s.completeOnboarding)
  const settingsName = useSettings((s) => s.name)

  const [stepIndex, setStepIndex] = useState(0)
  const [name, setNameDraft] = useState(settingsName ?? '')
  const [phone, setPhone] = useState('')
  const step = STEPS[stepIndex] as StepName
  const canGoBack = stepIndex > 0

  const next = () => {
    cancelSpeech()
    setStepIndex((index) => Math.min(index + 1, TOTAL - 1))
  }

  const finish = () => {
    if (name.trim()) setName(name.trim())
    completeOnboarding()
    navigate('/', { replace: true })
  }

  const say = (hi: string) => void speak(hi, { lang: 'hi-IN', rate: 0.95 })

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-surface pb-[env(safe-area-inset-bottom)]">
      <ObHeader
        step={stepIndex + 1}
        total={TOTAL}
        lang={lang}
        onBack={canGoBack ? () => setStepIndex((i) => Math.max(0, i - 1)) : undefined}
        variant={step === 'language' || step === 'ready' ? 'pill' : 'default'}
      />

      <main className="mx-auto w-full max-w-[560px] flex-1 overflow-y-auto overscroll-contain pb-6 pt-[calc(env(safe-area-inset-top)+6rem)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 'login' && <GoogleLoginStep lang={lang} onNext={next} />}
            {step === 'language' && <LanguageStep lang={lang} onNext={next} />}
            {step === 'home' && (
              <HomeCheckStep lang={lang} onNext={next} onElsewhere={() => navigate('/places')} />
            )}
            {step === 'profile' && (
              <ProfileDetailsStep
                lang={lang}
                name={name}
                phone={phone}
                email={null}
                onNameChange={setNameDraft}
                onPhoneChange={setPhone}
                onNext={next}
              />
            )}
            {step === 'ready' && <ReadyStep lang={lang} onFinish={finish} onSample={() => say(OB.sampleGarbage.hi)} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}