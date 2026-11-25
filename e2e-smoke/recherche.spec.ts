import { city, cityQuery, countLoadedImages, expect, gotoHydrated, isLocal, readResultsCount, resultCards, test } from './target'

test("la page d'accueil répond et propose la recherche", async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByPlaceholder('Ville, académie ou département').first()).toBeVisible()
})

test('la recherche par ville affiche des résidences bien formées', async ({ page }) => {
  await page.goto(`/trouver-un-logement-etudiant/ville/${city.slug}`)

  expect(await readResultsCount(page)).toBeGreaterThan(0)

  const firstCard = resultCards(page).first()
  await expect(firstCard.getByRole('heading', { level: 2 })).not.toBeEmpty()
  await expect(firstCard.getByText(/\(\d{5}\)/)).toBeVisible()

  await expect(page.getByText(/À partir de \d+\s?€/).first()).toBeVisible()
})

test("l'autocomplétion mène à la page de la ville", async ({ page }) => {
  await gotoHydrated(page, '/trouver-un-logement-etudiant')

  await page.getByRole('textbox', { name: 'Où souhaitez-vous étudier ?' }).filter({ visible: true }).fill(cityQuery)
  await page
    .getByRole('region', { name: 'Suggestions de recherche' })
    .filter({ visible: true })
    .getByRole('option', { name: new RegExp(city.name) })
    .first()
    .click()

  await expect(page).toHaveURL(new RegExp(`ville/${city.slug}`))
  expect(await readResultsCount(page)).toBeGreaterThan(0)
})

test('le filtre de loyer maximum restreint les résultats', async ({ page }) => {
  await gotoHydrated(page, `/trouver-un-logement-etudiant/ville/${city.slug}`)
  const before = await readResultsCount(page)

  const slider = page.getByRole('slider', { name: 'Loyer maximum' }).filter({ visible: true })
  await slider.fill('600')
  await slider.blur()

  await expect(page).toHaveURL(/prix=600/)
  await expect
    .poll(async () => {
      const prices = await page.getByText(/À partir de \d+\s?€/).allTextContents()
      return prices.every((price) => Number(price.match(/\d+/)?.[0]) <= 600)
    })
    .toBe(true)
  await expect.poll(() => readResultsCount(page)).toBeLessThanOrEqual(before)
})

test('la vue carte affiche le fond de plan et des résidences', async ({ page }) => {
  await gotoHydrated(page, `/trouver-un-logement-etudiant/ville/${city.slug}?vue=carte`)

  await expect(page.locator('.leaflet-marker-pane > *').first()).toBeVisible()

  await expect.poll(() => countLoadedImages(page.locator('img.leaflet-tile'))).toBeGreaterThan(0)
})

test('les photos des résidences se chargent', async ({ page }) => {
  test.skip(isLocal, 'S3 neutralisé en local — vérifiable uniquement sur un environnement déployé')

  await page.goto(`/trouver-un-logement-etudiant/ville/${city.slug}`)
  await expect(resultCards(page).first()).toBeVisible()

  await expect.poll(() => countLoadedImages(resultCards(page).locator('img'))).toBeGreaterThan(0)
})
