import { API_BASE, apiUrl } from './api-base'
import type { Coords } from './permissions'

export interface GeoAddress {
  /** Short, speakable form: "Greater Kailash 2, New Delhi". */
  label: string
  full: string | null
  locality: string | null
  city: string | null
  postcode: string | null
}

/** OpenStreetMap's public endpoint — no key, CORS-enabled, one request a second. */
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse'

/** Repeat lookups for the same spot are free and instant. */
const cache = new Map<string, GeoAddress>()
let lastCall = 0

interface NominatimAddress {
  suburb?: string
  neighbourhood?: string
  quarter?: string
  city_district?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
  state?: string
  postcode?: string
  road?: string
}

function parseNominatim(data: { display_name?: string; address?: NominatimAddress }): GeoAddress | null {
  const a = data.address ?? {}
  const locality = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? a.city ?? a.town ?? a.village ?? null
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.state ?? null
  const label = locality ?? city
  if (!data.display_name && !label) return null
  return {
    label: label ?? data.display_name ?? '',
    full: data.display_name ?? null,
    locality,
    city,
    postcode: a.postcode ?? null,
  }
}

/** Keeps us inside Nominatim's one-request-per-second policy. */
async function throttle() {
  const wait = 1000 - (Date.now() - lastCall)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastCall = Date.now()
}

/**
 * Coordinates → a human address.
 *
 * Uses the API's proxy when one is configured (so the provider's user agent and
 * rate limiting stay server-side), and otherwise talks to OpenStreetMap
 * directly. That keeps a packaged app working with no backend at all.
 *
 * Returns null when every path fails, so the caller can fall back to the raw
 * coordinates rather than inventing an address.
 */
export async function reverseGeocode(coords: Coords): Promise<GeoAddress | null> {
  const key = `${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)}`
  const hit = cache.get(key)
  if (hit) return hit

  if (API_BASE) {
    try {
      const response = await fetch(apiUrl(`/api/geo/reverse?lat=${coords.latitude}&lon=${coords.longitude}`), {
        headers: { accept: 'application/json' },
      })
      if (response.ok) {
        const data = (await response.json()) as { ok?: boolean } & Partial<GeoAddress>
        if (data.ok && data.label) {
          const resolved: GeoAddress = {
            label: data.label,
            full: data.full ?? null,
            locality: data.locality ?? null,
            city: data.city ?? null,
            postcode: data.postcode ?? null,
          }
          cache.set(key, resolved)
          return resolved
        }
      }
    } catch {
      // Fall through to the direct lookup.
    }
  }

  try {
    await throttle()
    const response = await fetch(
      `${NOMINATIM}?format=jsonv2&zoom=16&addressdetails=1&lat=${coords.latitude}&lon=${coords.longitude}`,
      { headers: { accept: 'application/json' } },
    )
    if (!response.ok) return null
    const resolved = parseNominatim((await response.json()) as { display_name?: string; address?: NominatimAddress })
    if (resolved) cache.set(key, resolved)
    return resolved
  } catch {
    return null
  }
}