/** Selects a language in onboarding and asserts the UI actually switches. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('/tmp/shots/lang', { recursive: true })

const BASE = 'http://127.0.0.1:5173'
const browser = await chromium.launch()

async function walk(pick) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'load' })
  await page.waitForURL(/\/welcome/)

  await page.locator('[data-testid="skip-signin"]').click()
  await page.waitForTimeout(400)
  if (pick) await page.getByRole('radio', { name: pick }).click()
  await page.locator('[data-testid="language-next"]').click()
  await page.waitForTimeout(600)

  const step3 = await page.textContent('body')
  await page.screenshot({ path: `/tmp/shots/lang/step3-${pick ? 'en' : 'hi'}.png` })

  await page.locator('[data-testid="home-check-next"]').click()
  await page.waitForTimeout(500)
  const step4 = await page.textContent('body')
  await page.screenshot({ path: `/tmp/shots/lang/step4-${pick ? 'en' : 'hi'}.png` })

  await page.locator('[data-testid="profile-next"]').click()
  await page.waitForTimeout(500)
  const step5 = await page.textContent('body')
  await page.screenshot({ path: `/tmp/shots/lang/step5-${pick ? 'en' : 'hi'}.png` })

  const uiLang = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jansetu.settings.v1')).state.uiLang,
  )

  await ctx.close()
  return { step3, step4, step5, errors, uiLang }
}

const en = await walk(/English/)
console.log('EN stored uiLang:', en.uiLang)
console.log('EN step3 English heading:', /Are you at home right now/i.test(en.step3))
console.log('EN step4 English heading:', /Confirm your details/i.test(en.step4))
console.log('EN step5 English heading:', /All set & verified/i.test(en.step5))
console.log('EN step3 free of Hindi body copy:', !/क्या आप अभी अपने घर/.test(en.step3))

const hi = await walk(/हिन्दी/)
console.log('HI stored uiLang:', hi.uiLang)
console.log('HI step3 Hindi heading:', /घर पर हैं/.test(hi.step3))
console.log('HI step4 Hindi heading:', /जानकारी की पुष्टि/.test(hi.step4))
console.log('HI step5 Hindi heading:', /सब तैयार/.test(hi.step5))

const allErrors = [...en.errors, ...hi.errors]
console.log('errors:', allErrors.length ? allErrors : 'none')

await browser.close()