/**
 * Absolute API origin for builds that have no dev-server proxy.
 *
 * The web build uses relative `/api` paths through the Vite proxy. A packaged
 * app has no proxy, so it only calls a server when one is explicitly configured
 * with `VITE_API_BASE_URL`. With no server the app runs standalone: on-device
 * speech, the local intent engine, on-device storage and direct OpenStreetMap.
 */
function resolveApiBase(): string {
  return import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
}

export const API_BASE = resolveApiBase()

/** Turns a relative API path into an absolute URL when a base is configured. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}