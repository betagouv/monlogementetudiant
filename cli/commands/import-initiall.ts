import { and, eq, sql } from 'drizzle-orm'
import { accommodations, externalSources } from '../../src/server/db/schema'
import { generateAccommodationKey, uploadFile } from '../../src/server/services/s3'
import { computeDerivedFields, generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import { db } from '../lib/db'
import { ensureCity, geocodeAddress } from '../lib/geocoder'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'
import { getOrCreateOwner } from '../utils/get-or-create-owner'

const SOURCE = 'initiall'
const OWNER_NAME = 'INITIALL'
const OWNER_URL = 'https://initiall.immo'
const API_BASE = 'https://initiall.immo/wp-json/wp/v2/residence/'

interface InitiallResidence {
  id: number
  title: { rendered: string }
  link: string
  acf: {
    address?: {
      address?: string
      city?: string
      post_code?: string
      lat?: number | string
      lng?: number | string
    }
    price?: string | number
    residence_full?: boolean
    residence_for_students_only?: boolean
    residence_is_accessible?: boolean
    typologies?: false | { name: string; count: string | number }[]
    equipments?: false | { name: string; slug: string }[]
    gallery?: { url: string }[]
  }
}

async function fetchResidences(options: ImportOptions): Promise<InitiallResidence[]> {
  const all: InitiallResidence[] = []
  let page = 1

  while (true) {
    if (options.verbose) console.log(`  Fetching page ${page}...`)

    const res = await fetch(`${API_BASE}?per_page=100&page=${page}`)
    if (!res.ok) break

    const data: InitiallResidence[] = await res.json()
    if (data.length === 0) break
    all.push(...data)

    if (options.limit && all.length >= options.limit) {
      return all.slice(0, options.limit)
    }

    const totalPages = Number(res.headers.get('X-WP-TotalPages')) || 1
    if (page >= totalPages) break
    page++
  }

  return options.limit ? all.slice(0, options.limit) : all
}

async function downloadImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string; ext: string } | null> {
  try {
    const res = await fetch(imageUrl, { redirect: 'follow' })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const buffer = Buffer.from(await res.arrayBuffer())
    return { buffer, contentType, ext }
  } catch {
    return null
  }
}

async function uploadImages(gallery: { url: string }[], verbose: boolean): Promise<string[]> {
  const urls: string[] = []
  for (const img of gallery) {
    const downloaded = await downloadImage(img.url)
    if (!downloaded) {
      if (verbose) console.log(`    ⚠ Image non téléchargée : ${img.url}`)
      continue
    }
    const key = generateAccommodationKey(downloaded.ext)
    const s3Url = await uploadFile({ key, body: downloaded.buffer, contentType: downloaded.contentType })
    urls.push(s3Url)
  }
  return urls
}

const TYPOLOGY_MAP: Record<string, string> = {
  T1: 'nbT1',
  'T1 bis': 'nbT1Bis',
  T2: 'nbT2',
  T3: 'nbT3',
  T4: 'nbT4',
  T5: 'nbT5',
}

function buildTypologyValues(typologies?: false | { name: string; count: string | number }[]) {
  const result: Record<string, number | null> = {
    nbT1: null,
    nbT1Bis: null,
    nbT2: null,
    nbT3: null,
    nbT4: null,
    nbT5: null,
  }
  if (!typologies) return result

  for (const typo of typologies) {
    const field = TYPOLOGY_MAP[typo.name]
    if (field) {
      const count = Number(typo.count)
      if (count > 0) result[field] = count
    }
  }
  return result
}

const EQUIPMENT_MAP: Record<string, string> = {
  laverie: 'laundryRoom',
  buanderie: 'laundryRoom',
  parking: 'parking',
  stationnement: 'parking',
  'local-velos': 'bikeStorage',
  wifi: 'wifi',
  internet: 'wifi',
  'espaces-communs': 'commonAreas',
  'acces-securise': 'secureAccess',
  'micro-ondes': 'microwave',
  refrigerateur: 'refrigerator',
  'plaques-cuisson': 'cookingPlates',
  bureau: 'desk',
}

function buildEquipmentValues(equipments?: false | { name: string; slug: string }[]) {
  const result: Record<string, boolean> = {}
  if (!equipments) return result

  for (const eq of equipments) {
    const slug = eq.slug.toLowerCase()
    const field = EQUIPMENT_MAP[slug]
    if (field) {
      result[field] = true
    }
  }
  return result
}

