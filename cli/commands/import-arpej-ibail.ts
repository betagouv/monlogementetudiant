import { and, eq } from 'drizzle-orm'
import { accommodations, externalSources, owners } from '../../src/server/db/schema'
import { generateAccommodationKey, uploadFile } from '../../src/server/services/s3'
import { computeDerivedFields, generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { db } from '../lib/db'
import { geocodeAddress } from '../lib/geocoder'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'

const IBAIL_SOURCE = 'arpej'
const OWNER_NAME = 'ARPEJ'
const OWNER_URL = 'https://www.arpej.fr/fr/'

interface IbailResidence {
  key: string
  title: string
  address: string
  address_complement?: string
  zip_code: string
  city: string
  rent_amount_from?: number
  rent_amount_to?: number
  accommodation_quantity?: number
  available_accommodation_quantity?: number
  description?: string
  images?: { url: string }[]
  [key: string]: unknown
}

async function getOrCreateOwner(): Promise<number> {
  const existing = await db.select().from(owners).where(eq(owners.name, OWNER_NAME)).limit(1)
  if (existing[0]) return existing[0].id

  const slug = OWNER_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const [created] = await db.insert(owners).values({ name: OWNER_NAME, slug, url: OWNER_URL }).returning({ id: owners.id })
  return created.id
}

async function fetchResidences(options: ImportOptions): Promise<IbailResidence[]> {
  const host = process.env.IBAIL_API_HOST
  const authKey = process.env.IBAIL_API_AUTH_KEY
  const authSecret = process.env.IBAIL_API_AUTH_SECRET

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
    const data: IbailResidence[] = await res.json()
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
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

    const ownerId = await getOrCreateOwner()
    if (options.verbose) console.log(`  🏢 Owner ARPEJ id=${ownerId}`)

    const residences = await fetchResidences(options)
    console.log(`  ✓ ${residences.length} résidences récupérées`)

    for (const residence of residences) {
      try {
        if (options.verbose) console.log(`  🏠 ${residence.title} (${residence.key})`)

        const existingSource = await db
          .select({ accommodationId: externalSources.accommodationId })
          .from(externalSources)
          .where(and(eq(externalSources.source, IBAIL_SOURCE), eq(externalSources.sourceId, residence.key)))
          .limit(1)

        const fullAddress = [residence.address, residence.address_complement, `${residence.zip_code} ${residence.city}`]
          .filter(Boolean)
          .join(', ')
        const geo = await geocodeAddress(fullAddress)

        let imageUrls: string[] = []
        if (residence.images?.length && !options.dryRun) {
          imageUrls = await uploadImages(residence.images, options.verbose ?? false)
        }

        const derived = computeDerivedFields({
          nb_t1: residence.accommodation_quantity ?? null,
          nb_t1_available: residence.available_accommodation_quantity ?? null,
          price_min_t1: residence.rent_amount_from ?? null,
          images_urls: imageUrls.length > 0 ? imageUrls : null,
        })

        const accommodationData = {
          name: residence.title,
          slug: generateSlug(residence.title),
          description: (residence.description as string) ?? null,
          address: geo?.address ?? residence.address,
          city: geo?.city ?? residence.city,
          postalCode: geo?.postalCode ?? residence.zip_code,
          residenceType: 'universitaire-conventionnee',
          published: true,
          available: derived.available,
          geom: geo ? ([geo.lng, geo.lat] as [number, number]) : null,
          nbT1: residence.accommodation_quantity ?? null,
          nbT1Available: residence.available_accommodation_quantity ?? null,
          priceMinT1: residence.rent_amount_from ?? null,
          priceMaxT1: residence.rent_amount_to ?? null,
          priceMin: derived.priceMin,
          nbTotalApartments: derived.nbTotalApartments,
          imagesUrls: imageUrls.length > 0 ? imageUrls : null,
          imagesCount: derived.imagesCount,
          ownerId,
          externalUrl: OWNER_URL,
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
            source: IBAIL_SOURCE,
            sourceId: residence.key,
          })
          result.created++
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
