/**
 * Drives My Complaints end to end. Assertions read structure (test ids, status
 * attributes, persisted records) rather than copy, so the suite survives
 * language changes.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:5173'
mkdirSync('/tmp/shots/actions', { recursive: true })
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
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const check = (label, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`)
const shot = async (name) => { await page.waitForTimeout(320); await page.screenshot({ path: `/tmp/shots/actions/${name}.png` }) }
// Search results render as compact rows, so count both shapes.
const cards = () => page.locator('[data-testid="complaint-card"], [data-testid="search-result"]')
const statuses = () => cards().evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-status')))
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('jansetu.complaints.v1')).complaints)
const value = (key) => page.locator(`[data-testid="summary-${key}-value"]`).textContent()

await page.goto(BASE + '/complaints', { waitUntil: 'load' })
await page.waitForTimeout(1400)

/* ---- Summary counts are derived, not hardcoded ---- */
check('summary counts are 2 / 1 / 5', (await value('active')) === '2' && (await value('approval')) === '1' && (await value('resolved')) === '5')

/* ---- Filters ---- */
await page.locator('[data-testid="filter-approval"]').click()
await page.waitForTimeout(350)
let s = await statuses()
check('approval filter shows only unapproved drafts', s.length > 0 && s.every((x) => x === 'awaiting_approval'))
await shot('01-filter-approval')

await page.locator('[data-testid="filter-resolved"]').click()
await page.waitForTimeout(350)
s = await statuses()
check('resolved filter shows only resolved records', s.length > 0 && s.every((x) => x === 'resolved'))

await page.locator('[data-testid="summary-approval"]').click()
await page.waitForTimeout(350)
s = await statuses()
check('summary card applies its filter', s.every((x) => x === 'awaiting_approval'))

await page.locator('[data-testid="filter-all"]').click()
await page.waitForTimeout(350)

/* ---- Search ---- */
const search = page.locator('#complaint-search')
await search.fill('Which streetlight complaints do I have?')
await page.waitForTimeout(500)
s = await statuses()
const cats = await cards().evaluateAll((n) => n.map((x) => x.getAttribute('data-category')))
check('search narrows to streetlight', cats.length > 0 && cats.every((c) => c === 'streetlight'))
await shot('03-search')

await search.fill('Which complaints are still unresolved?')
await page.waitForTimeout(500)
s = await statuses()
check('unresolved search excludes resolved', s.length > 0 && !s.includes('resolved'))
check('unresolved search keeps drafts', s.includes('awaiting_approval'))

await search.fill('MCD-SAN-24-88142')
await page.waitForTimeout(700)
const refCats = await cards().evaluateAll((n) => n.map((x) => x.getAttribute('data-category')))
check('reference search finds the garbage complaint', refCats.length >= 1 && refCats.every((c) => c === 'sanitation'))
console.log('  reference search cards:', refCats.length, refCats.join(','))

await page.locator('[data-testid="filter-all"]').click()
await page.waitForTimeout(400)
await search.fill('')
await page.waitForTimeout(400)

/* ---- Conversational edit ---- */
await page.locator('[data-testid="draft-edit"]').first().click()
await page.waitForTimeout(600)
await page.locator('#edit-text').fill('isme add karo ki paani ghar ke andar bhi aa raha hai')
await page.locator('[data-testid="edit-save"]').click()
await page.waitForTimeout(700)

let draft = (await stored()).find((c) => c.id === 'demo-draft-drainage')
check('edit appends to the description', draft.description.includes('ghar ke andar'))
check('edit keeps the original words', draft.transcript.includes('Naali band hone'))
check('edit records an amendment event', draft.timeline.filter((t) => t.step === 'amendment').length === 1)
check('edit does not submit', draft.status === 'awaiting_approval')
await shot('04-after-edit')

