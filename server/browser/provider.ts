/**
 * BrowserProvider — the single interface every automation backend implements.
 *
 * JANSETU must not depend on one vendor: Skyvern handles visually complex
 * portals, Playwright handles deterministic reads. Both speak this contract, so
 * switching providers never changes the calling code.
 *
 * Every method is read-only unless its name says otherwise (`click`, `fill`),
 * and no provider may open a host outside the organisation registry.
 */

export type BrowserStatus =
  | 'initialising'
  | 'opening'
  | 'inspecting'
  | 'navigating'
  | 'login-required'
  | 'otp-required'
  | 'intervention-required'
  | 'completed'
  | 'failed'

export interface PageSnapshot {
  url: string
  title: string
  /** Visible text, condensed — what the user could read. */
  text: string
  /** Interactive elements the planner may act on. */
  elements: { tag: string; role?: string; name?: string; type?: string }[]
  /** Links discovered on the page, relative or absolute. */
  links: { href: string; text: string }[]
  /** True when the page looks like it is asking for credentials. */
  looksLikeLogin: boolean
  /** True when an OTP / one-time-code field is present. */
  looksLikeOtp: boolean
  capturedAt: string
}

export interface BrowserSessionInfo {
  id: string
  userId: string
  organisationId?: string
  provider: 'playwright' | 'skyvern'
  status: BrowserStatus
  currentUrl: string | null
  createdAt: string
  lastActivity: string
}

export interface BrowserProvider {
  readonly name: 'playwright' | 'skyvern'
  readonly available: boolean
  /** Why it is unavailable, when `available` is false. */
  readonly unavailableReason?: string

  createSession(input: { userId: string; organisationId?: string }): Promise<BrowserSessionInfo>
  open(sessionId: string, url: string): Promise<PageSnapshot>
  inspect(sessionId: string): Promise<PageSnapshot>
  /**
   * Consequential actions. Callers MUST have consumed an approval for the exact
   * action and payload before invoking these.
   */
  fill(sessionId: string, selector: string, value: string): Promise<{ ok: boolean; reason?: string }>
  click(sessionId: string, selector: string): Promise<{ ok: boolean; reason?: string }>
  screenshot(sessionId: string): Promise<{ base64: string; mimeType: 'image/png' }>
  history(sessionId: string): Promise<string[]>
  close(sessionId: string): Promise<void>
}