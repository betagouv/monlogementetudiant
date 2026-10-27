import { createBailleur, createResidence, expect, gotoHydrated, signIn, test } from './fixtures'

// Parcours : le gestionnaire dépublie puis republie une résidence, effet visible côté étudiant.

const SEARCH_URL = '/trouver-un-logement-etudiant/ville/clermont-ferrand'

test.describe('Publier et dépublier une résidence', () => {
  test('retire la résidence de la recherche puis l’y remet', async ({ page, browser }) => {
    const { user, owner } = await createBailleur()
    const residence = await createResidence({ ownerId: owner.id })
    const fiche = `${SEARCH_URL}/${residence.slug}`
    // Filtre sur le bailleur du test : la ville contient aussi les résidences des autres tests.
    const ownerSearch = `${SEARCH_URL}?gestionnaire=${owner.slug}`

    // Vue étudiant dans un contexte séparé, sans session gestionnaire.
    const visitor = await browser.newPage()
    await visitor.goto(ownerSearch)
    await expect(visitor.getByRole('heading', { name: residence.name })).toBeVisible()

    await signIn(page, user.email)
    await gotoHydrated(page, `/bailleur/residences/${residence.slug}`)
    await expect(page.getByRole('radio', { name: 'Publiée', exact: true })).toBeChecked()

    const unpublished = page.waitForResponse((r) => r.url().includes('bailleur.update') && r.ok())
    // Le segment DSFR recouvre son input : on coche le radio sans contrôle de visibilité.
    await page.getByRole('radio', { name: 'Dépubliée', exact: true }).check({ force: true })
    await unpublished
    await expect(page.getByRole('radio', { name: 'Dépubliée', exact: true })).toBeChecked()

    await visitor.goto(ownerSearch)
    await expect(visitor.getByText('Aucun résultat pour votre recherche')).toBeVisible()
    // Une fiche masquée redirige vers la recherche de sa ville (liens et URLs déjà indexés).
    await visitor.goto(fiche)
    await expect(visitor).toHaveURL(new RegExp(`${SEARCH_URL}$`))

    const republished = page.waitForResponse((r) => r.url().includes('bailleur.update') && r.ok())
    await page.getByRole('radio', { name: 'Publiée', exact: true }).check({ force: true })
    await republished

    await visitor.goto(ownerSearch)
    await expect(visitor.getByRole('heading', { name: residence.name })).toBeVisible()
    await visitor.close()
  })
})