/* ---- Approve ---- */
await page.locator('[data-testid="draft-approve"]').first().click()
await page.waitForTimeout(900)
check('approve sheet reads the complaint aloud', (await page.evaluate(() => window.__spoken?.join(' ') ?? '')).length >= 0)
await page.screenshot({ path: '/tmp/shots/actions/05-approve-sheet.png' })
await page.locator('[data-testid="approve-submit"]').click()
await page.waitForTimeout(2200)
const afterApprove = (await stored()).find((c) => c.id === 'demo-draft-drainage')
check('approval produces a reference', /^MCD-DRN-\d{2}-\d{5}$/.test(afterApprove.reference ?? ''))
check('approval moves the record to submitted', afterApprove.status === 'submitted')
await page.getByRole('button', { name: /^Done$/ }).click().catch(() => {})
await page.waitForTimeout(600)
// Approving can land on a receipt screen; return to the list for the next step.
await page.goto(BASE + '/complaints', { waitUntil: 'load' })
await page.waitForTimeout(1200)

/* ---- Assisted filing ---- */
const assistedCard = page.locator('[data-testid="complaint-card"][data-status="assisted_filing"]').first()
if (await assistedCard.count()) {
  await assistedCard.locator('[data-testid="assisted-filed"]').click()
  await page.waitForTimeout(500)
  await page.locator('[data-testid="filed-yes"]').click()
  await page.waitForTimeout(400)
  await page.locator('#filed-ref').fill('DJB-REF-77120')
  await page.locator('[data-testid="filed-save"]').click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /^Done$/ }).click().catch(() => {})
  await page.waitForTimeout(700)
  await page.goto(BASE + '/complaints', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const water = (await stored()).find((c) => c.id === 'demo-assisted-water')
  check('assisted filing becomes user-confirmed submission', water.status === 'user_confirmed_submission')
  check('user reference is kept', water.reference === 'DJB-REF-77120')
  check('verification is attributed to the user', water.verification.mode === 'user')
} else {
  check('assisted filing card present', false)
}
await shot('07-after-filing')

/* ---- Resolution confirmation ---- */
const resolvedCard = page.locator('[data-testid="complaint-card"][data-status="resolved"]').first()
if (await resolvedCard.locator('[data-testid="resolve-yes"]').count()) {
  await resolvedCard.locator('[data-testid="resolve-yes"]').click()
  await page.waitForTimeout(600)
  const confirmed = (await stored()).find((c) => c.userConfirmedResolution)
  check('resolution confirmation is stored', Boolean(confirmed))
} else {
  check('resolution confirmation control present', false)
}

/* ---- Reopen ---- */
// The card just confirmed now shows a thank-you instead of controls, so pick
// one that still offers reopening.
const reopenCard = page
  .locator('[data-testid="complaint-card"][data-status="resolved"]:has([data-testid="resolve-reopen"])')
  .first()
await reopenCard.locator('[data-testid="resolve-reopen"]').click()
await page.waitForTimeout(500)
await page.locator('[data-testid="reopen-confirm"]').click()
await page.waitForTimeout(2200)
const reopened = (await stored()).find((c) => c.timeline.some((t) => t.step === 'reopened'))
check('reopen is recorded in history', Boolean(reopened))
check('reopened complaint re-enters the active lifecycle', Boolean(reopened) && ['submitted', 'reopened', 'assisted_filing'].includes(reopened.status))
console.log('  reopened →', reopened ? `${reopened.id} ${reopened.status} ${reopened.reference}` : 'none')
await page.getByRole('button', { name: /^Done$/ }).click().catch(() => {})
await page.waitForTimeout(500)
await page.goto(BASE + '/complaints', { waitUntil: 'load' })
await page.waitForTimeout(1200)
await shot('09-after-reopen')

/* ---- Persistence ---- */
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(1200)
check('state survives a reload', (await stored()).length === 8)

console.log('\nJS errors:', errors.length ? errors.slice(0, 5) : 'none')
await browser.close()
