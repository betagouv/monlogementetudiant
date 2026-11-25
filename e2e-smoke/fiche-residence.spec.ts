import { city, expect, gotoHydrated, resultCards, test } from './target'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('la première résidence de la liste ouvre sa fiche', async ({ page }) => {
  await gotoHydrated(page, `/trouver-un-logement-etudiant/ville/${city.slug}`)

  const firstCard = resultCards(page).first()
  const name = (await firstCard.getByRole('heading', { level: 2 }).textContent())?.trim()
  expect(name).toBeTruthy()

  await firstCard.getByRole('link').first().click()

  await expect(page.getByRole('heading', { level: 1, name: new RegExp(escapeRegExp(name as string)) })).toBeVisible()
  await expect(
    page
      .getByRole('main')
      .getByText(/\d+\s?€|Aucune disponibilité/)
      .first(),
  ).toBeVisible()
})
