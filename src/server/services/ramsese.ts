import 'server-only'
import { type TEtablissementSuperieur, type TUaiWs, ZGeoApiCommunes, ZUaisWs, ZUaiWs } from '~/schemas/ramsese/etablissement-superieur'
import { env } from '~/server/env'

/**
 * Récupération des établissements d'enseignement supérieur via RAMSESE, à partir
 * d'un code postal.
 *
 * Flux :
 *  1. code postal → code(s) commune INSEE (geo.api.gouv.fr — un CP couvre parfois
 *     plusieurs communes) ;
 *  2. `POST /v3/listeUai/filtres` sur ces communes → liste de numéros UAI ;
 *  3. `GET /v3/uai/{uai}` (avec géoloc + administration) pour chaque UAI → lieu.
 *
 * Le supérieur correspond à la sous-catégorie 5 de la nomenclature « nature UAI »
 * (codes 5xx). L'endpoint filtres n'exposant pas de flag « supérieur », on filtre
 * les natures sur le préfixe « 5 » à l'étape 3 (source de vérité complète, pas de
 * liste de codes à maintenir). Un jeu de natures explicite peut être fourni pour
 * pré-filtrer côté API et réduire le nombre d'appels détail.
 *
 * Même logique pour l'ouverture : l'endpoint filtres n'expose pas de critère
 * « établissement ouvert », l'état n'est disponible qu'au détail (`IDENTIFICATION.ETAT`),
 * donc l'exclusion des fermés se fait aussi à l'étape 3.
 */

const SUPERIEUR_NATURE_PREFIX = '5'
/**
 * Nomenclature RAMSESE « état de l'UAI » : 1 = ouvert, 2 = à ouvrir, 3 = fermé.
 * Un établissement fermé ou pas encore ouvert n'a rien à faire dans le bloc
 * « à proximité ».
 */
const ETAT_OUVERT = '1'
/**
 * Libellés « bouche-trou » saisis dans RAMSESE quand le nom réel n'est pas connu.
 * Comparés sur une forme normalisée (sans accents, casse et ponctuation ignorées).
 */
const PLACEHOLDER_DENOMINATIONS = new Set(['A COMPLETER', 'A COMPLETER PAR ACADEMIE', 'NON RENSEIGNE', 'SANS OBJET'])
const UAI_DETAIL_REVALIDATE_S = 86_400 // référentiel stable → cache Next.js 24 h
const DETAIL_CONCURRENCY = 8
const EXTERNAL_TIMEOUT_MS = 3_000

async function fetchWithTimeout(url: string, init: RequestInit & { next?: { revalidate: number } }): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`Délai dépassé : ${url.split('?')[0]}`)), EXTERNAL_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const ramseseHeaders = {
  'Content-Type': 'application/json',
  codeApplication: env.RAMSESE_CODE_APPLICATION,
}

