import { city, cityQuery, expect, gotoHydrated, test } from './target'

test("le simulateur d'aides estime les aides d'un étudiant sans garant", async ({ page }) => {
  await gotoHydrated(page, '/simuler-mes-aides-au-logement')

  await page.getByLabel('Quel âge avez-vous ?').fill('20')
  await page.getByText('Étudiant', { exact: true }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()

  await page.getByLabel('Dans quelle ville cherchez-vous un logement ?').fill(cityQuery)
  await page
    .getByRole('option', { name: new RegExp(city.name) })
    .first()
    .click()
  await page.getByRole('group', { name: 'Avez-vous un garant ?' }).getByText('Non', { exact: true }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()

  await page.getByLabel('Vos revenus mensuels').fill('0')
  await page.getByLabel('Montant de votre loyer mensuel').fill('400')
  await page.getByRole('button', { name: 'Voir les résultats' }).click()

  await expect(page.getByRole('heading', { name: 'Résultats de votre simulation' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Aides disponibles \(\d+\)/ })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Garantie Visale' })).toBeVisible()
})

test('le simulateur de budget calcule le solde mensuel', async ({ page }) => {
  await gotoHydrated(page, '/simuler-budget')

  const job = page.getByRole('group', { name: 'Ligne de revenu : Job étudiant' })
  await job.getByRole('spinbutton', { name: 'Montant' }).fill('600')
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
