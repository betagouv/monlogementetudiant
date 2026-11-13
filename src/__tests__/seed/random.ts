/**
 * Aléatoire déterministe et identités fictives pour le seed.
 *
 * - Graine fixe : deux exécutions produisent exactement les mêmes données (tests e2e stables).
 * - Dates relatives au lancement : les écrans « 30 derniers jours » ou « 6 derniers mois » restent
 *   peuplés quel que soit le jour où l'on seed.
 * - Identités anonymes : prénoms/noms génériques, e-mails en `example.com` (domaine réservé, RFC 2606),
 *   téléphones en 06 00 00 xx xx. Aucune donnée réelle.
 */

export type Random = ReturnType<typeof createRandom>

export function createRandom(seed = 20261113) {
  // mulberry32
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]
  const chance = (probability: number) => next() < probability
  /** Choix pondéré : `[[valeur, poids], …]`. */
  const weighted = <T>(entries: readonly (readonly [T, number])[]): T => {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
    let roll = next() * total
    for (const [value, weight] of entries) {
      roll -= weight
      if (roll < 0) return value
    }
    return entries[entries.length - 1][0]
  }
  const sample = <T>(items: readonly T[], count: number): T[] => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, count)
  }

  return { next, int, pick, chance, weighted, sample }
}

const DAY_MS = 24 * 60 * 60 * 1000

export function createClock(now = new Date()) {
  /** Instant situé `days` jours (fractionnaires acceptés) avant le lancement du seed. */
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS)
  const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS)
  /** Date `AAAA-MM-JJ` (colonnes `date`). */
  const isoDate = (date: Date) => date.toISOString().slice(0, 10)
  return { now, daysAgo, addDays, isoDate }
}

export type Clock = ReturnType<typeof createClock>

const FIRSTNAMES = [
  'Camille',
  'Lou',
  'Sacha',
  'Noa',
  'Charlie',
  'Alix',
  'Eden',
  'Maël',
  'Andréa',
  'Robin',
  'Louison',
  'Yaël',
  'Marin',
  'Ilian',
  'Jade',
  'Nour',
  'Lina',
  'Timéo',
  'Inès',
  'Hugo',
] as const

const LASTNAMES = [
  'Martin',
  'Bernard',
  'Petit',
  'Durand',
  'Leroy',
  'Moreau',
  'Simon',
  'Laurent',
  'Michel',
  'Garcia',
  'Roux',
  'Fournier',
  'Girard',
  'Bonnet',
  'Mercier',
] as const

/** Identité fictive n°`index` : stable, unique par index, sans lien avec une personne réelle. */
export function fakeIdentity(random: Random, index: number, prefix = 'etudiant') {
  const firstname = random.pick(FIRSTNAMES)
  const lastname = random.pick(LASTNAMES)
  const suffix = String(index).padStart(3, '0')
  return {
    firstname,
    lastname,
    name: `${firstname} ${lastname}`,
    email: `${prefix}-${suffix}@example.com`,
    phone: `060000${String(index % 10000).padStart(4, '0')}`,
    birthdate: `${random.int(1999, 2007)}-${String(random.int(1, 12)).padStart(2, '0')}-${String(random.int(1, 28)).padStart(2, '0')}`,
  }
}

/** Empreinte factice au format d'un sha256 hexadécimal (ipHash, tokenHash…). */
export function fakeHash(random: Random) {
  let out = ''
  for (let i = 0; i < 64; i++) out += '0123456789abcdef'[random.int(0, 15)]
  return out
}
