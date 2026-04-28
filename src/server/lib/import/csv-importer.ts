import path from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import { ZUpdateResidence } from '~/schemas/accommodations/update-residence'
import type { TImportJobResidence, TImportJobSummary } from '~/schemas/import-jobs'
import { db } from '~/server/db'
import { accommodations, externalSources, owners } from '~/server/db/schema'
import { generateAccommodationKey, uploadFile } from '~/server/services/s3'
import { computeDerivedFields, generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '~/server/utils/slug'
import { type CsvRow, generateSourceId, normalizeEnum, parseCsvContent, toBool, toDigit } from './csv-parser'
import { ensureCity, geocodeAddress, reverseGeocode } from './geocoder'

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

const ZAccommodationImport = ZUpdateResidence.pick({
  name: true,
  residence_type: true,
  target_audience: true,
  description: true,
  external_url: true,
  accept_waiting_list: true,
  nb_t1: true,
  nb_t1_bis: true,
  nb_t2: true,
  nb_t3: true,
  nb_t4: true,
  nb_t5: true,
  nb_t6: true,
  nb_t7_more: true,
  price_min_t1: true,
  price_max_t1: true,
  price_min_t1_bis: true,
  price_max_t1_bis: true,
  price_min_t2: true,
  price_max_t2: true,
  price_min_t3: true,
  price_max_t3: true,
  price_min_t4: true,
  price_max_t4: true,
  price_min_t5: true,
  price_max_t5: true,
  price_min_t6: true,
  price_max_t6: true,
  price_min_t7_more: true,
  price_max_t7_more: true,
  superficie_min_t1: true,
  superficie_max_t1: true,
  superficie_min_t1_bis: true,
  superficie_max_t1_bis: true,
  superficie_min_t2: true,
  superficie_max_t2: true,
  superficie_min_t3: true,
  superficie_max_t3: true,
  superficie_min_t4: true,
  superficie_max_t4: true,
  superficie_min_t5: true,
  superficie_max_t5: true,
  superficie_min_t6: true,
  superficie_max_t6: true,
  superficie_min_t7_more: true,
  superficie_max_t7_more: true,
  nb_accessible_apartments: true,
  nb_coliving_apartments: true,
  refrigerator: true,
  laundry_room: true,
  bathroom: true,
  kitchen_type: true,
  microwave: true,
  secure_access: true,
  parking: true,
  common_areas: true,
  bike_storage: true,
  desk: true,
  residence_manager: true,
  cooking_plates: true,
  images_urls: true,
  published: true,
  scholarship_holders_priority: true,
})

function buildValidationPayload(row: CsvRow) {
  return {
    name: row.name?.trim() || undefined,
    residence_type: normalizeEnum(row.residence_type) ?? undefined,
    target_audience: normalizeEnum(row.target_audience) ?? 'etudiants',
    description: row.description?.trim() || undefined,
    external_url: row.owner_url?.trim() || undefined,
    accept_waiting_list: toBool(row.accept_waiting_list) ?? undefined,
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
    nb_accessible_apartments: toDigit(row.nb_accessible_apartments, true) ?? undefined,
    nb_coliving_apartments: toDigit(row.nb_coliving_apartments, true) ?? undefined,
    refrigerator: toBool(row.refrigerator) ?? undefined,
    laundry_room: toBool(row.laundry_room) ?? undefined,
    bathroom: normalizeEnum(row.bathroom) ?? undefined,
    kitchen_type: normalizeEnum(row.kitchen_type) ?? undefined,
    microwave: toBool(row.microwave) ?? undefined,
    secure_access: toBool(row.secure_access) ?? undefined,
    parking: toBool(row.parking) ?? undefined,
    common_areas: toBool(row.common_areas) ?? undefined,
    bike_storage: toBool(row.bike_storage) ?? undefined,
    desk: toBool(row.desk) ?? undefined,
    residence_manager: toBool(row.residence_manager) ?? undefined,
    cooking_plates: toBool(row.cooking_plates) ?? undefined,
    published: true,
    scholarship_holders_priority: toBool(row.scholarship_holders_priority) ?? undefined,
    social_housing_required: toBool(row.social_housing_required) ?? undefined,
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
  const bucket = process.env.S3_BUCKET ?? ''

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

async function getOrCreateOwner(name: string, url?: string): Promise<number> {
  const existing = await db.select({ id: owners.id }).from(owners).where(eq(owners.name, name)).limit(1)
  if (existing[0]) return existing[0].id

  const slug = generateSlug(name)
  const [created] = await db
    .insert(owners)
    .values({ name, slug, url: url || null })
    .returning({ id: owners.id })
  return created.id
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

  const ownerName = rows[0].owner_name?.trim()
  const ownerUrl = rows[0].owner_url?.trim()
  if (!ownerName) throw new Error('owner_name manquant dans la première ligne')

  const ownerId = await getOrCreateOwner(ownerName, ownerUrl)

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
          const fullAddress = `${resolvedAddress}, ${resolvedPostalCode} ${resolvedCity}`
          const geo = await geocodeAddress(fullAddress)
          if (geo?.city) resolvedCity = geo.city
        }
      } else {
        const fullAddress = `${row.address ?? ''}, ${row.postal_code ?? ''} ${row.city ?? ''}`
        const geo = await geocodeAddress(fullAddress)
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

      const derived = computeDerivedFields({
        nb_t1: toDigit(row.nb_t1),
        nb_t1_bis: toDigit(row.nb_t1_bis),
        nb_t2: toDigit(row.nb_t2),
        nb_t3: toDigit(row.nb_t3),
        nb_t4: toDigit(row.nb_t4),
        nb_t5: toDigit(row.nb_t5),
        nb_t6: toDigit(row.nb_t6),
        nb_t7_more: toDigit(row.nb_t7_more),
        price_min_t1: toDigit(row.t1_rent_min),
        price_min_t1_bis: toDigit(row.t1_bis_rent_min),
        price_min_t2: toDigit(row.t2_rent_min),
        price_min_t3: toDigit(row.t3_rent_min),
        price_min_t4: toDigit(row.t4_rent_min),
        price_min_t5: toDigit(row.t5_rent_min),
        price_min_t6: toDigit(row.t6_rent_min),
        price_min_t7_more: toDigit(row.t7_more_rent_min),
        images_urls: imagesUrls.length > 0 ? imagesUrls : undefined,
      })

      const accommodationData = {
        name,
        description: row.description?.trim() || null,
        address: resolvedAddress,
        city: resolvedCity,
        cityId: resolvedCityId,
        postalCode: resolvedPostalCode,
        residenceType: normalizeEnum(row.residence_type),
        target_audience: (normalizeEnum(row.target_audience) ?? 'etudiants') as 'etudiants' | 'mixte-etudiants-jeunes-actifs',
        published: true,
        ...(geom ? { geom } : {}),
        nbT1: toDigit(row.nb_t1),
        nbT1Bis: toDigit(row.nb_t1_bis),
        nbT2: toDigit(row.nb_t2),
        nbT3: toDigit(row.nb_t3),
        nbT4: toDigit(row.nb_t4),
        nbT5: toDigit(row.nb_t5),
        nbT6: toDigit(row.nb_t6),
        nbT7More: toDigit(row.nb_t7_more),
        priceMinT1: toDigit(row.t1_rent_min),
        priceMaxT1: toDigit(row.t1_rent_max),
        priceMinT1Bis: toDigit(row.t1_bis_rent_min),
        priceMaxT1Bis: toDigit(row.t1_bis_rent_max),
        priceMinT2: toDigit(row.t2_rent_min),
        priceMaxT2: toDigit(row.t2_rent_max),
        priceMinT3: toDigit(row.t3_rent_min),
        priceMaxT3: toDigit(row.t3_rent_max),
        priceMinT4: toDigit(row.t4_rent_min),
        priceMaxT4: toDigit(row.t4_rent_max),
        priceMinT5: toDigit(row.t5_rent_min),
        priceMaxT5: toDigit(row.t5_rent_max),
        priceMinT6: toDigit(row.t6_rent_min),
        priceMaxT6: toDigit(row.t6_rent_max),
        priceMinT7More: toDigit(row.t7_more_rent_min),
        priceMaxT7More: toDigit(row.t7_more_rent_max),
        superficieMinT1: toDigit(row.superficie_min_t1),
        superficieMaxT1: toDigit(row.superficie_max_t1),
        superficieMinT1Bis: toDigit(row.superficie_min_t1_bis),
        superficieMaxT1Bis: toDigit(row.superficie_max_t1_bis),
        superficieMinT2: toDigit(row.superficie_min_t2),
        superficieMaxT2: toDigit(row.superficie_max_t2),
        superficieMinT3: toDigit(row.superficie_min_t3),
        superficieMaxT3: toDigit(row.superficie_max_t3),
        superficieMinT4: toDigit(row.superficie_min_t4),
        superficieMaxT4: toDigit(row.superficie_max_t4),
        superficieMinT5: toDigit(row.superficie_min_t5),
        superficieMaxT5: toDigit(row.superficie_max_t5),
        superficieMinT6: toDigit(row.superficie_min_t6),
        superficieMaxT6: toDigit(row.superficie_max_t6),
        superficieMinT7More: toDigit(row.superficie_min_t7_more),
        superficieMaxT7More: toDigit(row.superficie_max_t7_more),
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
        imagesCount: derived.imagesCount,
        externalUrl: row.owner_url?.trim() || null,
        externalReference: sourceId,
        ownerId,
        updatedAt: new Date(),
      }

      let action: 'created' | 'updated'

      if (existingSource[0]) {
        await db.update(accommodations).set(accommodationData).where(eq(accommodations.id, existingSource[0].accommodationId))
        result.updated++
        action = 'updated'

        const updated = await db
          .select({ slug: accommodations.slug })
          .from(accommodations)
          .where(eq(accommodations.id, existingSource[0].accommodationId))
          .limit(1)
        result.residences.push({ name, slug: updated[0]?.slug ?? '', city: resolvedCity || null, action: 'updated' })
      } else {
        const slug = await findAvailableSlug(generateSlug(name), db, accommodations)
        const [newAccommodation] = await db
          .insert(accommodations)
          .values({ ...accommodationData, slug, createdAt: new Date() })
          .returning({ id: accommodations.id })

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