// L'URL de base n'inclut pas /v3 ; on ajoute le préfixe des paths du swagger ici,
// et la clé passerelle Omogen en query param `api-key` (si définie).
const ramseseUrl = (path: string) => {
  const url = `${env.RAMSESE_API_URL}/v3${path}`
  if (!env.RAMSESE_API_KEY) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}api-key=${encodeURIComponent(env.RAMSESE_API_KEY)}`
}

type TValeurHist = { VALEUR?: string; DATE_FIN?: string }
type TCodeHist = { CODE?: string; DATE_FIN?: string }

/** Valeur active (sans DATE_FIN) la plus pertinente d'une liste historisée. */
function pickCurrentValeur(values?: TValeurHist[]): string | null {
  if (!values?.length) return null
  const active = values.find((v) => !v.DATE_FIN && v.VALEUR)
  return (active ?? values.findLast((v) => v.VALEUR))?.VALEUR ?? null
}

/** Forme comparable d'un libellé : sans accents, en majuscules, ponctuation → espace simple. */
function normalizeDenomination(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toUpperCase()
}

/** `true` si le libellé est vide ou un bouche-trou (« A compléter », « à COMPLETER »…). */
function isPlaceholderDenomination(value: string | null): boolean {
  if (!value) return true
  return PLACEHOLDER_DENOMINATIONS.has(normalizeDenomination(value))
}

/**
 * `true` si l'UAI est ouvert. Un `ETAT` absent est considéré ouvert : le champ est
 * optionnel côté API, mieux vaut afficher un établissement d'état inconnu que vider
 * le bloc si RAMSESE cesse de le servir.
 */
function isOpenUai(uai: TUaiWs): boolean {
  const etat = uai.IDENTIFICATION?.ETAT
  return !etat || etat === ETAT_OUVERT
}

/** Codes actifs (sans DATE_FIN) d'une liste de codes historisés. */
function activeCodes(codes?: TCodeHist[]): string[] {
  if (!codes?.length) return []
  return codes.filter((c) => !c.DATE_FIN && c.CODE).map((c) => c.CODE as string)
}

/**
 * Paris / Lyon / Marseille : RAMSESE code les UAI au niveau de l'arrondissement municipal
 * (ex. 75113 pour Paris 13e), alors que geo.api ne renvoie que la commune chef-lieu (75056),
 * qui ne correspond à aucun UAI. Le code d'arrondissement se déduit du code postal ; geo.api
 * le fournit aussi (`type=arrondissement-municipal`) mais en plusieurs secondes.
 */
function arrondissementInseeCode(codePostal: string): string | null {
  if (codePostal === '75116') return '75116'
  const paris = /^750(0[1-9]|1\d|20)$/.exec(codePostal)
  if (paris) return `751${paris[1]}`
  const lyon = /^6900([1-9])$/.exec(codePostal)
  if (lyon) return `6938${lyon[1]}`
  const marseille = /^130(0[1-9]|1[0-6])$/.exec(codePostal)
  if (marseille) return `132${marseille[1]}`
  return null
}

/** Étape 1 — code postal → codes commune INSEE (arrondissements municipaux inclus). */
async function fetchInseeCodesByPostalCode(codePostal: string): Promise<string[]> {
  const url = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(codePostal)}&fields=code,nom`
  const arrondissement = arrondissementInseeCode(codePostal)
  try {
    const res = await fetchWithTimeout(url, { next: { revalidate: UAI_DETAIL_REVALIDATE_S } })
    if (!res.ok) return arrondissement ? [arrondissement] : []
    const parsed = ZGeoApiCommunes.safeParse(await res.json())
    const communes = parsed.success ? parsed.data.map((c) => c.code) : []
    return [...new Set(arrondissement ? [...communes, arrondissement] : communes)]
  } catch {
    return arrondissement ? [arrondissement] : []
  }
}

/** Étape 2 — communes INSEE → numéros UAI. */
async function fetchUaisByCommunes(communes: string[], natures?: string[], secteurs?: string[]): Promise<string[]> {
  try {
    const res = await fetchWithTimeout(ramseseUrl('/listeUai/filtres'), {
      method: 'POST',
      headers: ramseseHeaders,
      body: JSON.stringify({
        communes,
        codeApplication: env.RAMSESE_CODE_APPLICATION,
        ...(natures?.length ? { natures } : {}),
        ...(secteurs?.length ? { secteurs } : {}),
      }),
      next: { revalidate: UAI_DETAIL_REVALIDATE_S },
    })
    if (!res.ok) throw new Error(`RAMSESE listeUai/filtres failed: ${res.status}`)
    const parsed = ZUaisWs.safeParse(await res.json())
    if (!parsed.success) return []
    return parsed.data.UAIS
  } catch {
    return []
  }
}

