import { and, eq, sql } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { sanitizeHTML } from '~/utils/sanitize-html'
import { accommodations, externalSources } from '../../src/server/db/schema'
import { computeDerivedFields, generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import { db } from '../lib/db'
import { ensureCity, reverseGeocode } from '../lib/geocoder'
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

type TypoCategory = 't1' | 't1bis' | 't2' | 't3' | 't4' | 't5' | 't6'

function mapTypologie(typo: string): TypoCategory {
  const t = typo.toUpperCase()
  if (t === 'APT1BIS' || t === 'APT1BIS+') return 't1bis'
  if (t === 'CHAMBRE' || t === 'APT1' || t === 'APT1+') return 't1'
  if (t === 'APT2' || t === 'APT2+') return 't2'
  if (t === 'APT3' || t === 'APT3+') return 't3'
  if (t === 'APT4' || t === 'APT4+') return 't4'
  if (t === 'APT5' || t === 'APT5+') return 't5'
  if (t === 'APT6' || t === 'APT6+') return 't6'
  return 't1'
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
  const byCategory = new Map<TypoCategory, { mins: number[]; maxes: number[]; count: number }>()

  for (const row of rows) {
    const cat = mapTypologie(row.typologie)
    let entry = byCategory.get(cat)
    if (!entry) {
      entry = { mins: [], maxes: [], count: 0 }
      byCategory.set(cat, entry)
    }
    entry.count++
    if (row.loyer_min != null && row.loyer_min > 0) entry.mins.push(Math.round(row.loyer_min))
    if (row.loyer_max != null && row.loyer_max > 0) entry.maxes.push(Math.round(row.loyer_max))
  }

  const minOf = (nums: number[]) => (nums.length > 0 ? Math.min(...nums) : null)
  const maxOf = (nums: number[]) => (nums.length > 0 ? Math.max(...nums) : null)
  const get = (cat: TypoCategory) => byCategory.get(cat)

  return {
    priceMinT1: minOf(get('t1')?.mins ?? []),
    priceMaxT1: maxOf(get('t1')?.maxes ?? []),
    priceMinT1Bis: minOf(get('t1bis')?.mins ?? []),
    priceMaxT1Bis: maxOf(get('t1bis')?.maxes ?? []),
    priceMinT2: minOf(get('t2')?.mins ?? []),
    priceMaxT2: maxOf(get('t2')?.maxes ?? []),
    priceMinT3: minOf(get('t3')?.mins ?? []),
    priceMaxT3: maxOf(get('t3')?.maxes ?? []),
    priceMinT4: minOf(get('t4')?.mins ?? []),
    priceMaxT4: maxOf(get('t4')?.maxes ?? []),
    priceMinT5: minOf(get('t5')?.mins ?? []),
    priceMaxT5: maxOf(get('t5')?.maxes ?? []),
    priceMinT6: minOf(get('t6')?.mins ?? []),
    priceMaxT6: maxOf(get('t6')?.maxes ?? []),
  }
}

function loadXlsx(filePath: string): { residences: CrousResidence[]; typologiesByResidence: Map<number, CrousTypology[]> } {
  const wb = XLSX.readFile(filePath)

  const wsResidences = wb.Sheets[wb.SheetNames[0]]
  const rawResidences = XLSX.utils.sheet_to_json<CrousResidence>(wsResidences)

  const wsTypologies = wb.Sheets[wb.SheetNames[1]]
  const rawTypologies = XLSX.utils.sheet_to_json<CrousTypology>(wsTypologies)

  const typologiesByResidence = new Map<number, CrousTypology[]>()
  for (const t of rawTypologies) {
    const code = t.code_residence
    if (!typologiesByResidence.has(code)) {
      typologiesByResidence.set(code, [])
    }
    typologiesByResidence.get(code)!.push(t)
  }

  return { residences: rawResidences, typologiesByResidence }
}

async function findExistingAccommodation(sourceId: string, name: string, ownerId: number): Promise<{ id: number; slug: string } | null> {
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

        const sourceId = item.uairne?.trim() || `${item.code_crous}-${item.code_residence}`
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

        const typoRows = typologiesByResidence.get(item.code_residence) ?? []
        const typology = buildTypologyFromRows(typoRows)

        const derived = computeDerivedFields({
          price_min_t1: typology.priceMinT1,
          price_min_t1_bis: typology.priceMinT1Bis,
          price_min_t2: typology.priceMinT2,
          price_min_t3: typology.priceMinT3,
          price_min_t4: typology.priceMinT4,
          price_min_t5: typology.priceMinT5,
          price_min_t6: typology.priceMinT6,
        })

        // Check if residence already exists
        const existing = options.dryRun ? null : await findExistingAccommodation(sourceId, name, ownerId)

        if (options.dryRun) {
          if (options.verbose) console.log(`    [dry-run] Création`)
          result.created++
          continue
        }

        // Common fields for both insert and update
        const baseFields = {
          name,
          description: item.description_residence ? sanitizeHTML(item.description_residence) : null,
          address: resolvedAddress,
          residenceType: 'residence-etudiante',
          target_audience: 'etudiants' as const,
          published: true,
          available: true,
          ...(geom ? { geom } : {}),
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
          priceMin: derived.priceMin,
          externalReference: sourceId,
          externalUrl: CROUS_EXTERNAL_URL,
          ownerId,
          updatedAt: new Date(),
        }
        const slug = await findAvailableSlug(generateSlug(name), db, accommodations)

        if (existing) {
          // UPDATE — keep existing slug, images, etc.
          const [updated] = await db
            .update(accommodations)
            .set({
              ...baseFields,
              ...(resolvedCityId ? { cityId: resolvedCityId } : {}),
              ...(resolvedPostalCode ? { postalCode: resolvedPostalCode } : {}),
            })
            .where(eq(accommodations.id, existing.id))
            .returning({
              slug: accommodations.slug,
              priceMinT1: accommodations.priceMinT1,
              name: accommodations.name,
            })

          if (options.verbose) {
            console.log(`    Mise à jour id=${existing.id}, name =${updated.name} slug=${updated.slug} priceMinT1=${updated.priceMinT1}`)
          }

          // Backfill external_sources if needed
          await db.insert(externalSources).values({ accommodationId: existing.id, source: SOURCE, sourceId }).onConflictDoNothing()

          if (resolvedCity) {
            processedEntries.push({ slug: updated.slug, city: resolvedCity })
          }
          result.updated++
        } else {
          const [created] = await db
            .insert(accommodations)
            .values({
              ...baseFields,
              slug,
              cityId: resolvedCityId,
              postalCode: resolvedPostalCode || '00000',
              imagesCount: 0,
              createdAt: new Date(),
            })
            .returning({ id: accommodations.id, slug: accommodations.slug })

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
    const baseUrl = process.env.BASE_URL
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
