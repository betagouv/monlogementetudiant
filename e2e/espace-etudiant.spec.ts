import { createStudent, expect, gotoHydrated, signIn, test } from './fixtures'

// Parcours : espace étudiant (liste de priorités, informations personnelles).

test.describe('Espace étudiant', () => {
  test('marque une priorité comme terminée puis la remet à faire', async ({ page }) => {
    const student = await createStudent()
    await signIn(page, student.email)
    await gotoHydrated(page, '/mon-espace/to-do')
    await expect(page.getByRole('heading', { level: 1, name: 'Ma liste de priorités' })).toBeVisible()

    const card = page.getByRole('heading', { name: 'Simuler mes aides au logement' }).locator('xpath=..')
    await card.getByRole('button', { name: 'Marquer comme terminé' }).click()
    await expect(card.getByRole('button', { name: 'Remettre à faire' })).toBeVisible()

    await page.reload()
    await expect(card.getByRole('button', { name: 'Remettre à faire' })).toBeVisible()

    await card.getByRole('button', { name: 'Remettre à faire' }).click()
    await expect(card.getByRole('button', { name: 'Marquer comme terminé' })).toBeVisible()
  })

  test('met à jour ses informations personnelles', async ({ page }) => {
    const student = await createStudent()
    await signIn(page, student.email)
    await gotoHydrated(page, '/mon-espace/informations-personnelles')

    await expect(page.getByLabel('E-mail')).toBeDisabled()
    await page.getByLabel('Téléphone portable').fill('0698765432')
    await page.getByRole('button', { name: 'Enregistrer' }).first().click()
    await expect(page.getByText('Vos informations ont été mises à jour.')).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Téléphone portable')).toHaveValue('0698765432')
  })
})
