import { chromium } from 'playwright'
const SETTINGS = { state:{uiLang:'en',speechLang:'hi-IN',languageChoice:'hinglish',voiceSpeed:1,textScale:1,reduceMotion:true,name:'Kamla',avatarId:'kamla',avatarPhoto:null,onboarded:true}, version:1 }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' })
await ctx.addInitScript((p)=>localStorage.setItem('jansetu.settings.v1',JSON.stringify(p)), SETTINGS)
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:5173/complaints', { waitUntil:'load' })
await page.waitForTimeout(1500)
console.log('summary:', JSON.stringify(await page.evaluate(() => {
  const g = document.querySelector('[role="group"]')
  return g ? [...g.querySelectorAll('button')].map(b => b.textContent) : null
})))
console.log('tabs:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map(t => t.textContent))))
console.log('body head:', (await page.textContent('body') ?? '').slice(0,260).replace(/\s+/g,' '))
await page.screenshot({ path: '/tmp/shots/dbg4.png' })
await browser.close()
