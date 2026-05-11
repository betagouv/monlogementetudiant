import { eq } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { closeDb, db } from '~/server/db'
import { accommodations } from '~/server/db/schema'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import {
  buildDisplaySourceId,
  buildMatchSourceId,
  buildResidenceLookup,
  CATEGORIES,
  type CrousResidenceRow,
  cleanNumber,
  getDuplicatedUairnes,
  getSheet,
  loadDbResidences,
  type MinMaxBounds,
  mapTypologie,
  mergeMinMaxBounds,
  normalizeText,
  summarizeBounds,
  type TypoCategory,
} from '../lib/crous-helpers'

type CrousTypologyRow = {
  code_crous?: number
  code_residence?: number
  typologie?: string
  loyer_min?: number | string
  loyer_max?: number | string
}

type ExpectedResidenceRents = {
  sourceId: string
  matchSourceId: string
  hasDuplicatedSourceId: boolean
  name: string
  normalizedName: string
  rents: Map<TypoCategory, MinMaxBounds>
}

type Options = {
  owner?: string
  dryRun?: boolean
  verbose?: boolean
  limit?: number
}

const RENT_FIELDS: Record<TypoCategory, { min: keyof typeof accommodations.$inferSelect; max: keyof typeof accommodations.$inferSelect }> =
  {
    t1: { min: 'priceMinT1', max: 'priceMaxT1' },
    t1bis: { min: 'priceMinT1Bis', max: 'priceMaxT1Bis' },
    t2: { min: 'priceMinT2', max: 'priceMaxT2' },
    t3: { min: 'priceMinT3', max: 'priceMaxT3' },
    t4: { min: 'priceMinT4', max: 'priceMaxT4' },
    t5: { min: 'priceMinT5', max: 'priceMaxT5' },
    t6: { min: 'priceMinT6', max: 'priceMaxT6' },
    t7more: { min: 'priceMinT7More', max: 'priceMaxT7More' },
  }

function loadExpectedRents(filePath: string, limit?: number): ExpectedResidenceRents[] {
  const workbook = XLSX.readFile(filePath)
  const residences = XLSX.utils.sheet_to_json<CrousResidenceRow>(getSheet(workbook, 'Liste residences', 0))
  const typologies = XLSX.utils.sheet_to_json<CrousTypologyRow>(getSheet(workbook, 'Liste types de lgt', 1))
  const duplicatedUairnes = getDuplicatedUairnes(residences)

  const rentsByResidence = new Map<string, Map<TypoCategory, MinMaxBounds>>()
  for (const row of typologies) {
    if (!row.code_residence) continue
    const key = `${row.code_crous ?? ''}:${row.code_residence}`
    const category = mapTypologie(row.typologie)
    const current = rentsByResidence.get(key) ?? new Map<TypoCategory, MinMaxBounds>()
    current.set(category, mergeMinMaxBounds(current.get(category), { min: cleanNumber(row.loyer_min), max: cleanNumber(row.loyer_max) }))
    rentsByResidence.set(key, current)
  }

  return residences
    .filter(
      (row): row is CrousResidenceRow & { code_residence: number; nom_residence: string } => !!row.code_residence && !!row.nom_residence,
    )
    .slice(0, limit)
    .map((row) => {
      const name = row.nom_residence.trim()
      return {
        sourceId: buildDisplaySourceId(row),
        matchSourceId: buildMatchSourceId(row, duplicatedUairnes),
        hasDuplicatedSourceId: !!row.uairne?.trim() && duplicatedUairnes.has(row.uairne.trim()),
        name,
        normalizedName: normalizeText(name),
        rents: rentsByResidence.get(`${row.code_crous ?? ''}:${row.code_residence}`) ?? new Map(),
      }
    })
}

function buildRentUpdate(rents: Map<TypoCategory, MinMaxBounds>): Record<string, number | null | Date> {
  const update: Record<string, number | null | Date> = {}
  const minRents: number[] = []

  for (const category of CATEGORIES) {
    const bounds = rents.get(category)
    const fields = RENT_FIELDS[category]
    update[fields.min] = bounds?.min ?? null
    update[fields.max] = bounds?.max ?? null
    if (bounds?.min != null) minRents.push(bounds.min)
  }

  update.priceMin = minRents.length > 0 ? Math.min(...minRents) : null
  update.updatedAt = new Date()
  return update
}

export async function importCrousRents(filePath: string, options: Options) {
  const result = { updated: 0, skipped: 0, errors: [] as string[] }

  try {
    const owner = options.owner ?? 'crous'
    const expectedResidences = loadExpectedRents(filePath, options.limit)
    const dbResidences = await loadDbResidences(owner)
    const { bySourceId, byName, bySlug } = buildResidenceLookup(dbResidences)

    console.log(`Import des loyers CROUS: ${expectedResidences.length} residences fichier, ${dbResidences.length} residences BDD.`)
    if (options.dryRun) console.log('(mode dry-run, aucune ecriture)')

    const pendingUpdates: Array<{ id: number; update: Record<string, number | null | Date> }> = []

    for (const expected of expectedResidences) {
      try {
        const bySource = bySourceId.get(expected.matchSourceId)
        const nameMatches = byName.get(expected.normalizedName) ?? []
        const byExpectedSlug = bySlug.get(generateSlug(expected.name))
        const byUniqueName = nameMatches.length === 1 ? nameMatches[0] : null
        const actual = expected.hasDuplicatedSourceId ? (byUniqueName ?? byExpectedSlug ?? null) : (bySource ?? byUniqueName)

        if (!actual) {
          result.skipped++
          if (options.verbose) console.log(`  Ignoree, residence introuvable: ${expected.name} (${expected.sourceId})`)
          continue
        }

        const hasRents = [...expected.rents.values()].some((b) => b.min != null || b.max != null)
        if (!hasRents) {
          result.skipped++
          if (options.verbose) console.log(`  Ignoree, aucun loyer: ${expected.name} (${expected.sourceId})`)
          continue
        }

        if (options.verbose) {
          console.log(`  ${options.dryRun ? '[dry-run] ' : ''}${actual.id} ${actual.slug}: ${summarizeBounds(expected.rents)}`)
        }

        pendingUpdates.push({ id: actual.id, update: buildRentUpdate(expected.rents) })
        result.updated++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        result.errors.push(`${expected.name} (${expected.sourceId}): ${message}`)
      }
    }

    if (!options.dryRun && pendingUpdates.length > 0) {
      await db.transaction(async (tx) => {
        for (const { id, update } of pendingUpdates) {
          await tx.update(accommodations).set(update).where(eq(accommodations.id, id))
        }
      })
    }

    console.log('\nImport loyers termine:')
    console.log(`  Mis a jour: ${result.updated}`)
    console.log(`  Ignores: ${result.skipped}`)
    if (result.errors.length > 0) {
      console.log(`  Erreurs: ${result.errors.length}`)
      for (const error of result.errors) console.log(`    - ${error}`)
    }

    if (result.errors.length > 0) process.exitCode = 1
  } finally {
    await closeDb()
  }
}
