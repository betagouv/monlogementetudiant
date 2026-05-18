import { and, eq, sql } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { db } from '~/server/db'
import { env } from '~/server/env'
import { ensureCity, reverseGeocode } from '~/server/lib/import/geocoder'
import { sanitizeHTML } from '~/utils/sanitize-html'
import { accommodationAddresses, accommodations, externalSources } from '../../src/server/db/schema'
import { computeDerivedFields, generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import {
  buildMatchSourceId,
  cleanNumber,
  getDuplicatedUairnes,
  getSheet,
  mapTypologie,
  maxValue,
  minValue,
  normalizeText,
  type TypoCategory,
} from '../lib/crous-helpers'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'
import { getOrCreateOwner } from '../utils/get-or-create-owner'

const SOURCE = 'crous'
const OWNER_NAME = 'CROUS'
const CROUS_EXTERNAL_URL = 'https://trouverunlogement.lescrous.fr/'

interface CrousResidence {
  code_crous: number
  nom_crous: string
  secteur?: string
  code_residence: number
  nom_residence: string
  uairne?: string
  description_residence?: string
  adresse_residence?: string
  longitude?: number
  latitude?: number
}

interface CrousTypology {
  code_crous?: number
  code_residence: number
  code_lgt: number
  nom_lgt: string
  description_lgt?: string
  typologie: string
  surface_min?: number
  surface_max?: number
  loyer_min?: number
  loyer_max?: number
}

function normalizeCity(city: string): string {
  return city
    .replace(/^\d{5}\s+/, '') // Strip leading INSEE code
    .replace(/\s+c[ée]dex\s*\d*/i, '')
    .replace(/\.+$/, '') // Strip trailing dots
    .trim()
}

function parseAddress(raw: string): { address: string; postalCode: string; city: string } {
  const matchDash = raw.match(/^(.+?)\s*-\s*(\d{5})\s+(.+)$/)
  if (matchDash) {
    return { address: matchDash[1].trim(), postalCode: matchDash[2], city: normalizeCity(matchDash[3]) }
  }
  const matchInline = raw.match(/^(.+?)\s+(\d{5})\s+(.+)$/)
  if (matchInline) {
    return { address: matchInline[1].trim(), postalCode: matchInline[2], city: normalizeCity(matchInline[3]) }
  }
  return { address: raw, postalCode: '', city: '' }
}

function buildTypologyFromRows(rows: CrousTypology[]) {
  const byCategory = new Map<
    TypoCategory,
    { rentMin: number | null; rentMax: number | null; surfaceMin: number | null; surfaceMax: number | null; count: number }
  >()
  let colivingCount = 0

  for (const row of rows) {
    const cat = mapTypologie(row.typologie)
    let entry = byCategory.get(cat)
    if (!entry) {
      entry = { rentMin: null, rentMax: null, surfaceMin: null, surfaceMax: null, count: 0 }
      byCategory.set(cat, entry)
    }
    entry.count++
    entry.rentMin = minValue(entry.rentMin, cleanNumber(row.loyer_min))
    entry.rentMax = maxValue(entry.rentMax, cleanNumber(row.loyer_max))
    entry.surfaceMin = minValue(entry.surfaceMin, cleanNumber(row.surface_min))
    entry.surfaceMax = maxValue(entry.surfaceMax, cleanNumber(row.surface_max))

    const typologie = row.typologie?.trim().toUpperCase() ?? ''
    const name = row.nom_lgt?.trim().toUpperCase() ?? ''
    if (typologie.endsWith('+') || name.includes('COLOCATION')) colivingCount++
  }

  const get = (cat: TypoCategory) => byCategory.get(cat)

  return {
    nbT1: get('t1')?.count ?? null,
    nbT1Bis: get('t1bis')?.count ?? null,
    nbT2: get('t2')?.count ?? null,
    nbT3: get('t3')?.count ?? null,
    nbT4: get('t4')?.count ?? null,
    nbT5: get('t5')?.count ?? null,
    nbT6: get('t6')?.count ?? null,
    nbT7More: get('t7more')?.count ?? null,
    nbColivingApartments: colivingCount || null,
    priceMinT1: get('t1')?.rentMin ?? null,
    priceMaxT1: get('t1')?.rentMax ?? null,
    priceMinT1Bis: get('t1bis')?.rentMin ?? null,
    priceMaxT1Bis: get('t1bis')?.rentMax ?? null,
    priceMinT2: get('t2')?.rentMin ?? null,
    priceMaxT2: get('t2')?.rentMax ?? null,
    priceMinT3: get('t3')?.rentMin ?? null,
    priceMaxT3: get('t3')?.rentMax ?? null,
    priceMinT4: get('t4')?.rentMin ?? null,
    priceMaxT4: get('t4')?.rentMax ?? null,
    priceMinT5: get('t5')?.rentMin ?? null,
    priceMaxT5: get('t5')?.rentMax ?? null,
    priceMinT6: get('t6')?.rentMin ?? null,
    priceMaxT6: get('t6')?.rentMax ?? null,
    priceMinT7More: get('t7more')?.rentMin ?? null,
    priceMaxT7More: get('t7more')?.rentMax ?? null,
    superficieMinT1: get('t1')?.surfaceMin ?? null,
    superficieMaxT1: get('t1')?.surfaceMax ?? null,
    superficieMinT1Bis: get('t1bis')?.surfaceMin ?? null,
    superficieMaxT1Bis: get('t1bis')?.surfaceMax ?? null,
    superficieMinT2: get('t2')?.surfaceMin ?? null,
    superficieMaxT2: get('t2')?.surfaceMax ?? null,
    superficieMinT3: get('t3')?.surfaceMin ?? null,
    superficieMaxT3: get('t3')?.surfaceMax ?? null,
    superficieMinT4: get('t4')?.surfaceMin ?? null,
    superficieMaxT4: get('t4')?.surfaceMax ?? null,
    superficieMinT5: get('t5')?.surfaceMin ?? null,
    superficieMaxT5: get('t5')?.surfaceMax ?? null,
    superficieMinT6: get('t6')?.surfaceMin ?? null,
    superficieMaxT6: get('t6')?.surfaceMax ?? null,
    superficieMinT7More: get('t7more')?.surfaceMin ?? null,
    superficieMaxT7More: get('t7more')?.surfaceMax ?? null,
  }
}

function buildResidenceKey(row: { code_crous?: number; code_residence: number }) {
  return `${row.code_crous ?? ''}:${row.code_residence}`
}

function loadXlsx(filePath: string): { residences: CrousResidence[]; typologiesByResidence: Map<string, CrousTypology[]> } {
  const wb = XLSX.readFile(filePath)

  const wsResidences = getSheet(wb, 'Liste residences', 0)
  const rawResidences = XLSX.utils.sheet_to_json<CrousResidence>(wsResidences)

  const wsTypologies = getSheet(wb, 'Liste types de lgt', 1)
  const rawTypologies = XLSX.utils.sheet_to_json<CrousTypology>(wsTypologies)

  const typologiesByResidence = new Map<string, CrousTypology[]>()
  for (const t of rawTypologies) {
    const code = buildResidenceKey(t)
    if (!typologiesByResidence.has(code)) {
      typologiesByResidence.set(code, [])
    }
    typologiesByResidence.get(code)!.push(t)
  }

  return { residences: rawResidences, typologiesByResidence }
}

async function findExistingAccommodation({
  sourceId,
  name,
  ownerId,
}: {
  sourceId: string
  name: string
  ownerId: number
}): Promise<{ id: number; slug: string } | null> {
  // 1. Match by external_sources table
  const bySource = await db
    .select({ accommodationId: externalSources.accommodationId })
    .from(externalSources)
    .where(and(eq(externalSources.source, SOURCE), eq(externalSources.sourceId, sourceId)))
    .limit(1)

  if (bySource[0]) {
    const [acc] = await db
      .select({ id: accommodations.id, slug: accommodations.slug })
      .from(accommodations)
      .where(eq(accommodations.id, bySource[0].accommodationId))
      .limit(1)
    if (acc) return acc
  }

  // 2. Match by externalReference + owner
  const byRef = await db
    .select({ id: accommodations.id, slug: accommodations.slug })
    .from(accommodations)
    .where(and(eq(accommodations.externalReference, sourceId), eq(accommodations.ownerId, ownerId)))
    .limit(1)
  if (byRef[0]) return byRef[0]

  const normalizedName = normalizeText(name)
  const byName = await db
    .select({ id: accommodations.id, slug: accommodations.slug, name: accommodations.name })
    .from(accommodations)
    .where(eq(accommodations.ownerId, ownerId))

  const nameMatches = byName.filter((acc) => normalizeText(acc.name) === normalizedName)
  if (nameMatches.length === 1) return { id: nameMatches[0].id, slug: nameMatches[0].slug }

  const expectedSlug = generateSlug(name)
  const bySlug = byName.find((acc) => acc.slug === expectedSlug)
  if (bySlug) return { id: bySlug.id, slug: bySlug.slug }

  return null
}

async function healthCheck(entries: { slug: string; city: string }[], baseUrl: string, verbose: boolean): Promise<string[]> {
  const failed: string[] = []
  console.log(`\n  Healthcheck: ${entries.length} résidences...`)

  const batchSize = 10
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(async ({ slug, city }) => {
        const url = `${baseUrl}/trouver-un-logement-etudiant/ville/${encodeURIComponent(city)}/${slug}`
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
        if (!res.ok) return { slug, city, status: res.status }
        return null
      }),
    )

    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      if (r.status === 'fulfilled' && r.value) {
        failed.push(r.value.slug)
        if (verbose) console.log(`    ❌ ${r.value.slug} → ${r.value.status}`)
      } else if (r.status === 'rejected') {
        failed.push(batch[j].slug)
        if (verbose) console.log(`    ❌ ${batch[j].slug} → ${r.reason}`)
      }
    }
  }

  return failed
}

