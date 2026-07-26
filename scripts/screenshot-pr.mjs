// Captures the screenshots the /pr-description command attaches to a PR.
//
//   node scripts/screenshot-pr.mjs --out docs/screenshots/pr-14
//
// Assumes the app is already serving on --base (default http://localhost:8787).
// Start it with `npm run dev-no-auth`, which needs no Google credentials — that
// is precisely what it exists for (ADR 0011) — and `npm run db:seed:local` so
// there is something on the list worth looking at.
//
// Playwright is a hard dependency of this script. The command installs it.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1])
}

const BASE = args.get('base') || 'http://localhost:8787'
const OUT = args.get('out') || 'docs/screenshots/local'

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

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
  { name: 'admin-desktop-light', route: '/admin', viewport: DESKTOP, scheme: 'light' },
]

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
  const context = await browser.newContext({
    viewport: shot.viewport,
    colorScheme: shot.scheme,
    deviceScaleFactor: 2,
    // Motion is decoration here; freezing it keeps the images reproducible.
    reducedMotion: 'reduce',
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
