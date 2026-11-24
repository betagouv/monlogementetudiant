import { createStudent, expect, gotoHydrated, signIn, test } from './fixtures'

// Parcours : menu latéral de l'espace étudiant (rubriques repliables et navigation).

test.describe("Menu de l'espace étudiant", () => {
  test('regroupe les entrées sous « Ma recherche » et « Préparer mon installation », repliées par défaut', async ({ page }) => {
    const student = await createStudent()
    await signIn(page, student.email)
    await gotoHydrated(page, '/mon-espace/tableau-de-bord')

    const menu = page.getByRole('navigation', { name: 'Mon espace' })

    await expect(menu.getByRole('button', { name: 'Ma recherche' })).toHaveAttribute('aria-expanded', 'false')
    await expect(menu.getByRole('button', { name: 'Préparer mon installation' })).toHaveAttribute('aria-expanded', 'false')
    await expect(menu.getByRole('link')).toHaveText([
      'Tableau de bord',
      /Mes priorités \(\d+\/\d+\)/,
      'Informations personnelles',
      'Signaler un problème',
    ])

    await menu.getByRole('button', { name: 'Ma recherche' }).click()
    await expect(menu.getByRole('link', { name: 'Alertes logements' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Favoris et candidatures' })).toBeVisible()

    await menu.getByRole('button', { name: 'Préparer mon installation' }).click()
    await expect(menu.getByRole('link', { name: 'Mon budget' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Aides au logement' })).toBeVisible()
  })

  test('navigue vers les pages des rubriques depuis le menu', async ({ page }) => {
    const student = await createStudent()
    await signIn(page, student.email)
    await gotoHydrated(page, '/mon-espace/tableau-de-bord')

    const menu = page.getByRole('navigation', { name: 'Mon espace' })

    await menu.getByRole('button', { name: 'Ma recherche' }).click()
    await menu.getByRole('link', { name: 'Alertes logements' }).click()
    await expect(page).toHaveURL(/\/mon-espace\/alertes/)
    await expect(menu.getByRole('button', { name: 'Ma recherche' })).toHaveAttribute('aria-current', 'true')

    await menu.getByRole('button', { name: 'Préparer mon installation' }).click()
    await menu.getByRole('link', { name: 'Mon budget' }).click()
    await expect(page).toHaveURL(/\/mon-espace\/mon-budget/)
    await expect(menu.getByRole('button', { name: 'Préparer mon installation' })).toHaveAttribute('aria-current', 'true')
  })
})
