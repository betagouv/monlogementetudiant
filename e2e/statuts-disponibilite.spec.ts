import { createBailleur, createResidence, expect, gotoHydrated, markAsCrous, test } from './fixtures'

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

  test('explique un statut non renseigné au survol', async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id }, typology(null))

    await gotoHydrated(page, ficheUrl(residence.slug))
    const trigger = page.getByRole('button', { name: 'Comprendre ce statut' })
    await trigger.hover()

    const explanation = page.getByText(
      'Le gestionnaire ne nous a pas transmis de disponibilités récentes. Consultez son site ou contactez-le directement.',
    )
    await expect(explanation).toBeVisible()
    const link = page.getByRole('link', { name: 'Comprendre les statuts de disponibilité' })
    await link.hover()
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/comprendre-les-disponibilites')
  })

  test('la bulle est utilisable au clavier', async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id }, typology(0))

    await gotoHydrated(page, ficheUrl(residence.slug))
    const trigger = page.getByRole('button', { name: 'Comprendre ce statut' })
    await trigger.focus()
    await page.keyboard.press('Enter')

    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(
      page.getByText('La résidence est complète à la date de mise à jour. Créez une alerte pour être prévenu dès qu’une place se libère.'),
    ).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Comprendre les statuts de disponibilité' })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('link', { name: 'Comprendre les statuts de disponibilité' })).toBeHidden()
    await expect(trigger).toBeFocused()

    await page.keyboard.press('Escape')
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  test("n'affiche pas de bulle pour une résidence Crous", async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id }, typology(null))
    await markAsCrous(residence.id)

    await gotoHydrated(page, ficheUrl(residence.slug))

    await expect(page.getByRole('heading', { name: '20 logements', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Comprendre ce statut' })).toHaveCount(0)
  })
})
