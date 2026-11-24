import type { Page } from '@playwright/test'
import { expect, gotoHydrated, test } from './fixtures'

const SEARCH_URL = '/trouver-un-logement-etudiant/ville/saint-etienne'
const STORAGE_KEY = 'mle:search-alert-banner-dismissed:ville:saint-etienne'
const DAY_MS = 24 * 60 * 60 * 1000

const bannerTitle = (page: Page) => page.getByRole('heading', { name: /Soyez prévenu dès qu.un logement se libère à Saint-Étienne/ })

async function seedDismissal(page: Page, key: string, daysAgo: number) {
  await page.addInitScript(
    ([storageKey, value]) => window.localStorage.setItem(storageKey, value),
    [key, new Date(Date.now() - daysAgo * DAY_MS).toISOString()],
  )
}

test.describe("Bandeau d'alerte des résultats de recherche", () => {
  test('affiche le bandeau sans fermeture enregistrée, puis le masque durablement une fois fermé', async ({ page }) => {
    await gotoHydrated(page, SEARCH_URL)
    await expect(bannerTitle(page)).toBeVisible()

    await page.getByRole('button', { name: "Masquer le bandeau d'alerte" }).click()
    await expect(bannerTitle(page)).toHaveCount(0)
    expect(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).not.toBeNull()

    await gotoHydrated(page, SEARCH_URL)
    await expect(page.getByText('Résidence E2E du Centre')).toBeVisible()
    await expect(bannerTitle(page)).toHaveCount(0)
  })

  test('masque le bandeau fermé il y a moins de 30 jours', async ({ page }) => {
    await seedDismissal(page, STORAGE_KEY, 5)
    await gotoHydrated(page, SEARCH_URL)

    await expect(page.getByText('Résidence E2E du Centre')).toBeVisible()
    await expect(bannerTitle(page)).toHaveCount(0)
  })

  test('réaffiche le bandeau fermé il y a plus de 30 jours', async ({ page }) => {
    await seedDismissal(page, STORAGE_KEY, 31)
    await gotoHydrated(page, SEARCH_URL)

    await expect(bannerTitle(page)).toBeVisible()
  })

  test('affiche le bandeau fermé sur un autre territoire', async ({ page }) => {
    await seedDismissal(page, 'mle:search-alert-banner-dismissed:ville:roanne', 1)
    await gotoHydrated(page, SEARCH_URL)

    await expect(bannerTitle(page)).toBeVisible()
  })
})
