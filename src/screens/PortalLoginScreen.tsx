import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconX, IconRotateClockwise, IconVolume, IconMicrophone, IconPencil, IconCheck, IconLock, IconArrowRight } from '@tabler/icons-react'
import { useComplaints, pickActive } from '@/state/complaints'
import { shortLocation } from '@/lib/complaints/display'
import { CATEGORY_LABEL } from '@/lib/complaints/types'
import { useUiLang } from '@/lib/i18n'
import { useDictation } from '@/lib/voice/useDictation'
import { speak, cancelSpeech } from '@/lib/voice/tts'
import { cn } from '@/lib/cn'

/**
 * AI-Assisted Portal Login — a browser-like sandbox window (ported from the
 * Stitch design). JANSETU's AI has already filled the form from the citizen's
 * spoken complaint; by government security rules only the Aadhaar number and
 * the captcha must be entered by the citizen — by typing OR by speaking.
 */

const SAMPLE_CAPTCHA = 'K7M9Q'

function randomCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

/** Strip anything that isn't a digit and group an Aadhaar number. */
function normalizeAadhaar(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 12)
}

export function PortalLoginScreen() {
  const navigate = useNavigate()
  const lang = useUiLang()
  const active = useComplaints((s) => pickActive(s.complaints))
  const complaints = useComplaints((s) => s.complaints)

  const [captcha, setCaptcha] = useState(SAMPLE_CAPTCHA)
  const [aadhaar, setAadhaar] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [guidancePlaying, setGuidancePlaying] = useState(false)

  // ---- AI-filled values (from the active complaint, with graceful fallback) ----
  const filled = useMemo(() => {
    const c = active ?? complaints[0]
    return {
      name: 'Kamla Devi (कमला देवी)',
      mobile: '+91 98••••421',
      category: c
        ? `${CATEGORY_LABEL[c.category][lang]}`
        : 'Solid Waste Management / कचरा उठाव',
      ward: c ? shortLocation(c.location.label) : 'Ward 88, Greater Kailash 2, South Zone',
      details:
        (c && c.description) ||
        'मेरे घर के सामने 3 हफ्ते से कचरा पड़ा है, बदबू आ रही है और सफाई कर्मचारी नहीं आ रहे हैं। कृपया तुरंत उठवाएं।',
    }
  }, [active, complaints, lang])

  // ---- voice entry for Aadhaar (digits) ----
  const aadhaarDict = useDictation({
    lang: 'en-IN',
    onFinal: (text) => setAadhaar(normalizeAadhaar(text)),
  })

  // ---- voice entry for captcha (letters) ----
  const captchaDict = useDictation({
    lang: 'en-IN',
    onFinal: (text) => setCaptchaInput(text.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6)),
  })

  const listenGuidance = async () => {
    if (guidancePlaying) {
      cancelSpeech()
      setGuidancePlaying(false)
      return
    }
    setGuidancePlaying(true)
    try {
      await speak(
        `कमला जी, मैंने आपका फ़ॉर्म और शिकायत का विवरण खुद भर दिया है। सरकारी सुरक्षा नियमों के अनुसार आधार नंबर और कैप्चा कोड केवल आपको दर्ज करना होगा।`,
        { lang: 'hi-IN', rate: 1 },
      )
    } finally {
      setGuidancePlaying(false)
    }
  }

  const playCaptchaAudio = () => {
    // read the captcha characters aloud so the citizen can speak/verify it
    void speak(captcha.split('').join(' '), { lang: 'en-IN', rate: 0.85 })
  }

  const canSubmit = normalizeAadhaar(aadhaar).length === 12 && captchaInput.trim().length >= 4

  return (
    <div className="app-bloom min-h-svh">
      <div className="mx-auto flex min-h-svh w-full max-w-[560px] flex-col">
        {/* ---------- Browser chrome ---------- */}
        <header className="safe-x sticky top-0 z-30 shrink-0 border-b border-line bg-card/95 pb-2.5 pt-[max(12px,env(safe-area-inset-top))] shadow-sm backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="flex size-8 items-center justify-center rounded-full text-ink transition-all hover:bg-black/5 active:scale-95"
            >
              <IconArrowLeft size={20} stroke={2.2} />
            </button>
            <div className="text-center">
              <h1 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink">
                सुरक्षित सरकारी पोर्टल
              </h1>
              <p className="text-[0.625rem] font-medium text-muted">Secure Govt Portal Sandbox</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Close portal"
              className="flex size-8 items-center justify-center rounded-full text-muted transition-all hover:bg-black/5 active:scale-95"
            >
              <IconX size={16} />
            </button>
          </div>

          {/* address bar */}
          <div className="flex items-center gap-2 rounded-xl border border-line bg-peach/40 px-2.5 py-1.5 shadow-inner">
            <div className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-100/70 px-1.5 py-0.5 text-[0.6875rem] font-medium text-emerald-700">
              <IconLock size={12} fill="currentColor" />
              <span className="text-[0.625rem] font-bold">NIC</span>
            </div>
            <div className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] tracking-tight text-muted">
              https://<span className="font-semibold text-ink">mcdonline.nic.in</span>/citizen/portal/login
            </div>
            <button aria-label="Refresh" className="text-muted/70 hover:text-ink">
              <IconRotateClockwise size={14} />
            </button>
          </div>

          {/* copilot active */}
          <div className="mt-1.5 flex items-center justify-between px-0.5 text-[0.6875rem]">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[0.625rem] font-semibold tracking-wide">🤖 AI BROWSER COPILOT ACTIVE</span>
            </div>
            <span className="font-mono text-[0.625rem] text-muted/70">TLS 1.3 • AES-256</span>
          </div>
        </header>

        {/* ---------- Scrollable body ---------- */}
        <main className="no-scrollbar flex-1 space-y-3.5 overflow-y-auto px-3 pb-6 pt-3">
          {/* AI guidance card */}
          <section className="relative overflow-hidden rounded-2xl border border-orange-200/90 bg-gradient-to-br from-[#FFF7ED] via-[#FFF3EB] to-orange-50 p-3.5 shadow-sm">
            <div className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-orange-200/30 blur-xl" />
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange to-amber-500 text-lg font-bold text-white shadow-md shadow-orange-500/20">
                ज
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-orange-600">
                    JANSETU Voice AI (जनसेतु मित्र)
                  </span>
                  <span className="rounded border border-orange-100 bg-white/80 px-1.5 py-0.5 text-[0.625rem] font-medium text-muted">
                    Live Assist
                  </span>
                </div>
                <p className="pt-0.5 text-xs font-medium leading-snug text-ink">
                  <strong className="font-semibold">कमला जी</strong>, मैंने आपका फ़ॉर्म और शिकायत का विवरण खुद भर दिया है।
                </p>
                <p className="text-[0.6875rem] leading-tight text-muted">
                  सरकारी सुरक्षा नियमों के अनुसार आधार नंबर और कैप्चा कोड केवल आपको दर्ज करना होगा।
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-orange-200/60 pt-2.5">
              <button
                onClick={() => void listenGuidance()}
                className="inline-flex items-center gap-2 rounded-full border border-orange-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition-all hover:bg-orange-50 active:scale-95"
              >
                <IconVolume size={15} className="text-orange" />
                <span>सुनें (Listen)</span>
              </button>
              <div className="flex items-center gap-0.5 px-2">
                {[10, 16, 20, 12, 18, 8].map((h, i) => (
                  <span
                    key={i}
                    className={cn('w-0.5 rounded-full', guidancePlaying ? 'bg-orange animate-[bar-bounce_0.8s_ease-in-out_infinite]' : 'bg-orange-400')}
                    style={{ height: h, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* portal window */}
          <section className="overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-sm">
            {/* gov header */}
            <div className="flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-stone-900 via-stone-800 to-[#134B70] px-3.5 py-2.5 text-white">
              <div className="flex h-7 w-1.5 shrink-0 flex-col overflow-hidden rounded-sm shadow-inner">
                <div className="h-1/3 bg-[#FF9933]" />
                <div className="h-1/3 bg-white" />
                <div className="h-1/3 bg-[#128807]" />
              </div>
              <div className="flex-1 leading-tight">
                <h2 className="text-xs font-bold tracking-wide">दिल्ली नगर निगम • MCD PORTAL</h2>
                <p className="text-[0.625rem] text-stone-300">जन शिकायत निवारण प्रणाली (Public Grievance Portal)</p>
              </div>
              <span className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[0.5625rem] text-stone-200">
                FORM 42-A
              </span>
            </div>

            <div className="space-y-4 p-3.5 text-xs">
              {/* Section A: AI-filled */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-stone-100 pb-1">
                  <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-stone-500">
                    भाग 1: स्वचालित प्रविष्टियाँ (AI Filled)
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[0.625rem] font-semibold text-emerald-700">
                    <IconCheck size={12} className="text-emerald-600" /> AI Completed
                  </span>
                </div>
                <FilledField label="आवेदक का नाम (Applicant Name)" value={filled.name} tag="✓ AI filled" />
                <FilledField label="मोबाइल संख्या (Registered Mobile)" value={filled.mobile} tag="✓ Verified OTP" mono />
                <FilledField label="शिकायत श्रेणी (Category)" value={filled.category} tag="✓ AI detected" />
                <FilledField label="वार्ड / क्षेत्र (Ward & Zone)" value={filled.ward} tag="✓ Geo-mapped" />
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[0.6875rem]">
                    <label className="font-medium text-stone-700">शिकायत विवरण (Complaint Details)</label>
                    <span className="text-[0.625rem] font-semibold text-emerald-700">✓ Voice transcribed</span>
                  </div>
                  <textarea
                    readOnly
                    rows={2}
                    value={filled.details}
                    className="w-full resize-none cursor-not-allowed rounded-lg border border-emerald-300 bg-emerald-50/40 px-2.5 py-1.5 text-xs font-normal leading-relaxed text-ink focus:outline-none"
                  />
                </div>
              </div>

              {/* Section B: secure vault (user fills) */}
              <div className="relative space-y-3 rounded-xl border-2 border-amber-400/80 bg-amber-50/70 p-3 shadow-sm">
                <div className="flex items-center gap-2 border-b border-amber-200 pb-1 text-[0.6875rem] font-bold text-amber-950">
                  <IconLock size={16} className="shrink-0 text-amber-700" />
                  <span>🔒 Citizen Credential Vault</span>
                </div>
                <p className="text-[0.625rem] leading-tight text-amber-900">
                  AI cannot view or enter passwords/captchas. Privacy is 100% protected.
                </p>

                {/* Aadhaar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[0.6875rem]">
                    <label htmlFor="aadhaar" className="font-bold text-ink">
                      आधार संख्या (Aadhaar / Citizen ID) <span className="text-coral">*</span>
                    </label>
                    <span className="text-[0.625rem] font-medium text-amber-800">आपको भरना है</span>
                  </div>
                  <div className="relative">
                    <input
                      id="aadhaar"
                      inputMode="numeric"
                      value={aadhaar}
                      onChange={(e) => setAadhaar(normalizeAadhaar(e.target.value))}
                      placeholder="xxxx xxxx xxxx"
                      className="w-full rounded-lg border-2 border-amber-500 bg-white px-3 py-2 pr-20 font-mono text-sm font-semibold tracking-wider text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                      {aadhaarDict.listening && (
                        <span className="max-w-[64px] truncate text-[0.625rem] text-amber-700">{aadhaarDict.interim}</span>
                      )}
                      <button
                        onClick={() => (aadhaarDict.listening ? aadhaarDict.stop() : aadhaarDict.start())}
                        aria-label="Speak Aadhaar"
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full transition-all active:scale-90',
                          aadhaarDict.listening ? 'bg-coral text-white' : 'bg-amber-100 text-amber-800',
                        )}
                      >
                        <IconMicrophone size={14} />
                      </button>
                      <IconPencil size={14} className="text-stone-400" />
                    </div>
                  </div>
                  {aadhaarDict.error && (
                    <p className="text-[0.625rem] text-coral">Voice unavailable — please type the number.</p>
                  )}
                </div>

                {/* Captcha */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[0.6875rem]">
                    <label htmlFor="captcha" className="font-bold text-ink">
                      सुरक्षा कोड (Security Captcha) <span className="text-coral">*</span>
                    </label>
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[0.625rem] font-bold text-red-600">
                      अनिवार्य (Mandatory)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="captcha-text flex-1 select-none rounded-lg border border-stone-400 bg-gradient-to-r from-stone-200 via-stone-100 to-stone-200 px-3 py-2 text-center text-base font-extrabold tracking-widest text-slate-800 shadow-inner">
                      {captcha}
                    </div>
                    <button
                      onClick={() => {
                        setCaptcha(randomCaptcha())
                        setCaptchaInput('')
                      }}
                      aria-label="Reload captcha"
                      className="flex size-9 items-center justify-center rounded-lg border border-stone-300 bg-stone-100 text-stone-700 transition-transform active:rotate-45"
                    >
                      <IconRotateClockwise size={16} />
                    </button>
                    <button
                      onClick={playCaptchaAudio}
                      aria-label="IconPlayerPlay audio captcha"
                      className="flex h-9 items-center gap-1 rounded-lg border border-stone-300 bg-stone-100 px-2 text-[0.6875rem] font-semibold text-stone-700"
                    >
                      <IconVolume size={14} />
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="captcha"
                      value={captchaInput}
                      maxLength={6}
                      onChange={(e) => setCaptchaInput(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
                      placeholder="Enter code above (ऊपर दिया कोड लिखें)"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 pr-11 font-mono text-xs uppercase text-ink focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange"
                    />
                    <button
                      onClick={() => (captchaDict.listening ? captchaDict.stop() : captchaDict.start())}
                      aria-label="Speak captcha"
                      className={cn(
                        'absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full transition-all active:scale-90',
                        captchaDict.listening ? 'bg-coral text-white' : 'bg-amber-100 text-amber-800',
                      )}
                    >
                      <IconMicrophone size={14} />
                    </button>
                  </div>
                  {captchaDict.listening && (
                    <p className="text-[0.625rem] text-amber-700">Listening… {captchaDict.interim}</p>
                  )}
                </div>
              </div>
            </div>

            {/* AI status ticker */}
            <div className="flex items-center gap-2 border-t border-line bg-peach/40 px-3.5 py-2 font-mono text-[0.625rem] text-muted">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
              <p className="truncate">
                <span className="font-bold text-ink">AI Status:</span>{' '}
                {canSubmit ? 'Credentials ready — AI will submit the form.' : 'Waiting for user to complete captcha...'}
              </p>
            </div>
          </section>
        </main>

        {/* ---------- Fixed action bar ---------- */}
        <footer className="safe-x z-40 shrink-0 space-y-2.5 border-t border-line bg-card p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-lg">
          <button
            disabled={!canSubmit}
            onClick={() => navigate('/preview')}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange via-[#FF6A2B] to-orange-600 px-4 py-3.5 text-sm font-bold tracking-wide text-white shadow-md shadow-orange-500/25 transition-all active:scale-[0.99]',
              canSubmit ? 'ring-4 ring-orange-300' : 'opacity-60',
            )}
          >
            <span>आगे बढ़ें और AI से सबमिट कराएं</span>
            <span className="text-xs font-semibold opacity-90">(Verify &amp; Submit)</span>
            <IconArrowRight size={16} className="ml-0.5" />
          </button>
          <div className="text-center">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted transition-colors hover:text-ink"
            >
              <IconArrowLeft size={14} />
              <span>वापस जाएं (Back to JANSETU Voice)</span>
            </button>
          </div>
          <p className="text-center text-[0.59375rem] font-medium leading-tight text-muted/70">
            🛡️ Protected by end-to-end encrypted session. Government of India compliant (IT Act 2000).
          </p>
        </footer>
      </div>
    </div>
  )
}

function FilledField({
  label,
  value,
  tag,
  mono,
}: {
  label: string
  value: string
  tag: string
  mono?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[0.6875rem]">
        <label className="font-medium text-stone-700">{label}</label>
        <span className="flex items-center gap-0.5 text-[0.625rem] font-semibold text-emerald-700">{tag}</span>
      </div>
      <input
        readOnly
        value={value}
        className={cn(
          'w-full cursor-not-allowed rounded-lg border border-emerald-300 bg-emerald-50/40 px-2.5 py-1.5 text-xs text-ink focus:outline-none',
          mono ? 'font-mono font-medium' : 'font-semibold',
        )}
      />
    </div>
  )
}