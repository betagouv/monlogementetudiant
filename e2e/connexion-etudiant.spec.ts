import { createStudent, expect, gotoHydrated, PASSWORD, test } from './fixtures'

// Parcours : connexion d'un étudiant par email et mot de passe.

test.describe('Connexion étudiant', () => {
  test("connecte l'étudiant et l'amène sur son espace", async ({ page }) => {
    const student = await createStudent()

    await gotoHydrated(page, '/se-connecter')
    await expect(page.getByRole('heading', { name: 'Se connecter à mon espace étudiant' })).toBeVisible()
    await page.getByRole('main').getByLabel('Email').fill(student.email)
    await page
      .getByRole('main')
      .getByRole('textbox', { name: /Mot de passe/ })
      .fill(PASSWORD)
    await page.getByRole('main').getByRole('button', { name: 'Se connecter' }).click()

    await expect(page).toHaveURL(/\/mon-espace\/tableau-de-bord/)
    await expect(page.getByRole('link', { name: 'Favoris et candidatures' }).first()).toBeVisible()
  })

  test('refuse un mot de passe incorrect', async ({ page }) => {
    const student = await createStudent()

    await gotoHydrated(page, '/se-connecter')
    await page.getByRole('main').getByLabel('Email').fill(student.email)
    await page
      .getByRole('main')
      .getByRole('textbox', { name: /Mot de passe/ })
      .fill('Mauvais-mot-de-passe')
    await page.getByRole('main').getByRole('button', { name: 'Se connecter' }).click()

    await expect(page.getByText('Email ou mot de passe incorrect.')).toBeVisible()
    await expect(page).toHaveURL(/\/se-connecter/)
  })

  test("signale un compte dont l'email n'est pas confirmé", async ({ page }) => {
    const student = await createStudent({ emailVerified: false })

    await gotoHydrated(page, '/se-connecter')
    await page.getByRole('main').getByLabel('Email').fill(student.email)
    await page
      .getByRole('main')
      .getByRole('textbox', { name: /Mot de passe/ })
      .fill(PASSWORD)
    await page.getByRole('main').getByRole('button', { name: 'Se connecter' }).click()

    await expect(page.getByText('Compte non confirmé')).toBeVisible()
    await expect(page.getByRole('button', { name: "Renvoyer l'email de confirmation" })).toBeVisible()
    await expect(page).toHaveURL(/\/se-connecter/)
  })
})
