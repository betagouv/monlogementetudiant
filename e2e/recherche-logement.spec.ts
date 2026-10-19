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
})
