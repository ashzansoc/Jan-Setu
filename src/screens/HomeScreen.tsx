import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconChevronRight, IconKeyboard, IconMapPin, IconMicrophone, IconRotateClockwise, IconSparkles, IconSquare } from '@tabler/icons-react'
import { Header } from '@/components/Header'
import { Greeting } from '@/components/Greeting'
import { FlowOrb, type OrbState } from '@/components/FlowOrb'
import { Waveform, waveStateFor } from '@/components/Waveform'
import { SuggestCards } from '@/components/SuggestCards'
import { ActiveComplaintCard } from '@/components/ActiveComplaintCard'
import { TypeInsteadSheet } from '@/components/TypeInsteadSheet'
import { ActiveTaskCard } from '@/components/action/ActiveTaskCard'
import { SectionLabel } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useComplaints, pickActive } from '@/state/complaints'
import { useActions } from '@/lib/action/store'
import { useConversation } from '@/state/conversation'
import { useSettings } from '@/state/settings'
import { inferAvatar } from '@/lib/avatar/infer'
import { useDict, useUiLang } from '@/lib/i18n'
import { requestLocation } from '@/lib/permissions'
import { reverseGeocode } from '@/lib/geo'
import {
  beginListening,
  cancelConversation,
  finishListening,
  speakStatus,
  startWith,
  stopCapture,
  ingestText,
} from '@/lib/flow'
import { CATEGORY_LABEL } from '@/lib/complaints/types'
import { cn } from '@/lib/cn'

