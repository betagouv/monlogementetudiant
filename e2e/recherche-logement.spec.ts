import type { Page } from '@playwright/test'
import { expect, gotoHydrated, test } from './fixtures'

// Parcours : recherche de logement par ville (données seedées par e2e/seed.ts).

async function readResultsCount(page: Page) {
  const label = page.getByText(/^\d+ résidences/).first()
  await expect(label).toBeVisible()
  return Number((await label.textContent())?.match(/^\d+/)?.[0])
}

test.describe('Recherche de logement par ville', () => {
  test('affiche les résidences de la ville et exclut les autres', async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/saint-etienne')

    await expect(page.getByText('Résidence E2E du Centre')).toBeVisible()
    await expect(page.getByText('Résidence E2E de la Gare')).toBeVisible()

    // Hors du polygone de la ville, ou non publiée : absentes des résultats.
    await expect(page.getByText('Résidence E2E Hors Ville')).toHaveCount(0)
    await expect(page.getByText('Résidence E2E Non Publiée')).toHaveCount(0)
  })

  test("ouvre la fiche d'une résidence depuis la liste", async ({ page }) => {
    await gotoHydrated(page, '/trouver-un-logement-etudiant/ville/saint-etienne')

    await page
      .getByRole('link', { name: /Résidence E2E du Centre/ })
      .first()
      .click()

    await expect(page).toHaveURL(/residence-e2e-du-centre/)
    await expect(page.getByRole('heading', { name: /Résidence E2E du Centre/ }).first()).toBeVisible()
  })

  test('trouve une ville via la barre de recherche avec autocomplétion', async ({ page }) => {
    await gotoHydrated(page, '/trouver-un-logement-etudiant')

    await page.getByRole('textbox', { name: 'Où souhaitez-vous étudier ?' }).filter({ visible: true }).fill('Saint-É')

    const suggestions = page.getByRole('region', { name: 'Suggestions de recherche' }).filter({ visible: true })
    await suggestions
      .getByRole('option', { name: /Saint-Étienne/ })
      .first()
      .click()

    await expect(page).toHaveURL(/ville\/saint-etienne/)
    await expect(page.getByText('Résidence E2E du Centre')).toBeVisible()
  })

  test('filtre les résidences par budget maximum', async ({ page }) => {
    await gotoHydrated(page, '/trouver-un-logement-etudiant/ville/saint-etienne')

    // Les deux résidences sont là avant le filtre.
    await expect(page.getByText('Résidence E2E du Centre')).toBeVisible()
    await expect(page.getByText('Résidence E2E de la Gare')).toBeVisible()

    // Loyer maximum à 500 € : la Résidence de la Gare (à partir de 650 €) sort de la liste.
    // Même curseur dans la modale de filtres mobile (cachée) : on cible le visible.
    // La recherche n'est relancée qu'au relâchement du curseur (ici, la perte de focus).
    const slider = page.getByRole('slider', { name: 'Loyer maximum' }).filter({ visible: true })
    await slider.fill('500')
    await slider.blur()

    await expect(page.getByText('Résidence E2E de la Gare')).toHaveCount(0)
    await expect(page.getByText('Résidence E2E du Centre')).toBeVisible()
  })

  test('affiche le message « aucun résultat » pour une ville sans résidence', async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/roanne')

    await expect(page.getByText('Aucun résultat pour votre recherche')).toBeVisible()
  })

  test('masque les résidences complètes via le switch « Logements disponibles »', async ({ page }) => {
    await gotoHydrated(page, '/trouver-un-logement-etudiant/ville/saint-etienne')
    const total = await readResultsCount(page)

    // Les cases DSFR sont recouvertes par leur label : on clique le label visible.
    await page.getByText('Disponibles uniquement', { exact: true }).filter({ visible: true }).click()

    // Seule la Résidence E2E Complète (0 disponibilité) sort de la liste.
    await expect(page.getByText(`${total - 1} résidences`)).toBeVisible()
    await expect(page.getByText('Résidence E2E Complète')).toHaveCount(0)
  })

  test('filtre les résidences proposant de la colocation', async ({ page }) => {
    await gotoHydrated(page, '/trouver-un-logement-etudiant/ville/saint-etienne')

    await page.getByRole('button', { name: 'Colocation', exact: true }).filter({ visible: true }).click()

    // D'abord attendre que la liste soit filtrée : la résidence attendue figure déjà dans la liste initiale.
    await expect(page.getByText('Résidence E2E du Centre')).toHaveCount(0)
    await expect(page.getByText('Résidence E2E Coloc')).toBeVisible()
  })

  test('filtre les résidences adaptées PMR', async ({ page }) => {
    await gotoHydrated(page, '/trouver-un-logement-etudiant/ville/saint-etienne')

    await page.getByRole('button', { name: 'Accessible PMR' }).filter({ visible: true }).click()

    // D'abord attendre que la liste soit filtrée : la résidence attendue figure déjà dans la liste initiale.
    await expect(page.getByText('Résidence E2E du Centre')).toHaveCount(0)
    await expect(page.getByText('Résidence E2E PMR')).toBeVisible()
  })

  test('sépare les résidences Crous des autres résidences', async ({ page }) => {
    await gotoHydrated(page, '/trouver-un-logement-etudiant/ville/saint-etienne')

    // La vue par défaut (« Logement hors CROUS ») exclut le Crous.
    await expect(page.getByRole('button', { name: 'Logement hors CROUS' }).filter({ visible: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByText('Résidence E2E Crous')).toHaveCount(0)

    await page.getByRole('button', { name: 'Logement CROUS', exact: true }).filter({ visible: true }).click()

    await expect(page.getByText('Résidence E2E Crous')).toBeVisible()
    await expect(page.getByText('Résidence E2E du Centre')).toHaveCount(0)
  })

  test('pagine la liste au-delà de douze résidences', async ({ page }) => {
    await gotoHydrated(page, '/trouver-un-logement-etudiant/ville/saint-etienne')

    // Page 1 : les résidences avec disponibilités ; la Résidence E2E Complète est reléguée en page 2.
    await expect(page.getByText('Résidence E2E de la Gare')).toBeVisible()
    await expect(page.getByText('Résidence E2E Complète')).toHaveCount(0)

    await page.getByRole('navigation', { name: 'Pagination' }).getByRole('link', { name: '2', exact: true }).click()

    await expect(page.getByText('Résidence E2E Complète')).toBeVisible()
    await expect(page.getByText('Résidence E2E de la Gare')).toHaveCount(0)
  })

  test("élargit la recherche autour d'une ville voisine sans résidence", async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/villars')

    // Aucune résidence à Villars même, mais celles de Saint-Étienne (~5 km) remontent
    // dans la section « Plus de résultats autour de… » (+10 km).
    await expect(page.getByText('Aucun résultat pour votre recherche')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Plus de résultats autour de Villars' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: /^Résidence E2E / }).first()).toBeVisible()
  })

  test('redirige un nom de ville vers son slug en conservant les filtres', async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/Saint-Étienne?colocation=true')

    await expect(page).toHaveURL(/\/ville\/saint-etienne\?colocation=true$/)
    await expect(page.getByText('Résidence E2E Coloc')).toBeVisible()
    await expect(page.getByText('Résidence E2E du Centre')).toHaveCount(0)
  })

  test('affiche la page 404 pour une résidence inconnue', async ({ page }) => {
    const response = await page.goto('/trouver-un-logement-etudiant/ville/saint-etienne/residence-inexistante')

    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()
  })

  test('conserve les filtres après rechargement de la page', async ({ page }) => {
    await gotoHydrated(page, '/trouver-un-logement-etudiant/ville/saint-etienne')

    await page.getByRole('button', { name: 'Accessible PMR' }).filter({ visible: true }).click()
    await expect(page).toHaveURL(/accessible=true/)

    await page.reload()

    await expect(page.getByText('Résidence E2E PMR')).toBeVisible()
    await expect(page.getByText('Résidence E2E du Centre')).toHaveCount(0)
  })
})
