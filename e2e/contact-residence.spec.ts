import { EOwnerContactMode } from '../src/enums/owner-contact-mode'
import { createBailleur, createResidence, createStudent, expect, gotoHydrated, signIn, test } from './fixtures'

// Parcours : un étudiant connecté laisse ses coordonnées au gestionnaire d'une résidence.

const ficheUrl = (slug: string) => `/trouver-un-logement-etudiant/ville/clermont-ferrand/${slug}`

test.describe('Être recontacté par le gestionnaire', () => {
  test('transmet les coordonnées pré-remplies d’un étudiant connecté', async ({ page }) => {
    const { owner } = await createBailleur({ contactMode: EOwnerContactMode.CONTACTS })
    const residence = await createResidence({ ownerId: owner.id })
    const student = await createStudent()
    await signIn(page, student.email)

    await gotoHydrated(page, ficheUrl(residence.slug))
    await page.getByRole('button', { name: 'Être recontacté' }).click()

    const modal = page.getByRole('dialog', { name: 'Être recontacté' })
    await expect(modal.getByText(/Les informations de votre compte sont pré-remplies/)).toBeVisible()
    await expect(modal.getByLabel('Prénom')).toHaveValue('Camille')
    await expect(modal.getByLabel('Prénom')).toBeDisabled()

    await modal.getByRole('button', { name: 'Partager mes coordonnées' }).click()
    await expect(modal.getByText('Vous devez accepter le partage de vos informations')).toBeVisible()

    await modal.getByText(/J’accepte de partager ces informations/).click()
    await modal.getByRole('button', { name: 'Partager mes coordonnées' }).click()

    // La demande vaut suivi : le bouton est désactivé et la résidence rejoint les favoris.
    await expect(page.getByRole('button', { name: 'Coordonnées transmises' })).toBeDisabled()
    await page.goto('/mon-espace/favoris')
    await expect(page.getByText(residence.name)).toBeVisible()
    await expect(page.getByText('Coordonnées partagées aux gestionnaires')).toBeVisible()
  })

  test("ne propose pas d'être recontacté quand le gestionnaire ne reçoit pas de contacts", async ({ page }) => {
    const { owner } = await createBailleur({ contactMode: EOwnerContactMode.NONE })
    const residence = await createResidence({ ownerId: owner.id })

    await page.goto(ficheUrl(residence.slug))

    await expect(page.getByRole('heading', { level: 1, name: new RegExp(residence.name) })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Être recontacté' })).toHaveCount(0)
  })
})
