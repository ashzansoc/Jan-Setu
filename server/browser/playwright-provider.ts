import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { isApprovedHost } from '../action/org-registry.js'
import { isPrivateHost } from '../action/guard.js'
import type { BrowserProvider, BrowserSessionInfo, PageSnapshot } from './provider.js'

/**
 * Deterministic browser execution with Playwright.
 *
 * Guardrails, all enforced before a page is opened:
 * - the host must be in the organisation registry,
 * - the host must not resolve to a private/loopback/metadata address,
 * - only http(s) is allowed.
 *
 * Each session gets its own isolated BrowserContext, so cookies, storage and
 * downloads never leak between users.
 */

interface InternalSession {
  info: BrowserSessionInfo
  context: BrowserContext
  page: Page
}

const sessions = new Map<string, InternalSession>()
let browserPromise: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = chromium.launch({ headless: true })
  return browserPromise
}

function assertNavigable(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('invalid-url')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('scheme-not-allowed')
  if (isPrivateHost(parsed.hostname)) throw new Error('private-host-blocked')
  if (!isApprovedHost(parsed.hostname)) throw new Error('host-not-approved')
}

const LOGIN_HINTS = /sign in|log in|login|password|username|user id|consumer number/i
const OTP_HINTS = /otp|one[- ]time password|verification code|enter the code/i

async function snapshot(page: Page): Promise<PageSnapshot> {
  const url = page.url()
  const title = await page.title().catch(() => '')

  const text = await page
    .evaluate(() => {
      const doc = (globalThis as unknown as { document: any }).document
      const body = doc.body
      if (!body) return ''
      const clone = body.cloneNode(true)
      clone.querySelectorAll('script,style,noscript,svg').forEach((node: any) => node.remove())
      return String(clone.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 4000)
    })
    .catch(() => '')

  const elements = await page
    .evaluate(() => {
      const doc = (globalThis as unknown as { document: any }).document
      return Array.from(doc.querySelectorAll('input,button,select,textarea,a[role="button"]'))
        .slice(0, 60)
        .map((element: any) => ({
          tag: String(element.tagName).toLowerCase(),
          role: element.getAttribute('role') ?? undefined,
          name:
            (element.getAttribute('aria-label') ||
              element.getAttribute('name') ||
              element.getAttribute('placeholder') ||
              String(element.textContent ?? '').trim())?.slice(0, 60) || undefined,
          type: element.getAttribute('type') ?? undefined,
        }))
    })
    .catch(() => [])

  const links = await page
    .evaluate(() => {
      const doc = (globalThis as unknown as { document: any }).document
      return Array.from(doc.querySelectorAll('a[href]'))
        .slice(0, 80)
        .map((anchor: any) => ({
          href: String(anchor.href),
          text: String(anchor.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
        }))
        .filter((link: { href: string }) => link.href.startsWith('http'))
    })
    .catch(() => [])

  const hasPassword = await page
    .evaluate(() => {
      const doc = (globalThis as unknown as { document: any }).document
      return !!doc.querySelector('input[type="password"]')
    })
    .catch(() => false)
  const hasOtp = await page
    .evaluate(() => {
      const doc = (globalThis as unknown as { document: any }).document
      return !!doc.querySelector('input[autocomplete="one-time-code"], input[name*="otp" i]')
    })
    .catch(() => false)

  return {
    url,
    title,
    text,
    elements,
    links,
    looksLikeLogin: hasPassword || LOGIN_HINTS.test(`${title} ${text.slice(0, 400)}`),
    looksLikeOtp: hasOtp || OTP_HINTS.test(`${title} ${text.slice(0, 400)}`),
    capturedAt: new Date().toISOString(),
  }
}

export const playwrightProvider: BrowserProvider = {
  name: 'playwright',
  available: true,

  async createSession({ userId, organisationId }) {
    const browser = await getBrowser()
    const context = await browser.newContext({
      userAgent: 'JANSETU/0.1 (civic service assistant; contact: support@jansetu.local)',
      viewport: { width: 1280, height: 900 },
      // Isolated per session: no shared storage, no persisted cookies.
      storageState: undefined,
    })
    const page = await context.newPage()
    const id = `bs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()
    const info: BrowserSessionInfo = {
      id,
      userId,
      organisationId,
      provider: 'playwright',
      status: 'initialising',
      currentUrl: null,
      createdAt: now,
      lastActivity: now,
    }
    sessions.set(id, { info, context, page })
    return info
  },

  async open(sessionId, url) {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('no-session')
    assertNavigable(url)

    session.info.status = 'opening'
    await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })

    // A redirect can leave the approved list — re-validate where we actually landed.
    const landed = session.page.url()
    try {
      assertNavigable(landed)
    } catch (error) {
      await session.page.goto('about:blank').catch(() => {})
      throw new Error(`redirect-not-approved: ${new URL(landed).host}`)
    }

    session.info.status = 'inspecting'
    session.info.currentUrl = session.page.url()
    session.info.lastActivity = new Date().toISOString()

    const result = await snapshot(session.page)
    session.info.status = result.looksLikeLogin
      ? 'login-required'
      : result.looksLikeOtp
        ? 'otp-required'
        : 'completed'
    return result
  },

  async inspect(sessionId) {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('no-session')
    session.info.lastActivity = new Date().toISOString()
    return snapshot(session.page)
  },

  async fill(sessionId, selector, value) {
    const session = sessions.get(sessionId)
    if (!session) return { ok: false, reason: 'no-session' }
    try {
      await session.page.fill(selector, value, { timeout: 8000 })
      session.info.lastActivity = new Date().toISOString()
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: (error as Error).message.slice(0, 120) }
    }
  },

  async click(sessionId, selector) {
    const session = sessions.get(sessionId)
    if (!session) return { ok: false, reason: 'no-session' }
    try {
      await session.page.click(selector, { timeout: 8000 })
      session.info.lastActivity = new Date().toISOString()
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: (error as Error).message.slice(0, 120) }
    }
  },

  async screenshot(sessionId) {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('no-session')
    const buffer = await session.page.screenshot({ type: 'png', fullPage: false })
    return { base64: buffer.toString('base64'), mimeType: 'image/png' }
  },

  async history(sessionId) {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('no-session')
    return session.page.context().pages().map((page) => page.url())
  },

  async close(sessionId) {
    const session = sessions.get(sessionId)
    if (!session) return
    await session.context.close().catch(() => {})
    sessions.delete(sessionId)
  },
}

/** Session handed to the client — never exposes the Playwright objects. */
export function sessionInfo(sessionId: string): BrowserSessionInfo | null {
  return sessions.get(sessionId)?.info ?? null
}

export function listSessions(): BrowserSessionInfo[] {
  return Array.from(sessions.values()).map((session) => session.info)
}