import { and, eq, sql } from 'drizzle-orm'
import type { TypologyType } from '~/schemas/accommodations/typology'
import { db } from '~/server/db'
import { ensureCity, geocodeAddressVerified } from '~/server/lib/import/geocoder'
import { markAvailabilityImported, resolveImportOwner } from '~/server/lib/import/resolve-owner'
import { syncTypologies, type TypologyDraft, typologyAggregates, typologyDraft } from '~/server/lib/typologies'
import { accommodationAddresses, accommodations, externalSources } from '../../src/server/db/schema'
import { generateAccommodationKey, uploadFile } from '../../src/server/services/s3'
import { generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'
import { pushResidenceEntry } from './import-utils'

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

const TYPOLOGY_MAP: Record<string, TypologyType> = {
  T1: 't1',
  'T1 bis': 't1_bis',
  T2: 't2',
  T3: 't3',
  T4: 't4',
  T5: 't5',
}

function buildTypologyDrafts(typologies?: false | { name: string; count: string | number }[]): TypologyDraft[] {
  if (!typologies) return []
  const counts = new Map<TypologyType, number>()
  for (const typo of typologies) {
    const type = TYPOLOGY_MAP[typo.name]
    if (type) {
      const count = Number(typo.count)
      if (count > 0) counts.set(type, count)
    }
  }
  return [...counts].map(([type, nbTotal]) => typologyDraft(type, { nbTotal }))
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
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], residences: [] }

    const owner = await resolveImportOwner({ id: options.ownerId, slug: options.ownerSlug, name: OWNER_NAME, url: OWNER_URL })
    const ownerId = owner.id
    if (!options.dryRun) await markAvailabilityImported(ownerId)
    result.ownerName = owner.name
    result.ownerId = ownerId
    if (options.verbose) console.log(`  Owner ${owner.name} id=${ownerId}`)

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
          .select({ accommodationId: externalSources.accommodationId, slug: accommodations.slug })
          .from(externalSources)
          .innerJoin(accommodations, eq(accommodations.id, externalSources.accommodationId))
          .where(and(eq(externalSources.source, SOURCE), eq(externalSources.sourceId, sourceId)))
          .limit(1)

        const acfAddress = residence.acf.address
        const apiLat = acfAddress?.lat != null ? Number(acfAddress.lat) : null
        const apiLng = acfAddress?.lng != null ? Number(acfAddress.lng) : null

        let geo = null
        if (acfAddress?.address && acfAddress.post_code) {
          geo = await geocodeAddressVerified(acfAddress.address, acfAddress.post_code, acfAddress.city)
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

        const typologyDrafts = buildTypologyDrafts(residence.acf.typologies)
        const equipment = buildEquipmentValues(residence.acf.equipments)

        const priceMin = residence.acf.price != null ? parseInt(String(residence.acf.price), 10) || null : null

        const derived = typologyAggregates(typologyDrafts)

        const addressData = {
          address: resolvedAddress,
          postalCode: resolvedPostalCode,
          cityId: resolvedCityId,
          ...(lat && lng ? { geom: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)` } : {}),
        }

        const accommodationData = {
          name,
          published: true,
          targetAudience: residence.acf.residence_for_students_only ? ('etudiants' as const) : null,
          priceMin: priceMin ?? derived.priceMin,
          nbTotalApartments: derived.nbTotalApartments,
          nbAccessibleApartments: residence.acf.residence_is_accessible ? 1 : null,
          ...equipment,
          imagesUrls: imageUrls.length > 0 ? imageUrls : null,
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
          const accommodationId = existingSource[0].accommodationId
          await db.update(accommodations).set(accommodationData).where(eq(accommodations.id, accommodationId))
          await syncTypologies(db, accommodationId, typologyDrafts)
          await db.delete(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, accommodationId))
          await db.insert(accommodationAddresses).values({ accommodationId, isMain: true, ...addressData })
          result.updated++
          pushResidenceEntry(result.residences!, { name, slug: existingSource[0].slug, city: resolvedCity ?? null, action: 'updated' })
        } else {
          const slug = await findAvailableSlug(generateSlug(name), db, accommodations)
          const [newAccommodation] = await db
            .insert(accommodations)
            .values({ ...accommodationData, slug, createdAt: new Date() })
            .returning({ id: accommodations.id })
          await syncTypologies(db, newAccommodation.id, typologyDrafts)

          await db.insert(accommodationAddresses).values({ accommodationId: newAccommodation.id, isMain: true, ...addressData })

          await db.insert(externalSources).values({
            accommodationId: newAccommodation.id,
            source: SOURCE,
            sourceId,
          })
          result.created++
          pushResidenceEntry(result.residences!, { name, slug, city: resolvedCity ?? null, action: 'created' })
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
