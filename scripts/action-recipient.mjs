/**
 * The email path with the capability probe reporting "configured".
 * The tool itself is NOT stubbed: the server still has no credentials, so the
 * run must end in an honest failure rather than a fabricated send.
 */
import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173'
const SETTINGS = {
  state: { uiLang:'en', speechLang:'hi-IN', languageChoice:'hinglish', voiceSpeed:1, textScale:1,
           reduceMotion:true, name:'Kamla', avatarId:'kamla', avatarPhoto:null, onboarded:true },
  version: 1,
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', locale: 'en-IN',
})
await context.addInitScript((p) => localStorage.setItem('jansetu.settings.v1', JSON.stringify(p)), SETTINGS)
// Only the health probe is intercepted; every tool call goes to the real server.
await context.route('**/api/health', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, llm: 'configured', browser: 'not-configured', email: 'configured', voice: 'configured' }),
  }),
)
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const check = (l, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} — ${l}`)
const tasks = () => page.evaluate(() => JSON.parse(localStorage.getItem('jansetu.actions.v1') || '{"tasks":[]}').tasks)

await page.goto(BASE + '/actions', { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.locator('[data-testid="open-ask"]').click()
await page.waitForTimeout(400)
await page.locator('#ask-action-input').fill('Email the electricity department about my wrong bill')
await page.locator('[data-testid="ask-submit"]').click()
await page.waitForTimeout(3500)

let list = await tasks()
check('the email task asks for the message first', (await tasks())[0]?.handoff?.field === 'body')

await page.locator('#handoff-input').fill('My electricity bill for October is wrong. Please correct it.')
await page.locator('#handoff-input').press('Enter')
await page.waitForTimeout(3000)

list = await tasks()
const withBody = list[0]
check('it then asks for the recipient rather than inventing one', withBody?.handoff?.field === 'recipient')
console.log('  handoff:', JSON.stringify({ field: withBody?.handoff?.field, state: withBody?.state }))
check('the draft step is blocked until the address arrives', withBody?.plan?.steps?.find((s) => s.action === 'draft_email')?.status === 'blocked')

// Provide an address; the real Gmail call must fail honestly (no credentials).
await page.locator('#handoff-input').fill('complaints@tatapowerdelhi.com')
await page.locator('#handoff-input').press('Enter')
await page.waitForTimeout(6000)

list = await tasks()
const after = list[0]
check('no message id was fabricated', !after?.emailMessageId)
check('the task reports the real outcome', ['failed', 'partially_completed'].includes(after?.state))
console.log('  outcome:', JSON.stringify({ state: after?.state, reason: after?.reason, steps: after?.plan?.steps?.map((s) => `${s.action}:${s.status}`) }))

console.log('js errors:', errors.length ? errors.slice(0, 3) : 'none')
await browser.close()
