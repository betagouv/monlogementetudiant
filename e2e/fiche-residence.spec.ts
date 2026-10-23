import { expect, test } from './fixtures'

// Parcours : consultation de la fiche d'une résidence (données seedées par e2e/seed.ts).

const FICHE_CENTRE = '/trouver-un-logement-etudiant/ville/saint-etienne/residence-e2e-du-centre'

test.describe("Fiche d'une résidence", () => {
  test('présente la résidence, ses prix et ses logements', async ({ page }) => {
    await page.goto(FICHE_CENTRE)

    await expect(page.getByRole('heading', { level: 1, name: /Résidence E2E du Centre/ })).toBeVisible()
    await expect(page.getByText('À partir de 420 €').first()).toBeVisible()
    await expect(page.getByText('Studio', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: '42 logements', exact: true })).toBeVisible()
    await expect(page.getByText(/^Mis à jour le /)).toBeVisible()
  })

  test("ouvre l'offre du gestionnaire dans un nouvel onglet", async ({ page }) => {
    await page.goto(FICHE_CENTRE)

    const offerLink = page.getByRole('link', { name: /Consulter l'offre du gestionnaire/ })
    await expect(offerLink).toHaveAttribute('href', 'https://bailleur.example.com/residence-du-centre')
    await expect(offerLink).toHaveAttribute('target', '_blank')
  })

  test('propose d’appeler la résidence', async ({ page }) => {
    await page.goto(FICHE_CENTRE)

    await expect(page.getByRole('link', { name: '04 77 00 00 00' })).toHaveAttribute('href', 'tel:+33477000000')
  })

  test('signale une résidence complète', async ({ page }) => {
    await page.goto('/trouver-un-logement-etudiant/ville/saint-etienne/residence-e2e-complete')

    await expect(page.getByRole('heading', { name: 'Aucune disponibilité pour le moment' })).toBeVisible()
  })

  test("revient à la recherche de la ville depuis le fil d'Ariane", async ({ page }) => {
    await page.goto(FICHE_CENTRE)

    await page
      .getByRole('navigation', { name: /vous êtes ici/i })
      .getByRole('link', { name: /Saint-Étienne/ })
      .click()

    await expect(page).toHaveURL(/\/trouver-un-logement-etudiant\/ville\//)
    await expect(page.getByRole('heading', { level: 1, name: 'Trouver un logement social étudiant à Saint-Étienne' })).toBeVisible()
  })
})
