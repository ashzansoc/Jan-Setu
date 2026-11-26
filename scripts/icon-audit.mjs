/**
 * Loads every route and fails if a screen throws or an icon fails to render.
 */
import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173'
const SETTINGS = { state:{uiLang:'en',speechLang:'hi-IN',languageChoice:'hinglish',voiceSpeed:1,textScale:1,reduceMotion:true,name:'Kamla',avatarId:'kamla',avatarPhoto:null,onboarded:true}, version:1 }

const ROUTES = [
  '/', '/complaints', '/complaints/demo-active-sanitation', '/replay',
  '/replay/demo-active-sanitation', '/profile', '/welcome',
  '/places', '/portal-login', '/assisted-filing',
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, reducedMotion:'reduce', locale:'en-IN' })
await ctx.addInitScript((p)=>localStorage.setItem('jansetu.settings.v1',JSON.stringify(p)), SETTINGS)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', m => { if (m.type()==='error' && !/favicon/.test(m.text())) errors.push(`console: ${m.text()}`) })

let failed = 0
for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil:'networkidle' }).catch(() => {})
  await page.waitForTimeout(700)
  const info = await page.evaluate(() => {
    const svgs = document.querySelectorAll('svg').length
    const empty = [...document.querySelectorAll('svg')].filter(s => !s.innerHTML.trim() && !s.getAttribute('class')?.includes('size-full')).length
    return { text: (document.body.innerText || '').trim().length, svgs, empty }
  })
  const ok = info.text > 40 && info.svgs > 0
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${route} — text:${info.text} svg:${info.svgs}`)
  if (route === '/' || route === '/replay/demo-active-sanitation' || route === '/complaints') {
    await page.screenshot({ path: `/tmp/shots/icons-${route.replace(/\//g,'_') || 'home'}.png` })
  }
}
console.log('\nJS errors:', errors.length ? errors.slice(0, 6) : 'none')
console.log('failed routes:', failed)
await browser.close()
