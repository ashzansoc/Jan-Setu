/**
 * Proves name and phone are mandatory: Next stays disabled and a reason is
 * shown until both are valid.
 */
import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const check = (label, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`)

await page.goto(BASE + '/', { waitUntil: 'load' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'load' })
await page.waitForURL(/\/welcome/)
await page.locator('[data-testid="skip-signin"]').click()
await page.waitForTimeout(300)
await page.getByRole('radio', { name: /English/ }).click()
await page.locator('[data-testid="language-next"]').click()
await page.waitForTimeout(500)
await page.locator('[data-testid="home-check-next"]').click()
await page.waitForTimeout(600)

const next = page.locator('[data-testid="profile-next"]')
check('Next is disabled with no name or phone', await next.isDisabled())
check('a reason is shown', /Please enter your name/i.test(await page.textContent('body')))

// Fill only the name — still blocked.
await page.locator('button[aria-label*="Edit Name"]').click()
await page.waitForTimeout(250)
await page.locator('input').last().fill('Kamla Devi')
await page.getByRole('button', { name: /Save|सहेजें/ }).click()
await page.waitForTimeout(300)
check('still blocked with a name but no phone', await next.isDisabled())
check('now asks for the phone', /mobile number/i.test(await page.textContent('body')))

// Fill an invalid phone — still blocked.
await page.locator('button[aria-label*="Mobile Number"]').click()
await page.waitForTimeout(250)
await page.locator('input').last().fill('12345')
await page.getByRole('button', { name: /Save|सहेजें/ }).click()
await page.waitForTimeout(300)
check('invalid phone is rejected', await next.isDisabled())
check('explains the 10-digit rule', /10-digit/i.test(await page.textContent('body')))

// Fill a valid phone — unblocked.
await page.locator('button[aria-label*="Mobile Number"]').click()
await page.waitForTimeout(250)
await page.locator('input').last().fill('98110 54421')
await page.getByRole('button', { name: /Save|सहेजें/ }).click()
await page.waitForTimeout(300)
check('valid name + phone enables Next', !(await next.isDisabled()))

await page.screenshot({ path: '/tmp/shots/profile-mandatory.png' })
console.log('errors:', errors.length ? errors.slice(0, 3) : 'none')
await browser.close()