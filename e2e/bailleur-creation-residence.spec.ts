import { normalizeAccommodationName } from '../src/utils/normalize-accommodation-name'
import { createBailleur, expect, gotoHydrated, signIn, test, uniqueId } from './fixtures'

// Parcours : le gestionnaire crée une nouvelle résidence.

const NEW_RESIDENCE_URL = '/bailleur/residences/nouvelle-residence'

test.describe('Créer une résidence', () => {
  test('signale les champs obligatoires manquants', async ({ page }) => {
    const { user } = await createBailleur()
    await signIn(page, user.email)
    await gotoHydrated(page, NEW_RESIDENCE_URL)

    await page.getByRole('button', { name: 'Créer la résidence' }).click()

    await expect(page.getByText('Le nom de la résidence est requis')).toBeVisible()
    await expect(page.getByText('Le type de la résidence est requis')).toBeVisible()
    await expect(page.getByText('Veuillez sélectionner un type de logement')).toBeVisible()
    await expect(page.getByText('Veuillez sélectionner une adresse valide')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(NEW_RESIDENCE_URL))
  })

  test('crée une résidence et la retrouve dans la liste', async ({ page }) => {
    const { user } = await createBailleur()
    await signIn(page, user.email)
    // L'autocomplétion d'adresse interroge la Géoplateforme depuis le navigateur : on fournit sa réponse.
    await page.route('https://data.geopf.fr/geocodage/search/**', (route) =>
      route.fulfill({
        json: {
          features: [
            {
              properties: {
                label: '12 Rue des Gras 63000 Clermont-Ferrand',
                name: '12 Rue des Gras',
                city: 'Clermont-Ferrand',
                postcode: '63000',
              },
              geometry: { coordinates: [3.08, 45.78] },
            },
          ],
        },
      }),
    )
    const name = `Résidence E2E Créée ${uniqueId()}`
    await gotoHydrated(page, NEW_RESIDENCE_URL)

    await page.getByRole('textbox', { name: 'Nom de la résidence' }).fill(name)
    await page.getByRole('combobox', { name: 'Type de résidence' }).selectOption({ index: 1 })
    // Les radios DSFR sont recouverts par leur label : on clique le label.
    await page.locator('label').filter({ hasText: 'Résidence exclusivement étudiante' }).click()
    await expect(page.getByRole('radio', { name: /^Résidence exclusivement étudiante/ })).toBeChecked()

    await page.getByRole('combobox', { name: 'Type de logement' }).selectOption({ label: 'Studio T1' })
    const typology = page.getByRole('tabpanel')
    await typology.getByRole('spinbutton', { name: 'Minimum' }).first().fill('410')
    await typology.getByRole('spinbutton', { name: 'Maximum' }).first().fill('480')
    await typology.getByRole('spinbutton', { name: 'Nombre total de logements' }).fill('25')
    await typology.getByRole('spinbutton', { name: 'Logements disponibles' }).fill('6')

    await page.getByRole('textbox', { name: 'Adresse' }).fill('12 rue des Gras')
    // Suggestions rendues en simples <li> cliquables (sans rôle ARIA) : ciblées par leur texte.
    await page.locator('li').filter({ hasText: '12 Rue des Gras 63000 Clermont-Ferrand' }).click()
    // Champ sans nom accessible (label non relié) : ciblé par son id.
    await page.locator('#accommodation-redirection').fill('https://bailleur.example.com/nouvelle-residence')

    await page.getByRole('button', { name: 'Créer la résidence' }).click()

    await expect(page.getByText('Résidence créée avec succès')).toBeVisible()
    await expect(page).toHaveURL(/\/bailleur\/residences\/(?!nouvelle-residence)[a-z0-9-]+$/)

    // Le nom est normalisé à l'enregistrement (casse, préfixe « Résidence » retiré).
    await gotoHydrated(page, '/bailleur/residences')
    await expect(page.getByRole('heading', { name: normalizeAccommodationName(name) })).toBeVisible()
  })
})