function orbStateFor(
  phase: ReturnType<typeof useConversation.getState>['phase'],
): OrbState {
  switch (phase) {
    case 'listening':
      return 'listening'
    case 'processing':
      return 'understanding'
    case 'clarifying':
      return 'speaking'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}

export function HomeScreen() {
  const d = useDict()
  const lang = useUiLang()
  const navigate = useNavigate()
  const [typeOpen, setTypeOpen] = useState(false)
  const clarifyRef = useRef<HTMLDivElement>(null)
  const [hearing, setHearing] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locNote, setLocNote] = useState<string | null>(null)

  const phase = useConversation((s) => s.phase)
  const interim = useConversation((s) => s.interim)
  const question = useConversation((s) => s.question)
  const turns = useConversation((s) => s.turns)
  const errorKey = useConversation((s) => s.errorKey)

  const complaints = useComplaints((s) => s.complaints)
  const activeTask = useActions((s) => s.tasks.find((t) => t.state !== 'completed' && t.state !== 'cancelled' && t.state !== 'failed'))
  const hydrate = useComplaints((s) => s.hydrate)
  const refresh = useComplaints((s) => s.refresh)

  const userName = useSettings((s) => s.name)
  const avatarPhoto = useSettings((s) => s.avatarPhoto)
  const avatarInferredForName = useSettings((s) => s.avatarInferredForName)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Name-driven memoji: infer gender + guessed age once per name, then pick the
  // matching face. A user-uploaded photo always wins. Inference is by the model
  // when the API is up, with a local heuristic fallback, so this never blocks.
  useEffect(() => {
    const nm = userName?.trim()
    if (!nm || avatarPhoto || avatarInferredForName === nm) return
    let cancelled = false
    inferAvatar(nm)
      .then((id) => {
        if (cancelled || !id) return
        const s = useSettings.getState()
        s.setAvatar(id)
        s.markAvatarInferred(nm)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userName, avatarPhoto, avatarInferredForName])

  const active = pickActive(complaints)

  // Silently ask the connector whether anything advanced. Never invents a stage.
  useEffect(() => {
    if (!active?.reference) return
    const timer = window.setTimeout(() => {
      void refresh(active.id)
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [active?.id, active?.reference, refresh])

  useEffect(
    () => () => {
      const current = useConversation.getState().phase
      // Navigating away mid-turn must stop the mic; navigating after the draft
      // is ready should let the spoken confirmation finish.
      if (current === 'listening' || current === 'processing' || current === 'clarifying') {
        cancelConversation()
      } else {
        stopCapture()
      }
    },
    [],
  )

  // A clarification often lands below the fold on a short phone; bring it up.
  useEffect(() => {
    if (phase !== 'clarifying') return
    const timer = window.setTimeout(() => {
      clarifyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 420)
    return () => window.clearTimeout(timer)
  }, [phase, question])

  const orbState = orbStateFor(phase)
  const busy = phase === 'listening' || phase === 'processing' || phase === 'clarifying'

  const handleOrb = () => {
    if (phase === 'listening') {
      finishListening()
      return
    }
    if (busy) return
    if (phase === 'error') {
      cancelConversation()
      void beginListening()
      return
    }
    startWith()
  }

  /**
   * Location permission, wired to the clarification that asks for it. Without a
   * reverse geocoder the coordinates are the answer — precise, and never a
   * fabricated address.
   */
  const useCurrentLocation = async () => {
    setLocating(true)
    setLocNote(null)
    const result = await requestLocation()
    setLocating(false)
    if (result.state === 'granted') {
      // Prefer a human address; fall back to precise coordinates if the
      // geocoder is unreachable, never to an invented address.
      const address = await reverseGeocode(result.coords)
      if (address) {
        ingestText(address.label)
        return
      }
      const { latitude, longitude } = result.coords
      ingestText(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
      return
    }
    const key = (result.reason ?? 'locationUnavailable') as keyof typeof d.permissions
    setLocNote(typeof d.permissions[key] === 'string' ? (d.permissions[key] as string) : d.permissions.locationUnavailable)
  }

  const hearStatus = async () => {
    if (!active) return
    const stageLabel = d.lifecycle[active.status]
    setHearing(true)
    await speakStatus(
      active.reference ? d.tts.status(stageLabel, active.reference) : d.tts.statusNoRef(stageLabel),
    )
    setHearing(false)
  }

  const lastAssistant = [...turns].reverse().find((turn) => turn.role === 'assistant')
  const clarifying = phase === 'clarifying' && question !== null
  const caption =
    orbState === 'listening'
      ? d.home.listening
      : orbState === 'understanding' || orbState === 'thinking'
        ? d.home.processing
        : clarifying
          ? d.home.yourTurn
          : orbState === 'speaking'
            ? d.home.speaking
            : d.home.tapToSpeak

  return (
    <div className="app-bloom min-h-svh">
      <div className="mx-auto w-full max-w-[560px] pb-[calc(104px+env(safe-area-inset-bottom))]">
        <Header />
        <Greeting />

        {/* ---- Microphone ---- */}
        <section className="mt-1 flex flex-col items-center" aria-label={d.home.tapToSpeak}>
          <FlowOrb
            state={orbState}
            onClick={handleOrb}
            label={orbState === 'listening' ? d.home.tapToStop : d.home.tapToSpeak}
            disabled={phase === 'processing'}
          />

          <Waveform state={waveStateFor(orbState)} className="mt-2.5" />

          <div className="safe-x mt-2.5 min-h-[72px] w-full text-center" aria-live="polite">
            {orbState === 'listening' && (
              <>
                <p className={cn('mx-auto max-w-[330px] line-clamp-2 text-[0.9375rem] leading-relaxed text-ink/80', lang === 'hi' && 'deva')}>
                  {interim || '…'}
                </p>
                <button
                  type="button"
                  onClick={() => finishListening()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[0.78125rem] font-semibold text-white"
                >
                  <IconSquare size={11} fill="currentColor" stroke={0} />
                  {d.home.tapToStop}
                </button>
              </>
            )}

            {(orbState === 'idle' || orbState === 'speaking') && (
              <>
                <p className="text-[1.1875rem] font-bold leading-tight text-ink">{caption}</p>
                <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted">{d.home.supported}</p>
              </>
            )}

            {(orbState === 'understanding' || orbState === 'thinking') && (
              <p className="text-[1rem] font-semibold text-ink/80">{d.home.processing}</p>
            )}

            {orbState === 'error' && (
              <div className="mx-auto max-w-[330px]">
                <p className={cn('text-[0.84375rem] leading-relaxed text-[#8A4A3A]', lang === 'hi' && 'deva')}>
                  {errorKey ? d.errors[errorKey] : d.errors.generic}
                </p>
                <div className="mt-2.5 flex justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<IconRotateClockwise size={14} stroke={2.4} />}
                    onClick={() => {
                      cancelConversation()
                      void beginListening()
                    }}
                  >
                    {d.actions.retry}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-indigo"
                    icon={<IconKeyboard size={15} stroke={2.2} />}
                    onClick={() => setTypeOpen(true)}
                  >
                    {d.home.typeInstead}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* clarifying turn */}
          {clarifying && (
            <div ref={clarifyRef} className="safe-x mt-1 w-full scroll-mb-28">
              <div className="rounded-2xl border border-indigo/15 bg-white/85 px-4 py-3 text-center shadow-chip">
                <p className={cn('text-[0.875rem] font-medium leading-relaxed text-ink/85', lang === 'hi' && 'deva')}>
                  {d.clarify[question]}
                </p>
                <div className="mt-2.5 flex justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => void beginListening()}
                    icon={<IconMicrophone size={14} stroke={2.4} />}
                  >
                    {d.actions.speakAnswer}
                  </Button>
                  {question === 'location' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-indigo"
                      icon={<IconMapPin size={14} stroke={2.2} />}
                      onClick={() => void useCurrentLocation()}
                    >
                      {locating ? d.permissions.locating : d.permissions.useCurrentLocation}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-indigo"
                    icon={<IconKeyboard size={15} stroke={2.2} />}
                    onClick={() => setTypeOpen(true)}
                  >
                    {d.home.typeInstead}
                  </Button>
                </div>
                {locNote && (
                  <p className="mt-2 text-[0.6875rem] leading-relaxed text-[#8A4A3A]">{locNote}</p>
                )}
              </div>
            </div>
          )}

          {/* Type instead — reachable through every state except processing.
              Not rendered while the clarification card or error block, which
              carry their own button, is on screen (avoids a phantom gap). */}
          {!clarifying && orbState !== 'error' && (
            <button
              type="button"
              onClick={() => setTypeOpen(true)}
              disabled={phase === 'processing'}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.84375rem] font-semibold text-indigo transition-colors hover:bg-indigo/[0.06] active:scale-95 disabled:pointer-events-none disabled:text-indigo/40"
            >
              <IconKeyboard size={16} stroke={2.2} />
              {d.home.typeInstead}
            </button>
          )}
        </section>

        {/* ---- Try saying ---- */}
        <section className="mt-3">
          <div className="safe-x mb-2.5 flex items-center justify-between">
            <SectionLabel>{d.home.trySaying}</SectionLabel>
          </div>
          <SuggestCards onPick={(utterance) => startWith(utterance)} />
        </section>

        {/* ---- Active task (only while the engine is working) ---- */}
        {activeTask && <ActiveTaskCard task={activeTask} />}

        {/* ---- Active complaint ---- */}
        <section className="safe-x mt-6">
          <div className="mb-2.5 flex items-center justify-between">
            <SectionLabel>{d.home.activeComplaint}</SectionLabel>
            <div className="flex items-center gap-3">
              <Link
                to="/filing"
                className="inline-flex items-center gap-1 rounded-full bg-peach px-2.5 py-1 text-[0.75rem] font-semibold text-orange active:scale-95"
              >
                <IconSparkles size={13} stroke={2.4} /> Assisted Filing
              </Link>
              {complaints.length > 0 && (
                <Link
                  to="/complaints"
                  className="inline-flex items-center gap-0.5 text-[0.8125rem] font-semibold text-indigo"
                >
                  {d.home.viewAll}
                  <IconChevronRight size={14} stroke={2.6} />
                </Link>
              )}
            </div>
          </div>

          {active ? (
            <ActiveComplaintCard
              complaint={active}
              hearing={hearing}
              onReplay={() => navigate(`/replay/${active.id}`)}
              onHear={() => void hearStatus()}
            />
          ) : (
            <div className="rounded-card border border-dashed border-line-strong bg-white/60 px-5 py-7 text-center">
              <p className="deva text-[0.875rem] leading-relaxed text-muted">{d.complaints.empty}</p>
            </div>
          )}

          <p className="mt-3 px-1 text-center text-[0.71875rem] leading-relaxed text-muted">
            {d.home.footerNote}
          </p>
        </section>

        {active && (
          <p className="safe-x mt-2.5 text-center text-[0.6875rem] leading-relaxed text-muted/80">
            {d.verification.sandboxNote}
          </p>
        )}

        <TypeInsteadSheet open={typeOpen} onClose={() => setTypeOpen(false)} />

        {/* live-region summary for assistive tech */}
        <p className="sr-only" aria-live="polite">
          {lastAssistant?.text ?? ''}
        </p>
        {/* ensures the active complaint's category is announced in the current language */}
        <p className="sr-only">
          {active ? `${d.home.activeComplaint}: ${CATEGORY_LABEL[active.category][lang]}` : ''}
        </p>
      </div>
    </div>
  )
}
