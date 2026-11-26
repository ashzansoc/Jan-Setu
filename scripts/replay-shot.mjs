import { chromium } from 'playwright'
const SETTINGS = { state:{uiLang:'en',speechLang:'hi-IN',languageChoice:'hinglish',voiceSpeed:1,textScale:1,reduceMotion:true,name:'Kamla',avatarId:'kamla',avatarPhoto:null,onboarded:true}, version:1 }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, reducedMotion:'reduce', locale:'en-IN', timezoneId:'Asia/Kolkata' })
await ctx.addInitScript((p)=>localStorage.setItem('jansetu.settings.v1',JSON.stringify(p)), SETTINGS)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => m.type()==='error' && errors.push(m.text()))
await page.goto('http://127.0.0.1:5173/replay/demo-active-sanitation', { waitUntil:'networkidle' })
await page.waitForTimeout(900)
await page.screenshot({ path: '/tmp/shots/replay-top.png' })
for (const [name, y] of [['mid', 700], ['lower', 1300], ['bottom', 2100]]) {
  await page.evaluate((t) => window.scrollTo({ top: t, behavior:'instant' }), y)
  await page.waitForTimeout(350)
  await page.screenshot({ path: `/tmp/shots/replay-${name}.png` })
}
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
