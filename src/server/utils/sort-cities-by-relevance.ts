export function sortCitiesByRelevance<T extends { city: string }>(cities: T[], searchTerm: string): T[] {
  const term = searchTerm.toLowerCase()
  return [...cities].sort((a, b) => {
    const cityA = a.city.toLowerCase()
    const cityB = b.city.toLowerCase()

    if (cityA === term && cityB !== term) return -1
    if (cityB === term && cityA !== term) return 1
    if (cityA === term && cityB === term) return 0

    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const arrondissementRegex = new RegExp(`^${escapedTerm}\\s+(\\d+)(?:er|e|ème)`, 'i')
    const arrondA = cityA.match(arrondissementRegex)
    const arrondB = cityB.match(arrondissementRegex)

    if (arrondA && arrondB) return parseInt(arrondA[1]) - parseInt(arrondB[1])
    if (arrondA && !arrondB) return -1
    if (!arrondA && arrondB) return 1

    const startsA = cityA.startsWith(term)
    const startsB = cityB.startsWith(term)
    if (startsA && !startsB) return -1
    if (!startsA && startsB) return 1

    return cityA.localeCompare(cityB)
  })
}
