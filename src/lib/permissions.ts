/**
 * Device permission requests, with a single place that knows how each one can
 * fail. Every function resolves — none reject — so callers can render a state
 * instead of handling exceptions.
 *
 * iOS also needs a matching usage description in Info.plist; without one the
 * system terminates the app rather than prompting. Those live in
 * `ios/App/App/Info.plist`.
 */

export type PermissionState = 'granted' | 'denied' | 'unsupported' | 'error'

export interface PermissionResult {
  state: PermissionState
  /** A stable key the UI maps to localised copy. */
  reason?: string
}

const micDenied: PermissionResult = { state: 'denied', reason: 'micDenied' }
const micUnsupported: PermissionResult = { state: 'unsupported', reason: 'micUnavailable' }

function hasMediaDevices(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/**
 * Microphone. Uses a throwaway stream purely to trigger the system prompt, then
 * stops every track so nothing stays open.
 */
export async function requestMicrophone(): Promise<PermissionResult> {
  if (!hasMediaDevices()) return micUnsupported
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return { state: 'granted' }
  } catch (error) {
    const name = (error as { name?: string } | null)?.name
    if (name === 'NotAllowedError' || name === 'SecurityError') return micDenied
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { state: 'unsupported', reason: 'micNotFound' }
    }
    return { state: 'error', reason: 'micBusy' }
  }
}

/** Camera. Reserved for attaching photo evidence to a complaint. */
export async function requestCamera(): Promise<PermissionResult> {
  if (!hasMediaDevices()) return { state: 'unsupported', reason: 'micUnavailable' }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    stream.getTracks().forEach((track) => track.stop())
    return { state: 'granted' }
  } catch (error) {
    const name = (error as { name?: string } | null)?.name
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return { state: 'denied', reason: 'cameraDenied' }
    }
    return { state: 'error', reason: 'cameraUnavailable' }
  }
}

export interface Coords {
  latitude: number
  longitude: number
  accuracy: number
}

/** Current position, or a reason the UI can explain. */
export async function requestLocation(): Promise<
  { state: 'granted'; coords: Coords } | { state: Exclude<PermissionState, 'granted'>; reason?: string }
> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { state: 'unsupported', reason: 'locationUnsupported' }
  }
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        // A citizen should not wait ten seconds on a screen that only needs a
        // locality; the address lookup continues in the background anyway.
        timeout: 6000,
        maximumAge: 30000,
      })
    })
    return {
      state: 'granted',
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      },
    }
  } catch (error) {
    const code = (error as { code?: number } | null)?.code
    if (code === 1) return { state: 'denied', reason: 'locationDenied' }
    if (code === 3) return { state: 'error', reason: 'locationTimeout' }
    return { state: 'error', reason: 'locationUnavailable' }
  }
}

/** Browser notifications. Nothing is sent until the app has something to say. */
export async function requestNotifications(): Promise<PermissionResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { state: 'unsupported', reason: 'notificationsUnsupported' }
  }
  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') return { state: 'granted' }
    if (permission === 'denied') return { state: 'denied', reason: 'notificationsDenied' }
    return { state: 'error', reason: 'notificationsUnsupported' }
  } catch {
    return { state: 'error', reason: 'notificationsUnsupported' }
  }
}