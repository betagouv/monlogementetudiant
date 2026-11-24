import { writeFile } from 'node:fs/promises'
import { and, eq, sql } from 'drizzle-orm'
import { NATURES_ETABLISSEMENTS } from '~/schemas/ramsese/natures'
import { env } from '~/server/env'
import { haversineMeters, parseRamseseCoordonnees } from '~/utils/geo'

/**
 * Commande de vérification RAMSESE — à lancer dans un one-off Scalingo (IP whitelistée).
 *
 * Rejoue le pipeline exact de la fiche logement (CP -> communes INSEE -> filtres UAI ->
 * détails géolocalisés -> distance) en réutilisant le vrai code de parsing/distance
 * (`~/utils/geo`) et la vraie liste blanche des natures. Réplique seulement les 3 appels
 * fetch en inline car le service `~/server/services/ramsese` importe `server-only`
 * (non résoluble hors bundler Next).
 *
 *   mle verify-ramsese --cp 94000
 *   mle verify-ramsese --slug residence-xxx          # CP + coords depuis la BDD
 *   mle verify-ramsese --cp 94000 --lat 48.79 --lng 2.45 --dump
 */

const BASE = env.RAMSESE_API_URL
const CODEAPP = env.RAMSESE_CODE_APPLICATION
const API_KEY = env.RAMSESE_API_KEY
const HEADERS = { 'Content-Type': 'application/json', codeApplication: CODEAPP }
const FETCH_TIMEOUT_MS = 15_000

// Ajoute /v3 + la clé passerelle Omogen en query param `api-key` (si définie).
function ramseseUrl(path: string): string {
  const url = `${BASE}/v3${path}`
  if (!API_KEY) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}api-key=${encodeURIComponent(API_KEY)}`
}

const distanceFmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface VerifyRamseseOptions {
  cp?: string
  insee?: string // codes INSEE directs (séparés par des virgules), court-circuite geo.api
  slug?: string
  lat?: string
  lng?: string
  limit?: number
  concurrency?: number // nb de requêtes détail en vol simultanément (pool borné). Défaut 8.
  natures?: boolean // commander: --no-natures => natures === false
  national?: boolean // périmètre national : filtres sur les natures seules, sans communes
  etats?: string // codes état (ex. « 1 ») envoyés dans le body filtres, pour sonder le support côté API
  json?: string // chemin d'un fichier .json où écrire la liste complète (non tronquée)
  dump?: boolean
}

type LatLng = { lat: number; lng: number }

async function mapPool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return results
}

// biome-ignore lint/suspicious/noExplicitAny: payloads RAMSESE bruts, non typés ici
type Json = any

/** Récupère CP + coords (WGS84) d'une résidence depuis la BDD (chemin fidèle à la prod). */
async function resolveFromSlug(slug: string): Promise<{ codePostal: string; residence: LatLng } | null> {
  const { db, closeDb } = await import('~/server/db')
  const { accommodations } = await import('~/server/db/schema/accommodations')
  const { accommodationAddresses } = await import('~/server/db/schema/accommodation-addresses')
  try {
    const [row] = await db
      .select({
        postalCode: accommodationAddresses.postalCode,
        lat: sql<number>`ST_Y(${accommodationAddresses.geom}::geometry)`,
        lng: sql<number>`ST_X(${accommodationAddresses.geom}::geometry)`,
      })
      .from(accommodations)
      .innerJoin(
        accommodationAddresses,
        and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
      )
      .where(eq(accommodations.slug, slug))
      .limit(1)
    if (!row) return null
    return { codePostal: row.postalCode, residence: { lat: row.lat, lng: row.lng } }
  } finally {
    await closeDb()
  }
}

/** Étape 1 — CP -> communes INSEE (arrondissements Paris/Lyon/Marseille inclus). */
async function fetchCommunes(cp: string): Promise<{ code: string; nom: string; centre?: LatLng }[]> {
  const cpe = encodeURIComponent(cp)
  const urls = [
    `https://geo.api.gouv.fr/communes?codePostal=${cpe}&fields=code,nom,centre`,
    `https://geo.api.gouv.fr/communes?codePostal=${cpe}&type=arrondissement-municipal&fields=code,nom,centre`,
  ]
  const byCode = new Map<string, { code: string; nom: string; centre?: LatLng }>()
  for (const url of urls) {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) continue
    const data = (await res.json()) as Json[]
    for (const c of data) {
      byCode.set(c.code, {
        code: c.code,
        nom: c.nom,
        centre: c.centre ? { lng: c.centre.coordinates[0], lat: c.centre.coordinates[1] } : undefined,
      })
    }
  }
  return [...byCode.values()]
}

