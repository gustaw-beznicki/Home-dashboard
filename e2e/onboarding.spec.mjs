import { expect, test } from 'playwright/test'
import { mkdir } from 'node:fs/promises'

// Walks the six-step onboarding wizard the way a freshly invited domownik
// would, on the real Worker + local D1 (via the dev bypass with
// DEV_ONBOARDING:true — see playwright.config.mjs).
//
// Doubles as the screenshot source for PR descriptions: set SHOTS_DIR and
// every named capture below lands there as a PNG, so the images reviewers see
// are by construction taken from a passing flow.

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

test.describe('phone, light', () => {
  test.use({ viewport: MOBILE, colorScheme: 'light' })

  test('full walk: welcome → name → stops → demo check-off → draft → dashboard', async ({
    page,
  }) => {
    await page.goto('/')

    // Step 0 — welcome (hero surface)
    await expect(page.getByRole('heading', { name: 'Wchodzisz na wspólną listę.' })).toBeVisible()
    await shot(page, 'onboarding-welcome-mobile-light', { fullPage: true })
    await page.getByRole('button', { name: 'Wchodzę' }).click()

    // Step 1 — name and avatar colour; the preview repeats the choice back
    await expect(page.getByRole('heading', { name: 'Jak Cię wołać?' })).toBeVisible()
    await page.getByPlaceholder('Kuba').fill('Kuba')
    await page.getByRole('button', { name: 'bordo' }).click()
    await expect(page.getByText('Kuba · dziś 9:40')).toBeVisible()
    await page.getByRole('button', { name: 'Dalej' }).click()

    // Step 2 — the three stops
    await expect(page.getByRole('heading', { name: 'Lista ma trzy przystanki' })).toBeVisible()
    await expect(page.getByText('Na spokojnie')).toBeVisible()
    await page.getByRole('button', { name: 'Dalej' }).click()

    // Step 3 — demo check-off, with the undo affordance actually working
    await expect(page.getByRole('heading', { name: 'Spróbuj odhaczyć' })).toBeVisible()
    await page.getByRole('button', { name: 'Zrobione' }).click()
    await expect(page.getByText('Zapisane na Ciebie.', { exact: false })).toBeVisible()
    await shot(page, 'onboarding-try-mobile-light', { fullPage: true })
    await page.getByRole('button', { name: 'cofnij' }).click()
    await expect(page.getByText('Zapisane na Ciebie.', { exact: false })).toBeHidden()
    await page.getByRole('button', { name: 'Zrobione' }).click()
    await page.getByRole('button', { name: 'Dalej' }).click()

    // Step 4 — the optional first task
    await expect(page.getByRole('heading', { name: 'Dorzuć coś swojego' })).toBeVisible()
    await page.getByPlaceholder('np. wynieść śmieci co wtorek').fill('Umyć okna na balkonie')
    await page.getByRole('button', { name: 'Dalej' }).click()

    // Step 5 — done, and out to the dashboard
    await expect(page.getByRole('heading', { name: 'Wszystko gotowe.' })).toBeVisible()
    await page.getByRole('button', { name: 'Pokaż listę' }).click()
    await expect(page.getByText('Cześć', { exact: false })).toBeVisible()
  })
})

test.describe('phone, dark', () => {
  test.use({ viewport: MOBILE, colorScheme: 'dark' })

  test('name step honours the system theme', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Wchodzę' }).click()
    await expect(page.getByRole('heading', { name: 'Jak Cię wołać?' })).toBeVisible()
    // The dark class comes from App's useDarkMode, not from Dashboard —
    // this is exactly the regression this assertion guards.
    await expect(page.locator('html')).toHaveClass(/dark/)
    await shot(page, 'onboarding-name-mobile-dark', { fullPage: true })
  })
})

test.describe('desktop, light', () => {
  test.use({ viewport: DESKTOP, colorScheme: 'light' })

  test('step rail navigates directly and shows progress', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Wchodzisz na wspólną listę.' })).toBeVisible()
    await shot(page, 'onboarding-welcome-desktop-light')

    // The rail is the desktop navigation: every step is one click away.
    await page.getByRole('button', { name: 'Twoje imię' }).click()
    await expect(page.getByRole('heading', { name: 'Jak Cię wołać?' })).toBeVisible()
    await expect(page.getByText('Krok 2 z 6')).toBeVisible()
    await shot(page, 'onboarding-name-desktop-light')
  })
})

test.describe('desktop, dark', () => {
  test.use({ viewport: DESKTOP, colorScheme: 'dark' })

  test('finish screen', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Gotowe' }).click()
    await expect(page.getByRole('heading', { name: 'Wszystko gotowe.' })).toBeVisible()
    await shot(page, 'onboarding-done-desktop-dark')
  })
})
