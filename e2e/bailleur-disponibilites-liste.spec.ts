import type { Page } from '@playwright/test'
import { backdateAvailability, createBailleur, createResidence, expect, gotoHydrated, signIn, test, todayLabel } from './fixtures'

// Parcours : le gestionnaire met à jour et confirme ses disponibilités depuis la liste de ses résidences.

const OLD_CONFIRMATION = new Date('2026-01-15T10:00:00Z')

/** Bloc d'une résidence dans la liste : le plus petit conteneur portant son titre et son champ « Disponibles ». */
const residenceRow = (page: Page, name: string) =>
  page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name }) })
    .filter({ has: page.getByRole('spinbutton', { name: 'Disponibles' }) })
    .last()

test.describe('Mettre à jour ses disponibilités depuis la liste des résidences', () => {
  test('enregistre les disponibilités d’une résidence', async ({ page }) => {
    const { user, owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id })
    await backdateAvailability(residence.id, OLD_CONFIRMATION)
    await signIn(page, user.email)

    await gotoHydrated(page, '/bailleur/residences')
    const row = residenceRow(page, residence.name)
    await expect(row.getByText('Disponibilités confirmées le 15/01/2026')).toBeVisible()

    await row.getByLabel('Disponibles').fill('2')
    await row.getByRole('button', { name: 'Confirmer les disponibilités' }).click()

    await expect(page.getByText('Disponibilités confirmées', { exact: true })).toBeVisible()
    await expect(row.getByText(`Disponibilités confirmées le ${todayLabel()}`)).toBeVisible()
    await page.reload()
    await expect(row.getByLabel('Disponibles')).toHaveValue('2')
  })

  test('propose de confirmer toutes les résidences en une fois', async ({ page }) => {
    const { user, owner } = await createBailleur()
    const edited = await createResidence({ ownerId: owner.id })
    const untouched = await createResidence({ ownerId: owner.id })
    await backdateAvailability(edited.id, OLD_CONFIRMATION)
    await backdateAvailability(untouched.id, OLD_CONFIRMATION)
    await signIn(page, user.email)

    await gotoHydrated(page, '/bailleur/residences')
    const editedRow = residenceRow(page, edited.name)
    const untouchedRow = residenceRow(page, untouched.name)
    await editedRow.getByLabel('Disponibles').fill('3')
    await editedRow.getByRole('button', { name: 'Confirmer les disponibilités' }).click()

    const modal = page.getByRole('dialog', { name: 'Confirmer les disponibilités de toutes vos résidences ?' })
    await modal.getByRole('button', { name: 'Confirmer toutes mes résidences' }).click()

    await expect(page.getByText('Disponibilités confirmées pour 2 résidences')).toBeVisible()
    await expect(editedRow.getByText(`Disponibilités confirmées le ${todayLabel()}`)).toBeVisible()
    await expect(untouchedRow.getByText(`Disponibilités confirmées le ${todayLabel()}`)).toBeVisible()
    await expect(untouchedRow.getByLabel('Disponibles')).toHaveValue('4')
  })

  test('ne confirme que la résidence modifiée si le gestionnaire le choisit', async ({ page }) => {
    const { user, owner } = await createBailleur()
    const edited = await createResidence({ ownerId: owner.id })
    const untouched = await createResidence({ ownerId: owner.id })
    await backdateAvailability(edited.id, OLD_CONFIRMATION)
    await backdateAvailability(untouched.id, OLD_CONFIRMATION)
    await signIn(page, user.email)

    await gotoHydrated(page, '/bailleur/residences')
    const editedRow = residenceRow(page, edited.name)
    const untouchedRow = residenceRow(page, untouched.name)
    await editedRow.getByRole('button', { name: 'Confirmer les disponibilités' }).click()

    const modal = page.getByRole('dialog', { name: 'Confirmer les disponibilités de toutes vos résidences ?' })
    await modal.getByRole('button', { name: 'Seulement cette résidence' }).click()

    await expect(editedRow.getByText(`Disponibilités confirmées le ${todayLabel()}`)).toBeVisible()
    await expect(untouchedRow.getByText('Disponibilités confirmées le 15/01/2026')).toBeVisible()
  })
})
