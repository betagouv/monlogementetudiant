import { createBailleur, createStudent, expect, signIn, test } from './fixtures'

// Parcours : accès aux espaces connectés selon le rôle.

test.describe('Accès aux espaces connectés', () => {
  test("refuse l'espace étudiant à un visiteur non connecté", async ({ page }) => {
    const response = await page.goto('/mon-espace/tableau-de-bord')

    expect(response?.status()).toBe(404)
  })

  test("ouvre l'espace étudiant à un étudiant connecté", async ({ page }) => {
    const student = await createStudent()
    await signIn(page, student.email)

    await page.goto('/mon-espace')

    await expect(page).toHaveURL(/\/mon-espace\/tableau-de-bord/)
    await expect(page.getByRole('link', { name: 'Favoris et candidatures' }).first()).toBeVisible()
  })

  test("redirige un visiteur non connecté de l'espace gestionnaire vers la connexion", async ({ page }) => {
    await page.goto('/bailleur/residences')

    await expect(page).toHaveURL(/\/gestionnaire\/se-connecter\?callbackUrl=%2Fbailleur%2Fresidences/)
  })

  test("refuse l'espace gestionnaire à un étudiant", async ({ page }) => {
    const student = await createStudent()
    await signIn(page, student.email)

    const response = await page.goto('/bailleur/tableau-de-bord')

    expect(response?.status()).toBe(404)
  })

  test("ouvre l'espace gestionnaire à un bailleur connecté", async ({ page }) => {
    const { user } = await createBailleur()
    await signIn(page, user.email)

    await page.goto('/bailleur/tableau-de-bord')

    await expect(page.getByRole('heading', { level: 1, name: 'Ravi de vous revoir Dominique 👋' })).toBeVisible()
  })
})
