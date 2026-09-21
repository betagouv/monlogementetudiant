import { AvailableLocales } from '~/i18n/locales'

/**
 * Gère les contractions françaises avec les noms de villes contenant des articles.
 *
 * Règles :
 * - "à + Le X" → "au X"
 * - "à + Les X" → "aux X"
 * - "à + La X" → "à La X" (pas de changement)
 * - "à + L'X" → "à L'X" (pas de changement)
 * - "de + Le X" → "du X"
 * - "de + Les X" → "des X"
 * - "de + La X" → "de La X" (pas de changement)
 * - "de + L'X" → "de L'X" (pas de changement)
 */

type Preposition = 'à' | 'de'

/**
 * Applique les contractions françaises pour une préposition suivie d'un nom de ville
 * @param preposition - La préposition ('à' ou 'de')
 * @param cityName - Le nom de la ville
 * @returns La chaîne avec la contraction appropriée
 */
export function applyFrenchContraction(preposition: Preposition, cityName: string): string {
  if (!cityName) return ''
  const trimmedCity = cityName.trim()

  if (/^Le\s/i.test(trimmedCity)) {
    const cityWithoutArticle = trimmedCity.replace(/^Le\s/i, '')
    return preposition === 'à' ? `au ${cityWithoutArticle}` : `du ${cityWithoutArticle}`
  }

  if (/^Les\s/i.test(trimmedCity)) {
    const cityWithoutArticle = trimmedCity.replace(/^Les\s/i, '')
    return preposition === 'à' ? `aux ${cityWithoutArticle}` : `des ${cityWithoutArticle}`
  }

  // Pour "La " et "L'" on ne fait pas de contraction
  return `${preposition} ${trimmedCity}`
}

/**
 * Formate un nom de ville précédé d'une préposition, selon la langue d'affichage. Le résultat est
 * destiné à être injecté dans un message (`{locationFormatted}`, `{cityFormatted}`, …) qui ne porte
 * donc pas lui-même la préposition de lieu.
 *
 * - fr : contraction française (« à Paris », « au Havre », « du Havre », « des Sables-d'Olonne »).
 * - en : « à » devient « in X » ; « de » renvoie le nom seul, la préposition anglaise dépendant de la
 *   phrase (« near », « around », « of ») et étant donc portée par le message en.json.
 */
export function formatCityWithPreposition(locale: string, preposition: Preposition, cityName: string): string {
  if (!cityName) return ''
  if (locale !== AvailableLocales.EN) return applyFrenchContraction(preposition, cityName)

  const trimmedCity = cityName.trim()
  return preposition === 'à' ? `in ${trimmedCity}` : trimmedCity
}
