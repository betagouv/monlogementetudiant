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
    await link.click()
    await expect(page).toHaveURL(/\/comprendre-les-disponibilites$/)
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

  test('présente les quatre statuts', async ({ page }) => {
    await gotoHydrated(page, '/comprendre-les-disponibilites')

    await expect(page.getByRole('heading', { level: 1, name: 'Comprendre les disponibilités' })).toBeVisible()
    for (const title of [
      'Des logements sont disponibles',
      'Aucun logement disponible pour le moment',
      'Le gestionnaire n’a pas mis à jour ses disponibilités',
      'La résidence accepte les candidatures en liste d’attente',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
    }
    await expect(page.getByText('Dépôt de dossier possible')).toHaveCount(0)
  })

  test('la bulle reste ouverte quand la souris descend du bouton vers le lien', async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id }, typology(null))

    await gotoHydrated(page, ficheUrl(residence.slug))
    const trigger = page.getByRole('button', { name: 'Comprendre ce statut' })
    await trigger.hover()
    const link = page.getByRole('link', { name: 'Comprendre les statuts de disponibilité' })
    const from = await trigger.boundingBox()
    const to = await link.boundingBox()
    if (!from || !to) throw new Error('positions introuvables')

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 30 })

    await expect(link).toBeVisible()
  })

  test('Échap ferme une bulle ouverte au survol', async ({ page }) => {
    const { owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id }, typology(null))

    await gotoHydrated(page, ficheUrl(residence.slug))
    await page.getByRole('button', { name: 'Comprendre ce statut' }).hover()
    const link = page.getByRole('link', { name: 'Comprendre les statuts de disponibilité' })
    await expect(link).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(link).toBeHidden()
  })
})
