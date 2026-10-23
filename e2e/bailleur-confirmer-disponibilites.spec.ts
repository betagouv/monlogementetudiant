import { createBailleur, createResidence, expect, gotoHydrated, signIn, test } from './fixtures'

// Parcours : le gestionnaire confirme ses disponibilités depuis le lien de l'email de relance.

const CONFIRM_URL = '/bailleur/disponibilites/confirmer'

test.describe('Confirmer ses disponibilités', () => {
  test('confirme en un clic les résidences relancées', async ({ page }) => {
    const { user, owner } = await createBailleur()
    const warnedAt = new Date(Date.now() - 2 * 24 * 3600 * 1000)
    const first = await createResidence({ ownerId: owner.id, staleAvailabilityWarnedAt: warnedAt })
    const second = await createResidence({ ownerId: owner.id, staleAvailabilityWarnedAt: warnedAt })
    const upToDate = await createResidence({ ownerId: owner.id })
    await signIn(page, user.email)

    await gotoHydrated(page, CONFIRM_URL)
    await expect(page.getByRole('heading', { level: 1, name: 'Confirmer mes disponibilités' })).toBeVisible()
    await expect(page.getByText(first.name)).toBeVisible()
    await expect(page.getByText(second.name)).toBeVisible()
    await expect(page.getByText(upToDate.name)).toHaveCount(0)
    await expect(page.getByText(/4 disponible\(s\) sur 20/).first()).toBeVisible()

    await page.getByRole('button', { name: 'Aucun changement dans mes disponibilités' }).click()

    await expect(page.getByText('Disponibilités confirmées pour 2 résidences')).toBeVisible()
    await expect(page.getByText('La date de mise à jour a été actualisée. Merci !')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Aucune disponibilité à confirmer')).toBeVisible()
  })

  test('redirige un gestionnaire non connecté vers la connexion en conservant la page', async ({ page }) => {
    await page.goto(CONFIRM_URL)

    await expect(page).toHaveURL(/\/gestionnaire\/se-connecter\?callbackUrl=%2Fbailleur%2Fdisponibilites%2Fconfirmer/)
  })
})
