/**
 * Règle de fraîcheur des disponibilités du suivi admin : une disponibilité est « à jour » si elle a été
 * mise à jour dans les 31 derniers jours, comptés en dates (heure de Paris) et non en heures.
 *
 * 31 jours plutôt que 30 : un gestionnaire qui met à jour à date fixe chaque mois n'est jamais pénalisé par un
 * mois de 31 jours, y compris au relevé du 1er (le 1er avril couvre encore une mise à jour du 1er mars).
 */
export const AVAILABILITY_FRESHNESS_DAYS = 31

const PARIS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Premier jour (AAAA-MM-JJ, heure de Paris) à partir duquel une mise à jour compte comme « à jour ». */
export function availabilityRecentSince(now: Date = new Date()): string {
  const parts = Object.fromEntries(PARIS_DAY.formatToParts(now).map((p) => [p.type, p.value]))
  const since = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - AVAILABILITY_FRESHNESS_DAYS))
  return since.toISOString().slice(0, 10)
}

/** « 1er octobre 2026 », « 18 octobre 2026 » */
export function formatRecentSince(since: string): string {
  const [year, month, day] = since.split('-').map(Number)
  const monthName = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' })
  return `${day === 1 ? '1er' : day} ${monthName} ${year}`
}
