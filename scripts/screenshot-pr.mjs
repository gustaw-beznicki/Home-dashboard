// Captures the screenshots the /pr-description command attaches to a PR.
//
//   node scripts/screenshot-pr.mjs --out "$(mktemp -d)/shots"
//
// The output goes outside the repo: PR screenshots are uploaded as assets on a
// `pr-N-images` prerelease, never committed. Omitting --out writes to the system
// temp directory rather than into the working tree.
//
// Assumes the app is already serving on --base (default http://localhost:8787).
// Start it with `npm run dev:no-auth`, which needs no Google credentials — that
// is precisely what it exists for (ADR 0011) — and `npm run db:seed:local` so
// there is something on the list worth looking at.
//
// Playwright is a hard dependency of this script. The command installs it.

import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

const run = promisify(execFile)

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1])
}

const BASE = args.get('base') || 'http://localhost:8787'
// Defaults outside the repo on purpose. PR screenshots are uploaded as release
// assets, never committed, so a forgotten --out must not drop 3 MB of PNGs into
// the working tree. The one committed image is docs/img/, for the README.
const OUT = args.get('out') || path.join(os.tmpdir(), 'ogarniamy-shots')

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

const WEEKDAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela']

// Each shot names the file, the viewport, the colour scheme, and an optional
// interaction to run before capturing. Keep the list small and deliberate —
// a reviewer skims five useful images and ignores twenty.
const SHOTS = [
  { name: 'dashboard-mobile-light', route: '/', viewport: MOBILE, scheme: 'light', fullPage: true },
  { name: 'dashboard-mobile-dark', route: '/', viewport: MOBILE, scheme: 'dark', fullPage: true },
  { name: 'dashboard-desktop-light', route: '/', viewport: DESKTOP, scheme: 'light' },
  { name: 'dashboard-desktop-dark', route: '/', viewport: DESKTOP, scheme: 'dark' },
  {
    name: 'task-sheet-mobile-light',
    route: '/',
    viewport: MOBILE,
    scheme: 'light',
    action: openFirstTask,
  },
  {
    name: 'rhythm-editor-desktop-light',
    route: '/',
    viewport: DESKTOP,
    scheme: 'light',
    action: async (page) => {
      await openFirstTask(page)
      // "co kilka dni" reveals the slider, which is the control worth showing.
      const chip = page.getByRole('button', { name: 'co kilka dni' })
      if (await chip.count()) await chip.first().click()
    },
  },
  {
    name: 'quick-add-suggestions-mobile-light',
    route: '/',
    viewport: MOBILE,
    scheme: 'light',
    action: (page) => typeIntoQuickAdd(page, 'podl'),
  },
  {
    name: 'quick-add-suggestions-mobile-dark',
    route: '/',
    viewport: MOBILE,
    scheme: 'dark',
    action: (page) => typeIntoQuickAdd(page, 'podl'),
  },
  {
    name: 'quick-add-suggestions-desktop-light',
    route: '/',
    viewport: DESKTOP,
    scheme: 'light',
    action: (page) => typeIntoQuickAdd(page, 'filtr'),
  },
  {
    name: 'quick-add-prefilled-sheet-mobile-light',
    route: '/',
    viewport: MOBILE,
    scheme: 'light',
    action: async (page) => {
      await typeIntoQuickAdd(page, 'smieci')
      await page.getByRole('option').first().click()
      await page.waitForTimeout(400) // the sheet transition is 260ms
    },
  },
  // A *new* task, not an existing one: the required-field signalling only shows
  // on a sheet that has nothing in it yet, which openFirstTask never produces.
  // Not fullPage: the sheet scrolls inside itself, so a full-page capture just
  // adds dashboard behind it and still crops the sheet. Two framed shots
  // instead — the top carries the name hint, the bottom the optional markers.
  {
    name: 'task-sheet-required-mobile-light',
    route: '/',
    viewport: MOBILE,
    scheme: 'light',
    action: openEmptySheet,
  },
  {
    name: 'task-sheet-required-mobile-dark',
    route: '/',
    viewport: MOBILE,
    scheme: 'dark',
    action: openEmptySheet,
  },
  {
    name: 'task-sheet-optional-mobile-light',
    route: '/',
    viewport: MOBILE,
    scheme: 'light',
    action: async (page) => {
      await openEmptySheet(page)
      await page
        .getByRole('dialog')
        .evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
      await page.waitForTimeout(300)
    },
  },
  {
    name: 'task-sheet-weekdays-required-desktop-light',
    route: '/',
    viewport: DESKTOP,
    scheme: 'light',
    action: async (page) => {
      await openEmptySheet(page)
      await page.getByRole('button', { name: 'co tydzień' }).click()
      for (const day of WEEKDAYS) {
        const chip = page.getByRole('button', { name: day, exact: true })
        if ((await chip.getAttribute('aria-pressed')) === 'true') await chip.click()
      }
    },
  },
  // The two panels the cadence work adds. Yearly is the interesting one: no day
  // rules at all, because the anchor below holds the month and the day.
  {
    name: 'rhythm-yearly-desktop-light',
    route: '/',
    viewport: DESKTOP,
    scheme: 'light',
    action: async (page) => {
      await openEmptySheet(page)
      await page.getByPlaceholder('Co trzeba ogarnąć?').fill('Przegląd techniczny')
      await page.getByRole('button', { name: 'co rok' }).click()
      await page.getByRole('button', { name: '2 lata', exact: true }).click()
    },
  },
  {
    name: 'rhythm-yearly-mobile-dark',
    route: '/',
    viewport: MOBILE,
    scheme: 'dark',
    action: async (page) => {
      await openEmptySheet(page)
      await page.getByPlaceholder('Co trzeba ogarnąć?').fill('Przegląd techniczny')
      await page.getByRole('button', { name: 'co rok' }).click()
      await page.getByRole('button', { name: '2 lata', exact: true }).click()
    },
  },
  {
    name: 'rhythm-quarterly-desktop-light',
    route: '/',
    viewport: DESKTOP,
    scheme: 'light',
    action: async (page) => {
      await openEmptySheet(page)
      await page.getByPlaceholder('Co trzeba ogarnąć?').fill('Wymienić filtr wody')
      await page.getByRole('button', { name: 'co miesiąc' }).click()
      await page.getByRole('button', { name: 'kwartał', exact: true }).click()
    },
  },
  {
    name: 'rhythm-nth-weekday-desktop-light',
    route: '/',
    viewport: DESKTOP,
    scheme: 'light',
    action: async (page) => {
      await openEmptySheet(page)
      await page.getByPlaceholder('Co trzeba ogarnąć?').fill('Segregacja i wystawka')
      await page.getByRole('button', { name: 'co miesiąc' }).click()
      await page.getByText('w dany dzień tygodnia').click()
      await page.getByLabel('Która z kolei').selectOption('3')
      await page.getByLabel('Dzień tygodnia').selectOption('3')
    },
  },
  // Closing the day. Ticking everything off is the only way to reach it, and it
  // has to be captured while the leaves are still falling — the fall is the
  // longest animation in the system at 2.6s, so `settle` alone would miss it.
  {
    name: 'day-complete-desktop-light',
    route: '/',
    viewport: DESKTOP,
    scheme: 'light',
    reseed: true,
    action: clearTheDay,
  },
  {
    name: 'day-complete-mobile-dark',
    route: '/',
    viewport: MOBILE,
    scheme: 'dark',
    reseed: true,
    action: clearTheDay,
  },
  // The same state with motion allowed, which is the only way the leaves appear
  // in an image — and the pair of shots is also the proof that reduced motion
  // drops them rather than merely slowing them down.
  {
    name: 'day-complete-leaves-desktop-light',
    route: '/',
    viewport: DESKTOP,
    scheme: 'light',
    motion: 'allow',
    reseed: true,
    action: clearTheDay,
  },
  { name: 'admin-desktop-light', route: '/admin', viewport: DESKTOP, scheme: 'light' },
  { name: 'panel-desktop-light', route: '/panel', viewport: DESKTOP, scheme: 'light' },
  { name: 'panel-mobile-light', route: '/panel', viewport: MOBILE, scheme: 'light', fullPage: true },
  {
    name: 'panel-data-desktop-light',
    route: '/panel',
    viewport: DESKTOP,
    scheme: 'light',
    action: async (page) => {
      const nav = page.getByRole('button', { name: /Dane domu/ })
      if (await nav.count()) await nav.first().click()
    },
  },
]