const command: ImportCommand = {
  name: 'crous',
  description: 'Import des résidences CROUS depuis un fichier XLSX',

  async execute(options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

    if (!options.file) {
      throw new Error("Option --file requise pour l'import CROUS")
    }

    const { residences, typologiesByResidence } = loadXlsx(options.file)
    const duplicatedUairnes = getDuplicatedUairnes(residences)
    const items = options.limit ? residences.slice(0, options.limit) : residences
    console.log(`  ${items.length} résidences chargées (${typologiesByResidence.size} résidences avec typologies)`)

    const ownerId = await getOrCreateOwner(OWNER_NAME)
    if (options.verbose) console.log(`  Owner "${OWNER_NAME}" id=${ownerId}`)

    const processedEntries: { slug: string; city: string }[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      try {
        const name = item.nom_residence?.trim()
        if (!name) {
          result.skipped++
          continue
        }

        const sourceId = buildMatchSourceId(item, duplicatedUairnes)
        if (options.verbose) console.log(`  [${i + 1}/${items.length}] ${name} (${sourceId})`)

        // Parse address
        const rawAddress = item.adresse_residence?.trim() ?? ''
        const parsed = parseAddress(rawAddress)

        const lat = item.latitude ?? 0
        const lng = item.longitude ?? 0
        let geom: ReturnType<typeof sql> | null = null
        let resolvedAddress = parsed.address
        let resolvedCity = parsed.city
        let resolvedPostalCode = parsed.postalCode

        if (lat !== 0 && lng !== 0) {
          geom = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`
          const rev = await reverseGeocode(lat, lng)
          if (rev) {
            if (!resolvedCity) resolvedCity = rev.city
            if (!resolvedAddress) resolvedAddress = rev.address
            if (!resolvedPostalCode) resolvedPostalCode = rev.postalCode
            if (options.verbose && rev.city) console.log(`    Reverse geocode → ${rev.city}`)
          }
        }

        resolvedCity = normalizeCity(resolvedCity)

        let resolvedCityId: number | null = null
        if (resolvedPostalCode) {
          const cityResult = await ensureCity(resolvedPostalCode, resolvedCity || name)
          resolvedCity = cityResult.name
          resolvedCityId = cityResult.id || null
        }

        if (!resolvedCity && options.verbose) {
          console.log(`    ⚠ Ville non résolue pour "${name}" (adresse: "${rawAddress}")`)
        }

        const typoRows = typologiesByResidence.get(buildResidenceKey(item)) ?? []
        const typology = buildTypologyFromRows(typoRows)

        const derived = computeDerivedFields({
          nb_t1: typology.nbT1,
          nb_t1_bis: typology.nbT1Bis,
          nb_t2: typology.nbT2,
          nb_t3: typology.nbT3,
          nb_t4: typology.nbT4,
          nb_t5: typology.nbT5,
          nb_t6: typology.nbT6,
          nb_t7_more: typology.nbT7More,
          price_min_t1: typology.priceMinT1,
          price_min_t1_bis: typology.priceMinT1Bis,
          price_min_t2: typology.priceMinT2,
          price_min_t3: typology.priceMinT3,
          price_min_t4: typology.priceMinT4,
          price_min_t5: typology.priceMinT5,
          price_min_t6: typology.priceMinT6,
          price_min_t7_more: typology.priceMinT7More,
        })

        // Check if residence already exists. Dry-run still resolves the match so the
        // preview reports whether the command would create or update.
        const existing = await findExistingAccommodation({ sourceId, name, ownerId })

        if (options.dryRun) {
          if (existing) {
            if (options.verbose) console.log(`    [dry-run] Mise à jour id=${existing.id}, slug=${existing.slug}`)
            result.updated++
          } else {
            if (options.verbose) console.log(`    [dry-run] Création`)
            result.created++
          }
          continue
        }

        // Address fields for accommodation_address table
        const addressData = {
          address: resolvedAddress,
          postalCode: resolvedPostalCode || '00000',
          cityId: resolvedCityId,
          ...(geom ? { geom } : {}),
        }

        // Common fields for both insert and update
        const baseFields = {
          name,
          description: item.description_residence ? sanitizeHTML(item.description_residence) : null,
          residenceType: 'residence-etudiante',
          target_audience: 'etudiants' as const,
          published: true,
          available: true,
          nbTotalApartments: derived.nbTotalApartments,
          nbColivingApartments: typology.nbColivingApartments,
          nbT1: typology.nbT1,
          nbT1Bis: typology.nbT1Bis,
          nbT2: typology.nbT2,
          nbT3: typology.nbT3,
          nbT4: typology.nbT4,
          nbT5: typology.nbT5,
          nbT6: typology.nbT6,
          nbT7More: typology.nbT7More,
          priceMinT1: typology.priceMinT1,
          priceMaxT1: typology.priceMaxT1,
          priceMinT1Bis: typology.priceMinT1Bis,
          priceMaxT1Bis: typology.priceMaxT1Bis,
          priceMinT2: typology.priceMinT2,
          priceMaxT2: typology.priceMaxT2,
          priceMinT3: typology.priceMinT3,
          priceMaxT3: typology.priceMaxT3,
          priceMinT4: typology.priceMinT4,
          priceMaxT4: typology.priceMaxT4,
          priceMinT5: typology.priceMinT5,
          priceMaxT5: typology.priceMaxT5,
          priceMinT6: typology.priceMinT6,
          priceMaxT6: typology.priceMaxT6,
          priceMinT7More: typology.priceMinT7More,
          priceMaxT7More: typology.priceMaxT7More,
          superficieMinT1: typology.superficieMinT1,
          superficieMaxT1: typology.superficieMaxT1,
          superficieMinT1Bis: typology.superficieMinT1Bis,
          superficieMaxT1Bis: typology.superficieMaxT1Bis,
          superficieMinT2: typology.superficieMinT2,
          superficieMaxT2: typology.superficieMaxT2,
          superficieMinT3: typology.superficieMinT3,
          superficieMaxT3: typology.superficieMaxT3,
          superficieMinT4: typology.superficieMinT4,
          superficieMaxT4: typology.superficieMaxT4,
          superficieMinT5: typology.superficieMinT5,
          superficieMaxT5: typology.superficieMaxT5,
          superficieMinT6: typology.superficieMinT6,
          superficieMaxT6: typology.superficieMaxT6,
          superficieMinT7More: typology.superficieMinT7More,
          superficieMaxT7More: typology.superficieMaxT7More,
          priceMin: derived.priceMin,
          externalReference: sourceId,
          externalUrl: CROUS_EXTERNAL_URL,
          ownerId,
          updatedAt: new Date(),
        }
        if (existing) {
          // UPDATE — keep existing slug, images, etc.
          const [updated] = await db.update(accommodations).set(baseFields).where(eq(accommodations.id, existing.id)).returning({
            slug: accommodations.slug,
            priceMinT1: accommodations.priceMinT1,
            name: accommodations.name,
          })

          // Upsert address
          await db.delete(accommodationAddresses).where(eq(accommodationAddresses.accommodationId, existing.id))
          await db.insert(accommodationAddresses).values({ accommodationId: existing.id, isMain: true, ...addressData })

          if (options.verbose) {
            console.log(`    Mise à jour id=${existing.id}, name =${updated.name} slug=${updated.slug} priceMinT1=${updated.priceMinT1}`)
          }

          // Backfill/update external_sources if needed.
          await db
            .insert(externalSources)
            .values({ accommodationId: existing.id, source: SOURCE, sourceId })
            .onConflictDoUpdate({
              target: [externalSources.source, externalSources.accommodationId],
              set: { sourceId },
            })

          if (resolvedCity) {
            processedEntries.push({ slug: updated.slug, city: resolvedCity })
          }
          result.updated++
        } else {
          const slug = await findAvailableSlug(generateSlug(name), db, accommodations)
          const [created] = await db
            .insert(accommodations)
            .values({
              ...baseFields,
              slug,
              imagesCount: 0,
              createdAt: new Date(),
            })
            .returning({ id: accommodations.id, slug: accommodations.slug })

          await db.insert(accommodationAddresses).values({ accommodationId: created.id, isMain: true, ...addressData })

          await db.insert(externalSources).values({
            accommodationId: created.id,
            source: SOURCE,
            sourceId,
          })

          if (resolvedCity) {
            processedEntries.push({ slug: created.slug, city: resolvedCity })
          }
          result.created++
        }
      } catch (error) {
        const rowNum = i + 1
        const cause = error instanceof Error ? (error as unknown as { cause?: unknown }).cause : null
        const dbError = cause && typeof cause === 'object' && 'message' in cause ? String((cause as { message: string }).message) : null
        const rawMessage = error instanceof Error ? error.message : String(error)
        const cleanMessage = rawMessage.replace(/Failed query:[\s\S]*/i, '').trim()
        const displayError = dbError || cleanMessage || rawMessage

        const msg = `Ligne ${rowNum} - ${item.nom_residence ?? '?'} (${item.code_residence}): ${displayError}`
        result.errors.push(msg)
        console.error(`    ❌ ${msg}`)
        if (options.verbose) {
          console.error(`       Adresse: ${item.adresse_residence}`)
          console.error(`       Message complet: ${rawMessage.slice(0, 500)}`)
        }
      }
    }

    // Healthcheck
    const baseUrl = env.BASE_URL
    if (baseUrl && processedEntries.length > 0 && !options.dryRun) {
      const failed = await healthCheck(processedEntries, baseUrl, options.verbose ?? false)
      if (failed.length > 0) {
        console.log(`\n  ⚠️  ${failed.length} résidences en erreur :`)
        for (const slug of failed) {
          const entry = processedEntries.find((e) => e.slug === slug)
          const city = entry ? encodeURIComponent(entry.city) : '_'
          console.log(`    - ${baseUrl}/trouver-un-logement-etudiant/ville/${city}/${slug}`)
        }
      } else {
        console.log(`  ✅ Toutes les ${processedEntries.length} résidences répondent en 200`)
      }
    } else if (!baseUrl) {
      console.log(`\n  ⚠️  BASE_URL non définie, healthcheck ignoré`)
    }

    return result
  },
}

export default command
