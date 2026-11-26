import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconCheck, IconCircle, IconLoader2, IconMicrophone, IconShieldExclamation, IconSparkles, IconArrowRight, IconExternalLink } from '@tabler/icons-react'
import { useComplaints, pickActive } from '@/state/complaints'
import { CATEGORY_LABEL } from '@/lib/complaints/types'
import { useUiLang } from '@/lib/i18n'
import { useDictation } from '@/lib/voice/useDictation'
import { startFiling, provideFilingInput, type FilingSession } from '@/lib/filing/client'
import { cn } from '@/lib/cn'

/**
 * ASSISTED FILING — the JANSETU × Skyvern experience.
 *
 * The citizen speaks; JANSETU identifies the government service, opens the
 * official portal via the backend Assisted Filing Engine, fills what it can,
 * and asks only for the missing/sensitive fields. Final submission always
 * needs explicit approval.
 *
 * When the Skyvern engine is not configured on the server, this screen is
 * honest about it and hands off to the local assisted portal sandbox rather
 * than faking automation.
 */

const STEPS = [
  'Request',
  'Service identified',
  'Open portal',
  'Fill your info',
  'Your input',
  'Human verify',
  'Review',
  'Approve',
  'Submitted',
]

export function AssistedFilingScreen() {
  const navigate = useNavigate()
  const lang = useUiLang()
  const active = useComplaints((s) => pickActive(s.complaints))
  const [session, setSession] = useState<FilingSession | null>(null)
  const [starting, setStarting] = useState(true)
  const [inputField, setInputField] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')

  // Start a filing session for the active complaint (or a sensible default).
  useEffect(() => {
    let alive = true
    const request = active
      ? `${CATEGORY_LABEL[active.category][lang]} complaint — ${active.location.label}`
      : 'Municipal / water complaint registration'
    startFiling(request, {
      name: 'Kamla Devi',
      mobile: '+91 98••••421',
      address: active?.location.label ?? 'Ward 88, Greater Kailash 2',
    }).then((s) => {
      if (!alive) return
      setSession(s)
      setStarting(false)
      if (s && (s.state === 'WAITING_FOR_USER_INPUT' || s.state === 'WAITING_FOR_CAPTCHA')) {
        setInputField(s.fields.find((f) => f.status !== 'available')?.id ?? null)
      }
    })
    return () => {
      alive = false
    }
  }, [active, lang])

  const dict = useDictation({
    lang: 'en-IN',
    onFinal: (text) => setInputValue(text),
  })

  const submitField = async () => {
    if (!session || !inputField || !inputValue.trim()) return
    const s = await provideFilingInput(session.id, inputField, inputValue.trim())
    if (s) {
      setSession(s)
      setInputValue('')
      setInputField(null)
    }
  }

  const notConfigured = !session || session.state === 'NOT_CONFIGURED'
  const activeStep = session ? stepIndex(session.state) : 1

  return (
    <div className="app-bloom min-h-svh">
      <div className="mx-auto flex min-h-svh w-full max-w-[560px] flex-col">
        <header className="safe-x sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-card/95 pb-2.5 pt-[max(12px,env(safe-area-inset-top))] shadow-sm backdrop-blur">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="-ml-2 flex size-10 items-center justify-center rounded-full text-ink transition-all hover:bg-black/5 active:scale-90"
          >
            <IconArrowLeft size={21} stroke={2.2} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.0625rem] font-bold leading-tight text-ink">Assisted Filing</h1>
            <p className="truncate text-[0.78125rem] text-muted">AI handles the complexity. You stay in control.</p>
          </div>
          <IconSparkles size={20} className="text-orange" />
        </header>

        <main className="safe-x flex-1 space-y-4 overflow-y-auto py-4">
          {/* service identified */}
          <section className="rounded-card border border-line bg-card p-4 shadow-card">
            <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-muted">Service</p>
            {session?.service ? (
              <>
                <h2 className="mt-1 text-[1.0625rem] font-bold text-ink">{session.service.department}</h2>
                <p className="text-[0.84375rem] text-muted">{session.service.name}</p>
                <p className="mt-1 truncate font-mono text-[0.71875rem] text-muted/80">
                  {session.service.applicationUrl}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[0.84375rem] text-muted">
                {starting ? 'Identifying the right government service…' : 'No verified service matched.'}
              </p>
            )}
          </section>

          {/* progress */}
          <section className="rounded-card border border-line bg-card p-4 shadow-card">
            <ol className="space-y-2.5">
              {STEPS.map((label, i) => {
                const done = i < activeStep && !notConfigured
                const current = i === activeStep && !notConfigured
                return (
                  <li key={label} className="flex items-center gap-3">
                    {done ? (
                      <span className="flex size-6 items-center justify-center rounded-full bg-success text-white">
                        <IconCheck size={14} stroke={3} />
                      </span>
                    ) : current ? (
                      <IconLoader2 size={24} className="animate-spin text-orange" />
                    ) : (
                      <IconCircle size={24} className="text-line-strong" />
                    )}
                    <span
                      className={cn(
                        'text-[0.84375rem]',
                        current ? 'font-bold text-ink' : done ? 'text-ink/70' : 'text-muted',
                      )}
                    >
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          {/* not configured → honest handoff to sandbox */}
          {notConfigured && !starting && (
            <section className="rounded-card border border-amber-300 bg-amber-50 p-4 shadow-card">
              <div className="flex items-start gap-3">
                <IconShieldExclamation size={22} className="mt-0.5 shrink-0 text-amber-700" />
                <div>
                  <h3 className="text-[0.9375rem] font-bold text-amber-950">Browser automation needs setup</h3>
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-amber-900">
                    The Skyvern filing engine isn’t configured on the server yet. You can still try the
                    assisted portal now — JANSETU fills the form and you complete only the secure fields.
                  </p>
                  <button
                    onClick={() => navigate('/portal-login')}
                    className="mt-3 inline-flex items-center gap-2 rounded-btn bg-gradient-to-br from-orange-bright to-coral px-4 py-2.5 text-[0.84375rem] font-semibold text-white shadow-md active:scale-95"
                  >
                    Continue in assisted sandbox <IconArrowRight size={16} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* waiting for user input */}
          {session && (session.state === 'WAITING_FOR_USER_INPUT' || session.state === 'WAITING_FOR_CAPTCHA') && (
            <section className="rounded-card border border-line bg-card p-4 shadow-card">
              <h3 className="text-[0.9375rem] font-bold text-ink">
                {session.fields.find((f) => f.id === inputField)?.label ?? 'Information needed'}
              </h3>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type or speak…"
                  className="min-w-0 flex-1 rounded-btn border border-line-strong bg-white px-3.5 py-2.5 text-[0.875rem] text-ink focus:border-orange focus:outline-none"
                />
                <button
                  onClick={() => (dict.listening ? dict.stop() : dict.start())}
                  aria-label="Speak"
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full active:scale-90',
                    dict.listening ? 'bg-coral text-white' : 'bg-peach text-orange',
                  )}
                >
                  <IconMicrophone size={20} />
                </button>
              </div>
              {dict.listening && <p className="mt-1 text-[0.75rem] text-muted">Listening… {dict.interim}</p>}
              <button
                onClick={() => void submitField()}
                disabled={!inputValue.trim()}
                className="mt-3 inline-flex items-center gap-2 rounded-btn bg-ink px-4 py-2.5 text-[0.84375rem] font-semibold text-white active:scale-95 disabled:opacity-50"
              >
                Confirm <IconCheck size={16} />
              </button>
            </section>
          )}

          {session?.state === 'COMPLETED' && (
            <section className="rounded-card border border-success/30 bg-success/10 p-4 text-center shadow-card">
              <IconCheck size={32} className="mx-auto text-success" />
              <h3 className="mt-2 text-[1rem] font-bold text-ink">Submitted & verified</h3>
              {session.reference && (
                <p className="mt-1 font-mono text-[0.84375rem] text-ink/80">Ref: {session.reference}</p>
              )}
            </section>
          )}
        </main>

        <footer className="safe-x shrink-0 border-t border-line bg-card p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center justify-center gap-2 rounded-btn border border-line-strong bg-white px-4 py-3 text-[0.875rem] font-semibold text-ink active:scale-95"
          >
            <IconExternalLink size={16} /> Back to JANSETU Voice
          </button>
        </footer>
      </div>
    </div>
  )
}

function stepIndex(state: string): number {
  switch (state) {
    case 'AUTOMATING':
      return 2
    case 'WAITING_FOR_USER_INPUT':
    case 'WAITING_FOR_PASSWORD':
    case 'WAITING_FOR_OTP':
    case 'WAITING_FOR_DOCUMENT':
      return 4
    case 'WAITING_FOR_CAPTCHA':
      return 5
    case 'AWAITING_APPROVAL':
      return 6
    case 'SUBMITTING':
      return 7
    case 'VERIFYING':
      return 8
    case 'COMPLETED':
      return 9
    default:
      return 1
  }
}