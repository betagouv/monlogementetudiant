import { expect, gotoHydrated, test } from './fixtures'

// Parcours : simulateurs (calculs côté navigateur, sans compte).

test.describe("Simulateur d'aides au logement", () => {
  test('bloque le passage à l’étape suivante tant que le profil est incomplet', async ({ page }) => {
    await gotoHydrated(page, '/simuler-mes-aides-au-logement')

    await page.getByRole('button', { name: 'Continuer' }).click()

    await expect(page.getByRole('alert', { name: '2 informations sont manquantes ou invalides' })).toBeVisible()
    await expect(page.getByText('Veuillez renseigner votre âge').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /Votre situation/ })).toBeVisible()
  })

  test('explique en français que le statut est obligatoire', async ({ page }) => {
    // Bug connu : sans statut coché, Zod renvoie son message brut en anglais
    // (« Invalid input: expected array, received undefined »). Retirer `test.fail` une fois corrigé.
    test.fail()
    await gotoHydrated(page, '/simuler-mes-aides-au-logement')

    await page.getByRole('button', { name: 'Continuer' }).click()

    await expect(page.getByText('Veuillez sélectionner votre statut').first()).toBeVisible({ timeout: 3_000 })
  })

  test("estime les aides d'un étudiant sans garant", async ({ page }) => {
    await gotoHydrated(page, '/simuler-mes-aides-au-logement')

    await page.getByLabel('Quel âge avez-vous ?').fill('20')
    await page.getByText('Étudiant', { exact: true }).click()
    await page.getByRole('button', { name: 'Continuer' }).click()

    await page.getByLabel('Dans quelle ville cherchez-vous un logement ?').fill('Saint-É')
    await page
      .getByRole('option', { name: /Saint-Étienne/ })
      .first()
      .click()
    await page.getByRole('group', { name: 'Avez-vous un garant ?' }).getByText('Non', { exact: true }).click()
    await page.getByRole('button', { name: 'Continuer' }).click()

    await page.getByLabel('Vos revenus mensuels').fill('0')
    await page.getByLabel('Montant de votre loyer mensuel').fill('400')
    await page.getByRole('button', { name: 'Voir les résultats' }).click()

    await expect(page.getByRole('heading', { name: 'Résultats de votre simulation' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Aides disponibles (2)' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Aides au logement de la Caf (APL, ALS)' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Garantie Visale' })).toBeVisible()
  })
})

test.describe('Simulateur de budget', () => {
  test('calcule le solde mensuel à partir des revenus et des dépenses', async ({ page }) => {
    await gotoHydrated(page, '/simuler-budget')

    const job = page.getByRole('group', { name: 'Ligne de revenu : Job étudiant' })
    await job.getByRole('spinbutton', { name: 'Montant' }).fill('600')
    // Une bourse annuelle est ramenée au mois : 3 600 € / 12 = 300 €.
    const bourse = page.getByRole('group', { name: /Ligne de revenu : Bourses/ })
    await bourse.getByRole('combobox', { name: 'Fréquence' }).selectOption({ label: 'Annuelle' })
    await bourse.getByRole('spinbutton', { name: 'Montant' }).fill('3600')

    await page.getByRole('group', { name: 'Ligne de dépense : Loyer' }).getByRole('spinbutton', { name: 'Montant' }).fill('450')
    await page
      .getByRole('group', { name: /Ligne de dépense : Alimentation/ })
      .getByRole('spinbutton', { name: 'Montant' })
      .fill('140')

    const main = page.getByRole('main')
    await expect(main).toContainText(/Revenus totaux mensualisés\s*900,00\s€/)
    await expect(main).toContainText(/Dépenses totales mensualisées\s*590,00\s€/)
    await expect(main).toContainText(/Solde restant\s*\+310,00\s€/)
  })
})
