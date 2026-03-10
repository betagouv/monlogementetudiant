import * as fs from 'node:fs'
import * as path from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import { accommodations, externalSources, owners } from '../../src/server/db/schema'
import { generateAccommodationKey, uploadFile } from '../../src/server/services/s3'
import { computeDerivedFields, generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import { db } from '../lib/db'
import { ensureCity, geocodeAddress, reverseGeocode } from '../lib/geocoder'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'

interface CsvRow {
  [key: string]: string
}

function toDigit(value: string | undefined, canBeZero = false): number | null {
  if (!value) return null
  const cleaned = value.replace(/€/g, '').replace(/,/g, '.').replace(/\s/g, '').trim()
  if (cleaned === '') return null
  const num = Number.parseInt(cleaned, 10)
  if (Number.isNaN(num)) return null
  if (num === 0 && !canBeZero) return null
  return num
}

function toBool(value: string | undefined): boolean | null {
  if (!value || value.trim() === '') return null
  const v = value.trim().toLowerCase()
  return ['oui', 'vrai', 'true', '1', 'yes'].includes(v)
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ';') {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function splitCsvRows(content: string): string[] {
  const rows: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          current += '""'
          i++
        } else {
          inQuotes = false
          current += ch
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
      current += ch
    } else if (ch === '\n') {
      const trimmed = current.replace(/\r$/, '')
      if (trimmed !== '') rows.push(trimmed)
      current = ''
    } else {
      current += ch
    }
  }
  const trimmed = current.replace(/\r$/, '')
  if (trimmed !== '') rows.push(trimmed)
  return rows
}

function parseCsv(filePath: string, limit?: number): CsvRow[] {
  let content = fs.readFileSync(filePath, 'utf-8')
  // Strip BOM
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }

  const lines = splitCsvRows(content)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    if (limit && rows.length >= limit) break
    const fields = parseCsvLine(lines[i])
    const row: CsvRow = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j]?.trim() ?? ''
    }
    rows.push(row)
  }

  return rows
}

async function getOrCreateOwner(name: string, url?: string): Promise<number> {
  const existing = await db.select().from(owners).where(eq(owners.name, name)).limit(1)
  if (existing[0]) return existing[0].id

  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const [created] = await db
    .insert(owners)
    .values({ name, slug, url: url || null })
    .returning({ id: owners.id })
  return created.id
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

  for (const url of urls) {
    try {
      const host = new URL(url).hostname
      if (host === 's3.gra.io.cloud.ovh.net' || host.endsWith('.s3.gra.io.cloud.ovh.net')) {
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

function generateSourceId(row: CsvRow): string {
  if (row.code && row.code.trim() !== '') return row.code.trim()
  const key = `${row.name ?? ''}|${row.address ?? ''}|${row.postal_code ?? ''}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
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

    // Get or create owner from first row
    const ownerName = rows[0].owner_name?.trim()
    const ownerUrl = rows[0].owner_url?.trim()
    if (!ownerName) {
      throw new Error('owner_name manquant dans la première ligne')
    }

    let ownerId: number | undefined
    if (!options.dryRun) {
      ownerId = await getOrCreateOwner(ownerName, ownerUrl)
      if (options.verbose) console.log(`  Owner "${ownerName}" id=${ownerId}`)
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
        let geom: ReturnType<typeof sql> = sql`NULL::geometry`
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
            const fullAddress = `${resolvedAddress}, ${resolvedPostalCode} ${resolvedCity}`
            const geo = await geocodeAddress(fullAddress)
            if (geo?.city) {
              resolvedCity = geo.city
              if (options.verbose) console.log(`    Casse corrigée → ${resolvedCity}`)
            }
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

        // Ensure city exists in DB with correct casing
        if (resolvedPostalCode && resolvedCity) {
          resolvedCity = await ensureCity(resolvedPostalCode, resolvedCity)
        }

        // Images
        const imagesUrls = options.dryRun ? [] : await processImages(row.pictures ?? '', options.verbose)

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
          slug: await findAvailableSlug(generateSlug(name), db, accommodations),
          description: row.description?.trim() || null,
          address: resolvedAddress,
          city: resolvedCity,
          postalCode: resolvedPostalCode,
          residenceType: row.residence_type?.trim() || null,
          target_audience: 'etudiants' as const,
          published: true,
          available: derived.available,
          geom,
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
          kitchenType: row.kitchen_type?.trim() || null,
          desk: toBool(row.desk),
          cookingPlates: toBool(row.cooking_plates),
          microwave: toBool(row.microwave),
          refrigerator: toBool(row.refrigerator),
          bathroom: row.bathroom?.trim() || null,
          acceptWaitingList: toBool(row.accept_waiting_list),
          scholarshipHoldersPriority: toBool(row.scholarship_holders_priority),
          imagesUrls: imagesUrls.length > 0 ? imagesUrls : null,
          imagesCount: derived.imagesCount,
          externalUrl: row.owner_url?.trim() || null,
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
          await db.update(accommodations).set(accommodationData).where(eq(accommodations.id, existingSource[0].accommodationId))
          result.updated++
        } else {
          const [newAccommodation] = await db
            .insert(accommodations)
            .values({ ...accommodationData, createdAt: new Date() })
            .returning({ id: accommodations.id })

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
