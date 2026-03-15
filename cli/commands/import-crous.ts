import { and, eq, sql } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { accommodations, externalSources } from '../../src/server/db/schema'
import { computeDerivedFields, generateSlug } from '../../src/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '../../src/server/utils/slug'
import { db } from '../lib/db'
import { ensureCity, reverseGeocode } from '../lib/geocoder'
import type { ImportCommand, ImportOptions, ImportResult } from '../types'
import { getOrCreateOwner } from '../utils/get-or-create-owner'

const SOURCE = 'crous'
const OWNER_NAME = 'CROUS'

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

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&eacute;/gi, 'é')
    .replace(/&egrave;/gi, 'è')
    .replace(/&agrave;/gi, 'à')
    .replace(/&acirc;/gi, 'â')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&ucirc;/gi, 'û')
    .replace(/&iuml;/gi, 'ï')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&rsquo;/gi, '\u2019')
    .replace(/&lsquo;/gi, '\u2018')
    .replace(/&ldquo;/gi, '\u201C')
    .replace(/&rdquo;/gi, '\u201D')
    .replace(/&ndash;/gi, '\u2013')
    .replace(/&mdash;/gi, '\u2014')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&sup2;/gi, '\u00B2')
    .replace(/&[a-z]+;/gi, '')
    .replace(/\r\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseAddress(raw: string): { address: string; postalCode: string; city: string } {
  // Formats: "564, avenue Gaston Berger - 13621 AIX-en-PROVENCE CEDEX 1"
  //          "1 place du Recteur Jules Blache - 13013 Marseille"
  //          "10 rue Henri Poincaré -13388 Marseille"
  const match = raw.match(/^(.+?)\s*-\s*(\d{5})\s+(.+)$/)
  if (match) {
    let city = match[3].replace(/\s+cedex\s*\d*/i, '').trim()
    // Fix ALL-CAPS city: capitalize first letter of each word
    if (city === city.toUpperCase()) {
      city = city.toLowerCase().replace(/(^|[\s-])(\w)/g, (_, sep, ch) => sep + ch.toUpperCase())
    }
    return { address: match[1].trim(), postalCode: match[2], city }
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

  // Sheet 1: residences
  const wsResidences = wb.Sheets[wb.SheetNames[0]]
  const rawResidences = XLSX.utils.sheet_to_json<CrousResidence>(wsResidences)

  // Sheet 2: typologies
  const wsTypologies = wb.Sheets[wb.SheetNames[1]]
  const rawTypologies = XLSX.utils.sheet_to_json<CrousTypology>(wsTypologies)

  // Group typologies by code_residence
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

    const ownerId = options.dryRun ? 0 : await getOrCreateOwner(OWNER_NAME)
    if (options.verbose) console.log(`  Owner "${OWNER_NAME}" id=${ownerId}`)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      try {
        const name = item.nom_residence?.trim()
        if (!name) {
          result.skipped++
          continue
        }

        const sourceId = String(item.code_residence)
        if (options.verbose) console.log(`  [${i + 1}/${items.length}] ${name} (${sourceId})`)

        // Check existing
        const existingSource = await db
          .select({ accommodationId: externalSources.accommodationId })
          .from(externalSources)
          .where(and(eq(externalSources.source, SOURCE), eq(externalSources.sourceId, sourceId)))
          .limit(1)

        // Parse address
        const rawAddress = item.adresse_residence?.trim() ?? ''
        const parsed = parseAddress(rawAddress)

        // Geocoding: use lat/lng from XLSX
        const lat = item.latitude ?? 0
        const lng = item.longitude ?? 0
        let geom: ReturnType<typeof sql> | null = null
        let resolvedAddress = parsed.address
        let resolvedCity = parsed.city
        let resolvedPostalCode = parsed.postalCode

        if (lat !== 0 && lng !== 0) {
          geom = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`
          // If address parsing failed, reverse geocode
          if (!resolvedCity) {
            const rev = await reverseGeocode(lat, lng)
            if (rev) {
              resolvedCity = rev.city || resolvedCity
              resolvedAddress = rev.address || resolvedAddress
              resolvedPostalCode = rev.postalCode || resolvedPostalCode
              if (options.verbose) console.log(`    Reverse geocode → ${resolvedCity}`)
            }
          }
        }

        // Ensure city exists in DB
        if (resolvedPostalCode && resolvedCity) {
          resolvedCity = await ensureCity(resolvedPostalCode, resolvedCity)
        }

        // Description: strip HTML
        const description = item.description_residence ? stripHtml(item.description_residence) : null

        // Typology: aggregate from sheet 2
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

        const accommodationData = {
          name,
          slug: await findAvailableSlug(generateSlug(name), db, accommodations),
          description,
          address: resolvedAddress,
          city: resolvedCity,
          postalCode: resolvedPostalCode,
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
          imagesCount: 0,
          externalReference: sourceId,
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

    return result
  },
}

export default command
