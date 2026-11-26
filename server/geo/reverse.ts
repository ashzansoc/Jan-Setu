/**
 * Reverse geocoding — coordinates to a human address.
 *
 * Uses OpenStreetMap's Nominatim, which needs no API key but does require a
 * descriptive User-Agent and at most one request per second. Results are cached
 * per rounded coordinate so repeat lookups never hit the upstream service.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const USER_AGENT = 'JANSETU/0.1 (civic complaint app; contact: support@jansetu.local)'

export interface ReverseGeocodeResult {
  /** Short, speakable form: "Greater Kailash 2, New Delhi". */
  label: string
  /** The full address line from the provider, when available. */
  full: string | null
  locality: string | null
  city: string | null
  postcode: string | null
}

const cache = new Map<string, ReverseGeocodeResult>()
let lastCall = 0

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Keeps us inside Nominatim's one-request-per-second policy. */
async function throttle() {
  const now = Date.now()
  const wait = 1000 - (now - lastCall)
  if (wait > 0) await sleep(wait)
  lastCall = Date.now()
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`
  const hit = cache.get(key)
  if (hit) return hit

  await throttle()

  let response: Response
  try {
    response = await fetch(
      `${ENDPOINT}?format=jsonv2&zoom=16&addressdetails=1&lat=${lat}&lon=${lon}`,
      { headers: { 'User-Agent': USER_AGENT, accept: 'application/json' } },
    )
  } catch {
    return null
  }

  if (!response.ok) {
    console.warn('[jansetu geo] reverse lookup failed', response.status)
    return null
  }

  const data = (await response.json()) as {
    display_name?: string
    address?: Record<string, string>
  }

  const address = data.address ?? {}
  const locality =
    address.neighbourhood ?? address.suburb ?? address.village ?? address.hamlet ?? address.city_district ?? null
  const city = address.city ?? address.town ?? address.state_district ?? address.state ?? null

  // Prefer the parts a citizen would recognise and say aloud.
  const labelParts = [locality, city].filter(Boolean) as string[]
  const label = labelParts.length ? labelParts.join(', ') : (data.display_name ?? '').split(',').slice(0, 2).join(', ')

  if (!label) return null

  const result: ReverseGeocodeResult = {
    label,
    full: data.display_name ?? null,
    locality,
    city,
    postcode: address.postcode ?? null,
  }
  cache.set(key, result)
  return result
}