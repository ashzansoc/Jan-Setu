/**
 * Live microphone level, used to make the concentric rings breathe with the
 * user's voice. If the browser refuses a second audio stream we simply report
 * nothing and the UI keeps its CSS pulse — the orb never looks broken.
 */

export interface LevelSession {
  stop: () => void
  /** True once a real audio stream is being measured. */
  readonly live: boolean
}

type LevelListener = (level: number) => void

export async function startLevels(
  onLevel: LevelListener,
  options: { smooth?: number } = {},
): Promise<LevelSession> {
  const smooth = options.smooth ?? 0.55
  let live = false
  let audioContext: AudioContext | null = null
  let stream: MediaStream | null = null
  let raf = 0
  let smoothed = 0

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { stop() {}, get live() { return false } }
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch {
    return { stop() {}, get live() { return false } }
  }

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) {
    stream.getTracks().forEach((t) => t.stop())
    return { stop() {}, get live() { return false } }
  }

  audioContext = new Ctor()
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.75
  source.connect(analyser)
  const buffer = new Float32Array(analyser.fftSize)
  live = true

  const tick = () => {
    analyser.getFloatTimeDomainData(buffer)
    let sum = 0
    for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i]
    const rms = Math.sqrt(sum / buffer.length)
    // Map speech RMS (~0.01–0.25) onto a usable 0–1 range.
    const target = Math.min(1, Math.max(0, (rms - 0.008) * 7.5))
    smoothed += (target - smoothed) * (1 - smooth)
    onLevel(smoothed)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  const stop = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close()
    }
    audioContext = null
    onLevel(0)
  }

  return {
    stop,
    get live() {
      return live
    },
  }
}
