import type { HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { normalizeText } from '~/utils/normalize-text'

export const HOUSING_AID_STATUSES = ['student', 'apprentice', 'employed-student', 'lyceen', 'boursier-crous'] as const
export type HousingAidStatus = (typeof HOUSING_AID_STATUSES)[number]

export type HousingAidSimulation = { userId: string; inputs: HelpSimulatorFormData }

export type SimulationMetrics = {
  simulations: number
  students: number
  averageIncome: number | null
  averageRent: number | null
  guarantorRate: number | null
}

export type SimulationStatusRow = SimulationMetrics & { status: HousingAidStatus }

export type SimulationCityRow = SimulationMetrics & {
  // Clé normalisée, stable d'une saisie à l'autre (sert d'identifiant dans l'URL).
  key: string
  city: string
  // Ville marquée « populaire » dans le référentiel (grandes villes universitaires).
  isUniversityCity: boolean
  byStatus: SimulationStatusRow[]
}

// La ville est saisie librement (l'autocomplétion est facultative) : « Saint-Étienne », « saint etienne » et
// « ST ETIENNE » doivent tomber dans la même ligne.
export const cityKey = (city: string) =>
  normalizeText(city)
    .replace(/\bst\b/g, 'saint')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Libellé d'une ville hors référentiel : l'orthographe la plus fréquente parmi celles « bien écrites » (initiale
// en capitale, pas tout en capitales) ; à défaut, la plus fréquente, remise en forme (« dijon » → « Dijon »).
const isWellCased = (spelling: string) => /^\p{Lu}/u.test(spelling) && spelling !== spelling.toUpperCase()
const capitalizeWords = (value: string) =>
  value.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase())

function cityLabel(spellings: Map<string, number>) {
  const byFrequency = [...spellings.entries()].sort((a, b) => b[1] - a[1]).map(([spelling]) => spelling)
  return byFrequency.find(isWellCased) ?? capitalizeWords(byFrequency[0])
}

const average = (values: number[]) => (values.length === 0 ? null : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length))

/** Indicateurs d'un ensemble de simulations. Toutes les versions comptent ; « students » dédoublonne. */
export function summarizeSimulations(simulations: HousingAidSimulation[]): SimulationMetrics {
  const rents = simulations
    .map((s) => s.inputs.monthlyRent)
    .filter((rent): rent is number => typeof rent === 'number' && !Number.isNaN(rent))
  return {
    simulations: simulations.length,
    students: new Set(simulations.map((s) => s.userId)).size,
    averageIncome: average(simulations.map((s) => s.inputs.monthlyIncome)),
    averageRent: average(rents),
    guarantorRate:
      simulations.length === 0
        ? null
        : Math.round((simulations.filter((s) => s.inputs.hasGuarantor === 'yes').length / simulations.length) * 100),
  }
}

/** Statut multi-choix : une simulation compte dans chaque ligne, la somme dépasse le total. */
export function summarizeByStatus(simulations: HousingAidSimulation[]): SimulationStatusRow[] {
  return HOUSING_AID_STATUSES.map((status) => ({
    status,
    ...summarizeSimulations(simulations.filter((s) => s.inputs.status.includes(status))),
  })).filter((row) => row.simulations > 0)
}

/**
 * Répartition des simulations d'aides par ville visée, de la plus simulée à la moins simulée. Le libellé est
 * celui du référentiel si la ville y est connue, sinon l'orthographe la plus fréquente.
 */
export function groupSimulationsByCity(
  simulations: HousingAidSimulation[],
  referenceCities: { name: string; popular: boolean }[],
): SimulationCityRow[] {
  const reference = new Map(referenceCities.map((c) => [cityKey(c.name), c]))
  const groups = new Map<string, { spellings: Map<string, number>; simulations: HousingAidSimulation[] }>()

  for (const simulation of simulations) {
    const key = cityKey(simulation.inputs.city)
    if (!key) continue
    const group = groups.get(key) ?? { spellings: new Map<string, number>(), simulations: [] as HousingAidSimulation[] }
    const spelling = simulation.inputs.city.trim()
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1)
    group.simulations.push(simulation)
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const known = reference.get(key)
      return {
        key,
        city: known?.name ?? cityLabel(group.spellings),
        isUniversityCity: known?.popular ?? false,
        ...summarizeSimulations(group.simulations),
        byStatus: summarizeByStatus(group.simulations),
      }
    })
    .sort((a, b) => b.simulations - a.simulations || a.city.localeCompare(b.city, 'fr'))
}
