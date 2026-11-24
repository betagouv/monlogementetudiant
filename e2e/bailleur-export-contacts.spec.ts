import { readFile } from 'node:fs/promises'
import { createAcademy, createCity, createDepartment } from '../src/__tests__/fixtures/factories'
import { EContactStatus } from '../src/enums/contact-status'
import { EOwnerContactMode } from '../src/enums/owner-contact-mode'
import { contactRequests } from '../src/server/db/schema/contacts'
import { createBailleur, createResidence, expect, gotoHydrated, signIn, test, uniqueId } from './fixtures'

// Parcours : le gestionnaire exporte en CSV les coordonnées déposées sur ses résidences, filtrées par région ou par résidence.

async function createParisCity() {
  const id = uniqueId()
  const academy = await createAcademy({ name: `Académie de Paris ${id}`, slug: `academie-paris-${id}` })
  const department = await createDepartment({ academyId: academy.id, name: 'Paris', code: '75', slug: `paris-${id}` })
  const city = await createCity({
    departmentId: department.id,
    name: 'Paris',
    slug: `paris-${id}`,
    postalCodes: ['75005'],
    inseeCodes: [id.slice(0, 5)],
  })
  return city.id
}

test.describe('Exporter les coordonnées des étudiants', () => {
  test('télécharge le CSV filtré par région puis par résidence', async ({ page, db }) => {
    const { user, owner } = await createBailleur({ contactMode: EOwnerContactMode.CONTACTS })
    const clermont = await createResidence({ ownerId: owner.id, acceptsApplications: true })
    const paris = await createResidence({ ownerId: owner.id, acceptsApplications: true, cityId: await createParisCity() })
    const id = uniqueId()
    const clermontEmail = `clermont-${id}@e2e.test`
    const parisEmail = `paris-${id}@e2e.test`
    await db.insert(contactRequests).values([
      {
        accommodationId: clermont.id,
        firstname: 'Inès',
        lastname: 'Roche',
        email: clermontEmail,
        status: EContactStatus.A_CONTACTER,
        confirmedAt: new Date(),
      },
      {
        accommodationId: paris.id,
        firstname: 'Hugo',
        lastname: 'Petit',
        email: parisEmail,
        status: EContactStatus.A_CONTACTER,
        confirmedAt: new Date(),
      },
    ])
    await signIn(page, user.email)

    await gotoHydrated(page, '/bailleur/contacts')
    await expect(page.getByRole('heading', { name: 'Exporter les coordonnées des étudiants' })).toBeVisible()

    await page.getByLabel('Région', { exact: true }).selectOption('Île-de-France')
    await expect(page.getByLabel('Résidence', { exact: true }).locator('option')).toHaveText(['Toutes les résidences', paris.name])

    const exportLink = page.getByRole('link', { name: 'Exporter les coordonnées (CSV)' })
    const [byRegion] = await Promise.all([page.waitForEvent('download'), exportLink.click()])
    const regionCsv = await readFile((await byRegion.path()) as string, 'utf-8')
    expect(regionCsv).toContain(parisEmail)
    expect(regionCsv).not.toContain(clermontEmail)

    await page.getByLabel('Région', { exact: true }).selectOption('')
    await page.getByLabel('Résidence', { exact: true }).selectOption(clermont.slug)
    const [byResidence] = await Promise.all([page.waitForEvent('download'), exportLink.click()])
    const residenceCsv = await readFile((await byResidence.path()) as string, 'utf-8')
    expect(residenceCsv).toContain(clermontEmail)
    expect(residenceCsv).toContain('Auvergne-Rhône-Alpes')
    expect(residenceCsv).not.toContain(parisEmail)
  })
})
