import { createAdmin, createBailleur, createResidence, expect, gotoHydrated, signIn, test } from './fixtures'

// Parcours : enquête flash sur la part d'étudiants boursiers, résidence par résidence.

const SURVEY_TITLE = "Enquête flash : part d'étudiants boursiers"
const ACTION_TITLE = "Répondre à l'enquête flash sur les boursiers"

test.describe('Enquête flash boursiers', () => {
  test('invite à répondre, garde le brouillon et ne relance plus une fois complétée', async ({ page }) => {
    const { user, owner } = await createBailleur({ scholarshipSurveyPending: true })
    const first = await createResidence({ ownerId: owner.id, name: 'Résidence A enquête' })
    const second = await createResidence({ ownerId: owner.id, name: 'Résidence B enquête' })

    await signIn(page, user.email)
    await gotoHydrated(page, '/bailleur/tableau-de-bord')

    const loginModal = page.getByRole('dialog', { name: 'Une enquête flash est disponible' })
    await expect(loginModal).toBeVisible()
    await expect(page.getByRole('link', { name: ACTION_TITLE }).first()).toBeVisible()
    await loginModal.getByRole('link', { name: "Répondre à l'enquête" }).click()

    await expect(page.getByRole('heading', { level: 1, name: SURVEY_TITLE })).toBeVisible()
    await expect(page.getByText('0 résidence sur 2 renseignée')).toBeVisible()

    const firstRow = page.getByRole('group', { name: first.name })
    const secondRow = page.getByRole('group', { name: second.name })
    await firstRow.getByLabel("Nombre d'étudiants boursiers").fill('42')
    await expect(page.getByText('1 résidence sur 2 renseignée')).toBeVisible()

    await page.getByRole('button', { name: 'Envoyer mes réponses' }).click()
    const missingModal = page.getByRole('dialog', { name: 'Il reste des résidences à compléter' })
    await expect(missingModal).toBeVisible()
    await expect(missingModal.getByRole('listitem').filter({ hasText: second.name })).toBeVisible()
    await expect(missingModal.getByRole('listitem').filter({ hasText: first.name })).toHaveCount(0)
    await missingModal.getByRole('button', { name: 'Continuer à compléter' }).click()

    await gotoHydrated(page, '/bailleur/enquete-boursiers')
    await expect(firstRow.getByLabel("Nombre d'étudiants boursiers")).toHaveValue('42')

    await secondRow.getByText('Non mesuré dans cette résidence').click()
    await expect(secondRow.getByLabel("Ou part d'étudiants boursiers (%)")).toBeDisabled()
    await page.getByRole('button', { name: 'Envoyer mes réponses' }).click()

    await expect(page).toHaveURL(/\/bailleur\/tableau-de-bord/)
    await expect(page.getByRole('link', { name: ACTION_TITLE })).toHaveCount(0)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Enquête flash' })).toBeVisible()
  })

  test('ne propose plus l’enquête à un bailleur qui l’a complétée, mais la laisse modifiable', async ({ page }) => {
    const { user, owner } = await createBailleur()
    await createResidence({ ownerId: owner.id })

    await signIn(page, user.email)
    await gotoHydrated(page, '/bailleur/tableau-de-bord')

    await expect(page.getByRole('dialog', { name: 'Une enquête flash est disponible' })).toBeHidden()
    await expect(page.getByRole('link', { name: ACTION_TITLE })).toHaveCount(0)
    await page.getByRole('navigation').getByRole('link', { name: 'Enquête flash' }).click()
    await expect(page.getByRole('heading', { level: 1, name: SURVEY_TITLE })).toBeVisible()
  })

  test('enregistre la saisie en brouillon quand on quitte par le menu', async ({ page }) => {
    const { user, owner } = await createBailleur({ scholarshipSurveyPending: true })
    const residence = await createResidence({ ownerId: owner.id })

    await signIn(page, user.email)
    await gotoHydrated(page, '/bailleur/enquete-boursiers')
    const saved = page.waitForResponse((r) => r.url().includes('scholarshipSurvey.save') && r.ok())
    await page.getByRole('group', { name: residence.name }).getByLabel("Nombre d'étudiants boursiers").fill('7')
    await saved

    await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: 'Tableau de bord' }).click()
    await expect(page).toHaveURL(/\/bailleur\/tableau-de-bord/)
    await gotoHydrated(page, '/bailleur/enquete-boursiers')
    await expect(page.getByRole('group', { name: residence.name }).getByLabel("Nombre d'étudiants boursiers")).toHaveValue('7')
  })

  test('n’efface pas la réponse saisie entre-temps dans un autre onglet', async ({ page, context }) => {
    const { user, owner } = await createBailleur({ scholarshipSurveyPending: true })
    const first = await createResidence({ ownerId: owner.id, name: 'Résidence A onglets' })
    const second = await createResidence({ ownerId: owner.id, name: 'Résidence B onglets' })

    await signIn(page, user.email)
    await gotoHydrated(page, '/bailleur/enquete-boursiers')

    const other = await context.newPage()
    await gotoHydrated(other, '/bailleur/enquete-boursiers')
    const saved = other.waitForResponse((r) => r.url().includes('scholarshipSurvey.save') && r.ok())
    await other.getByRole('group', { name: second.name }).getByLabel("Nombre d'étudiants boursiers").fill('18')
    await saved
    await other.close()

    await page.getByRole('group', { name: first.name }).getByLabel("Nombre d'étudiants boursiers").fill('42')
    await page.getByRole('button', { name: 'Envoyer mes réponses' }).click()
    await expect(page).toHaveURL(/\/bailleur\/tableau-de-bord/)

    await gotoHydrated(page, '/bailleur/enquete-boursiers')
    await expect(page.getByRole('group', { name: second.name }).getByLabel("Nombre d'étudiants boursiers")).toHaveValue('18')
  })

  test('liste les réponses côté administration et propose l’export', async ({ page }) => {
    const admin = await createAdmin()
    const { owner } = await createBailleur({ scholarshipSurveyPending: true })
    const residence = await createResidence({ ownerId: owner.id })

    await signIn(page, admin.email)
    await gotoHydrated(page, '/administration/enquete-boursiers?status=unanswered&search=' + encodeURIComponent(residence.name))

    await expect(page.getByRole('heading', { level: 1, name: SURVEY_TITLE })).toBeVisible()
    await expect(page.getByText('Les logements CROUS ne sont pas pris en compte dans cette enquête.')).toBeVisible()
    await expect(page.getByRole('cell', { name: residence.name })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Exporter en CSV' })).toHaveAttribute('href', /status=unanswered/)
  })
})
