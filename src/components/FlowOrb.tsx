import { useEffect, useRef } from 'react'
import { useAudioLevel, useSpeakingLevel } from '@/state/conversation'
import { cn } from '@/lib/cn'

/**
 * A soft, flowing "voice-mode" orb in the spirit of the OpenAI / ChatGPT
 * voice assistant: a pearlescent sphere whose surface gently morphs and
 * ripples, reacting to microphone amplitude. Warm JANSETU palette, no hard
 * edges — a calm, living blob rather than a particle field or a flat disc.
 *
 * Rendered on Canvas 2D: a closed path built from layered sine/noise harmonics
 * (so the silhouette undulates organically), filled with a soft radial
 * gradient + a slow internal "flow" highlight. Audio level is read straight
 * from the store each frame — no React re-renders.
 */
/**
 * The full JANSETU orb vocabulary. Each state is driven by a real application
 * or audio event — never by a timer.
 */
export type OrbState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'understanding'
  | 'thinking'
  | 'planning'
  | 'clarifying'
  | 'working'
  | 'waiting'
  | 'speaking'
  | 'success'
  | 'error'

const TAU = Math.PI * 2

interface FlowOrbProps {
  state: OrbState
  onClick?: () => void
  label: string
  disabled?: boolean
}

export function FlowOrb({ state, onClick, label, disabled }: FlowOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0
    // smoothed amplitude so the blob eases rather than jitters
    let smoothAmp = 0

    const draw = (now: number) => {
      resize()
      const t = (now - start) / 1000
      const st = stateRef.current
      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2
      const R = Math.min(W, H) / 2

      // ---- state + audio ----
      const targetAmp =
        st === 'listening'
          ? useAudioLevel.getState().level
          : st === 'speaking'
            ? useSpeakingLevel.getState().level
            : 0
      smoothAmp += (targetAmp - smoothAmp) * 0.2
      let speed = 0.6
      let baseWobble = 0.05
      let glow = 0.5
      if (st === 'idle') {
        speed = 0.5
        baseWobble = 0.045
      } else if (st === 'listening') {
        speed = 0.9
        baseWobble = 0.06 + smoothAmp * 0.14
        glow = 0.5 + smoothAmp * 0.4
      } else if (st === 'speaking') {
        speed = 1.1
        baseWobble = 0.07 + smoothAmp * 0.12
        glow = 0.55 + smoothAmp * 0.3
      } else if (st === 'success') {
        speed = 0.8
        baseWobble = 0.05
        glow = 0.7
      } else if (st === 'error') {
        speed = 0.4
        baseWobble = 0.03
        glow = 0.4
      } else if (st === 'waiting') {
        speed = 0.35
        baseWobble = 0.035
        glow = 0.45
      } else {
        // transcribing, understanding, thinking, planning, clarifying, working
        speed = 1.4
        baseWobble = 0.08
        glow = 0.55 + 0.15 * Math.sin(t * 3)
      }
      const breathe = 1 + 0.02 * Math.sin(t * 1.1) + smoothAmp * 0.05

      ctx.clearRect(0, 0, W, H)

      // ---- soft outer glow ----
      const glowR = R * (1.0 + smoothAmp * 0.1)
      const og = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, glowR)
      og.addColorStop(0, `rgba(255,138,61,${(0.3 * glow).toFixed(3)})`)
      og.addColorStop(0.7, `rgba(244,81,98,${(0.14 * glow).toFixed(3)})`)
      og.addColorStop(1, 'rgba(244,81,98,0)')
      ctx.fillStyle = og
      ctx.fillRect(0, 0, W, H)

      // ---- flowing blob silhouette (layered harmonics) ----
      const N = 160
      ctx.beginPath()
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * TAU
        // organic multi-frequency wobble around the circle
        const wob =
          Math.sin(a * 2 + t * speed) * baseWobble +
          Math.sin(a * 3 - t * speed * 0.8 + 1.3) * baseWobble * 0.6 +
          Math.sin(a * 5 + t * speed * 1.2 + 2.1) * baseWobble * 0.35 +
          Math.cos(a * 4 - t * speed * 0.6) * baseWobble * 0.4
        const rad = R * 0.82 * breathe * (1 + wob)
        const x = cx + Math.cos(a) * rad
        const y = cy + Math.sin(a) * rad
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()

      // pearlescent warm gradient body
      const bg = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R)
      bg.addColorStop(0, '#FFE3D2') // warm ivory-peach highlight
      bg.addColorStop(0.4, '#FFB27A') // soft orange
      bg.addColorStop(0.78, '#F25621') // primary orange
      bg.addColorStop(1, '#D93E1E') // deeper orange edge
      ctx.fillStyle = bg
      ctx.fill()

      // ---- slow internal flow highlight (the "living" sheen) ----
      ctx.save()
      ctx.clip()
      const fx = cx + Math.cos(t * 0.6) * R * 0.3
      const fy = cy + Math.sin(t * 0.8) * R * 0.3
      const flow = ctx.createRadialGradient(fx, fy, 0, fx, fy, R * 0.9)
      flow.addColorStop(0, 'rgba(255,255,255,0.35)')
      flow.addColorStop(0.5, 'rgba(255,220,190,0.12)')
      flow.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = flow
      ctx.fillRect(0, 0, W, H)

      // top-left specular sheen
      const spec = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, 0, cx - R * 0.35, cy - R * 0.4, R * 0.6)
      spec.addColorStop(0, 'rgba(255,255,255,0.5)')
      spec.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = spec
      ctx.fillRect(0, 0, W, H)
      ctx.restore()

      if (!reduced) raf = requestAnimationFrame(draw)
    }

    if (reduced) draw(start)
    else raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="relative mx-auto flex w-full items-center justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={state === 'listening'}
        data-state={state}
        className={cn(
          'group relative mx-auto aspect-square select-none',
          'w-[clamp(250px,72vw,340px)]',
          'transition-transform duration-200 active:scale-[0.985] disabled:cursor-not-allowed',
          disabled && 'opacity-70',
        )}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      </button>
    </div>
  )
}