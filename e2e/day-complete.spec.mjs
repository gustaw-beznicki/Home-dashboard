import { expect, test } from 'playwright/test'
import { mkdir } from 'node:fs/promises'

// Closing the day: the progress bar filling and the reward that follows.
//
// Worth a browser and not only jsdom for two reasons. The reward must not take
// undo away — a rule that is about layout and only breaks against real data, and
// did: an earlier version tested "the list isn't empty", which is still true when
// the only thing left is the quiet group. And the falling leaves are removed by a
// CSS media query, which jsdom does not evaluate; the shared config runs with
// `reducedMotion: 'reduce'`, so this run is the one that proves they go.
//
// The spec brings its own day rather than relying on what is in the database.
// That is not tidiness: locally the database is seeded and has six things due,
// while CI never runs `db:seed:local` and starts empty — so a version of this
// that ticked off "whatever is due" passed here and failed there against a list
// with nothing on it. Three things anchored today, created and removed per test.

const SHOTS_DIR = process.env.SHOTS_DIR
const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

async function shot(page, name, options = {}) {
  if (!SHOTS_DIR) return
  await mkdir(SHOTS_DIR, { recursive: true })
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png`, ...options })
}

// Same jump as task-sheet.spec.mjs: the bypass writes no `users` row, so the
// wizard greets every load. Wait for it to mount before asking which header it
// drew — "pomiń" is phone-only, and probing too early answers "no" either way.
async function skipOnboarding(page) {
  await expect(page.getByRole('button', { name: 'Wchodzę' })).toBeVisible()

  const skip = page.getByRole('button', { name: 'pomiń' })
  if (await skip.isVisible()) {
    await skip.click()
  } else {
    await page.getByRole('button', { name: 'Gotowe' }).click()
  }
  await page.getByRole('button', { name: 'Pokaż listę' }).click()
}

// The hero and its progress bar paint before /api/tasks resolves, and an empty
// list reads as a finished day — so anything that counts cards has to wait for
// the cards. `count()` does not auto-wait: asked too early it answers "nothing to
// tick off", and the loop below would exit having done nothing while every
// assertion after it still looked plausible.
async function waitForList(page) {
  await expect(page.locator('article').first()).toBeVisible()
}

// Tick off everything that fell due today. "Na spokojnie" cards carry no tick
// button at all, so this runs dry exactly when the day is closed — the same
// definition the progress bar uses.
async function clearTheDay(page) {
  await waitForList(page)
  const ticks = page.getByRole('button', { name: /^Zrobione:/ })
  await expect(ticks.first()).toBeVisible()

  for (let i = 0; i < 40; i += 1) {
    if ((await ticks.count()) === 0) return
    await ticks.first().click()
    await page.waitForTimeout(120)
  }
  throw new Error('the list never ran out of things to tick off')
}

function isoToday() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const FIXTURES = [
  { name: 'E2E dzień: podlać monsterę', category: 'plants' },
  { name: 'E2E dzień: wynieść śmieci', category: 'home' },
  { name: 'E2E dzień: witamina D', category: 'health' },
]

async function giveTheDaySomeWork(page) {
  for (const fixture of FIXTURES) {
    const response = await page.request.post('/api/tasks', {
      data: { ...fixture, note: '', interval: { type: 'daily', startsOn: isoToday() } },
    })
    expect(response.ok(), await response.text()).toBe(true)
  }
}

async function takeItAway(page) {
  const tasks = await (await page.request.get('/api/tasks')).json()
  for (const task of tasks) {
    if (task.name.startsWith('E2E dzień: ')) await page.request.delete(`/api/tasks/${task.id}`)
  }
}

// Reopen the day through the API, not through the "cofnij" affordance. The
// affordance lives for UNDO_WINDOW_MS (8s) after the tick, which is less than a
// test spends asserting — restoring through the UI worked when it ran alone and
// silently did nothing the moment the window had closed, leaving the next test
// looking at a day it could not reopen.
//
// Only today's completions go: deleting the newest row per task walks history
// backwards, and the seeded history behind the week card has no reason to be a
// casualty of a layout test.
async function reopenTheDay({ page }) {
  const today = isoToday()
  const tasks = await (await page.request.get('/api/tasks')).json()
  for (const task of tasks) {
    if (task.lastDone === today) await page.request.delete(`/api/tasks/${task.id}/complete`)
  }
}

// Each test starts from an open day with work on it and leaves the database as it
// found it, so the pair can run in either order and running the file twice in a
// row behaves the same as running it once.
test.beforeEach(async ({ page }) => {
  await reopenTheDay({ page })
  await giveTheDaySomeWork(page)
})

test.afterEach(async ({ page }) => {
  await takeItAway(page)
  await reopenTheDay({ page })
})

test.describe('phone, dark', () => {
  test.use({ viewport: MOBILE, colorScheme: 'dark' })

  test('the bar fills as the day empties, and 100% is reached, not rounded to', async ({ page }) => {
    await page.goto('/')
    await skipOnboarding(page)

    await waitForList(page)
    const bar = page.getByRole('progressbar')
    await expect(bar).toBeVisible()
    const before = Number(await bar.getAttribute('aria-valuenow'))
    expect(before).toBeLessThan(100)

    await page.getByRole('button', { name: /^Zrobione:/ }).first().click()
    await expect
      .poll(async () => Number(await bar.getAttribute('aria-valuenow')))
      .toBeGreaterThan(before)
    await shot(page, 'day-progress-mobile-dark', { fullPage: true })

    await clearTheDay(page)
    await expect(bar).toHaveAttribute('aria-valuenow', '100')
  })
})

test.describe('desktop, light', () => {
  test.use({ viewport: DESKTOP, colorScheme: 'light' })

  test('the reward stands above the things just ticked off, not in their place', async ({
    page,
  }) => {
    await page.goto('/')
    await skipOnboarding(page)
    await clearTheDay(page)
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')

    const reward = page.getByText('Wszystko z głowy.')
    await expect(reward).toBeVisible()

    // The rule the layout exists to keep: undo is still one click away.
    const undo = page.getByRole('button', { name: 'cofnij' }).first()
    await expect(undo).toBeVisible()

    // And above, not below — a reward under the list would scroll out of sight.
    const rewardBox = await reward.boundingBox()
    const undoBox = await undo.boundingBox()
    expect(rewardBox.y).toBeLessThan(undoBox.y)

    // Decoration only, so the media query removes it rather than slowing it down.
    await expect(page.locator('[data-leaf]').first()).toBeHidden()

    await shot(page, 'day-complete-desktop-light')

    // Taking one back reopens the day: the reward has to go with it.
    await undo.click()
    await expect(reward).toBeHidden()
  })
})
