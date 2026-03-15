import { eq, sql } from 'drizzle-orm'
import { cities, departments } from '../../src/server/db/schema'
import { generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import { db } from './db'

interface GeocodeResult {
  lat: number
  lng: number
  city: string
  address: string
  postalCode: string
}

const GEOCODE_THROTTLE_MS = 200
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
  const retryDelay = 5000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await throttle()
      const response = await fetch(url)
      if (response.status === 429 || response.status >= 500) {
        console.warn(`  ⚠ Geocoding HTTP ${response.status} for "${fullAddress}" (attempt ${attempt}/${maxAttempts})`)
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          continue
        }
        return null
      }
      if (!response.ok) {
        console.warn(`  ⚠ Geocoding HTTP ${response.status} for "${fullAddress}"`)
        return null
      }
      const data = await response.json()
      const feature = data?.features?.[0]
      if (!feature?.geometry?.coordinates || feature.geometry.type !== 'Point') {
        if (attempt < maxAttempts) {
          console.warn(`  ⚠ Geocoding: no result for "${fullAddress}", retrying...`)
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          continue
        }
        console.warn(`  ⚠ Geocoding: no result for "${fullAddress}" after ${maxAttempts} attempts`)
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
    } catch (error) {
      console.warn(
        `  ⚠ Geocoding error for "${fullAddress}" (attempt ${attempt}/${maxAttempts}): ${error instanceof Error ? error.message : String(error)}`,
      )
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        continue
      }
      return null
    }
  }
  return null
}

interface GeoApiCity {
  nom: string
  code: string
  codesPostaux: string[]
  codeDepartement: string
  codeEpci?: string
  population?: number
  contour?: GeoJSON.Geometry
}

export async function fetchCityFromGeoApi(postalCode: string, name?: string): Promise<GeoApiCity | null> {
  const url = `https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom,codesPostaux,codeDepartement,contour,codeEpci,population`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const results: GeoApiCity[] = await response.json()
    if (results.length === 0) {
      // Fallback: treat as INSEE code
      return await fetchCityByInsee(postalCode)
    }
    if (name && results.length > 1) {
      const normalized = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      const match = results.find((c) => {
        const n = c.nom
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        return n === normalized || n.includes(normalized) || normalized.includes(n)
      })
      return match ?? results[0]
    }
    return results[0]
  } catch {
    return null
  }
}

export async function fetchCityByInsee(inseeCode: string): Promise<GeoApiCity | null> {
  const url = `https://geo.api.gouv.fr/communes/${inseeCode}?fields=nom,codesPostaux,codeDepartement,contour,codeEpci,population`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function fillCityFromApi(cityId: number): Promise<boolean> {
  const city = await db.select({ postalCodes: cities.postalCodes, name: cities.name }).from(cities).where(eq(cities.id, cityId)).limit(1)
  if (!city[0]) return false

  const postalCode = city[0].postalCodes?.[0]
  if (!postalCode) return false

  const apiCity = await fetchCityFromGeoApi(postalCode, city[0].name)
  if (!apiCity) return false

  const updates: Record<string, unknown> = {}

  if (apiCity.codeEpci) updates.epciCode = apiCity.codeEpci
  if (apiCity.population != null) updates.population = apiCity.population
  if (apiCity.contour) {
    updates.boundary = sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(apiCity.contour)}), 4326)`
  }
  if (apiCity.codesPostaux?.length) updates.postalCodes = apiCity.codesPostaux
  if (apiCity.code) updates.inseeCodes = [apiCity.code]

  if (Object.keys(updates).length > 0) {
    await db.update(cities).set(updates).where(eq(cities.id, cityId))
  }

  return true
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

export async function ensureCity(postalCode: string, cityName: string): Promise<string> {
  // 1. Look up by postal code in cities table
  const existing = await db.select({ name: cities.name }).from(cities).where(sql`${postalCode} = ANY(${cities.postalCodes})`).limit(1)
  if (existing[0]) return existing[0].name

  // 2. Not found — fetch from geo API and create
  const apiCity = await fetchCityFromGeoApi(postalCode, cityName)
  if (!apiCity) return cityName

  const dept = await db.select({ id: departments.id }).from(departments).where(eq(departments.code, apiCity.codeDepartement)).limit(1)
  if (!dept[0]) return apiCity.nom

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

  await fillCityFromApi(newCity.id)
  return apiCity.nom
}
