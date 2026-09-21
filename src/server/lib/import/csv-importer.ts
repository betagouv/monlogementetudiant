import path from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ETargetAudience } from '~/enums/target-audience'
import { TYPOLOGIES } from '~/schemas/accommodations/typology'
import { ZUpdateResidence } from '~/schemas/accommodations/update-residence'
import type { TImportJobResidence, TImportJobSummary } from '~/schemas/import-jobs'
import { db } from '~/server/db'
import { accommodationAddresses, accommodations, externalSources } from '~/server/db/schema'
import { env } from '~/server/env'
import { resolveImportOwner } from '~/server/lib/import/resolve-owner'
import { syncTypologies, typologyAggregates, typologyDraft } from '~/server/lib/typologies'
import { generateAccommodationKey, uploadFile } from '~/server/services/s3'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '~/server/utils/slug'
import { type CsvRow, generateSourceId, normalizeEnum, parseCsvContent, toBool, toDigit, toUrl } from './csv-parser'
import { ensureCity, geocodeAddressVerified, geocodeImportRow, reverseGeocode } from './geocoder'

export type ProgressLine = {
  row: number
  name: string
  action?: 'created' | 'updated' | 'skipped' | 'error'
  message?: string
}

export type CsvProgressEvent =
  | { type: 'progress'; row: number; total: number; name: string; action: 'created' | 'updated' | 'skipped' }
  | { type: 'error'; row: number; name: string; message: string }
  | { type: 'done'; summary: TImportJobSummary }

export type CsvPreviewRow = {
  index: number
  name: string
  address: string
  city: string
  owner: string
  status: 'valid' | 'error'
  message?: string
}

export type CsvPreviewResult = {
  rows: CsvPreviewRow[]
  total: number
  valid: number
  errors: number
  ownerName: string
  source: string
}

// CSV rows are flat per-typology (nb_t1, price_min_t1, …); this Zod shape validates them. They are
// later mapped into TypologyDraft[] (see typologyDrafts below) and persisted via syncTypologies.
const flatTypologyImportShape = Object.fromEntries(
  TYPOLOGIES.flatMap(({ type }) => [
    [`nb_${type}`, z.number().nullish()],
    [`nb_${type}_available`, z.number().nullish()],
    [`price_min_${type}`, z.number().nullish()],
    [`price_max_${type}`, z.number().nullish()],
    [`superficie_min_${type}`, z.number().nullish()],
    [`superficie_max_${type}`, z.number().nullish()],
  ]),
) as z.ZodRawShape

const ZAccommodationImport = ZUpdateResidence.pick({
  name: true,
  residenceType: true,
  targetAudience: true,
  description: true,
  externalUrl: true,
  acceptWaitingList: true,
  nbAccessibleApartments: true,
  nbColivingApartments: true,
  refrigerator: true,
  laundryRoom: true,
  bathroom: true,
  kitchenType: true,
  microwave: true,
  secureAccess: true,
  parking: true,
  commonAreas: true,
  bikeStorage: true,
  desk: true,
  residenceManager: true,
  cookingPlates: true,
  imagesUrls: true,
  published: true,
  scholarshipHoldersPriority: true,
}).extend(flatTypologyImportShape)

