/**
 * Verifies the home-check step really detects a location and persists it,
 * rather than showing a sample address.
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

const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
  permissions: ['geolocation'],
  geolocation: { latitude: 28.6139, longitude: 77.209 },
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

// Stub the reverse geocoder so the test is deterministic.
await page.route('**/api/geo/reverse*', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      label: 'Mandi House, New Delhi',
      locality: 'Mandi House',
      city: 'New Delhi',
      postcode: '110001',
    }),
  }),
)

await page.goto(BASE + '/', { waitUntil: 'load' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'load' })
await page.waitForURL(/\/welcome/)
await page.locator('[data-testid="skip-signin"]').click()
await page.waitForTimeout(300)
await page.getByRole('radio', { name: /English/ }).click()
await page.locator('[data-testid="language-next"]').click()
await page.waitForTimeout(2500) // allow GPS + reverse geocode

const body = await page.textContent('body')
const check = (label, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`)

check('detects the real locality, not the seed', /Mandi House/.test(body))
check('does not show the seed Greater Kailash address', !/Greater Kailash/.test(body))

await page.screenshot({ path: '/tmp/shots/homecheck-detected.png' })

await page.locator('[data-testid="home-check-next"]').click()
await page.waitForTimeout(600)

const saved = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('jansetu.places.v1'))
  const def = raw.state.places.find((p) => p.isDefault)
  return { locality: def?.locality, geoVerified: def?.geoVerified, line1: def?.line1 }
})
check('confirmed area is persisted as the default place', /Mandi House/.test(saved.locality ?? ''))
check('persisted place is marked geo-verified', saved.geoVerified === true)
console.log('  saved:', JSON.stringify(saved))

// The action engine must now resolve the detected area.
const ctxLine = await page.evaluate(async () => {
  const m = await import('/src/lib/action/context.ts')
  return m.buildUserContext().locality
})
check('the action engine sees the detected locality', /Mandi House/.test(ctxLine.value ?? ''))
console.log('  context locality:', JSON.stringify(ctxLine))

console.log('errors:', errors.length ? errors.slice(0, 3) : 'none')
await browser.close()