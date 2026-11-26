/**
 * Behavioural QA: onboarding from a clean slate, text-to-speech wiring, and
 * every navigation destination. Run with the dev server up.
 */
import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173'
async function fillProfile(p) {
  const nameBtn = p.locator('button[aria-label*="Edit Name"]')
  if (await nameBtn.count()) {
    await nameBtn.click()
    await p.waitForTimeout(250)
    await p.locator('input').last().fill('Kamla Devi')
    await p.getByRole('button', { name: /सहेजें|Save/ }).click()
    await p.waitForTimeout(250)
  }
  const phoneBtn = p.locator('button[aria-label*="Mobile Number"]')
  if (await phoneBtn.count()) {
    await phoneBtn.click()
    await p.waitForTimeout(250)
    await p.locator('input').last().fill('9811054421')
    await p.getByRole('button', { name: /सहेजें|Save/ }).click()
    await p.waitForTimeout(250)
  }
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata',
})
// Record every speech utterance instead of playing it. (Runs on every page
// load, so state is NOT cleared here — a clear would wipe onboarding each
// navigation and send the script back to /welcome.)
await context.addInitScript(() => {
  window.__spoken = []
  const original = window.speechSynthesis && window.speechSynthesis.speak.bind(window.speechSynthesis)
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = (u) => {
      window.__spoken.push(u.text)
      u.onstart && u.onstart(new Event('start'))
      setTimeout(() => u.onend && u.onend(new Event('end')), 10)
    }
  }
  void original
})
// Force the browser speech path: the server has an ElevenLabs key, so the real
// provider would be used and this stub could not observe the utterance.
await context.route('**/api/voice/config', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: false, provider: 'webspeech' }),
  }),
)
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

// --- 1. Clean slate → the 5-step onboarding → home
await page.goto(BASE + '/', { waitUntil: 'load' })
// Clear once, here, so later navigations keep the completed onboarding.
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'load' })
await page.waitForURL(/\/welcome/)
console.log('redirects to welcome:', page.url().endsWith('/welcome'))

await page.locator('[data-testid="skip-signin"]').click()
await page.waitForTimeout(400)
// Pick English so the rest of this script's copy assertions apply.
await page.getByRole('radio', { name: /English/ }).click()
await page.locator('[data-testid="language-next"]').click()
await page.waitForTimeout(500)
await page.locator('[data-testid="home-check-next"]').click()
await page.waitForTimeout(500)
await fillProfile(page)
await page.locator('[data-testid="profile-next"]').click()
await page.waitForTimeout(500)
await page.locator('[data-testid="onboarding-finish"]').click()
await page.waitForURL((url) => new URL(url).pathname === '/')
// The shell animates between routes; wait for the voice entry itself.
await page.getByRole('button', { name: /Tap to speak/i }).waitFor({ timeout: 10000 })
console.log('lands on home:', new URL(page.url()).pathname === '/')
console.log('onboarding is complete:', (await page.evaluate(() => JSON.parse(localStorage.getItem('jansetu.settings.v1')).state.onboarded)) === true)
const homeText = await page.textContent('body')
console.log('home renders the voice entry:', /Tap to speak/i.test(homeText))

// --- 2. Hear status speaks
await page.evaluate(() => (window.__spoken = []))
const hear = page.getByRole('button', { name: /Hear status/i })
await hear.scrollIntoViewIfNeeded()
await hear.click()
await page.waitForTimeout(700)
const spokenStatus = await page.evaluate(() => window.__spoken.join(' '))
console.log('hear-status spoke:', spokenStatus.length > 10, JSON.stringify(spokenStatus.slice(0, 70)))

// --- 3. Suggestion chip drives the flow
await page.evaluate(() => window.scrollTo({ top: 0 }))
await page.getByRole('button', { name: /Ghar ke saamne kachra pada hai/ }).click()
await page.waitForTimeout(2500)
const afterChip = await page.textContent('body')
console.log('chip asked for location:', /Which area or street/i.test(afterChip))

// --- 4. Every destination renders
await page.evaluate(() => (window.__spoken = []))
const routes = ['/', '/complaints', '/replay', '/profile', '/welcome']
for (const route of routes) {
  await page.goto(BASE + route, { waitUntil: 'load' })
  await page.waitForTimeout(400)
  const h = await page.evaluate(() => document.body.innerText.trim().length)
  console.log(`route ${route} text length:`, h, h > 40 ? 'ok' : 'EMPTY')
}

// --- 5. Replay step audio
await page.goto(BASE + '/replay/demo-active-sanitation', { waitUntil: 'load' })
await page.waitForTimeout(500)
await page.evaluate(() => (window.__spoken = []))
await page.locator('article[role="button"]').first().click()
await page.waitForTimeout(600)
const spokenStep = await page.evaluate(() => window.__spoken.join(' '))
console.log('replay step spoke:', spokenStep.length > 10)

console.log('js errors:', errors.length ? errors : 'none')
await browser.close()
