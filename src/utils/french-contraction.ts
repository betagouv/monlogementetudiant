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
  const trimmedCity = cityName.trim()

  // Vérifie si la ville commence par "Le " (article masculin singulier)
  if (/^Le\s/i.test(trimmedCity)) {
    const cityWithoutArticle = trimmedCity.replace(/^Le\s/i, '')
    return preposition === 'à' ? `au ${cityWithoutArticle}` : `du ${cityWithoutArticle}`
  }

  // Vérifie si la ville commence par "Les " (article pluriel)
  if (/^Les\s/i.test(trimmedCity)) {
    const cityWithoutArticle = trimmedCity.replace(/^Les\s/i, '')
    return preposition === 'à' ? `aux ${cityWithoutArticle}` : `des ${cityWithoutArticle}`
  }

  // Pour "La " et "L'" on ne fait pas de contraction
  return `${preposition} ${trimmedCity}`
}

/**
 * Formate un nom de ville avec la préposition "à" en appliquant les contractions
 * @param cityName - Le nom de la ville
 * @returns "au X", "aux X", ou "à X" selon le cas
 */
export function formatCityWithA(cityName: string): string {
  if (!cityName) return ''
  return applyFrenchContraction('à', cityName)
}

/**
 * Formate un nom de ville avec la préposition "de" en appliquant les contractions
 * @param cityName - Le nom de la ville
 * @returns "du X", "des X", ou "de X" selon le cas
 */
export function formatCityWithDe(cityName: string): string {
  if (!cityName) return ''
  return applyFrenchContraction('de', cityName)
}
