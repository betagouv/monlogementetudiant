import type { Page } from '@playwright/test'
import { EOwnerContactMode } from '../src/enums/owner-contact-mode'
import { createBailleur, createResidence, expect, test } from './fixtures'

// Parcours : encart disponibilité/contact de la fiche résidence, décliné selon les six cas
// (disponibilités, aucune, aucune + dépôt de dossier, dépôt seul, non renseignées, être recontacté).

const ficheUrl = (slug: string) => `/trouver-un-logement-etudiant/ville/clermont-ferrand/${slug}`

const typology = (nbAvailable: number | null) => [
  {
    type: 't1' as const,
    priceMin: 430,
    priceMax: 510,
    superficieMin: 18,
    superficieMax: 24,
    nbTotal: 20,
    nbAvailable,
    colocation: false,
  },
]

const sidebar = (page: Page, title: string) => page.getByRole('heading', { name: title, exact: true }).locator('xpath=..')

test.describe('Encart disponibilité de la fiche résidence', () => {
  test('affiche les disponibilités, le téléphone et les actions', async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence(
      { ownerId: owner.id, externalUrl: 'https://bailleur.example.com/offre', phoneNumber: '0612272369' },
      typology(4),
    )

    await page.goto(ficheUrl(residence.slug))

    const card = sidebar(page, '4 logements disponibles')
    await expect(card.getByText(`Logement étudiant proposé par ${owner.name}`)).toBeVisible()
    await expect(card.getByText(/^Mis à jour le /)).toBeVisible()
    await expect(card.getByRole('link', { name: "Consulter l'offre" })).toHaveAttribute('href', 'https://bailleur.example.com/offre')
    await expect(card.getByText('Par téléphone')).toBeVisible()
    await expect(card.getByRole('link', { name: '06 12 27 23 69' })).toHaveAttribute('href', 'tel:+33612272369')
    await expect(card.getByRole('button', { name: 'Ajouter en favoris' })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Signaler une erreur' })).toBeVisible()
    await expect(card.getByText('Dépôt de dossier possible')).toHaveCount(0)
    await expect(card.getByText('Restez alerté des disponibilités')).toHaveCount(0)
  })

  test("propose de créer une alerte quand il n'y a aucune disponibilité", async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id }, typology(0))

    await page.goto(ficheUrl(residence.slug))

    const card = sidebar(page, 'Aucun logement disponible')
    await expect(card.getByText(/^Mis à jour le /)).toBeVisible()
    await expect(card.getByText('Restez alerté des disponibilités')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Créer une alerte logement' })).toBeVisible()
    await expect(card.getByText('Dépôt de dossier possible')).toHaveCount(0)
  })

  test('signale le dépôt de dossier possible en plus de l’alerte quand la résidence est complète', async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id, acceptWaitingList: true }, typology(0))

    await page.goto(ficheUrl(residence.slug))

    const card = sidebar(page, 'Aucun logement disponible')
    await expect(card.getByText('Dépôt de dossier possible')).toBeVisible()
    await expect(card.getByText('Restez alerté des disponibilités')).toBeVisible()
  })

  test('signale le dépôt de dossier possible quand les disponibilités ne sont pas renseignées', async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id, acceptWaitingList: true }, typology(null))

    await page.goto(ficheUrl(residence.slug))

    const card = sidebar(page, 'Disponibilités non renseignées')
    await expect(card.getByText('Dépôt de dossier possible')).toBeVisible()
    await expect(card.getByText(/^Mis à jour le /)).toHaveCount(0)
    await expect(card.getByText('Restez alerté des disponibilités')).toHaveCount(0)
  })

  test('reste sobre quand les disponibilités ne sont pas communiquées', async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id, externalUrl: 'https://bailleur.example.com/offre' }, typology(null))

    await page.goto(ficheUrl(residence.slug))

    const card = sidebar(page, 'Disponibilités non renseignées')
    await expect(card.getByRole('link', { name: "Consulter l'offre" })).toBeVisible()
    await expect(card.getByText(/^Mis à jour le /)).toHaveCount(0)
    await expect(card.getByText('Dépôt de dossier possible')).toHaveCount(0)
    await expect(card.getByText('Restez alerté des disponibilités')).toHaveCount(0)
  })

  test('met en avant « Être recontacté » devant la consultation de l’offre', async ({ page }) => {
    const { owner } = await createBailleur({ contactMode: EOwnerContactMode.CONTACTS })
    const residence = await createResidence({ ownerId: owner.id, externalUrl: 'https://bailleur.example.com/offre' }, typology(2))

    await page.goto(ficheUrl(residence.slug))

    const card = sidebar(page, '2 logements disponibles')
    await expect(card.getByRole('button', { name: 'Être recontacté' })).toBeVisible()
    await expect(card.getByText('Laissez vos coordonnées, le gestionnaire vous recontactera par e-mail ou téléphone.')).toBeVisible()
    await expect(card.getByRole('link', { name: "Consulter l'offre" })).toBeVisible()
  })
})