/** Étape 3 — détail d'un UAI (identification + localisation + géoloc). */
async function fetchUaiDetail(numeroUai: string): Promise<TUaiWs | null> {
  const params = new URLSearchParams({
    INCLURE_GEOLOCALISATION: 'true',
    ADMINISTRATION: 'true',
  })
  try {
    const res = await fetchWithTimeout(ramseseUrl(`/uai/${encodeURIComponent(numeroUai)}?${params}`), {
      headers: ramseseHeaders,
      next: { revalidate: UAI_DETAIL_REVALIDATE_S },
    })
    if (!res.ok) return null
    const parsed = ZUaiWs.safeParse(await res.json())
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Fan-out borné pour éviter de saturer la passerelle sur les grosses villes. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

function toEtablissement(uai: TUaiWs): TEtablissementSuperieur | null {
  const numeroUai = uai.IDENTIFICATION?.NUMERO_UAI
  if (!numeroUai) return null

  const geo = uai.GEOLOCALISATION
  const coordonnees =
    geo?.COORDONNEES_X && geo.COORDONNEES_Y
      ? {
          x: geo.COORDONNEES_X,
          y: geo.COORDONNEES_Y,
          systemeReference: geo.SYSTEME_REFERENCE ?? null,
        }
      : null

  // Une appellation bouche-trou (« A COMPLETER ») ne doit pas masquer une
  // dénomination principale exploitable ; si les deux sont vides/bouche-trou,
  // l'établissement est écarté en aval.
  const appellation = pickCurrentValeur(uai.IDENTIFICATION?.APPELLATIONS_OFFICIELLES)
  const denominationPrincipale = pickCurrentValeur(uai.IDENTIFICATION?.DENOMINATIONS_PRINCIPALES)
  const denomination = [appellation, denominationPrincipale].find((v) => !isPlaceholderDenomination(v)) ?? null

  return {
    numeroUai,
    denomination,
    sigle: pickCurrentValeur(uai.IDENTIFICATION?.SIGLES),
    natureCodes: activeCodes(uai.IDENTIFICATION?.NATURES),
    secteur: activeCodes(uai.IDENTIFICATION?.SECTEURS)[0] ?? null,
    adresse: pickCurrentValeur(uai.LOCALISATION?.ADRESSES),
    codePostal: uai.LOCALISATION?.CODE_POSTAL ?? null,
    commune: uai.LOCALISATION?.LOCALITE_ACHEMINEMENT ?? null,
    codeInseeCommune: uai.ADMINISTRATION?.CODE_INSEE_COMMUNE ?? null,
    telephone: uai.LOCALISATION?.TELEPHONE ?? null,
    email: uai.LOCALISATION?.MEL ?? null,
    coordonnees,
  }
}

export type TGetEtablissementsSuperieurOptions = {
  /** Codes « nature » explicites pour pré-filtrer côté API (perf). Défaut : sous-cat. 5. */
  natures?: string[]
  /** Secteurs à conserver (ex. `['PU', 'PR']`). Défaut : tous. */
  secteurs?: string[]
}

/**
 * Retourne les établissements d'enseignement supérieur situés dans la/les commune(s)
 * couverte(s) par un code postal. Renvoie `[]` si le CP est inconnu ou l'API muette.
 */
export async function getEtablissementsSuperieurByCodePostal(
  codePostal: string,
  options: TGetEtablissementsSuperieurOptions = {},
): Promise<TEtablissementSuperieur[]> {
  const communes = await fetchInseeCodesByPostalCode(codePostal)
  if (communes.length === 0) return []

  const numerosUai = await fetchUaisByCommunes(communes, options.natures, options.secteurs)
  if (numerosUai.length === 0) return []

  const details = await mapWithConcurrency(numerosUai, DETAIL_CONCURRENCY, fetchUaiDetail)

  const naturesFilter = options.natures?.length ? new Set(options.natures) : null
  const isSuperieur = (codes: string[]) =>
    naturesFilter ? codes.some((c) => naturesFilter.has(c)) : codes.some((c) => c.startsWith(SUPERIEUR_NATURE_PREFIX))

  return details
    .map((uai) => (uai && isOpenUai(uai) ? toEtablissement(uai) : null))
    .filter((e): e is TEtablissementSuperieur => e !== null && isSuperieur(e.natureCodes) && !isPlaceholderDenomination(e.denomination))
}

// for tests purpose
export const _internal = {
  EXTERNAL_TIMEOUT_MS,
  fetchInseeCodesByPostalCode,
  fetchUaisByCommunes,
  fetchUaiDetail,
  toEtablissement,
  mapWithConcurrency,
  isPlaceholderDenomination,
  isOpenUai,
}
