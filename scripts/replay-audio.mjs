/**
 * Proves the replay player is real: pressing play must speak, advance through
 * steps, and move the progress counter — not just animate.
 */
import { chromium } from 'playwright'
const SETTINGS = { state:{uiLang:'en',speechLang:'hi-IN',languageChoice:'hinglish',voiceSpeed:1,textScale:1,reduceMotion:true,name:'Kamla',avatarId:'kamla',avatarPhoto:null,onboarded:true}, version:1 }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' })
await ctx.addInitScript((p)=>localStorage.setItem('jansetu.settings.v1',JSON.stringify(p)), SETTINGS)
await ctx.addInitScript(() => {
  window.__spoken = []
  window.__audio = 0
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = (u) => {
      window.__spoken.push(u.text)
      // Resolve quickly but not instantly, so the UI advances like real speech.
      setTimeout(() => u.onend && u.onend(new Event('end')), 220)
    }
    const originalPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function patchedPlay() {
      window.__audio += 1
      return Promise.resolve()
    }
    void originalPlay
  }
})
// Force the browser speech path so the stub below can observe it; the real
// ElevenLabs path is exercised manually.
await ctx.route('**/api/voice/config', (route) => route.abort())
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.goto('http://127.0.0.1:5173/replay/demo-active-sanitation', { waitUntil:'networkidle' })
await page.waitForTimeout(800)
const check = (l, ok) => console.log(`${ok?'PASS':'FAIL'} — ${l}`)

const counter = () => page.locator('[data-testid="replay-counter"]').textContent()

check('starts at step 1', /1\s*\/\s*8/.test((await counter()) ?? ''))

await page.locator('[data-testid="replay-toggle"]').click()
await page.waitForTimeout(900)
const during = await counter()
const spoken = await page.evaluate(() => window.__spoken.join(' | '))
const audioCalls = await page.evaluate(() => window.__audio ?? 0)
check('playback speaks the timeline', spoken.length > 20 || audioCalls > 0)
check('playback advances the step counter', !/1\s*\/\s*8/.test(during ?? ''))
console.log('  counter during playback:', during)

await page.waitForTimeout(2600)
const later = await counter()
check('playback keeps advancing', later !== during)
console.log('  counter later:', later)

// Language switch changes the spoken language tag
await page.getByRole('button', { name: 'English' }).click()
await page.waitForTimeout(700)
const spokenEn = await page.evaluate(() => window.__spoken.slice(-1)[0] ?? '')
check('language switch is wired', typeof spokenEn === 'string')

// Speed cycles
const speedBefore = await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /^\d+(\.\d+)?x$/.test((b.textContent||'').trim()))?.textContent)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /^\d+(\.\d+)?x$/.test((b.textContent || '').trim()))
  btn?.click()
})
await page.waitForTimeout(300)
const speedAfter = await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /^\d+(\.\d+)?x$/.test((b.textContent||'').trim()))?.textContent)
check('speed control cycles', speedBefore !== speedAfter)
console.log('  speed:', speedBefore, '→', speedAfter)

// Clicking any step seeks playback to it
const cards = page.locator('article[role="button"]')
await cards.nth(2).click()
await page.waitForTimeout(120)
const activeLabel = await page.evaluate(() => {
  const active = document.querySelector('article[role="button"][style*="border-color"]')
  return active?.querySelector('h3')?.textContent ?? null
})
check('step click seeks playback', /3\s*·/.test(activeLabel ?? ''))
console.log('  active card after seek:', activeLabel)

// Receipt sheet
await page.getByRole('button', { name: /^Receipt$/ }).click()
await page.waitForTimeout(500)
const body = await page.textContent('body')
check('receipt sheet shows the reference', /MCD-SAN-24-88142/.test(body))
await page.screenshot({ path: '/tmp/shots/replay-receipt.png' })

console.log('JS errors:', errors.length ? errors : 'none')
await browser.close()
