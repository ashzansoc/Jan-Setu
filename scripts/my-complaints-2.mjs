import { chromium } from 'playwright'
const BASE = 'http://127.0.0.1:5173'
const SETTINGS = { state:{uiLang:'en',speechLang:'hi-IN',languageChoice:'hinglish',voiceSpeed:1,textScale:1,reduceMotion:true,name:'Kamla',avatarId:'kamla',avatarPhoto:null,onboarded:true}, version:1 }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, reducedMotion:'reduce', locale:'en-IN', timezoneId:'Asia/Kolkata' })
await ctx.addInitScript((p)=>localStorage.setItem('jansetu.settings.v1',JSON.stringify(p)), SETTINGS)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => m.type()==='error' && errors.push(m.text()))
const has = async (t) => (await page.textContent('body')).includes(t)
const cardCount = () => page.locator('[data-testid="complaint-card"]').count()
const check = (l, ok) => console.log(`${ok?'PASS':'FAIL'} — ${l}`)

await page.goto(BASE + '/complaints', { waitUntil:'networkidle' })
await page.waitForTimeout(700)

// See all 5
check('renders complaint cards', (await cardCount()) >= 3)
await page.locator('[data-testid="resolved-see-all"]').click()
await page.waitForTimeout(400)
check('See all expands to every resolved card', (await page.locator('[data-testid="complaint-card"][data-status="resolved"]').count()) === 5)
await page.locator('[data-testid="resolved-see-all"]').click()
await page.waitForTimeout(300)
check('Show fewer collapses again', (await page.locator('[data-testid="complaint-card"][data-status="resolved"]').count()) === 2)

// Default order is newest-first: the 12-day-old streetlight is shown.
const firstResolvedRef = () => page.locator('[data-testid="complaint-card"][data-status="resolved"]').first().getAttribute('data-reference')
const newestFirst = await firstResolvedRef()
check('newest-first shows the most recent resolution', newestFirst === 'MCD-ELE-24-70311')
console.log('  newest resolved ref:', newestFirst)

// Sort sheet
await page.locator('[data-testid="open-sort"]').click()
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/shots/actions/10-sort-sheet.png' })
await page.locator('[data-testid="sort-oldest"]').click()
await page.waitForTimeout(500)

// Oldest-first shows the 44-day-old one instead — that swap is the proof.
const oldestFirst = await firstResolvedRef()
check('oldest-first shows the oldest resolution', oldestFirst === 'MCD-ELE-24-58871')
console.log('  oldest resolved ref:', oldestFirst)

// Hide demo records
await page.locator('[data-testid="open-sort"]').click()
await page.waitForTimeout(400)
await page.locator('[data-testid="hide-demo"]').check()
await page.waitForTimeout(600)
check('hide demo empties the list', (await cardCount()) === 0)

// Restore via a fresh page (settings are not persisted for the demo toggle)
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(700)

// FAB starts a new complaint
await page.locator('[data-testid="new-complaint"]').click()
await page.waitForTimeout(600)
check('floating mic routes home to listen', new URL(page.url()).pathname === '/')

// Home + detail + replay still render
await page.goto(BASE + '/', { waitUntil: 'load' })
await page.waitForTimeout(700)
check('home renders', (await page.locator('button[aria-pressed]').count()) > 0)
await page.screenshot({ path: '/tmp/shots/actions/11-home.png' })

await page.goto(BASE + '/complaints/demo-draft-drainage', { waitUntil: 'load' })
await page.waitForTimeout(700)
check('complaint detail renders', (await page.locator('h1').first().textContent())?.length > 2)
await page.screenshot({ path: '/tmp/shots/actions/12-detail.png' })

await page.goto(BASE + '/replay/demo-draft-drainage', { waitUntil: 'load' })
await page.waitForTimeout(700)
check('replay renders a player', (await page.locator('[data-testid="replay-toggle"]').count()) === 1)
await page.screenshot({ path: '/tmp/shots/actions/13-replay-draft.png' })

await page.goto(BASE + '/replay/demo-active-sanitation', { waitUntil: 'load' })
await page.waitForTimeout(700)
await page.screenshot({ path: '/tmp/shots/actions/14-replay-active.png' })

console.log('JS errors:', errors.length ? errors : 'none')
await browser.close()
