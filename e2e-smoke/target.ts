import { test as base, expect, type Locator, type Page } from '@playwright/test'

export const baseURL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3210'

export const isLocal = new URL(baseURL).hostname === 'localhost'

export const city = {
  slug: process.env.SMOKE_CITY_SLUG ?? (isLocal ? 'saint-etienne' : 'lille'),
  name: process.env.SMOKE_CITY_NAME ?? (isLocal ? 'Saint-Étienne' : 'Lille'),
}

export const cityQuery = city.name.slice(0, 7)

export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle', { timeout: isLocal ? 10_000 : 3_000 }).catch(() => undefined)
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page)
    if (!isLocal) await page.waitForTimeout(3_000)
  },
})

export { expect }

export function resultCards(page: Page) {
  return page.locator('[id^="accomodation-"]')
}

export async function readResultsCount(page: Page) {
  const label = page.getByText(/^\d+ résidence/).first()
  const empty = page.getByText('Aucun résultat pour votre recherche')
  await expect(label.or(empty).first()).toBeVisible()
  if (await empty.isVisible()) return 0
  return Number((await label.textContent())?.match(/^\d+/)?.[0])
}

export async function countLoadedImages(images: Locator) {
  const loaded = await images.evaluateAll((els) => els.filter((el) => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0))
  return loaded.length
}
