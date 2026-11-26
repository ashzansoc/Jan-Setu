import { chromium } from 'playwright'
const SETTINGS = { state: { uiLang:'en', speechLang:'hi-IN', languageChoice:'hinglish', voiceSpeed:1, textScale:1, reduceMotion:true, name:'Kamla', avatarId:'kamla', avatarPhoto:null, onboarded:true }, version:1 }
const browser = await chromium.launch()
const context = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, reducedMotion:'reduce', locale:'en-IN' })
await context.addInitScript((p) => localStorage.setItem('jansetu.settings.v1', JSON.stringify(p)), SETTINGS)
const page = await context.newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' })
await page.getByRole('button', { name: /Tap to speak/i }).click()
// wait past the 4.5s startup watchdog
await page.waitForTimeout(6000)
await page.screenshot({ path: '/tmp/shots/mic-watchdog.png' })
const text = await page.textContent('body')
console.log('recovered to a message:', /not available|permission|wrong/i.test(text))
console.log('duplicate type-instead buttons:', await page.getByRole('button', { name: /Type instead/i }).count())
console.log('js errors:', errs.length)
await browser.close()