const command: ImportCommand = {
  name: 'initiall',
  description: 'Import des résidences Initiall via API WordPress',

  async execute(options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

    const ownerId = await getOrCreateOwner(OWNER_NAME, OWNER_URL)
    if (options.verbose) console.log(`  Owner INITIALL id=${ownerId}`)

    const residences = await fetchResidences(options)
    console.log(`  ${residences.length} résidences récupérées`)

    for (let i = 0; i < residences.length; i++) {
      const residence = residences[i]
      try {
        const sourceId = String(residence.id)
        const name = residence.title.rendered
        if (options.verbose) console.log(`  [${i + 1}/${residences.length}] ${name} (${sourceId})`)

        if (options.verbose && Array.isArray(residence.acf.equipments) && residence.acf.equipments.length) {
          console.log(`    Equipments: ${residence.acf.equipments.map((e) => `${e.name} (${e.slug})`).join(', ')}`)
        }

        const existingSource = await db
          .select({ accommodationId: externalSources.accommodationId })
          .from(externalSources)
          .where(and(eq(externalSources.source, SOURCE), eq(externalSources.sourceId, sourceId)))
          .limit(1)

        const acfAddress = residence.acf.address
        const apiLat = acfAddress?.lat != null ? Number(acfAddress.lat) : null
        const apiLng = acfAddress?.lng != null ? Number(acfAddress.lng) : null

        let geo = null
        if (acfAddress?.address) {
          const fullAddress = [acfAddress.address, acfAddress.post_code, acfAddress.city].filter(Boolean).join(', ')
          geo = await geocodeAddress(fullAddress)
        }

        const lat = apiLat && apiLng ? apiLat : geo?.lat
        const lng = apiLat && apiLng ? apiLng : geo?.lng
        const resolvedAddress = geo?.address ?? acfAddress?.address ?? ''
        const resolvedPostalCode = geo?.postalCode ?? acfAddress?.post_code ?? ''
        let resolvedCity = geo?.city ?? acfAddress?.city ?? ''

        let resolvedCityId: number | null = null
        if (resolvedPostalCode && resolvedCity) {
          const cityResult = await ensureCity(resolvedPostalCode, resolvedCity)
          resolvedCity = cityResult.name
          resolvedCityId = cityResult.id || null
        }

        let imageUrls: string[] = []
        if (residence.acf.gallery?.length && !options.dryRun) {
          imageUrls = await uploadImages(residence.acf.gallery, options.verbose ?? false)
        }

        const typology = buildTypologyValues(residence.acf.typologies)
        const equipment = buildEquipmentValues(residence.acf.equipments)

        const priceMin = residence.acf.price != null ? parseInt(String(residence.acf.price), 10) || null : null

        const derived = computeDerivedFields({
          nb_t1: typology.nbT1,
          nb_t1_bis: typology.nbT1Bis,
          nb_t2: typology.nbT2,
          nb_t3: typology.nbT3,
          nb_t4: typology.nbT4,
          nb_t5: typology.nbT5,
          images_urls: imageUrls.length > 0 ? imageUrls : null,
        })

        const accommodationData = {
          name,
          slug: await findAvailableSlug(generateSlug(name), db, accommodations),
          address: resolvedAddress,
          city: resolvedCity,
          cityId: resolvedCityId,
          postalCode: resolvedPostalCode,
          published: true,
          available: residence.acf.residence_full === true ? false : true,
          target_audience: residence.acf.residence_for_students_only ? 'etudiants' : null,
          ...(lat && lng ? { geom: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)` } : {}),
          nbT1: typology.nbT1,
          nbT1Bis: typology.nbT1Bis,
          nbT2: typology.nbT2,
          nbT3: typology.nbT3,
          nbT4: typology.nbT4,
          nbT5: typology.nbT5,
          priceMin: priceMin ?? derived.priceMin,
          nbTotalApartments: derived.nbTotalApartments,
          nbAccessibleApartments: residence.acf.residence_is_accessible ? 1 : null,
          ...equipment,
          imagesUrls: imageUrls.length > 0 ? imageUrls : null,
          imagesCount: derived.imagesCount,
          externalUrl: residence.link,
          ownerId,
          updatedAt: new Date(),
        }

        if (options.dryRun) {
          if (existingSource[0]) {
            if (options.verbose) console.log(`    [dry-run] Mise à jour id=${existingSource[0].accommodationId}`)
            result.updated++
          } else {
            if (options.verbose) console.log(`    [dry-run] Création`)
            result.created++
          }
          continue
        }

        if (existingSource[0]) {
          await db.update(accommodations).set(accommodationData).where(eq(accommodations.id, existingSource[0].accommodationId))
          result.updated++
        } else {
          const [newAccommodation] = await db
            .insert(accommodations)
            .values({ ...accommodationData, createdAt: new Date() })
            .returning({ id: accommodations.id })

          await db.insert(externalSources).values({
            accommodationId: newAccommodation.id,
            source: SOURCE,
            sourceId,
          })
          result.created++
        }
      } catch (error) {
        const msg = `${residence.title.rendered} (${residence.id}): ${error instanceof Error ? error.message : String(error)}`
        result.errors.push(msg)
        if (options.verbose) console.log(`    ✗ ${msg}`)
      }
    }

    return result
  },
}

export default command
