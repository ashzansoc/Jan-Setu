import { useEffect, useRef } from 'react'
import { useAudioLevel } from '@/state/conversation'
import { cn } from '@/lib/cn'

type WaveState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

/** Maps the wider orb vocabulary onto the waveform's five visual states. */
export function waveStateFor(state: string): WaveState {
  if (state === 'listening') return 'listening'
  if (state === 'speaking') return 'speaking'
  if (state === 'error') return 'error'
  if (state === 'idle' || state === 'waiting') return 'idle'
  return 'processing'
}

const BAR_COUNT = 5

/**
 * The small bar cluster under the orb. Idle and speaking use CSS loops; while
 * listening, bar heights are written directly to the DOM from the amplitude
 * store so a 60fps signal never triggers a React render.
 */
export function Waveform({
  state = 'idle',
  className,
  bars = BAR_COUNT,
}: {
  state?: WaveState
  className?: string
  bars?: number
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const listening = state === 'listening'

  useEffect(() => {
    if (!listening) return
    const root = rootRef.current
    if (!root) return
    const elements = Array.from(root.children) as HTMLElement[]
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let raf = 0
    const start = performance.now()

    const paint = () => {
      const level = useAudioLevel.getState().level
      const time = (performance.now() - start) / 1000
      elements.forEach((el, index) => {
        const centerBias = 1 - Math.abs(index - (bars - 1) / 2) / bars
        const phase = Math.sin(time * 5.6 + index * 0.85) * 0.5 + 0.5
        const amplitude = 0.22 + level * 2.4
        const scale = Math.min(1, 0.3 + amplitude * (0.45 + phase * 0.55) * (0.6 + centerBias))
        el.style.transform = `scaleY(${scale.toFixed(3)})`
      })
      raf = requestAnimationFrame(paint)
    }
    raf = requestAnimationFrame(paint)

    return () => {
      cancelAnimationFrame(raf)
      elements.forEach((el) => {
        el.style.transform = ''
      })
    }
  }, [listening, bars])

  const heights = ['h-[9px]', 'h-[16px]', 'h-[23px]', 'h-[16px]', 'h-[9px]']
  const fallback = (index: number) => heights[index % heights.length]

  return (
    <div
      ref={rootRef}
      className={cn('flex items-center justify-center gap-[4.5px]', className)}
      data-state={state}
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'w-[4.5px] origin-center rounded-full',
            bars === BAR_COUNT ? fallback(index) : 'h-[18px]',
            state === 'idle' && 'animate-[bar-bounce_1.9s_ease-in-out_infinite]',
            state === 'speaking' && 'animate-[bar-bounce_0.72s_ease-in-out_infinite]',
            state === 'processing' && 'animate-[bar-bounce_1.15s_ease-in-out_infinite]',
          )}
          style={{
            background: 'linear-gradient(180deg, #FF9A4D 0%, #FF762F 45%, #F45156 100%)',
            animationDelay: `${index * 0.13}s`,
          }}
        />
      ))}
    </div>
  )
}