/**
 * Étape 2 — communes INSEE -> numéros UAI.
 * `etats` est une sonde : la clé n'est pas documentée côté filtres, un `400` signifie
 * que l'API ne sait pas filtrer sur l'état (et qu'il faut le faire à l'étape détail).
 */
async function fetchUais(communes: string[], natures: string[] | null, etats?: string[]): Promise<{ status: number; uais: string[] }> {
  try {
    const res = await fetch(ramseseUrl('/listeUai/filtres'), {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        ...(communes.length ? { communes } : {}),
        codeApplication: CODEAPP,
        ...(natures ? { natures } : {}),
        ...(etats?.length ? { etats } : {}),
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    let uais: string[] = []
    try {
      const body = (await res.json()) as Json
      uais = body?.UAIS ?? []
    } catch {
      // corps non JSON (erreur passerelle) : on garde juste le status
    }
    return { status: res.status, uais }
  } catch (err) {
    console.error(`   ✗ échec réseau filtres : ${err instanceof Error ? err.message : String(err)}`)
    return { status: 0, uais: [] }
  }
}

/** Étape 3 — détail d'un UAI (identification + localisation + géoloc). */
async function fetchUaiDetail(uai: string): Promise<{ status: number; data: Json | null }> {
  try {
    const res = await fetch(ramseseUrl(`/uai/${encodeURIComponent(uai)}?INCLURE_GEOLOCALISATION=true&ADMINISTRATION=true`), {
      headers: HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const data = res.ok ? ((await res.json().catch(() => null)) as Json) : null
    return { status: res.status, data }
  } catch {
    return { status: 0, data: null }
  }
}

/** `--etats 1,2` -> `['1','2']` ; absent -> `undefined` (aucune clé `etats` envoyée). */
function parseEtats(raw?: string): string[] | undefined {
  const codes = raw
    ?.split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  return codes?.length ? codes : undefined
}

/** Nomenclature RAMSESE « état de l'UAI ». */
const ETAT_LABELS: Record<string, string> = { '1': 'ouvert', '2': 'à ouvrir', '3': 'fermé' }

function pickValeur(arr?: Json[]): string | null {
  if (!arr?.length) return null
  return (arr.find((v) => !v.DATE_FIN && v.VALEUR) ?? arr.findLast?.((v: Json) => v.VALEUR))?.VALEUR ?? null
}

export async function verifyRamsese(options: VerifyRamseseOptions) {
  console.log('🔎 Vérification RAMSESE')
  console.log(`   BASE=${BASE}  codeApplication=${CODEAPP}  api-key=${API_KEY ? 'définie' : 'ABSENTE'}`)

  // Périmètre national : on court-circuite CP/communes et on interroge filtres sur les
  // seules natures (liste blanche). Pas de résidence => pas de distance ni de classement.
  if (options.national) {
    if (options.natures === false) {
      console.error('✗ --national exige la liste blanche des natures (ne pas combiner avec --no-natures)')
      process.exit(1)
    }
    const { status, uais } = await fetchUais([], [...NATURES_ETABLISSEMENTS], parseEtats(options.etats))
    console.log(`\n1) POST /v3/listeUai/filtres (national, sans communes) -> HTTP ${status} | UAIS=${uais.length}`)
    if (status !== 200) {
      console.log('   ⚠️  Status ≠ 200 : 400=`communes` requis (national non supporté) · 401/403=IP non whitelistée · 0/5xx=réseau')
    }
    if (uais.length === 0) {
      console.log('\nAucun UAI. Fin.')
      process.exit(status === 200 ? 0 : 1)
    }
    await detailAndReport(uais, null, options)
    process.exit(0)
  }

  // 1) Résolution CP + point résidence
  let codePostal = options.cp ?? '94000'
  let residence: LatLng | null = options.lat != null && options.lng != null ? { lat: Number(options.lat), lng: Number(options.lng) } : null

  if (options.slug) {
    const resolved = await resolveFromSlug(options.slug)
    if (!resolved) {
      console.error(`✗ Résidence introuvable pour le slug "${options.slug}"`)
      process.exit(1)
    }
    codePostal = resolved.codePostal
    residence = resolved.residence
    console.log(`   Résidence "${options.slug}" : CP=${codePostal}  résidence=${residence.lat},${residence.lng}`)
  }

  let communes: { code: string; nom: string; centre?: LatLng }[]
  if (options.insee) {
    communes = options.insee.split(',').map((code) => ({ code: code.trim(), nom: '(insee direct)' }))
    console.log(`\n1) Codes INSEE fournis directement : ${communes.map((c) => c.code).join(', ')}`)
  } else {
    communes = await fetchCommunes(codePostal)
    if (communes.length === 0) {
      console.error(`✗ Aucune commune pour le CP ${codePostal} (geo.api.gouv.fr)`)
      process.exit(1)
    }
    console.log(`\n1) CP ${codePostal} -> communes INSEE : ${communes.map((c) => `${c.code} ${c.nom}`).join(', ')}`)
  }

  if (!residence) {
    residence = communes[0].centre ?? { lat: 0, lng: 0 }
    console.log(`   (pas de --lat/--lng : distance calculée depuis le centre de ${communes[0].nom})`)
  }

  // 2) filtres -> UAIS
  const useNatures = options.natures !== false
  const inseeCodes = communes.map((c) => c.code)
  const naturesArg = useNatures ? [...NATURES_ETABLISSEMENTS] : null
  const etatsArg = parseEtats(options.etats)
  let { status, uais } = await fetchUais(inseeCodes, naturesArg, etatsArg)
  console.log(
    `\n2) POST /v3/listeUai/filtres -> HTTP ${status} | UAIS=${uais.length}${useNatures ? ' (liste blanche)' : ' (sans filtre natures)'}${
      etatsArg ? ` (sonde etats=[${etatsArg.join(',')}])` : ''
    }`,
  )
  if (status !== 200) {
    console.log('   ⚠️  Status ≠ 200 : 401/403=IP non whitelistée (ou auth) · 404=chemin /v3 à ajuster · 0/5xx=réseau/passerelle')
    if (etatsArg) console.log("   ⚠️  Sonde --etats active : un 400 ici = l'API ne connaît pas ce critère (filtrer à l'étape détail).")
  }
  if (uais.length === 0 && useNatures) {
    const fallback = await fetchUais(inseeCodes, null)
    console.log(`   (diagnostic sans natures) -> HTTP ${fallback.status} | UAIS=${fallback.uais.length}`)
    if (fallback.uais.length) {
      console.log('   → connectivité OK mais la liste blanche ne matche rien sur cette commune.')
      uais = fallback.uais
    }
  }
  if (uais.length === 0) {
    console.log('\nAucun UAI à détailler. Fin.')
    process.exit(0)
  }

  // 3) détails + parsing + distance
  await detailAndReport(uais, residence, options)
  process.exit(0)
}

/**
 * Étape 3 mutualisée : détaille chaque UAI, imprime le tableau + le top 5 (si une
 * résidence est fournie), et écrit la liste complète en JSON si `--json` est passé.
 * `residence === null` en périmètre national : pas de distance ni de classement.
 */
async function detailAndReport(uais: string[], residence: LatLng | null, options: VerifyRamseseOptions) {
  const limit = options.limit ?? uais.length
  const subset = uais.slice(0, limit)
  // Pool borné : au plus `concurrency` requêtes en vol à la fois (jamais 5580 d'un coup,
  // jamais du séquentiel). Monter la valeur pour le national, sans saturer la passerelle.
  const concurrency = Math.max(1, options.concurrency ?? 8)
  console.log(
    `\n3) Détails de ${subset.length}/${uais.length} UAI (concurrence ${concurrency}, INCLURE_GEOLOCALISATION + ADMINISTRATION) :`,
  )

  const rows = await mapPool(subset, concurrency, async (uai) => {
    const { status: st, data } = await fetchUaiDetail(uai)
    if (!data) return { uai, status: st, error: true } as const
    const id = data.IDENTIFICATION ?? {}
    const loc = data.LOCALISATION ?? {}
    const geo = data.GEOLOCALISATION ?? {}
    const nom = pickValeur(id.APPELLATIONS_OFFICIELLES) ?? pickValeur(id.DENOMINATIONS_PRINCIPALES) ?? '?'
    const natures: string[] = (id.NATURES ?? []).filter((n: Json) => !n.DATE_FIN).map((n: Json) => n.CODE)
    const rawCoords =
      geo.COORDONNEES_X && geo.COORDONNEES_Y
        ? { x: String(geo.COORDONNEES_X), y: String(geo.COORDONNEES_Y), systemeReference: geo.SYSTEME_REFERENCE ?? null }
        : null
    const point = rawCoords ? parseRamseseCoordonnees(rawCoords) : null
    const distanceMeters = residence && point ? haversineMeters(residence, point) : null
    const adresse = pickValeur(loc.ADRESSES)
    const codePostal = loc.CODE_POSTAL ?? null
    const commune = loc.LOCALITE_ACHEMINEMENT ?? null
    const etat: string | null = id.ETAT ?? null
    return { uai, status: st, nom, etat, natures, adresse, codePostal, commune, rawCoords, point, distanceMeters }
  })

  const systems = new Set<string>()
  const etatCounts = new Map<string, number>()
  for (const r of rows) {
    if ('error' in r) {
      console.log(`   ${r.uai} | HTTP ${r.status} | (pas de détail)`)
      continue
    }
    if (r.rawCoords?.systemeReference) systems.add(r.rawCoords.systemeReference)
    const etatKey = r.etat ?? 'absent'
    etatCounts.set(etatKey, (etatCounts.get(etatKey) ?? 0) + 1)
    const etatStr = `etat=${etatKey}${r.etat && ETAT_LABELS[r.etat] ? `(${ETAT_LABELS[r.etat]})` : ''}`
    const coordsStr = r.rawCoords ? `X=${r.rawCoords.x} Y=${r.rawCoords.y} ref=${r.rawCoords.systemeReference}` : 'PAS DE GEOLOC'
    const parsed = r.point ? `-> ${r.point.lat.toFixed(5)},${r.point.lng.toFixed(5)}` : ''
    const dist = r.distanceMeters != null ? `| ${distanceFmt.format(r.distanceMeters / 1000)} km` : ''
    console.log(`   ${r.uai} | ${r.nom} | ${etatStr} | nat=[${r.natures.join(',')}] | ${coordsStr} ${parsed} ${dist}`)
  }

  console.log(`\n   Systèmes de référence rencontrés : ${systems.size ? [...systems].join(', ') : 'aucun'}`)
  // Si l'étape filtres renvoyait déjà uniquement des ouverts, on ne verra que « 1 ».
  const etatsRecap = [...etatCounts.entries()].map(([code, n]) => `${code}${ETAT_LABELS[code] ? `(${ETAT_LABELS[code]})` : ''}=${n}`)
  console.log(`   États rencontrés : ${etatsRecap.length ? etatsRecap.join(', ') : 'aucun'}`)

  // Liste complète (non tronquée) en JSON — les lignes en erreur sont exclues.
  if (options.json) {
    const etablissements = rows
      .filter((r): r is Exclude<typeof r, { error: true }> => !('error' in r))
      .map((r) => ({
        numeroUai: r.uai,
        denomination: r.nom,
        etat: r.etat,
        natureCodes: r.natures,
        adresse: r.adresse,
        codePostal: r.codePostal,
        commune: r.commune,
        coordonnees: r.point,
        rawCoordonnees: r.rawCoords,
        distanceMeters: r.distanceMeters,
      }))
    await writeFile(options.json, JSON.stringify(etablissements, null, 2))
    console.log(`\n💾 ${etablissements.length} établissements écrits dans ${options.json}`)
  }

  // Top 5 = ce que le bloc fiche logement afficherait (uniquement si une résidence est connue).
  const ranked = rows
    .filter((r): r is Exclude<typeof r, { error: true }> => !('error' in r) && r.distanceMeters != null)
    .sort((a, b) => (a.distanceMeters as number) - (b.distanceMeters as number))
    .slice(0, 5)
  if (ranked.length) {
    console.log('\n🏁 Top 5 (rendu attendu du bloc fiche logement) :')
    for (const r of ranked) {
      console.log(`   ${r.nom} — ${distanceFmt.format((r.distanceMeters as number) / 1000)} km`)
    }
  }

  // Payload complet de référence
  if (options.dump) {
    const { data } = await fetchUaiDetail(uais[0])
    console.log(`\n===== PAYLOAD COMPLET ${uais[0]} =====`)
    console.log(JSON.stringify(data, null, 2))
  }
}
