/**
 * End-to-end interaction pass. Drives the complaint lifecycle through the real
 * UI (no stubs) and captures each screen.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:5173'
mkdirSync('/tmp/shots/flow', { recursive: true })

const SETTINGS = {
  state: {
    uiLang: 'en',
    speechLang: 'hi-IN',
    languageChoice: 'hinglish',
    voiceSpeed: 1,
    textScale: 1,
    reduceMotion: true,
    name: 'Kamla',
    avatarId: 'kamla',
    avatarPhoto: null,
    onboarded: true,
  },
  version: 1,
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata',
})
await context.addInitScript((payload) => {
  window.localStorage.setItem('jansetu.settings.v1', JSON.stringify(payload))
}, SETTINGS)

const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const shot = async (name) => {
  await page.waitForTimeout(500)
  await page.screenshot({ path: `/tmp/shots/flow/${name}.png` })
  console.log('shot', name)
}

await page.goto(BASE + '/', { waitUntil: 'load' })
await shot('01-home')

// --- Open the type-instead fallback
await page.getByRole('button', { name: /Type instead/i }).first().click()
await page.waitForTimeout(600)
await shot('02-type-sheet')

// --- First utterance: no location given, so a clarification must follow
await page.locator('#type-input').fill('Ghar ke saamne teen hafte se kachra pada hai, bahut badbu aa rahi hai.')
await page.getByRole('button', { name: /^Send$/ }).click()
await page.waitForTimeout(2600)
await shot('03-clarifying')

// --- Answer the clarification with the location
const typeBtn = page.getByRole('button', { name: /Type instead/i }).first()
if (await typeBtn.isVisible().catch(() => false)) await typeBtn.click()
await page.waitForTimeout(500)
await page.locator('#type-input').fill('Greater Kailash 2, Delhi')
await page.getByRole('button', { name: /^Send$/ }).click()
await page.waitForTimeout(3000)
await shot('04-understand')

const url1 = page.url()
console.log('after clarify ->', url1)

// --- Continue to preview
await page.getByRole('button', { name: /Looks right/i }).click()
await page.waitForTimeout(700)
await shot('05-preview')

// --- Approve
await page.getByRole('button', { name: /Approve & submit/i }).click()
await page.waitForTimeout(700)
await shot('06-consent')

await page.getByRole('button', { name: /Yes, submit it/i }).click()
await page.waitForTimeout(2200)
await shot('07-receipt')

const body = await page.textContent('body')
const refMatch = body.match(/MCD-[A-Z]{3}-\d{2}-\d{5}/)
console.log('reference:', refMatch?.[0] ?? 'NONE')

// --- Replay
await page.getByRole('button', { name: /See what happened/i }).click()
await page.waitForTimeout(900)
await shot('08-replay')

// --- Back home, confirm the new complaint is the active one
await page.goto(BASE + '/', { waitUntil: 'load' })
await page.waitForTimeout(800)
await shot('09-home-after')

// --- Complaints list
await page.goto(BASE + '/complaints', { waitUntil: 'load' })
await shot('10-complaints')

// --- Hindi interface through the real language selector
await page.goto(BASE + '/', { waitUntil: 'load' })
await page.getByRole('button', { name: /Change language/i }).click()
await page.waitForTimeout(600)
await shot('11-language-sheet')
await page.getByRole('button', { name: /हिन्दी/ }).first().click()
await page.waitForTimeout(900)
await shot('12-home-hindi')

// --- Verify the Hindi headline and labels actually changed
const hindiBody = await page.textContent('body')
console.log('hindi labels present:', /बोलिए, हम सुन रहे हैं/.test(hindiBody), /सभी देखें|अभी कोई/.test(hindiBody))

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none')
await browser.close()
