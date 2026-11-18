import { and, eq, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { cities, departments } from '~/server/db/schema'
import { resolveAddressLocation } from '~/server/lib/geocoding/resolve'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '~/server/utils/slug'

interface GeocodeResult {
  lat: number
  lng: number
  city: string
  address: string
  postalCode: string
}

export interface GeoApiCity {
  nom: string
  code: string
  codesPostaux: string[]
  codeDepartement: string
  codeEpci?: string
  population?: number
  contour?: GeoJSON.Geometry
}

const IS_TEST = Boolean(process.env.VITEST)
const GEOCODE_THROTTLE_MS = IS_TEST ? 0 : 200
const RETRY_DELAY_MS = IS_TEST ? 0 : 5000
let lastGeocodeCall = 0

async function throttle() {
  const now = Date.now()
  const elapsed = now - lastGeocodeCall
  if (elapsed < GEOCODE_THROTTLE_MS) {
    await new Promise((resolve) => setTimeout(resolve, GEOCODE_THROTTLE_MS - elapsed))
  }
  lastGeocodeCall = Date.now()
}

export async function geocodeAddress(fullAddress: string): Promise<GeocodeResult | null> {
  const url = `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(fullAddress)}&limit=1`
  const maxAttempts = 2

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await throttle()
      const response = await fetch(url)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }
        return null
      }
      if (!response.ok) return null
      const data = await response.json()
      const feature = data?.features?.[0]
      if (!feature?.geometry?.coordinates || feature.geometry.type !== 'Point') {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }
        return null
      }
      const [lng, lat] = feature.geometry.coordinates
      const props = feature.properties ?? {}
      return {
        lat,
        lng,
        city: props.city ?? props.municipality ?? '',
        address: props.name ?? props.label ?? '',
        postalCode: props.postcode ?? '',
      }
    } catch {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        continue
      }
      return null
    }
  }
  return null
}

/**
 * Variante vérifiée de `geocodeAddress` : le candidat retenu doit être
 * rattachable à la commune du code postal. À privilégier partout où l'adresse
 * est disponible en parties séparées — c'est-à-dire dans tous les imports.
 *
 * Renvoie `null` quand rien ne peut être validé, plutôt qu'un point arbitraire.
 */
export async function geocodeAddressVerified(address: string, postalCode: string, cityName?: string | null): Promise<GeocodeResult | null> {
  const decision = await resolveAddressLocation({ address, postalCode, cityName })
  if (decision.action !== 'apply') return null
  return {
    lat: decision.lat,
    lng: decision.lng,
    city: decision.city,
    address: decision.address,
    postalCode: decision.postalCode,
  }
}

/**
 * Géocode une ligne d'import. Sans code postal il n'y a rien à vérifier : on
 * retombe alors sur la recherche libre, qui n'est pas pire que l'existant.
 */
export async function geocodeImportRow(address: string, postalCode: string, city: string): Promise<GeocodeResult | null> {
  if (postalCode) return geocodeAddressVerified(address, postalCode, city)
  return geocodeAddress([address, city].filter(Boolean).join(', '))
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const url = `https://data.geopf.fr/geocodage/reverse?lon=${lng}&lat=${lat}&limit=1`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json()
    const feature = data?.features?.[0]
    if (!feature?.properties) return null
    const props = feature.properties
    const [rLng, rLat] = feature.geometry?.coordinates ?? [lng, lat]
    return {
      lat: rLat,
      lng: rLng,
      city: props.city ?? props.municipality ?? '',
      address: props.name ?? props.label ?? '',
      postalCode: props.postcode ?? '',
    }
  } catch {
    return null
  }
}

export function normalizeCommuneName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s'\u2019-]+/g, ' ')
    .trim()
}

async function fetchGeoApiJson(url: string): Promise<unknown | null> {
  const maxAttempts = 2
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }
        return null
      }
      if (!response.ok) return null
      return await response.json()
    } catch {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        continue
      }
      return null
    }
  }
  return null
}

// Un code postal couvre souvent plusieurs communes : sans homonyme exact, on retient la plus peupl\u00e9e.
export async function fetchCityFromGeoApi(postalCode: string, name?: string): Promise<GeoApiCity | null> {
  const results = (await fetchGeoApiJson(
    `https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom,codesPostaux,codeDepartement,codeEpci,population`,
  )) as GeoApiCity[] | null
  if (!results?.length) return null
  if (name) {
    const normalized = normalizeCommuneName(name)
    const match = results.find((c) => normalizeCommuneName(c.nom) === normalized)
    if (match) return match
  }
  return results.reduce((best, c) => ((c.population ?? 0) > (best.population ?? 0) ? c : best))
}

export async function fetchCityByInsee(inseeCode: string): Promise<GeoApiCity | null> {
  return (await fetchGeoApiJson(
    `https://geo.api.gouv.fr/communes/${inseeCode}?fields=nom,code,codesPostaux,codeDepartement,codeEpci,population`,
  )) as GeoApiCity | null
}