// The chore catalog behind the suggestions is imported on first focus
// (ADR 0014), so the list needs a moment after typing before it exists.
async function typeIntoQuickAdd(page, query) {
  const input = page.getByRole('combobox')
  await input.click()
  await input.fill(query)
  await page.getByRole('option').first().waitFor({ timeout: 5000 })
}

// The + beside quick-add with the field left empty — the state that blocks.
async function openEmptySheet(page) {
  await page.getByRole('button', { name: 'Nowa rzecz' }).click()
  await page.getByRole('dialog').waitFor({ timeout: 5000 })
  await page.waitForTimeout(400) // the sheet transition is 260ms
}

// Tick off everything that fell due today. "Na spokojnie" cards carry no tick
// button at all, so the loop runs dry exactly when the day is closed — which is
// also the definition the progress bar uses.
async function clearTheDay(page) {
  for (let i = 0; i < 30; i += 1) {
    const tick = page.getByRole('button', { name: /^Zrobione:/ })
    if (!(await tick.count())) break
    await tick.first().click()
    await page.waitForTimeout(200)
  }
  // Long enough for the medallion (520ms) and the staggered lines, short enough
  // that leaves are still mid-fall.
  await page.waitForTimeout(1100)
}

// The seed truncates `tasks` and `completions` before inserting, so this puts the
// list back to a known state. Needed by any shot that ticks things off: without
// it the second such shot loads a database where everything is already done, the
// undo window has long closed, and it captures a screen the person would never
// see. `--skip-reseed` opts out for a run against a database you set up by hand.
// Read off argv directly rather than out of `args`, which pairs every flag with
// the token after it and would swallow the next option.
const SKIP_RESEED = process.argv.includes('--skip-reseed')

