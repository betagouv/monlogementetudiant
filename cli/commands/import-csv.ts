import * as fs from 'node:fs'
import * as path from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ETargetAudience } from '~/enums/target-audience'
import { db } from '~/server/db'
import { env } from '~/server/env'
import { ensureCity, geocodeAddressVerified, geocodeImportRow, reverseGeocode } from '~/server/lib/import/geocoder'
import { TYPOLOGIES } from '../../src/schemas/accommodations/typology'
import { ZUpdateResidence } from '../../src/schemas/accommodations/update-residence'
import { accommodationAddresses, accommodations, externalSources } from '../../src/server/db/schema'
import type { CsvRow } from '../../src/server/lib/import/csv-parser'
import { generateSourceId, normalizeEnum, parseCsvContent, toBool, toDigit, toUrl } from '../../src/server/lib/import/csv-parser'
import { resolveImportOwner } from '../../src/server/lib/import/resolve-owner'
import { syncTypologies, typologyAggregates, typologyDraft } from '../../src/server/lib/typologies'
import { generateAccommodationKey, uploadFile } from '../../src/server/services/s3'
import { generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'

function parseCsv(filePath: string, limit?: number): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  return parseCsvContent(content, limit)
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

async function processImages(picturesRaw: string, verbose?: boolean): Promise<string[]> {
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
        if (verbose) console.log(`    Téléchargement image : ${url}`)
        const response = await fetch(url)
        if (!response.ok) {
          if (verbose) console.log(`    ⚠ Image non accessible : ${url} (${response.status})`)
          continue
        }
        const buffer = Buffer.from(await response.arrayBuffer())
        const ext = getExtFromUrl(url)
        const key = generateAccommodationKey(ext)
        const s3Url = await uploadFile({ key, body: buffer, contentType: getMimeType(ext) })
        result.push(s3Url)
      }
    } catch (error) {
      if (verbose) console.log(`    ⚠ Erreur image ${url}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return result
}

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

// Build the validation payload from the raw CSV row.
// address/city/postal_code are intentionally omitted (resolved by geocoding in pass 2)
// images_urls is omitted (uploaded to S3 in pass 2). All three fields are .optional() in the schema.
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

const command: ImportCommand = {
  name: 'csv',
  description: 'Import générique depuis un fichier CSV (;)',

  async execute(options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

    if (!options.file) {
      throw new Error("Option --file requise pour l'import CSV")
    }
    if (!options.source) {
      throw new Error("Option --source requise pour l'import CSV")
    }

    const source = options.source
    const rows = parseCsv(options.file, options.limit)
    console.log(`  ${rows.length} lignes chargées depuis ${options.file}`)

    if (rows.length === 0) return result

    // PASS 1: Validate every row up-front. No DB writes happen until all rows pass.
    // Rows with no name are skipped (same as pass 2) and not validated.
    const validationErrors: string[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const name = row.name?.trim()
      if (!name) continue
      const parsed = ZAccommodationImport.safeParse(buildValidationPayload(row))
      if (!parsed.success) {
        const issues = parsed.error.issues.map((iss) => `${iss.path.join('.') || '<root>'}: ${iss.message}`).join('; ')
        validationErrors.push(`Ligne ${i + 1} - ${name}: ${issues}`)
      }
    }
    if (validationErrors.length > 0) {
      throw new Error(`Validation Zod échouée (${validationErrors.length} ligne(s)):\n${validationErrors.join('\n')}`)
    }

    // Bailleur de la première ligne : `owner_id` puis `owner_slug` (identifiants stables) avant le nom.
    const ownerIdColumn = options.ownerId ?? toDigit(rows[0].owner_id)
    const ownerSlug = options.ownerSlug ?? rows[0].owner_slug?.trim()
    const ownerName = rows[0].owner_name?.trim()
    const ownerUrl = toUrl(rows[0].owner_url) ?? undefined
    if (ownerIdColumn == null && !ownerSlug && !ownerName) {
      throw new Error('owner_id, owner_slug ou owner_name manquant dans la première ligne')
    }

    let ownerId: number | undefined
    if (!options.dryRun) {
      const owner = await resolveImportOwner({ id: ownerIdColumn, slug: ownerSlug, name: ownerName, url: ownerUrl })
      ownerId = owner.id
      result.ownerId = owner.id
      result.ownerName = owner.name
      if (options.verbose) console.log(`  Owner "${owner.name}" id=${ownerId}`)
    } else if (ownerIdColumn != null || ownerSlug) {
      // En dry-run on vérifie l'identifiant stable — sans `name`, la résolution ne peut rien créer.
      const owner = await resolveImportOwner({ id: ownerIdColumn, slug: ownerSlug })
      if (options.verbose) console.log(`  [dry-run] Owner "${owner.name}" id=${owner.id}`)
    } else if (options.verbose) {
      console.log(`  [dry-run] Owner "${ownerName}"`)
    }

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]
      try {
        const name = row.name?.trim()
        if (!name) {
          result.skipped++
          continue
        }

        const sourceId = generateSourceId(row)
        if (options.verbose) console.log(`  [${rowIndex + 1}/${rows.length}] ${name} (${sourceId})`)

        // Check existing
        const existingSource = await db
          .select({ accommodationId: externalSources.accommodationId })
          .from(externalSources)
          .where(and(eq(externalSources.source, source), eq(externalSources.sourceId, sourceId)))
          .limit(1)

        // Geocoding: use lat/lng from CSV, fallback to API
        const lat = Number.parseFloat(row.latitude ?? '')
        const lng = Number.parseFloat(row.longitude ?? '')
        let geom: ReturnType<typeof sql> | null = null
        let resolvedAddress = row.address?.trim() ?? ''
        let resolvedCity = row.city?.trim() ?? ''
        let resolvedPostalCode = row.postal_code?.trim() ?? ''

        if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0) {
          geom = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`
          // Reverse geocode to fill missing city/address/postalCode
          if (!resolvedCity) {
            const rev = await reverseGeocode(lat, lng)
            if (rev) {
              resolvedCity = rev.city || resolvedCity
              resolvedAddress = rev.address || resolvedAddress
              resolvedPostalCode = rev.postalCode || resolvedPostalCode
              if (options.verbose) console.log(`    Reverse geocode → ${resolvedCity}`)
            }
          }
          // Forward geocode to fix ALL-CAPS city name
          if (resolvedCity && resolvedCity === resolvedCity.toUpperCase() && resolvedCity !== resolvedCity.toLowerCase()) {
            const geo = await geocodeAddressVerified(resolvedAddress, resolvedPostalCode, resolvedCity)
            if (geo?.city) {
              resolvedCity = geo.city
              if (options.verbose) console.log(`    Casse corrigée → ${resolvedCity}`)
            }
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

        // Ensure city exists in DB with correct casing
        let resolvedCityId: number | null = null
        if (resolvedPostalCode && resolvedCity) {
          const cityResult = await ensureCity(resolvedPostalCode, resolvedCity)
          resolvedCity = cityResult.name
          resolvedCityId = cityResult.id || null
        }

        // Images
        const imagesUrls = options.dryRun ? [] : await processImages(row.pictures ?? '', options.verbose)

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
          ownerId: ownerId!,
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
          // The CSV total can exceed the sum of categorized typologies; keep it over sync's recomputed value.
          await db
            .update(accommodations)
            .set({ nbTotalApartments: accommodationData.nbTotalApartments })
            .where(eq(accommodations.id, accommodationId))
          await db.delete(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, accommodationId))
          await db.insert(accommodationAddresses).values({ accommodationId, isMain: true, ...addressData })
          result.updated++
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

          await db.insert(externalSources).values({
            accommodationId: newAccommodation.id,
            source,
            sourceId,
          })
          result.created++
        }
      } catch (error) {
        const rowNum = rowIndex + 1
        // Extract the real DB error from error.cause (postgres-js / drizzle wrap the original error)
        const cause = error instanceof Error ? (error as unknown as { cause?: unknown }).cause : null
        const dbError = cause && typeof cause === 'object' && 'message' in cause ? String((cause as { message: string }).message) : null
        // Strip the SQL query dump from drizzle's error message
        const rawMessage = error instanceof Error ? error.message : String(error)
        const cleanMessage = rawMessage.replace(/Failed query:[\s\S]*/i, '').trim()
        const displayError = dbError || cleanMessage || rawMessage

        const rowContext = [
          row.address ? `address="${row.address}"` : null,
          row.city ? `city="${row.city}"` : null,
          row.postal_code ? `postal_code="${row.postal_code}"` : null,
          row.latitude ? `lat=${row.latitude}` : null,
          row.longitude ? `lng=${row.longitude}` : null,
          row.nb_total_apartments ? `nb_total=${row.nb_total_apartments}` : null,
          row.owner_name ? `owner="${row.owner_name}"` : null,
        ]
          .filter(Boolean)
          .join(', ')

        const msg = `Ligne ${rowNum} - ${row.name ?? '?'}: ${displayError}`
        result.errors.push(msg)
        console.error(`    ❌ ${msg}`)
        console.error(`       Contexte: ${rowContext}`)
        if (options.verbose) {
          // In verbose mode, show the full original error for deep debugging
          console.error(`       Message complet: ${rawMessage.slice(0, 500)}`)
        }
      }
    }

    return result
  },
}

export default command
