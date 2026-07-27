import { expect, test } from 'playwright/test'
import { mkdir } from 'node:fs/promises'

// What the task sheet demands before it will save, and what it lets you skip.
// Runs against the real Worker + local D1 via the dev bypass (ADR 0011).
//
// Worth an e2e and not only a jsdom test: the required/optional signalling is
// the difference between a greyed-out button someone understands and one they
// file as a bug. The jsdom tests in src/components/TaskViews.test.jsx assert the
// same rules against the component in isolation; these assert them against what
// the browser actually paints, at the two viewports the app is designed for.

const SHOTS_DIR = process.env.SHOTS_DIR
const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

const WEEKDAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela']

async function shot(page, name, options = {}) {
  if (!SHOTS_DIR) return
  await mkdir(SHOTS_DIR, { recursive: true })
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png`, ...options })
}

// The shared config runs the Worker with DEV_ONBOARDING:true, and the bypass
// writes no `users` row, so the wizard greets every page load. Jump it: the
// phone header has "pomiń", the desktop rail lets you click the last step.
async function skipOnboarding(page) {
  // Wait for the wizard to mount before asking which header it drew: "pomiń"
  // is phone-only (lg:hidden), so probing its visibility too early answers
  // "no" on a phone as well and sends us down the desktop branch.
  await expect(page.getByRole('button', { name: 'Wchodzę' })).toBeVisible()

  const skip = page.getByRole('button', { name: 'pomiń' })
  if (await skip.isVisible()) {
    await skip.click()
  } else {
    await page.getByRole('button', { name: 'Gotowe' }).click()
  }
  await page.getByRole('button', { name: 'Pokaż listę' }).click()
}

async function openSheet(page) {
  await page.goto('/')
  await skipOnboarding(page)

  // The + beside quick-add, with the field left empty: opens the sheet with no
  // name, which is the state a first-time user sees and the one that blocks.
  await page.getByRole('button', { name: 'Nowa rzecz' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

function saveButton(page) {
  return page.getByRole('button', { name: 'Dodaj do domu' })
}

test.describe('phone, light', () => {
  test.use({ viewport: MOBILE, colorScheme: 'light' })

  test('the dead save button explains itself, and stops explaining once fixed', async ({
    page,
  }) => {
    await openSheet(page)

    await expect(saveButton(page)).toBeDisabled()
    await expect(page.getByText('Wpisz nazwę, żeby zapisać.')).toBeVisible()
    await shot(page, 'task-sheet-name-required-mobile-light', { fullPage: true })

    await page.getByPlaceholder('Co trzeba ogarnąć?').fill('Przegląd techniczny')
    await expect(page.getByText('Wpisz nazwę, żeby zapisać.')).toBeHidden()
    await expect(saveButton(page)).toBeEnabled()
  })

  test('marks exactly the two fields that may be left empty', async ({ page }) => {
    await openSheet(page)

    // Not a count for its own sake: the convention is that only the skippable
    // fields are marked, so a third tag appearing means the convention slipped.
    await expect(page.getByText('opcjonalne')).toHaveCount(2)
    await expect(page.getByLabel(/Ostatnio zrobione/)).toBeVisible()
    await expect(page.getByLabel(/Notatka/)).toBeVisible()
  })

  test('an emptied weekday list blocks the save instead of silently guessing', async ({ page }) => {
    await openSheet(page)
    await page.getByPlaceholder('Co trzeba ogarnąć?').fill('Wynieść śmieci')
    await page.getByRole('button', { name: 'co tydzień' }).click()

    // Which day is pre-ticked depends on today, so clear whatever is pressed.
    for (const day of WEEKDAYS) {
      const chip = page.getByRole('button', { name: day, exact: true })
      if ((await chip.getAttribute('aria-pressed')) === 'true') await chip.click()
    }

    await expect(page.getByText('Zaznacz przynajmniej jeden dzień.')).toBeVisible()
    await expect(saveButton(page)).toBeDisabled()
    await shot(page, 'task-sheet-weekdays-required-mobile-light', { fullPage: true })

    await page.getByRole('button', { name: 'czwartek', exact: true }).click()
    await expect(page.getByText('Zaznacz przynajmniej jeden dzień.')).toBeHidden()
    await expect(saveButton(page)).toBeEnabled()
  })
})

test.describe('desktop, light', () => {
  test.use({ viewport: DESKTOP, colorScheme: 'light' })

  test('each rhythm shows only its own controls', async ({ page }) => {
    await openSheet(page)

    await page.getByRole('button', { name: 'co miesiąc' }).click()
    await expect(page.getByText('pierwszego dnia')).toBeVisible()
    // The point of the whole exercise: no weekday picker under a monthly rhythm.
    await expect(page.getByText('W które dni?')).toBeHidden()
    await expect(page.getByLabel('Co ile dni')).toBeHidden()
    await shot(page, 'task-sheet-monthly-desktop-light')

    await page.getByRole('button', { name: 'co tydzień' }).click()
    await expect(page.getByText('W które dni?')).toBeVisible()
    await expect(page.getByText('pierwszego dnia')).toBeHidden()

    await page.getByRole('button', { name: 'co kilka dni' }).click()
    await expect(page.getByLabel('Co ile dni')).toBeVisible()
    await expect(page.getByText('W które dni?')).toBeHidden()

    // Manual drops the anchor and the preview with it — there is nothing to
    // count from and no deadline to show.
    await page.getByRole('button', { name: 'bez rytmu' }).click()
    await expect(page.getByText('Od kiedy liczymy?')).toBeHidden()
    await expect(page.getByText('Wypadnie')).toBeHidden()
  })

  test('a yearly rhythm survives the round trip through D1', async ({ page }) => {
    await openSheet(page)

    const name = `Przegląd techniczny ${Date.now()}`
    test.info().annotations.push({ type: 'creates', description: name })
    await page.getByPlaceholder('Co trzeba ogarnąć?').fill(name)

    await page.getByRole('button', { name: 'co rok' }).click()
    await page.getByRole('button', { name: '2 lata', exact: true }).click()

    // No day picker under a yearly rhythm — the anchor holds the date.
    await expect(page.getByText('W które dni?')).toBeHidden()
    await expect(page.getByText('pierwszego dnia')).toBeHidden()
    await expect(page.getByText('Dzień i miesiąc bierzemy z daty poniżej.')).toBeVisible()

    // The preview is the proof the cadence reached recurrence.js: two years
    // between deadlines, not two months. Assert the dates, not just the caption —
    // an earlier version of this test checked only the caption and let through a
    // preview rendering three different years as three identical "27 lipca".
    await expect(page.getByText('co 2 lata')).toBeVisible()
    const previewed = await page
      .locator('p', { hasText: /^\d+ \w+( \d{4})?$/ })
      .allInnerTexts()
    const years = previewed.map((t) => t.match(/\d{4}$/)?.[0] ?? String(new Date().getFullYear()))
    expect(new Set(years).size).toBeGreaterThan(1)

    await saveButton(page).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Reload: this is what proves the two new columns were written and read
    // back, rather than the cadence living only in React state.
    await page.reload()
    await skipOnboarding(page)
    await page.getByText(name).click()
    await expect(page.getByRole('button', { name: 'co rok' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByRole('button', { name: '2 lata', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('a task with only the required fields filled reaches the list', async ({ page }) => {
    await openSheet(page)

    // The local D1 is shared across runs, so this test cleans up after itself
    // rather than leaving a pile of near-identical rows behind.
    const name = `Przegląd techniczny ${Date.now()}`
    test.info().annotations.push({ type: 'creates', description: name })
    await page.getByPlaceholder('Co trzeba ogarnąć?').fill(name)
    // Nothing else touched: no last-done, no note, default category and rhythm.
    await saveButton(page).click()

    await expect(page.getByRole('dialog')).toBeHidden()
    // Through the Worker and into D1 — a reload proves it was not just optimism
    // in local state.
    await expect(page.getByText(name)).toBeVisible()

    await page.reload()
    await skipOnboarding(page)
    await expect(page.getByText(name)).toBeVisible()
  })

  // Asserts the delete actually landed rather than firing and forgetting: a
  // silently-wrong endpoint here would leak a row per run into the local D1 and
  // nobody would notice until the list was full of them.
  test.afterEach(async ({ page }) => {
    for (const { type, description } of test.info().annotations) {
      if (type !== 'creates') continue

      const before = await (await page.request.get('/api/tasks')).json()
      const doomed = before.filter((task) => task.name === description)
      expect(doomed.length).toBeGreaterThan(0)

      for (const task of doomed) {
        const res = await page.request.delete(`/api/tasks/${task.id}`)
        expect(res.ok(), `DELETE /api/tasks/${task.id}`).toBeTruthy()
      }

      const after = await (await page.request.get('/api/tasks')).json()
      expect(after.filter((task) => task.name === description)).toHaveLength(0)
    }
  })
})

test.describe('phone, dark', () => {
  test.use({ viewport: MOBILE, colorScheme: 'dark' })

  test('the required-field hint is legible in the dark theme too', async ({ page }) => {
    await openSheet(page)
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByText('Wpisz nazwę, żeby zapisać.')).toBeVisible()
    await shot(page, 'task-sheet-name-required-mobile-dark', { fullPage: true })
  })
})

// The two dates a rhythm hangs off, in a real browser. Worth it here because the
// bug was a browser-behaviour bug: "inna data" was a `<label>` around an
// `sr-only` date input, and browsers only open the date picker from the calendar
// indicator or `showPicker()` — so the control was inert in a way jsdom cannot
// notice, since jsdom has no picker to fail to open.
test.describe('anchor shortcuts, desktop light', () => {
  test.use({ viewport: DESKTOP, colorScheme: 'light' })

  test('"inna data" opens a field you can type into', async ({ page }) => {
    await openSheet(page)
    const dialog = page.getByRole('dialog')

    // A fresh sheet is anchored today, so the custom field starts closed.
    await dialog.getByRole('button', { name: 'od dziś' }).click()
    const field = dialog.getByLabel('Od kiedy liczymy?')
    await expect(field).toBeHidden()

    await dialog.getByRole('button', { name: 'inna data' }).click()
    await expect(field).toBeVisible()

    await field.fill('2026-03-05')
    await expect(dialog.getByText('czwartek, 5 marca')).toBeVisible()
    await shot(page, 'anchor-custom-date-desktop-light')
  })

  test('the last completion drives the preview, and can be the anchor', async ({ page }) => {
    await openSheet(page)
    const dialog = page.getByRole('dialog')

    // With no completion there is nothing to count from, so no shortcut for it.
    await expect(dialog.getByRole('button', { name: 'od ostatniej daty' })).toBeHidden()

    await dialog.getByRole('button', { name: 'co miesiąc' }).click()
    await dialog.getByText('pierwszego dnia').click()
    await dialog.locator('#task-last-done').fill('2026-06-01')

    // A fresh sheet is anchored today, and the anchor means "not before this", so
    // a completion from June is behind the grid and correctly ignored: the first
    // deadline is still the next 1st.
    const fromLast = dialog.getByRole('button', { name: 'od ostatniej daty' })
    await expect(fromLast).toBeVisible()
    await expect(dialog.locator('#task-last-done')).toHaveValue('2026-06-01')
    await expect(dialog.getByText('1 lipca')).toBeHidden()

    // Which is exactly what the shortcut is for: move the grid back to the
    // completion, and the preview starts from the deadline that followed it.
    await fromLast.click()
    await expect(fromLast).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.getByText('poniedziałek, 1 czerwca')).toBeVisible()
    await expect(dialog.getByText('1 lipca')).toBeVisible()
    await expect(dialog.getByText('1 sierpnia')).toBeVisible()
  })
})

