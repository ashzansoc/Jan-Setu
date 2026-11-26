/**
 * Absolute API origin for builds without a dev-server proxy.
 *
 * The web build uses relative `/api` paths through the Vite proxy. A bundled
 * native app has no proxy, so it targets the API on the host directly (the iOS
 * Simulator shares the host network, so 127.0.0.1 resolves).
 */
export function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  if (fromEnv) return fromEnv
  const native = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  if (native?.isNativePlatform?.()) return 'http://127.0.0.1:8787'
  return ''
}

export const API_BASE = resolveApiBase()