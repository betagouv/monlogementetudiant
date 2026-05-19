import { and, eq, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { env } from '~/server/env'
import { ensureCity, geocodeAddress } from '~/server/lib/import/geocoder'
import { accommodationAddresses, accommodations, externalSources, importBlocklist } from '../../src/server/db/schema'
import { generateAccommodationKey, uploadFile } from '../../src/server/services/s3'
import { computeDerivedFields, generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'
import { getOrCreateOwner } from '../utils/get-or-create-owner'
import { pushResidenceEntry } from './import-utils'

const IBAIL_SOURCE = 'arpej'
const OWNER_NAME = 'ARPEJ'
const OWNER_URL = 'https://www.arpej.fr/fr/'

interface IbailResidence {
  key: string
  title: string
  url?: string | null
  address: string
  address_complement?: string | null
  zip_code: string
  city: string
  rent_amount_from?: number
  rent_amount_to?: number
  accommodation_quantity?: number
  available_accommodation_quantity?: number
  description?: string | null
  images?: { url: string }[]
  pictures?: { url: string }[]
  availability?: {
    surface_from?: number | null
    surface_to?: number | null
    rent_amount_from?: number | null
    rent_amount_to?: number | null
    accommodation_quantity?: number | null
    count?: number | null
    url?: string | null
  } | null
  [key: string]: unknown
}

function toInteger(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value)
}

function normalizeResidence(residence: IbailResidence) {
  const availability = residence.availability

  return {
    rentAmountFrom: toInteger(residence.rent_amount_from ?? availability?.rent_amount_from),
    rentAmountTo: toInteger(residence.rent_amount_to ?? availability?.rent_amount_to),
    accommodationQuantity: residence.accommodation_quantity ?? availability?.accommodation_quantity ?? null,
    availableAccommodationQuantity: residence.available_accommodation_quantity ?? availability?.count ?? null,
    surfaceFrom: toInteger(availability?.surface_from),
    surfaceTo: toInteger(availability?.surface_to),
    imageSources: residence.images ?? residence.pictures ?? [],
    externalUrl: residence.url ?? availability?.url ?? OWNER_URL,
  }
}

function omitNullish<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value != null)) as Partial<T>
}