function buildValidationPayload(row: CsvRow) {
  return {
    name: row.name?.trim() || undefined,
    residenceType: normalizeEnum(row.residence_type) ?? undefined,
    targetAudience: normalizeEnum(row.target_audience) ?? 'etudiants',
    description: row.description?.trim() || undefined,
    externalUrl: toUrl(row.owner_url) ?? undefined,
    acceptWaitingList: toBool(row.accept_waiting_list) ?? undefined,
    nb_t1: toDigit(row.nb_t1) ?? undefined,
    nb_t1_bis: toDigit(row.nb_t1_bis) ?? undefined,
    nb_t2: toDigit(row.nb_t2) ?? undefined,
    nb_t3: toDigit(row.nb_t3) ?? undefined,
    nb_t4: toDigit(row.nb_t4) ?? undefined,
    nb_t5: toDigit(row.nb_t5) ?? undefined,
    nb_t6: toDigit(row.nb_t6) ?? undefined,
    nb_t7_more: toDigit(row.nb_t7_more) ?? undefined,
    price_min_t1: toDigit(row.t1_rent_min) ?? undefined,
    price_max_t1: toDigit(row.t1_rent_max) ?? undefined,
    price_min_t1_bis: toDigit(row.t1_bis_rent_min) ?? undefined,
    price_max_t1_bis: toDigit(row.t1_bis_rent_max) ?? undefined,
    price_min_t2: toDigit(row.t2_rent_min) ?? undefined,
    price_max_t2: toDigit(row.t2_rent_max) ?? undefined,
    price_min_t3: toDigit(row.t3_rent_min) ?? undefined,
    price_max_t3: toDigit(row.t3_rent_max) ?? undefined,
    price_min_t4: toDigit(row.t4_rent_min) ?? undefined,
    price_max_t4: toDigit(row.t4_rent_max) ?? undefined,
    price_min_t5: toDigit(row.t5_rent_min) ?? undefined,
    price_max_t5: toDigit(row.t5_rent_max) ?? undefined,
    price_min_t6: toDigit(row.t6_rent_min) ?? undefined,
    price_max_t6: toDigit(row.t6_rent_max) ?? undefined,
    price_min_t7_more: toDigit(row.t7_more_rent_min) ?? undefined,
    price_max_t7_more: toDigit(row.t7_more_rent_max) ?? undefined,
    superficie_min_t1: toDigit(row.superficie_min_t1) ?? undefined,
    superficie_max_t1: toDigit(row.superficie_max_t1) ?? undefined,
    superficie_min_t1_bis: toDigit(row.superficie_min_t1_bis) ?? undefined,
    superficie_max_t1_bis: toDigit(row.superficie_max_t1_bis) ?? undefined,
    superficie_min_t2: toDigit(row.superficie_min_t2) ?? undefined,
    superficie_max_t2: toDigit(row.superficie_max_t2) ?? undefined,
    superficie_min_t3: toDigit(row.superficie_min_t3) ?? undefined,
    superficie_max_t3: toDigit(row.superficie_max_t3) ?? undefined,
    superficie_min_t4: toDigit(row.superficie_min_t4) ?? undefined,
    superficie_max_t4: toDigit(row.superficie_max_t4) ?? undefined,
    superficie_min_t5: toDigit(row.superficie_min_t5) ?? undefined,
    superficie_max_t5: toDigit(row.superficie_max_t5) ?? undefined,
    superficie_min_t6: toDigit(row.superficie_min_t6) ?? undefined,
    superficie_max_t6: toDigit(row.superficie_max_t6) ?? undefined,
    superficie_min_t7_more: toDigit(row.superficie_min_t7_more) ?? undefined,
    superficie_max_t7_more: toDigit(row.superficie_max_t7_more) ?? undefined,
    nbAccessibleApartments: toDigit(row.nb_accessible_apartments, true) ?? undefined,
    nbColivingApartments: toDigit(row.nb_coliving_apartments, true) ?? undefined,
    refrigerator: toBool(row.refrigerator) ?? undefined,
    laundryRoom: toBool(row.laundry_room) ?? undefined,
    bathroom: normalizeEnum(row.bathroom) ?? undefined,
    kitchenType: normalizeEnum(row.kitchen_type) ?? undefined,
    microwave: toBool(row.microwave) ?? undefined,
    secureAccess: toBool(row.secure_access) ?? undefined,
    parking: toBool(row.parking) ?? undefined,
    commonAreas: toBool(row.common_areas) ?? undefined,
    bikeStorage: toBool(row.bike_storage) ?? undefined,
    desk: toBool(row.desk) ?? undefined,
    residenceManager: toBool(row.residence_manager) ?? undefined,
    cookingPlates: toBool(row.cooking_plates) ?? undefined,
    published: true,
    scholarshipHoldersPriority: toBool(row.scholarship_holders_priority) ?? undefined,
    socialHousingRequired: toBool(row.social_housing_required) ?? undefined,
  }
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const ext = path.extname(pathname).replace('.', '').toLowerCase()
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext) ? ext : 'jpg'
  } catch {
    return 'jpg'
  }
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
  }
  return map[ext] ?? 'image/jpeg'
}

