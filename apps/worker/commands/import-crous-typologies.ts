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
  getDuplicatedUairnes,
  getSheetRows,
  loadDbResidences,
  mapTypologie,
  normalizeText,
  readWorkbook,
  type TypoCategory,
} from '../lib/crous-helpers'

type CrousTypologyRow = {
  code_crous?: number
  code_residence?: number
  nom_lgt?: string
  typologie?: string
}

type ExpectedResidenceTypologies = {
  sourceId: string
  matchSourceId: string
  hasDuplicatedSourceId: boolean
  name: string
  normalizedName: string
  counts: Map<TypoCategory, number>
  colivingCount: number
}

type Options = {
  owner?: string
  dryRun?: boolean
  verbose?: boolean
  limit?: number
  replace?: boolean
}

function isColivingTypology(row: CrousTypologyRow): boolean {
  const typologie = row.typologie?.trim().toUpperCase() ?? ''
  const name = row.nom_lgt?.trim().toUpperCase() ?? ''
  return typologie.endsWith('+') || name.includes('COLOCATION')
}

async function loadExpectedTypologies(filePath: string, limit?: number): Promise<ExpectedResidenceTypologies[]> {
  const workbook = await readWorkbook(filePath)
  const residences = getSheetRows<CrousResidenceRow>(workbook, 'Liste residences', 0)
  const typologies = getSheetRows<CrousTypologyRow>(workbook, 'Liste types de lgt', 1)
  const duplicatedUairnes = getDuplicatedUairnes(residences)

  const countsByResidence = new Map<string, Map<TypoCategory, number>>()
  const colivingByResidence = new Map<string, number>()

  for (const row of typologies) {
    if (!row.code_residence) continue

    const key = `${row.code_crous ?? ''}:${row.code_residence}`
    const category = mapTypologie(row.typologie)
    const counts = countsByResidence.get(key) ?? new Map<TypoCategory, number>()
    counts.set(category, (counts.get(category) ?? 0) + 1)
    countsByResidence.set(key, counts)

    if (isColivingTypology(row)) {
      colivingByResidence.set(key, (colivingByResidence.get(key) ?? 0) + 1)
    }
  }

  return residences
    .filter(
      (row): row is CrousResidenceRow & { code_residence: number; nom_residence: string } => !!row.code_residence && !!row.nom_residence,
    )
    .slice(0, limit)
    .map((row) => {
      const name = row.nom_residence.trim()
      const key = `${row.code_crous ?? ''}:${row.code_residence}`
      return {
        sourceId: buildDisplaySourceId(row),
        matchSourceId: buildMatchSourceId(row, duplicatedUairnes),
        hasDuplicatedSourceId: !!row.uairne?.trim() && duplicatedUairnes.has(row.uairne.trim()),
        name,
        normalizedName: normalizeText(name),
        counts: countsByResidence.get(key) ?? new Map(),
        colivingCount: colivingByResidence.get(key) ?? 0,
      }
    })
}

// Counts present overwrite; absent counts are left untouched unless `replace` clears them to null.
function buildCountPatches(counts: Map<TypoCategory, number>, options: { replace?: boolean }): TypologyPatch[] {
  const patches: TypologyPatch[] = []
  for (const category of CATEGORIES) {
    const count = counts.get(category)
    if (count != null) patches.push({ type: CATEGORY_TO_TYPE[category], nbTotal: count })
    else if (options.replace) patches.push({ type: CATEGORY_TO_TYPE[category], nbTotal: null })
  }
  return patches
}

// nbColivingApartments is a real accommodation column (not a typology field), set alongside updatedAt.
function buildAccommodationUpdate(colivingCount: number, options: { replace?: boolean }): Record<string, number | null | Date> {
  const update: Record<string, number | null | Date> = { updatedAt: new Date() }
  if (colivingCount > 0) update.nbColivingApartments = colivingCount
  else if (options.replace) update.nbColivingApartments = null
  return update
}

function summarizeCounts(counts: Map<TypoCategory, number>, colivingCount: number): string {
  const typologies = CATEGORIES.map((category) => {
    const count = counts.get(category)
    return count ? `${category}=${count}` : null
  })
    .filter((value): value is string => value != null)
    .join(', ')
  return `${typologies}${colivingCount ? `, coloc=${colivingCount}` : ''}`
}

export async function importCrousTypologies(filePath: string, options: Options) {
  const result = { updated: 0, skipped: 0, errors: [] as string[] }

  try {
    const owner = options.owner ?? 'crous'
    const expectedResidences = await loadExpectedTypologies(filePath, options.limit)
    const dbResidences = await loadDbResidences(owner)
    const { bySourceId, byName, bySlug } = buildResidenceLookup(dbResidences)

    console.log(`Import des typologies CROUS: ${expectedResidences.length} residences fichier, ${dbResidences.length} residences BDD.`)
    if (options.dryRun) console.log('(mode dry-run, aucune ecriture)')

    const pendingUpdates: Array<{ id: number; accUpdate: Record<string, number | null | Date>; patches: TypologyPatch[] }> = []

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

        const hasTypologies = expected.counts.size > 0
        if (!hasTypologies) {
          result.skipped++
          if (options.verbose) console.log(`  Ignoree, aucune typologie: ${expected.name} (${expected.sourceId})`)
          continue
        }

        if (options.verbose) {
          console.log(
            `  ${options.dryRun ? '[dry-run] ' : ''}${actual.id} ${actual.slug}: ${summarizeCounts(expected.counts, expected.colivingCount)}`,
          )
        }

        pendingUpdates.push({
          id: actual.id,
          accUpdate: buildAccommodationUpdate(expected.colivingCount, options),
          patches: buildCountPatches(expected.counts, options),
        })
        result.updated++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        result.errors.push(`${expected.name} (${expected.sourceId}): ${message}`)
      }
    }

    if (!options.dryRun && pendingUpdates.length > 0) {
      await db.transaction(async (tx) => {
        for (const { id, accUpdate, patches } of pendingUpdates) {
          await tx.update(accommodations).set(accUpdate).where(eq(accommodations.id, id))
          // Merge the new typology counts into existing child rows (prices/surfaces preserved).
          await mergeTypologies(tx, id, patches)
        }
      })
    }

    console.log('\nImport typologies termine:')
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