export async function fetchCommunesByDepartment(deptCode: string): Promise<GeoApiCity[]> {
  const url = `https://geo.api.gouv.fr/departements/${deptCode}/communes?fields=nom,codesPostaux,codeDepartement,contour,codeEpci,population`
  const maxAttempts = 2

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await throttle()
      const response = await fetch(url)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }
        return []
      }
      if (!response.ok) return []
      return await response.json()
    } catch {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        continue
      }
      return []
    }
  }
  return []
}

export async function fillCityFromApi(cityId: number): Promise<boolean> {
  const [city] = await db
    .select({ postalCodes: cities.postalCodes, name: cities.name, inseeCodes: cities.inseeCodes })
    .from(cities)
    .where(eq(cities.id, cityId))
    .limit(1)
  if (!city) return false

  let apiCity: GeoApiCity | null
  const inseeCode = city.inseeCodes?.[0]
  if (inseeCode) {
    apiCity = await fetchCityByInsee(inseeCode)
  } else {
    const postalCode = city.postalCodes?.[0]
    if (!postalCode) return false
    apiCity = await fetchCityFromGeoApi(postalCode, city.name)
    if (apiCity && normalizeCommuneName(apiCity.nom) !== normalizeCommuneName(city.name)) return false
  }
  if (!apiCity) return false

  const updates: Record<string, unknown> = {}
  if (apiCity.codeEpci) updates.epciCode = apiCity.codeEpci
  if (apiCity.population != null) updates.population = apiCity.population
  if (apiCity.codesPostaux?.length) updates.postalCodes = apiCity.codesPostaux
  if (apiCity.code) updates.inseeCodes = [apiCity.code]
  if (inseeCode && apiCity.nom && apiCity.nom !== city.name) {
    updates.name = apiCity.nom
    updates.slug = await findAvailableSlug(generateSlug(apiCity.nom), db, cities)
    console.log(`    ↻ ${city.name} renommée en ${apiCity.nom} (INSEE ${inseeCode})`)
  }

  if (Object.keys(updates).length > 0) {
    await db.update(cities).set(updates).where(eq(cities.id, cityId))
  }
  return true
}

export async function ensureCity(postalCode: string, cityName: string): Promise<{ name: string; id: number }> {
  const existingByName = await db
    .select({ name: cities.name, id: cities.id })
    .from(cities)
    .where(
      and(
        sql`${cities.postalCodes} @> ARRAY[${postalCode}]::varchar[]`,
        sql`lower(immutable_unaccent(${cities.name})) = lower(immutable_unaccent(${cityName}))`,
      ),
    )
    .limit(1)
  if (existingByName[0]) return existingByName[0]

  // Un code postal couvre souvent plusieurs communes (91400 = Gometz-la-Ville,
  // Orsay, Saclay). Sans tri, Postgres en renverrait une arbitraire. La plus
  // peuplée est la commune principale du code postal dans la quasi-totalité des cas.
  const existing = await db
    .select({ name: cities.name, id: cities.id })
    .from(cities)
    .where(sql`${cities.postalCodes} @> ARRAY[${postalCode}]::varchar[]`)
    .orderBy(sql`${cities.population} DESC NULLS LAST`, cities.id)
    .limit(1)
  if (existing[0]) return existing[0]

  const apiCity = await fetchCityFromGeoApi(postalCode, cityName)
  if (!apiCity) return { name: cityName, id: 0 }

  const byInsee = await db
    .select({ name: cities.name, id: cities.id, postalCodes: cities.postalCodes })
    .from(cities)
    .where(sql`${cities.inseeCodes} @> ARRAY[${apiCity.code}]::varchar[]`)
    .limit(1)
  if (byInsee[0]) {
    if (!byInsee[0].postalCodes.includes(postalCode)) {
      await db
        .update(cities)
        .set({ postalCodes: [...byInsee[0].postalCodes, postalCode] })
        .where(eq(cities.id, byInsee[0].id))
    }
    return { name: byInsee[0].name, id: byInsee[0].id }
  }

  const dept = await db.select({ id: departments.id }).from(departments).where(eq(departments.code, apiCity.codeDepartement)).limit(1)
  if (!dept[0]) return { name: apiCity.nom, id: 0 }

  const [newCity] = await db
    .insert(cities)
    .values({
      name: apiCity.nom,
      slug: await findAvailableSlug(generateSlug(apiCity.nom), db, cities),
      postalCodes: apiCity.codesPostaux,
      inseeCodes: [apiCity.code],
      departmentId: dept[0].id,
      popular: false,
      epciCode: apiCity.codeEpci ?? null,
      population: apiCity.population ?? null,
    })
    .returning({ id: cities.id })

  return { name: apiCity.nom, id: newCity.id }
}
