/**
 * Screenshot harness for visual verification.
 * Usage: node scripts/shoot.mjs [route] [width] [height] [outfile]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'

const SIZES = {
  small: [360, 780],
  phone: [390, 844],
  large: [430, 932],
  tablet: [768, 1024],
  desktop: [1440, 900],
}

const ONBOARDING = {
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

const which = process.argv[2] ?? 'all'
const route = process.argv[3] ?? '/'

mkdirSync('/tmp/shots', { recursive: true })

const browser = await chromium.launch()

const targets =
  which === 'all'
    ? Object.entries(SIZES)
    : [[which, SIZES[which] ?? SIZES.phone]]

for (const [name, [width, height]] of targets) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  })
  await context.addInitScript((payload) => {
    window.localStorage.setItem('jansetu.settings.v1', JSON.stringify(payload))
  }, ONBOARDING)
  const page = await context.newPage()
  await page.goto(BASE + route, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  const file = `/tmp/shots/${route.replace(/\//g, '_') || 'home'}-${name}.png`
  await page.screenshot({ path: file })
  console.log(file, `${width}x${height}`)
  await context.close()
}

await browser.close()
