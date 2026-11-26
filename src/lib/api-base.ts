/**
 * Absolute API origin for builds that have no dev-server proxy.
 *
 * The web build uses relative `/api` paths through the Vite proxy. A bundled
 * native app has no proxy, so it targets the API on the host directly — the
 * iOS Simulator shares the host's network stack, so 127.0.0.1 resolves. The
 * Android emulator does not: there 127.0.0.1 is the guest itself, and the host
 * is only reachable through its 10.0.2.2 alias.
 */
function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  if (fromEnv) return fromEnv
  const native = window as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
  }
  if (native.Capacitor?.isNativePlatform?.()) {
    return native.Capacitor.getPlatform?.() === 'android'
      ? 'http://10.0.2.2:8787'
      : 'http://127.0.0.1:8787'
  }
  return ''
}

export const API_BASE = resolveApiBase()

/** Turns a relative API path into an absolute URL when a base is configured. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}