async function processImages(picturesRaw: string): Promise<string[]> {
  if (!picturesRaw || picturesRaw.trim() === '') return []

  const urls = picturesRaw
    .split(/[|\n]/)
    .map((u) => u.trim())
    .filter((u) => u !== '' && (u.startsWith('http://') || u.startsWith('https://')))

  const result: string[] = []
  const bucket = env.S3_BUCKET

  for (const url of urls) {
    try {
      const host = new URL(url).hostname
      if (host === `${bucket}.s3.gra.io.cloud.ovh.net`) {
        result.push(url)
      } else {
        const response = await fetch(url)
        if (!response.ok) continue
        const buffer = Buffer.from(await response.arrayBuffer())
        const ext = getExtFromUrl(url)
        const key = generateAccommodationKey(ext)
        const s3Url = await uploadFile({ key, body: buffer, contentType: getMimeType(ext) })
        result.push(s3Url)
      }
    } catch {
      // skip failing images
    }
  }

  return result
}

// ─── PREVIEW (no DB writes) ────────────────────────────────────────────────

export function previewCsv(content: string, source: string): CsvPreviewResult {
  const rows = parseCsvContent(content)

  if (rows.length === 0) {
    return { rows: [], total: 0, valid: 0, errors: 0, ownerName: '', source }
  }

  const ownerName = rows[0].owner_name?.trim() ?? ''
  const previewRows: CsvPreviewRow[] = []
  let valid = 0
  let errors = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const name = row.name?.trim()

    if (!name) {
      previewRows.push({
        index: i + 1,
        name: '(sans nom)',
        address: row.address?.trim() ?? '',
        city: row.city?.trim() ?? '',
        owner: row.owner_name?.trim() ?? '',
        status: 'error',
        message: 'Nom de résidence manquant',
      })
      errors++
      continue
    }

    const parsed = ZAccommodationImport.safeParse(buildValidationPayload(row))
    if (!parsed.success) {
      const message = parsed.error.issues.map((iss) => `${iss.path.join('.') || '<root>'}: ${iss.message}`).join('; ')
      previewRows.push({
        index: i + 1,
        name,
        address: row.address?.trim() ?? '',
        city: row.city?.trim() ?? '',
        owner: row.owner_name?.trim() ?? '',
        status: 'error',
        message,
      })
      errors++
    } else {
      previewRows.push({
        index: i + 1,
        name,
        address: row.address?.trim() ?? '',
        city: row.city?.trim() ?? '',
        owner: row.owner_name?.trim() ?? '',
        status: 'valid',
      })
      valid++
    }
  }

  return { rows: previewRows, total: rows.length, valid, errors, ownerName, source }
}

// ─── EXECUTE (with SSE progress callback) ─────────────────────────────────

