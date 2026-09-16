import { eq } from 'drizzle-orm'
import { closeDb, db } from '~/server/db'
import { accommodations } from '~/server/db/schema'
import { mergeTypologies, type TypologyPatch } from '~/server/lib/typologies'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import {
  buildDisplaySourceId,
  buildMatchSourceId,
  buildResidenceLookup,
  CATEGORIES,
  CATEGORY_TO_TYPE,
  type CrousResidenceRow,
  cleanNumber,
  getDuplicatedUairnes,
  getSheetRows,
  loadDbResidences,
  type MinMaxBounds,
  mapTypologie,
  mergeMinMaxBounds,
  normalizeText,
  readWorkbook,
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

async function loadExpectedRents(filePath: string, limit?: number): Promise<ExpectedResidenceRents[]> {
  const workbook = await readWorkbook(filePath)
  const residences = getSheetRows<CrousResidenceRow>(workbook, 'Liste residences', 0)
  const typologies = getSheetRows<CrousTypologyRow>(workbook, 'Liste types de lgt', 1)
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

function buildRentPatches(rents: Map<TypoCategory, MinMaxBounds>): TypologyPatch[] {
  return CATEGORIES.map((category) => {
    const bounds = rents.get(category)
    return { type: CATEGORY_TO_TYPE[category], priceMin: bounds?.min ?? null, priceMax: bounds?.max ?? null }
  })
}

export async function importCrousRents(filePath: string, options: Options) {
  const result = { updated: 0, skipped: 0, errors: [] as string[] }

  try {
    const owner = options.owner ?? 'crous'
    const expectedResidences = await loadExpectedRents(filePath, options.limit)
    const dbResidences = await loadDbResidences(owner)
    const { bySourceId, byName, bySlug } = buildResidenceLookup(dbResidences)

    console.log(`Import des loyers CROUS: ${expectedResidences.length} residences fichier, ${dbResidences.length} residences BDD.`)
    if (options.dryRun) console.log('(mode dry-run, aucune ecriture)')

    const pendingUpdates: Array<{ id: number; patches: TypologyPatch[] }> = []

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

        pendingUpdates.push({ id: actual.id, patches: buildRentPatches(expected.rents) })
        result.updated++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        result.errors.push(`${expected.name} (${expected.sourceId}): ${message}`)
      }
    }

    if (!options.dryRun && pendingUpdates.length > 0) {
      await db.transaction(async (tx) => {
        for (const { id, patches } of pendingUpdates) {
          await tx.update(accommodations).set({ updatedAt: new Date() }).where(eq(accommodations.id, id))
          // Merge the new rent bounds into existing typology child rows (counts/surfaces preserved);
          // recomputes the parent priceMin aggregate from the updated child rows.
          await mergeTypologies(tx, id, patches)
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
