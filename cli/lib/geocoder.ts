import { eq, sql } from 'drizzle-orm'
import { db } from './db'
import { cities } from '../../src/server/db/schema'

interface GeocodeResult {
  lat: number
  lng: number
  city: string
  address: string
  postalCode: string
}

export async function geocodeAddress(fullAddress: string): Promise<GeocodeResult | null> {
  const url = `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(fullAddress)}&limit=1`
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json()
    const feature = data?.features?.[0]
    if (!feature?.geometry?.coordinates) return null
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
    return null
  }
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
    if (results.length === 0) return null
    if (name && results.length > 1) {
      const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const match = results.find((c) => {
        const n = c.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
  const city = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1)
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
