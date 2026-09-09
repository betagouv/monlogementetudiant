import { z } from 'zod'
import { env } from '~/server/env'

const GEO_API_URL = 'https://geo.api.gouv.fr'
const THROTTLE_MS = 150
const CANDIDATE_LIMIT = 10
const FETCH_TIMEOUT_MS = 10000

// --- Réponses des APIs externes ---------------------------------------------

const ZBanFeature = z.object({
  geometry: z.object({
    type: z.string(),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    label: z.string().optional(),
    name: z.string().optional(),
    city: z.string().optional(),
    municipality: z.string().optional(),
    postcode: z.string().optional(),
    citycode: z.string().optional(),
    depcode: z.string().optional(),
  }),
})
type TBanFeature = z.infer<typeof ZBanFeature>

// Les features sont validées une par une : une seule malformée ne doit pas
// invalider toute la réponse.
const ZBanResponse = z.object({ features: z.array(z.unknown()).default([]) })

const ZCommune = z.object({
  nom: z.string(),
  code: z.string(),
  codeDepartement: z.string().optional(),
  population: z.number().optional(),
  centre: z.object({ coordinates: z.tuple([z.number(), z.number()]) }).optional(),
})
const ZCommunes = z.array(ZCommune)
type TCommune = z.infer<typeof ZCommune>

// --- Décision ----------------------------------------------------------------

export type TGeocodeConfidence = 'exact' | 'commune' | 'dept-only'

export type TGeocodeReason =
  | 'citycode-match'
  | 'postcode-match'
  | 'cityname-match'
  | 'street-absent-from-ban'
  | 'cedex-dept-match'
  | 'orphan-box-suffix'
  | 'current-point-in-postcode'
  | 'cedex-current-in-dept'
  | 'no-candidate'
  | 'cedex-no-dept-match'
  // Attribué par le backfill, pas par cette fonction : la commune que la BAN
  // désigne ne contient pas le point retenu d'après nos propres contours.
  | 'boundary-disagreement'
  // Idem : l'adresse n'a aucun cityId, ce qui la fait disparaître des listings.
  | 'missing-city-id'

/**
 * `apply` : coordonnées vérifiées, on peut écrire.
 * `keep`  : le point déjà en base est plausible, ne rien réécrire.
 * `flag`  : impossible de trancher automatiquement, revue manuelle.
 */
export type TGeocodeDecision =
  | {
      action: 'apply'
      lat: number
      lng: number
      address: string
      city: string
      postalCode: string
      inseeCode: string | null
      confidence: TGeocodeConfidence
      reason: TGeocodeReason
    }
  | { action: 'keep'; reason: TGeocodeReason }
  | { action: 'flag'; reason: TGeocodeReason }

// --- Utilitaires exportés (réutilisés par l'import et le backfill) ------------

/**
 * Un « CS » / « BP » / « TSA » orphelin en fin d'adresse signale que le numéro
 * de boîte a été découpé et rangé dans le code postal à l'import : « 2 rue du
 * Général Delestraint CS 15250 » devient adresse « … CS » + code postal
 * « 15250 », qui est un vrai code postal (Ayrens, Cantal) alors que la
 * résidence est à Metz. Le code postal est donc faux même s'il existe.
 */
const ORPHAN_BOX_SUFFIX = /[\s,-]*\b(cs|bp|tsa)\s*$/i
// Pas de \b après le groupe : le numéro est parfois collé au sigle (« CS5217 »),
// et « s » suivi de « 5 » ne forme pas de frontière de mot.
const BOX_SUFFIX = /[\s,-]*\b(cs|bp|cedex|tsa)\s*\d*\s*$/i

export function hasOrphanBoxSuffix(address: string): boolean {
  return ORPHAN_BOX_SUFFIX.test((address ?? '').trim())
}

export function stripBoxSuffix(address: string): string {
  let cleaned = (address ?? '').trim()
  while (BOX_SUFFIX.test(cleaned)) cleaned = cleaned.replace(BOX_SUFFIX, '').trim()
  return cleaned
}

/** Les codes postaux d'outre-mer portent le département sur trois chiffres. */
export function departmentOf(postalCode: string): string {
  return postalCode.startsWith('97') || postalCode.startsWith('98') ? postalCode.slice(0, 3) : postalCode.slice(0, 2)
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// --- Accès réseau -------------------------------------------------------------

let lastCall = 0

async function throttledJson(url: string): Promise<unknown | null> {
  const wait = THROTTLE_MS - (Date.now() - lastCall)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastCall = Date.now()

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (response.status === 429 || response.status >= 500) {
        if (attempt < 2) continue
        return null
      }
      if (!response.ok) return null
      return await response.json()
    } catch {
      if (attempt < 2) continue
      return null
    }
  }
  return null
}

const communesCache = new Map<string, TCommune[]>()

/** Communes rattachées à un code postal. Vide si le code n'existe pas (CEDEX). */
export async function fetchCommunesForPostalCode(postalCode: string): Promise<TCommune[]> {
  const cached = communesCache.get(postalCode)
  if (cached) return cached

  const raw = await throttledJson(`${GEO_API_URL}/communes?codePostal=${postalCode}&fields=nom,code,codeDepartement,centre,population`)
  const parsed = ZCommunes.safeParse(raw)
  const communes = parsed.success ? parsed.data : []
  communesCache.set(postalCode, communes)
  return communes
}

