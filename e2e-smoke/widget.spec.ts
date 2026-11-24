import { city, expect, resultCards, test } from './target'

test('le widget partenaire sert son script et affiche des logements', async ({ page }) => {
  const embed = await page.request.get('/widget/embed.js')
  expect(embed.ok()).toBeTruthy()

  await page.goto(`/widget/logements?city=${encodeURIComponent(city.name)}&referrer=smoke-test`)

  await expect(resultCards(page).first()).toBeVisible()
})
