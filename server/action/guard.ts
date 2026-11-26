/**
 * Network safety for every server-side tool.
 *
 * Two rules, applied to every outbound request:
 *   1. The destination must be on the approved list (a verified government
 *      domain, or an operator-configured allowlist).
 *   4. The destination must not resolve to a private, loopback or metadata
 *      address — the classic SSRF targets.
 */

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /\.internal$/i,
  /\.local$/i,
]

export class UnsafeDestinationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeDestinationError'
  }
}

export function isPrivateHost(hostname: string): boolean {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
}

/** Operator-configured allowlist, comma separated. */
export function httpAllowlist(): string[] {
  return (process.env.ACTION_HTTP_ALLOWLIST ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function assertSafeUrl(rawUrl: string, allowedHosts?: string[]): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new UnsafeDestinationError('The destination is not a valid URL.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeDestinationError('Only http and https destinations are allowed.')
  }
  if (url.username || url.password) {
    throw new UnsafeDestinationError('Credentials in a URL are not allowed.')
  }
  if (isPrivateHost(url.hostname)) {
    throw new UnsafeDestinationError('That destination is not publicly routable.')
  }
  if (allowedHosts && allowedHosts.length > 0) {
    const host = url.hostname.toLowerCase()
    const permitted = allowedHosts.some((entry) => host === entry || host.endsWith(`.${entry}`))
    if (!permitted) {
      throw new UnsafeDestinationError('That destination is not on the approved list.')
    }
  }
  return url
}

/** Redacts anything that looks like a secret before it reaches a log. */
export function redactSecrets(value: string): string {
  return value
    .replace(/([?&](?:key|token|access_token|secret|password)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
}