async function fetchCandidates(query: string): Promise<TBanFeature[]> {
  const raw = await throttledJson(`${env.GEOCODING_API_URL}?q=${encodeURIComponent(query)}&limit=${CANDIDATE_LIMIT}`)
  const parsed = ZBanResponse.safeParse(raw)
  if (!parsed.success) return []

  const features: TBanFeature[] = []
  for (const candidate of parsed.data.features) {
    const feature = ZBanFeature.safeParse(candidate)
    if (feature.success && feature.data.geometry.type === 'Point') features.push(feature.data)
  }
  return features
}

// --- Résolution ---------------------------------------------------------------

function fromFeature(feature: TBanFeature, postalCode: string, confidence: TGeocodeConfidence, reason: TGeocodeReason): TGeocodeDecision {
  const [lng, lat] = feature.geometry.coordinates
  return {
    action: 'apply',
    lat,
    lng,
    address: feature.properties.name ?? feature.properties.label ?? '',
    city: feature.properties.city ?? feature.properties.municipality ?? '',
    postalCode: feature.properties.postcode ?? postalCode,
    inseeCode: feature.properties.citycode ?? null,
    confidence,
    reason,
  }
}

/**
 * Géocode une adresse en vérifiant que le résultat retenu tombe bien dans la
 * commune attendue, au lieu de faire confiance au premier candidat de la BAN.
 *
 * Sans cette vérification, « 3 allée Marguerite Yourcenar 02100 Saint-Quentin »
 * — rue absente de la BAN — renvoie « 3 Rue Marguerite Yourcenar 37550
 * Saint-Avertin » avec un score de 0,56, soit 333 km d'écart.
 */
export async function resolveAddressLocation(input: {
  address: string
  postalCode: string
  cityName?: string | null
  /** Code INSEE de la commune où tombe le point actuel, s'il y en a un. */
  currentInseeCode?: string | null
  /** Département du point actuel, s'il y en a un. */
  currentDepartment?: string | null
}): Promise<TGeocodeDecision> {
  const { postalCode, cityName, currentInseeCode, currentDepartment } = input

  // Garde-fou 1 : code postal issu d'un numéro de boîte -> inexploitable, et le
  // nom de commune qui en dérive l'est tout autant. On ne réécrit rien.
  if (hasOrphanBoxSuffix(input.address)) return { action: 'flag', reason: 'orphan-box-suffix' }

  const street = stripBoxSuffix(input.address)
  const communes = await fetchCommunesForPostalCode(postalCode)
  const postalCodeIsReal = communes.length > 0
  const inseeOfPostalCode = new Set(communes.map((commune) => commune.code))

  const query = postalCodeIsReal ? `${street} ${postalCode} ${cityName ?? ''}`.trim() : street
  const candidates = await fetchCandidates(query)

  if (postalCodeIsReal) {
    // Validation par ordre de force décroissante.
    for (const candidate of candidates) {
      if (candidate.properties.citycode && inseeOfPostalCode.has(candidate.properties.citycode)) {
        return fromFeature(candidate, postalCode, 'exact', 'citycode-match')
      }
    }
    for (const candidate of candidates) {
      if (candidate.properties.postcode === postalCode) return fromFeature(candidate, postalCode, 'exact', 'postcode-match')
    }
    for (const candidate of candidates) {
      if (cityName && normalizeName(candidate.properties.city) === normalizeName(cityName)) {
        return fromFeature(candidate, postalCode, 'exact', 'cityname-match')
      }
    }

    // Garde-fou 2 : aucun candidat ne valide, mais le point déjà en base est
    // dans une commune du code postal -> il est plausible, on n'y touche pas.
    if (currentInseeCode && inseeOfPostalCode.has(currentInseeCode)) {
      return { action: 'keep', reason: 'current-point-in-postcode' }
    }

    // Adresse absente de la BAN et point actuel aberrant : le centre de la
    // commune est le mieux qu'on puisse produire sans coordonnées manuelles.
    const commune =
      communes.find((c) => cityName && normalizeName(c.nom) === normalizeName(cityName)) ??
      [...communes].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0]
    if (commune?.centre) {
      const [lng, lat] = commune.centre.coordinates
      return {
        action: 'apply',
        lat,
        lng,
        address: street,
        city: commune.nom,
        postalCode,
        inseeCode: commune.code,
        confidence: 'commune',
        reason: 'street-absent-from-ban',
      }
    }
    return { action: 'flag', reason: 'no-candidate' }
  }

  // Code postal CEDEX : absent de geo.api, mais le département reste lisible.
  const department = departmentOf(postalCode)
  const inDepartment = candidates.filter((candidate) => candidate.properties.depcode === department)
  if (inDepartment.length > 0) {
    if (currentDepartment === department) return { action: 'keep', reason: 'cedex-current-in-dept' }
    return fromFeature(inDepartment[0], postalCode, 'dept-only', 'cedex-dept-match')
  }
  return { action: 'flag', reason: 'cedex-no-dept-match' }
}
