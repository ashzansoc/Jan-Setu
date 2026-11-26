/**
 * Walks the onboarding flow end to end and captures each step.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:5173'
mkdirSync('/tmp/shots/ob', { recursive: true })

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
})
// Fresh state: onboarding not completed.
await context.addInitScript(() => localStorage.clear())
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const check = (label, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`)
const shot = async (name) => {
  await page.waitForTimeout(500)
  await page.screenshot({ path: `/tmp/shots/ob/${name}.png` })
}

await page.goto(BASE + '/welcome', { waitUntil: 'load' })
await page.waitForTimeout(1200)
check('step 1 is the Google login screen', /Continue with Google/i.test(await page.textContent('body')))
await shot('1-login')

// Language
await page.locator('[data-testid="skip-signin"]').click()
await page.waitForTimeout(600)
const langText = await page.textContent('body')
check('step 2 is language selection', /अपनी भाषा चुनें/i.test(langText) || /Choose your language/i.test(langText))
await shot('2-language')
await page.locator('[data-testid="language-next"]').click()
await page.waitForTimeout(700)

// Home check
const homeText = await page.textContent('body')
check('step 3 is the home check', /Are you at home right now/i.test(homeText) || /घर पर हैं/i.test(homeText))
await shot('3-home-check')
await page.locator('[data-testid="home-check-next"]').click()
await page.waitForTimeout(700)

// Profile details
const profileText = await page.textContent('body')
check('step 4 is profile details', /Confirm your details/i.test(profileText) || /जानकारी की पुष्टि/i.test(profileText))
await shot('4-profile')
await fillProfile(page)
await page.locator('[data-testid="profile-next"]').click()
await page.waitForTimeout(700)

// Ready
await page.locator('[data-testid="onboarding-finish"]').click()
await page.waitForTimeout(1400)
check('finishing lands on home', page.url().endsWith('/'))
check('the app is now onboarded', (await page.evaluate(() => JSON.parse(localStorage.getItem('jansetu.settings.v1')).state.onboarded)) === true)
await shot('5-ready')

console.log('js errors:', errors.length ? errors.slice(0, 4) : 'none')
await browser.close()