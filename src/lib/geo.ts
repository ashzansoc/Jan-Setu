import { apiUrl } from './api-base'
import type { Coords } from './permissions'

export interface GeoAddress {
  /** Short, speakable form: "Greater Kailash 2, New Delhi". */
  label: string
  full: string | null
  locality: string | null
  city: string | null
  postcode: string | null
}

/**
 * Coordinates → a human address, through the API's Nominatim proxy.
 *
 * Returns null when the API is unreachable or the lookup fails, so the caller
 * can fall back to the raw coordinates rather than inventing an address.
 */
export async function reverseGeocode(coords: Coords): Promise<GeoAddress | null> {
  const query = `?lat=${coords.latitude}&lon=${coords.longitude}`
  try {
    const response = await fetch(apiUrl(`/api/geo/reverse${query}`), {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { ok?: boolean } & Partial<GeoAddress>
    if (!data.ok || !data.label) return null
    return {
      label: data.label,
      full: data.full ?? null,
      locality: data.locality ?? null,
      city: data.city ?? null,
      postcode: data.postcode ?? null,
    }
  } catch {
    return null
  }
}