import { createBailleur, createResidence, expect, gotoHydrated, test } from './fixtures'

const ficheUrl = (slug: string) => `/trouver-un-logement-etudiant/ville/clermont-ferrand/${slug}`

const typology = (nbAvailable: number | null) => [
  { type: 't1' as const, priceMin: 430, priceMax: 510, superficieMin: 18, superficieMax: 24, nbTotal: 20, nbAvailable, colocation: false },
]

test.describe('Statuts de disponibilité', () => {
  test("affiche le badge Liste d'attente sur une résidence complète qui l'accepte", async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id, acceptWaitingList: true }, typology(0))

    await gotoHydrated(page, ficheUrl(residence.slug))

    await expect(page.getByText(/^Liste d.attente$/)).toBeVisible()
    await expect(page.getByText('Dépôt de dossier possible')).toHaveCount(0)
  })

  test("n'affiche pas Liste d'attente quand des logements sont disponibles", async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id, acceptWaitingList: true }, typology(4))

    await gotoHydrated(page, ficheUrl(residence.slug))

    await expect(page.getByText(/^Liste d.attente$/)).toHaveCount(0)
  })
})
