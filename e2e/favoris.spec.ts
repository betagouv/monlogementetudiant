import { createStudent, expect, signIn, test } from './fixtures'

// Parcours : favoris d'un étudiant depuis la fiche d'une résidence.

const FICHE_GARE = '/trouver-un-logement-etudiant/ville/saint-etienne/residence-e2e-de-la-gare'

test.describe('Favoris', () => {
  test('invite un visiteur non connecté à se connecter', async ({ page }) => {
    await page.goto(FICHE_GARE)

    await page.getByRole('button', { name: 'Ajouter en favoris' }).first().click()

    const modal = page.getByRole('dialog', { name: "Vous n'êtes pas connecté" })
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', /\/se-connecter/)
    await expect(modal.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', /\/s-inscrire/)
  })

  test('ajoute puis retire une résidence des favoris', async ({ page }) => {
    const student = await createStudent()
    await signIn(page, student.email)

    await page.goto(FICHE_GARE)
    await page.getByRole('button', { name: 'Ajouter en favoris' }).first().click()
    await expect(page.getByRole('button', { name: 'Retirer des favoris' }).first()).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/mon-espace/favoris')
    await expect(page.getByRole('heading', { level: 1, name: 'Favoris et candidatures' })).toBeVisible()
    await expect(page.getByText('Résidence E2E de la Gare')).toBeVisible()

    await page.goto(FICHE_GARE)
    await page.getByRole('button', { name: 'Retirer des favoris' }).first().click()
    await expect(page.getByRole('button', { name: 'Ajouter en favoris' }).first()).toBeVisible()

    await page.goto('/mon-espace/favoris')
    await expect(page.getByRole('heading', { level: 1, name: 'Favoris et candidatures' })).toBeVisible()
    await expect(page.getByText('Résidence E2E de la Gare')).toHaveCount(0)
  })
})