export async function executeCsvImport(
  content: string,
  source: string,
  onProgress: (event: CsvProgressEvent) => void | Promise<void>,
): Promise<TImportJobSummary> {
  const rows = parseCsvContent(content)

  if (rows.length === 0) {
    const summary: TImportJobSummary = { created: 0, updated: 0, skipped: 0, errors: [] }
    await onProgress({ type: 'done', summary })
    return summary
  }

  // Bailleur de la première ligne : `owner_id` puis `owner_slug` (identifiants stables) avant le nom.
  const owner = await resolveImportOwner({
    id: toDigit(rows[0].owner_id),
    slug: rows[0].owner_slug?.trim(),
    name: rows[0].owner_name?.trim(),
    url: toUrl(rows[0].owner_url) ?? undefined,
  })
  const { id: ownerId, name: ownerName } = owner

  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
    ownerId,
    ownerName,
    residences: [] as TImportJobResidence[],
  } satisfies TImportJobSummary

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const name = row.name?.trim()

    if (!name) {
      result.skipped++
      await onProgress({ type: 'progress', row: rowIndex + 1, total: rows.length, name: '(sans nom)', action: 'skipped' })
      continue
    }

    try {
      const sourceId = generateSourceId(row)

      const existingSource = await db
        .select({ accommodationId: externalSources.accommodationId })
        .from(externalSources)
        .where(and(eq(externalSources.source, source), eq(externalSources.sourceId, sourceId)))
        .limit(1)

      // Geocoding
      const lat = Number.parseFloat(row.latitude ?? '')
      const lng = Number.parseFloat(row.longitude ?? '')
      let geom: ReturnType<typeof sql> | null = null
      let resolvedAddress = row.address?.trim() ?? ''
      let resolvedCity = row.city?.trim() ?? ''
      let resolvedPostalCode = row.postal_code?.trim() ?? ''

      if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0) {
        geom = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`
        if (!resolvedCity) {
          const rev = await reverseGeocode(lat, lng)
          if (rev) {
            resolvedCity = rev.city || resolvedCity
            resolvedAddress = rev.address || resolvedAddress
            resolvedPostalCode = rev.postalCode || resolvedPostalCode
          }
        }
        if (resolvedCity && resolvedCity === resolvedCity.toUpperCase() && resolvedCity !== resolvedCity.toLowerCase()) {
          const geo = await geocodeAddressVerified(resolvedAddress, resolvedPostalCode, resolvedCity)
          if (geo?.city) resolvedCity = geo.city
        }
      } else {
        const geo = await geocodeImportRow(row.address ?? '', row.postal_code ?? '', row.city ?? '')
        if (geo) {
          geom = sql`ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)`
          resolvedAddress = geo.address || resolvedAddress
          resolvedCity = geo.city || resolvedCity
          resolvedPostalCode = geo.postalCode || resolvedPostalCode
        }
      }

      let resolvedCityId: number | null = null
      if (resolvedPostalCode && resolvedCity) {
        const cityResult = await ensureCity(resolvedPostalCode, resolvedCity)
        resolvedCity = cityResult.name
        resolvedCityId = cityResult.id || null
      }

      const imagesUrls = await processImages(row.pictures ?? '')

      const addressData = {
        address: resolvedAddress,
        postalCode: resolvedPostalCode,
        cityId: resolvedCityId,
        ...(geom ? { geom } : {}),
      }

      const typologyDrafts = TYPOLOGIES.map(({ type }) =>
        typologyDraft(type, {
          nbTotal: toDigit(row[`nb_${type}`]),
          priceMin: toDigit(row[`${type}_rent_min`]),
          priceMax: toDigit(row[`${type}_rent_max`]),
          superficieMin: toDigit(row[`superficie_min_${type}`]),
          superficieMax: toDigit(row[`superficie_max_${type}`]),
        }),
      )

      const derived = typologyAggregates(typologyDrafts)

      const accommodationData = {
        name,
        description: row.description?.trim() || null,
        residenceType: normalizeEnum(row.residence_type),
        targetAudience: (normalizeEnum(row.target_audience) ?? 'etudiants') as ETargetAudience,
        published: true,
        priceMin: derived.priceMin,
        nbTotalApartments: toDigit(row.nb_total_apartments, true) ?? derived.nbTotalApartments,
        nbAccessibleApartments: toDigit(row.nb_accessible_apartments, true),
        nbColivingApartments: toDigit(row.nb_coliving_apartments, true),
        laundryRoom: toBool(row.laundry_room),
        commonAreas: toBool(row.common_areas),
        bikeStorage: toBool(row.bike_storage),
        parking: toBool(row.parking),
        secureAccess: toBool(row.secure_access),
        residenceManager: toBool(row.residence_manager),
        kitchenType: normalizeEnum(row.kitchen_type),
        desk: toBool(row.desk),
        cookingPlates: toBool(row.cooking_plates),
        microwave: toBool(row.microwave),
        refrigerator: toBool(row.refrigerator),
        bathroom: normalizeEnum(row.bathroom),
        acceptWaitingList: toBool(row.accept_waiting_list),
        scholarshipHoldersPriority: toBool(row.scholarship_holders_priority),
        socialHousingRequired: toBool(row.social_housing_required),
        imagesUrls: imagesUrls.length > 0 ? imagesUrls : null,
        externalUrl: toUrl(row.owner_url),
        externalReference: sourceId,
        ownerId,
        updatedAt: new Date(),
      }

      let action: 'created' | 'updated'

      if (existingSource[0]) {
        const accommodationId = existingSource[0].accommodationId
        await db.update(accommodations).set(accommodationData).where(eq(accommodations.id, accommodationId))
        await syncTypologies(db, accommodationId, typologyDrafts)
        // The CSV total can exceed the sum of categorized typologies; keep it over sync's recomputed value.
        await db
          .update(accommodations)
          .set({ nbTotalApartments: accommodationData.nbTotalApartments })
          .where(eq(accommodations.id, accommodationId))
        await db.delete(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, accommodationId))
        await db.insert(accommodationAddresses).values({ accommodationId, isMain: true, ...addressData })
        result.updated++
        action = 'updated'

        const updated = await db
          .select({ slug: accommodations.slug })
          .from(accommodations)
          .where(eq(accommodations.id, accommodationId))
          .limit(1)
        result.residences.push({ name, slug: updated[0]?.slug ?? '', city: resolvedCity || null, action: 'updated' })
      } else {
        const slug = await findAvailableSlug(generateSlug(name), db, accommodations)
        const [newAccommodation] = await db
          .insert(accommodations)
          .values({ ...accommodationData, slug, createdAt: new Date() })
          .returning({ id: accommodations.id })

        await syncTypologies(db, newAccommodation.id, typologyDrafts)
        // The CSV total can exceed the sum of categorized typologies; keep it over sync's recomputed value.
        await db
          .update(accommodations)
          .set({ nbTotalApartments: accommodationData.nbTotalApartments })
          .where(eq(accommodations.id, newAccommodation.id))
        await db.insert(accommodationAddresses).values({ accommodationId: newAccommodation.id, isMain: true, ...addressData })
        await db.insert(externalSources).values({ accommodationId: newAccommodation.id, source, sourceId })
        result.created++
        action = 'created'
        result.residences.push({ name, slug, city: resolvedCity || null, action: 'created' })
      }

      await onProgress({ type: 'progress', row: rowIndex + 1, total: rows.length, name, action })
    } catch (error) {
      const cause = error instanceof Error ? (error as unknown as { cause?: unknown }).cause : null
      const dbError = cause && typeof cause === 'object' && 'message' in cause ? String((cause as { message: string }).message) : null
      const rawMessage = error instanceof Error ? error.message : String(error)
      const cleanMessage = rawMessage.replace(/Failed query:[\s\S]*/i, '').trim()
      const message = dbError || cleanMessage || rawMessage

      result.errors.push(`Ligne ${rowIndex + 1} - ${row.name ?? '?'}: ${message}`)
      await onProgress({ type: 'error', row: rowIndex + 1, name: row.name?.trim() ?? '?', message })
    }
  }

  const summary: TImportJobSummary = {
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    errors: result.errors,
    ownerId: result.ownerId,
    ownerName: result.ownerName,
    residences: result.residences,
  }

  await onProgress({ type: 'done', summary })
  return summary
}
