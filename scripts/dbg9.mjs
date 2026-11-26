import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport:{width:390,height:844} })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:5173/complaints', { waitUntil:'load' })
await page.waitForTimeout(1200)
const out = await page.evaluate(async () => {
  const m = await import('/src/lib/complaints/search.ts')
  const q = m.parseComplaintQuery('streetlight')
  const raw = JSON.parse(localStorage.getItem('jansetu.complaints.v1'))
  const matched = raw.complaints.filter(c => m.matchesQuery(c, q)).map(c => c.id)
  return { q, matched }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