async function fetchResidences(options: ImportOptions): Promise<IbailResidence[]> {
  const { IBAIL_API_HOST: host, IBAIL_API_AUTH_KEY: authKey, IBAIL_API_AUTH_SECRET: authSecret } = env

  if (!host || !authKey || !authSecret) {
    throw new Error('Missing env vars: IBAIL_API_HOST, IBAIL_API_AUTH_KEY, IBAIL_API_AUTH_SECRET')
  }

  const all: IbailResidence[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    if (options.verbose) console.log(`  Fetching page ${page}/${totalPages}...`)

    const res = await fetch(`${host}/residences?page=${page}`, {
      headers: {
        'X-Auth-Key': authKey,
        'X-Auth-Secret': authSecret,
        Accept: 'application/json',
      },
    })

    if (!res.ok) throw new Error(`iBAIL API error: ${res.status} ${await res.text()}`)

    totalPages = Number(res.headers.get('X-Pagination-Total-Pages')) || 1
    const data: IbailResidence[] = (await res.json()).residences ?? []
    all.push(...data)

    if (options.limit && all.length >= options.limit) {
      return all.slice(0, options.limit)
    }

    const nextPage = res.headers.get('X-Pagination-Next-Page')
    page = nextPage ? Number(nextPage) : page + 1
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

async function uploadImages(images: { url: string }[], verbose: boolean): Promise<string[]> {
  const urls: string[] = []
  for (const img of images) {
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

const command: ImportCommand = {
  name: 'arpej-ibail',
  description: 'Import des résidences ARPEJ via API iBAIL',

  async execute(options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], residences: [] }

    const ownerId = await getOrCreateOwner(OWNER_NAME, OWNER_URL)
    result.ownerName = OWNER_NAME
    result.ownerId = ownerId
    if (options.verbose) console.log(`  🏢 Owner ARPEJ id=${ownerId}`)

    const residences = await fetchResidences(options)
    console.log(`  ✓ ${residences.length} résidences récupérées`)

    for (const residence of residences) {
      try {
        if (options.verbose) console.log(`  🏠 ${residence.title} (${residence.key})`)

        const blockedImport = await db
          .select({ reason: importBlocklist.reason })
          .from(importBlocklist)
          .where(and(eq(importBlocklist.source, IBAIL_SOURCE), eq(importBlocklist.sourceId, residence.key)))
          .limit(1)

        if (blockedImport[0]) {
          if (options.verbose) {
            const reason = blockedImport[0].reason ? ` (${blockedImport[0].reason})` : ''
            console.log(`    ⏭ Ignorée: résidence bloquée pour l'import${reason}`)
          }
          result.skipped++
          continue
        }

        const existingSource = await db
          .select({ accommodationId: externalSources.accommodationId, slug: accommodations.slug })
          .from(externalSources)
          .innerJoin(accommodations, eq(accommodations.id, externalSources.accommodationId))
          .where(and(eq(externalSources.source, IBAIL_SOURCE), eq(externalSources.sourceId, residence.key)))
          .limit(1)

        const normalized = normalizeResidence(residence)
        const fullAddress = [residence.address, residence.address_complement, `${residence.zip_code} ${residence.city}`]
          .filter(Boolean)
          .join(', ')
        const geo = await geocodeAddress(fullAddress)

        const resolvedPostalCode = geo?.postalCode ?? residence.zip_code
        const resolvedCityName = geo?.city ?? residence.city
        let resolvedCityId: number | null = null
        if (resolvedPostalCode && resolvedCityName) {
          const cityResult = await ensureCity(resolvedPostalCode, resolvedCityName)
          resolvedCityId = cityResult.id || null
        }

        let imageUrls: string[] = []
        if (normalized.imageSources.length && !options.dryRun) {
          imageUrls = await uploadImages(normalized.imageSources, options.verbose ?? false)
        }

        const derived = computeDerivedFields({
          nb_t1: normalized.accommodationQuantity,
          price_min_t1: normalized.rentAmountFrom,
          images_urls: imageUrls.length > 0 ? imageUrls : null,
        })

        const addressData = {
          address: geo?.address ?? residence.address.trim(),
          postalCode: resolvedPostalCode,
          cityId: resolvedCityId,
          ...(geo ? { geom: sql`ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)` } : {}),
        }

        const accommodationData = {
          name: residence.title,
          description: (residence.description as string) ?? null,
          residenceType: 'universitaire-conventionnee',
          published: true,
          nbT1: normalized.accommodationQuantity,
          nbT1Available: normalized.availableAccommodationQuantity,
          priceMinT1: normalized.rentAmountFrom,
          priceMaxT1: normalized.rentAmountTo,
          priceMin: derived.priceMin,
          nbTotalApartments: derived.nbTotalApartments,
          superficieMinT1: normalized.surfaceFrom,
          superficieMaxT1: normalized.surfaceTo,
          ownerId,
          externalUrl: normalized.externalUrl,
          updatedAt: new Date(),
        }

        const cityName = resolvedCityName ?? null

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
          const updateData: Partial<typeof accommodations.$inferInsert> = {
            ...omitNullish(accommodationData),
            ...(imageUrls.length > 0 ? { imagesUrls: imageUrls, imagesCount: derived.imagesCount } : {}),
          }

          await db.update(accommodations).set(updateData).where(eq(accommodations.id, accommodationId))

          const existingAddress = await db
            .select({ id: accommodationAddresses.id })
            .from(accommodationAddresses)
            .where(and(eq(accommodationAddresses.accommodationId, accommodationId), eq(accommodationAddresses.isMain, true)))
            .limit(1)
          const addressUpdateData = omitNullish(addressData)

          if (existingAddress[0]) {
            await db.update(accommodationAddresses).set(addressUpdateData).where(eq(accommodationAddresses.id, existingAddress[0].id))
          } else {
            await db.insert(accommodationAddresses).values({ accommodationId, isMain: true, ...addressData })
          }
          result.updated++
          pushResidenceEntry(result.residences!, { name: residence.title, slug: existingSource[0].slug, city: cityName, action: 'updated' })
        } else {
          const slug = await findAvailableSlug(generateSlug(residence.title), db, accommodations)
          const [newAccommodation] = await db
            .insert(accommodations)
            .values({
              ...accommodationData,
              imagesUrls: imageUrls.length > 0 ? imageUrls : null,
              imagesCount: derived.imagesCount,
              slug,
              createdAt: new Date(),
            })
            .returning({ id: accommodations.id })

          await db.insert(accommodationAddresses).values({ accommodationId: newAccommodation.id, isMain: true, ...addressData })

          await db.insert(externalSources).values({
            accommodationId: newAccommodation.id,
            source: IBAIL_SOURCE,
            sourceId: residence.key,
          })
          result.created++
          pushResidenceEntry(result.residences!, { name: residence.title, slug, city: cityName, action: 'created' })
        }
      } catch (error) {
        const msg = `${residence.title} (${residence.key}): ${error instanceof Error ? error.message : String(error)}`
        result.errors.push(msg)
        if (options.verbose) console.log(`    ✗ ${msg}`)
      }
    }

    return result
  },
}

export default command
