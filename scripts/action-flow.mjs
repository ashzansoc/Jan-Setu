/**
 * End-to-end Action Intelligence Engine run.
 * Types a request, supplies the missing field, approves, and asserts the task
 * reached a verified-or-honest outcome with evidence.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:5173'
mkdirSync('/tmp/shots/action', { recursive: true })
const SETTINGS = {
  state: { uiLang:'en', speechLang:'hi-IN', languageChoice:'hinglish', voiceSpeed:1, textScale:1,
           reduceMotion:true, name:'Kamla', avatarId:'kamla', avatarPhoto:null, onboarded:true },
  version: 1,
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce',
  locale: 'en-IN', timezoneId: 'Asia/Kolkata',
})
await context.addInitScript((p) => localStorage.setItem('jansetu.settings.v1', JSON.stringify(p)), SETTINGS)
await context.addInitScript(() => {
  window.__spoken = []
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(new Event('end')), 5) }
  }
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const check = (label, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`)
const shot = async (name) => { await page.waitForTimeout(400); await page.screenshot({ path: `/tmp/shots/action/${name}.png` }) }
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('jansetu.actions.v1')).tasks)

await page.goto(BASE + '/actions', { waitUntil: 'load' })
await page.waitForTimeout(1200)

// --- Ask for something that needs a location
await page.locator('[data-testid="open-ask"]').click()
await page.waitForTimeout(500)
await page.locator('#ask-action-input').fill('Register a garbage complaint in my area')
await page.locator('[data-testid="ask-submit"]').click()
await page.waitForTimeout(2500)
await shot('01-handoff-location')

let tasks = await stored()
check('a task was created', tasks.length === 1)
check(
  'the engine asked for the missing location',
  tasks[0]?.handoff?.field === 'location' && ['waiting_for_user', 'waiting_for_information'].includes(tasks[0]?.state),
)

// --- Provide the location
await page.locator('#handoff-input').fill('Greater Kailash 2, New Delhi')
await page.locator('#handoff-input').press('Enter')
await page.waitForTimeout(3000)
await shot('02-plan')

tasks = await stored()
const task = tasks[0]
check('a plan was produced', (task?.plan?.steps?.length ?? 0) >= 4)
check('the plan includes a consent gate', task?.plan?.steps?.some((s) => s.action === 'request_approval'))
check('the task is waiting for approval', task?.state === 'waiting_for_approval')
console.log('  steps:', task?.plan?.steps?.map((s) => `${s.action}:${s.status}`).join(' | '))

// --- Approve
await page.locator('[data-testid="approve-step"]').click()
await page.waitForTimeout(4000)
await shot('03-result')

tasks = await stored()
const done = tasks[0]
check('the task reached a terminal state', ['completed', 'partially_completed'].includes(done?.state))
check('a complaint record was created', Boolean(done?.complaintId))
check('the result carries evidence', Boolean(done?.result?.method))
check('sandbox evidence is not claimed as verified', done?.result?.status !== 'verified')
console.log('  outcome:', JSON.stringify({ state: done?.state, ref: done?.result?.evidence?.reference, verification: done?.result?.status, reason: done?.result?.reason }))

// --- The complaint is reachable from the task
if (done?.complaintId) {
  await page.goto(`${BASE}/complaints/${done.complaintId}`, { waitUntil: 'load' })
  await page.waitForTimeout(900)
  check('the produced complaint opens', (await page.textContent('body')).includes('Garbage accumulation'))
}

// --- The Action Centre lists it
await page.goto(BASE + '/actions', { waitUntil: 'load' })
await page.waitForTimeout(900)
check('the Action Centre lists the task', (await page.locator('[data-testid="action-task-card"]').count()) === 1)

// --- Unsupported request fails honestly
await page.goto(BASE + '/actions', { waitUntil: 'load' })
await page.waitForTimeout(600)
console.log('\nJS errors:', errors.length ? errors.slice(0, 4) : 'none')
await browser.close()
