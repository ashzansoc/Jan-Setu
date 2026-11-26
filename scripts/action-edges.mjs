/** Acceptance paths that must fail honestly: no browser, no email, vague request. */
import { chromium } from 'playwright'
const BASE = 'http://127.0.0.1:5173'
const SETTINGS = { state:{uiLang:'en',speechLang:'hi-IN',languageChoice:'hinglish',voiceSpeed:1,textScale:1,reduceMotion:true,name:'Kamla',avatarId:'kamla',avatarPhoto:null,onboarded:true}, version:1 }
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, reducedMotion:'reduce', locale:'en-IN' })
await ctx.addInitScript((p)=>localStorage.setItem('jansetu.settings.v1',JSON.stringify(p)), SETTINGS)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
const check = (l, ok) => console.log(`${ok?'PASS':'FAIL'} — ${l}`)
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('jansetu.actions.v1') || '{"tasks":[]}').tasks)

async function ask(text) {
  await page.goto(BASE + '/actions', { waitUntil:'load' })
  await page.waitForTimeout(900)
  await page.locator('[data-testid="open-ask"]').click()
  await page.waitForTimeout(400)
  await page.locator('#ask-action-input').fill(text)
  await page.locator('[data-testid="ask-submit"]').click()
  await page.waitForTimeout(3000)
}

// 1. Vague request → clarification, no plan
await ask('Please solve my electricity issue')
let tasks = await stored()
check('vague request asks a clarifying question', tasks[0]?.state === 'waiting_for_information' && !tasks[0]?.plan)
console.log('  reason:', tasks[0]?.reason)

// 2. Email task → NOT_CONFIGURED, no fake send
await ask('Email the electricity department about my wrong bill')
tasks = await stored()
const emailTask = tasks[0]
await page.waitForTimeout(2500)
const fresh = (await stored())[0]
check('email task stops at not-configured', fresh?.state === 'failed' && /not configured|not connected|no email account/i.test(fresh?.reason ?? ''))
check('no email id was fabricated', !fresh?.emailMessageId)
console.log('  reason:', fresh?.reason)

// 3. Browser task → NOT_CONFIGURED, no fake reference
await ask('Submit my application on the municipal portal')
await page.waitForTimeout(3000)
const browserTask = (await stored())[0]
check('browser task stops at not-configured', browserTask?.state === 'failed' && /not configured/i.test(browserTask?.reason ?? ''))
console.log('  reason:', browserTask?.reason)

console.log('js errors:', errors.length ? errors.slice(0,3) : 'none')
await browser.close()
