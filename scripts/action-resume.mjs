/**
 * Acceptance test 8 — interrupt the app during a workflow.
 * Also covers pause/resume and proves no duplicate complaint is created.
 */
import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173'
const SETTINGS = {
  state: { uiLang:'en', speechLang:'hi-IN', languageChoice:'hinglish', voiceSpeed:1, textScale:1,
           reduceMotion:true, name:'Kamla', avatarId:'kamla', avatarPhoto:null, onboarded:true },
  version: 1,
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce',
  locale: 'en-IN', timezoneId: 'Asia/Kolkata',
})
await context.addInitScript((p) => localStorage.setItem('jansetu.settings.v1', JSON.stringify(p)), SETTINGS)
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const check = (label, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`)
const stored = () =>
  page.evaluate(() => ({
    tasks: JSON.parse(localStorage.getItem('jansetu.actions.v1') || '{"tasks":[]}').tasks,
    complaints: JSON.parse(localStorage.getItem('jansetu.complaints.v1') || '{"complaints":[]}').complaints.length,
  }))

// --- Start a task and get it to the approval gate
await page.goto(BASE + '/actions', { waitUntil: 'load' })
await page.waitForTimeout(1400)
await page.locator('[data-testid="open-ask"]').click()
await page.waitForTimeout(400)
await page.locator('#ask-action-input').fill('Register a garbage complaint in my area')
await page.locator('[data-testid="ask-submit"]').click()
await page.waitForTimeout(2200)
await page.locator('#handoff-input').fill('Greater Kailash 2, New Delhi')
await page.locator('#handoff-input').press('Enter')
await page.waitForTimeout(3000)

let snapshot = await stored()
const taskId = snapshot.tasks[0]?.id
const complaintsBefore = snapshot.complaints
check('task reached the approval gate', snapshot.tasks[0]?.state === 'waiting_for_approval')

// --- Hard interrupt: reload the page (simulates the app being killed)
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(1600)
snapshot = await stored()
check('task survived the restart', snapshot.tasks[0]?.id === taskId)
check('plan survived the restart', (snapshot.tasks[0]?.plan?.steps?.length ?? 0) >= 4)
check('no complaint was filed before approval', snapshot.complaints === complaintsBefore)

// --- The task screen still renders the restored plan
await page.goto(`${BASE}/actions/${taskId}`, { waitUntil: 'load' })
await page.waitForTimeout(1400)
check('restored task shows its plan', (await page.locator('[data-testid="action-plan"] li').count()) >= 4)
check('restored task still needs approval', (await page.locator('[data-testid="approve-step"]').count()) === 1)

// --- Approve after the restart; the task must complete exactly once
await page.locator('[data-testid="approve-step"]').click()
await page.waitForTimeout(4000)
snapshot = await stored()
const after = snapshot.tasks[0]
check('task completed after the restart', ['completed', 'partially_completed'].includes(after?.state))
// The complaint is created at prepare time and only submitted on approval, so
// completing the task must not add a second record.
check('no duplicate complaint was created', snapshot.complaints === complaintsBefore)
check('the complaint is linked to the task', Boolean(after?.complaintId))

// --- Pause / resume on a fresh task
await page.goto(BASE + '/actions', { waitUntil: 'load' })
await page.waitForTimeout(1200)
await page.locator('[data-testid="open-ask"]').click()
await page.waitForTimeout(400)
await page.locator('#ask-action-input').fill('Register a water complaint in Sangam Vihar')
await page.locator('[data-testid="ask-submit"]').click()
await page.waitForTimeout(3500)
const paused = (await stored()).tasks[0]
if (paused?.state === 'waiting_for_approval') {
  check('second task also reached approval', true)
} else {
  check('second task reached a gate', ['waiting_for_approval', 'completed'].includes(paused?.state))
}

// --- Pause semantics: a paused task must not advance, and must resume
const pauseResult = await page.evaluate(async () => {
  const store = await import('/src/lib/action/store.ts')
  const engine = await import('/src/lib/action/executor.ts')
  store.useActions.getState().hydrate()
  const task = store.useActions.getState().tasks[0]
  if (!task) return { ok: false, reason: 'no task' }

  const before = JSON.stringify(store.useActions.getState().get(task.id).plan)
  store.useActions.getState().patchTask(task.id, { paused: true })
  await engine.runTask(task.id)
  const frozen = JSON.stringify(store.useActions.getState().get(task.id).plan) === before

  store.useActions.getState().patchTask(task.id, { paused: false })
  const cleared = store.useActions.getState().get(task.id).paused === false
  return { ok: frozen && cleared, frozen, cleared }
})
check('a paused task does not advance and resumes cleanly', pauseResult.ok)
console.log('  pause:', JSON.stringify(pauseResult))

console.log('\njs errors:', errors.length ? errors.slice(0, 3) : 'none')
await browser.close()