async function reseed() {
  if (SKIP_RESEED) return
  await run('npm', ['run', 'db:seed:local'], { shell: true })
}

async function openFirstTask(page) {
  // The card title is a stretched-link button, so it is the reliable handle.
  const card = page.locator('article').first()
  await card.waitFor({ timeout: 5000 })
  await card.locator('button').first().click()
  await page.waitForTimeout(400) // the sheet transition is 260ms
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  // Web fonts land after first paint and shift metrics noticeably.
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await page.waitForTimeout(350)
}

const browser = await chromium.launch()
const written = []
const failed = []

for (const shot of SHOTS) {
  if (shot.reseed) await reseed()
  const context = await browser.newContext({
    viewport: shot.viewport,
    colorScheme: shot.scheme,
    deviceScaleFactor: 2,
    // Motion is decoration here; freezing it keeps the images reproducible. The
    // one exception is a shot whose subject *is* the motion — `motion: 'allow'`
    // is how the falling leaves get captured at all, since under `reduce` they
    // are removed outright and the shot would silently prove nothing.
    reducedMotion: shot.motion === 'allow' ? 'no-preference' : 'reduce',
  })
  const page = await context.newPage()
  const problems = []
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))
  page.on('pageerror', (e) => problems.push(String(e)))

  try {
    await page.goto(`${BASE}${shot.route}`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    if (shot.action) await shot.action(page)
    await settle(page)

    const file = path.join(OUT, `${shot.name}.png`)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, await page.screenshot({ fullPage: !!shot.fullPage }))
    written.push({ file, problems })
  } catch (err) {
    failed.push({ name: shot.name, error: String(err) })
  } finally {
    await context.close()
  }
}

await browser.close()

for (const { file, problems } of written) {
  console.log(`ok   ${file}${problems.length ? `  (console errors: ${problems.length})` : ''}`)
  // Surface these loudly: a screenshot that renders fine while the console is
  // full of errors is exactly the thing a reviewer would miss.
  for (const p of problems.slice(0, 3)) console.log(`       ! ${p}`)
}
for (const { name, error } of failed) console.log(`FAIL ${name}: ${error}`)

console.log(`\n${written.length}/${SHOTS.length} captured into ${OUT}`)
if (failed.length) process.exitCode = 1
