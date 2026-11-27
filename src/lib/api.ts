/**
 * Absolute API origin, when one is configured.
 *
 * The web build uses relative `/api` paths through the Vite proxy. A packaged
 * app has no proxy and no guaranteed server, so it stays empty unless
 * `VITE_API_BASE_URL` is set at build time. Empty means standalone: on-device
 * speech, the local intent engine, on-device storage and direct OpenStreetMap.
 */
export function resolveApiBase(): string {
  return import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
}

export const API_BASE = resolveApiBase()