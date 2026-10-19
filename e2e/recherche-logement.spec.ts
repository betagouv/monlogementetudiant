import { expect, test } from '@playwright/test'

// Parcours : recherche de logement par ville (données seedées par e2e/seed.ts).

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
    await page.goto('/trouver-un-logement-etudiant/ville/saint-etienne')

    await page.getByRole('link', { name: /Résidence E2E du Centre/ }).first().click()

    await expect(page).toHaveURL(/residence-e2e-du-centre/)
    await expect(page.getByRole('heading', { name: /Résidence E2E du Centre/ }).first()).toBeVisible()
  })

  test("trouve une ville via la barre de recherche avec autocomplétion", async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant')

    // Le DSFR rend aussi une version mobile cachée du champ : on cible la visible.
    await page.getByLabel('Ville, académie ou département').filter({ visible: true }).fill('Saint-É')

    const suggestions = page.getByRole('region', { name: 'Suggestions de recherche' }).filter({ visible: true })
    await suggestions.getByRole('option', { name: /Saint-Étienne/ }).first().click()

    await expect(page).toHaveURL(/ville\/saint-etienne/)
    await expect(page.getByText('Résidence E2E du Centre')).toBeVisible()
  })

  test('filtre les résidences par budget maximum', async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/saint-etienne')

    // Les deux résidences sont là avant le filtre.
    await expect(page.getByText('Résidence E2E du Centre')).toBeVisible()
    await expect(page.getByText('Résidence E2E de la Gare')).toBeVisible()

    // « Moins de 500€ » : seule la Résidence du Centre (à partir de 420 €) reste.
    // Même sélecteur dans la modale de filtres mobile (cachée) : on cible le visible.
    await page.getByLabel('Budget maximum').filter({ visible: true }).selectOption({ label: 'Moins de 500€' })

    await expect(page.getByText('Résidence E2E de la Gare')).toHaveCount(0)
    await expect(page.getByText('Résidence E2E du Centre')).toBeVisible()
  })

  test("affiche le message « aucun résultat » pour une ville sans résidence", async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/roanne')

    await expect(page.getByText('Aucun résultat pour votre recherche')).toBeVisible()
  })

  test('masque les résidences complètes via le switch « Logements disponibles »', async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/saint-etienne')
    await expect(page.getByText(/13 résidences/)).toBeVisible()

    // Les toggles DSFR recouvrent leur checkbox : on clique le label visible.
    await page.getByText('Logements disponibles', { exact: true }).filter({ visible: true }).click()

    // Seule la Résidence E2E Complète (0 disponibilité) sort de la liste.
    await expect(page.getByText(/12 résidences/)).toBeVisible()
    await expect(page.getByText('Résidence E2E Complète')).toHaveCount(0)
  })

  test('filtre les résidences proposant de la colocation', async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/saint-etienne')

    await page.getByRole('button', { name: 'Plus de filtres' }).filter({ visible: true }).click()
    await page.getByText('Colocation', { exact: true }).filter({ visible: true }).click()

    await expect(page.getByText('Résidence E2E Coloc')).toBeVisible()
    await expect(page.getByText('Résidence E2E du Centre')).toHaveCount(0)
  })

  test('filtre les résidences adaptées PMR', async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/saint-etienne')

    await page.getByRole('button', { name: 'Plus de filtres' }).filter({ visible: true }).click()
    await page.getByText('Adapté PMR').filter({ visible: true }).click()

    await expect(page.getByText('Résidence E2E PMR')).toBeVisible()
    await expect(page.getByText('Résidence E2E du Centre')).toHaveCount(0)
  })

  test('sépare les résidences Crous des autres résidences', async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/saint-etienne')

    // La vue par défaut (« Autres résidences ») exclut le Crous.
    await expect(page.getByText('Résidence E2E Crous')).toHaveCount(0)

    await page.getByText(/^Crous \(/).filter({ visible: true }).click()

    await expect(page.getByText('Résidence E2E Crous')).toBeVisible()
    await expect(page.getByText('Résidence E2E du Centre')).toHaveCount(0)
  })

  test('pagine la liste au-delà de douze résidences', async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/saint-etienne')

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
    await expect(page.getByText(/Plus de résultats autour/)).toBeVisible()
    await expect(page.getByText('Résidence E2E du Centre')).toBeVisible()
  })
})
