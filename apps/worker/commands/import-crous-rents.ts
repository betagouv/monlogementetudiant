import fs from 'node:fs/promises'
import { eq, inArray } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodations, accommodationTypologies } from '~/server/db/schema'
import {
  groupTypologiesByAccommodation,
  mergeTypologies,
  mergeTypologyPatches,
  type TypologyDraft,
  type TypologyPatch,
  typologyDraft,
} from '~/server/lib/typologies'
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
  report?: string
}

type PendingUpdate = { id: number; slug: string; sourceId: string; patches: TypologyPatch[] }

type ReportRow = {
  sourceId: string
  id: number
  slug: string
  type: string
  price_min_avant: number | null
  price_min_apres: number | null
  price_max_avant: number | null
  price_max_apres: number | null
  action: 'creee' | 'supprimee' | 'mise_a_jour' | 'inchangee'
}

const TYPE_ORDER = CATEGORIES.map((category) => CATEGORY_TO_TYPE[category])

/**
 * Prédit, pour chaque typologie des résidences à mettre à jour, l'état exact après merge
 * (mêmes patches et même fonction de merge que l'écriture) — c'est le rapport avant/après
 * qu'on relit manuellement avant de lancer l'import en réel.
 */
async function buildReportRows(pendingUpdates: PendingUpdate[]): Promise<ReportRow[]> {
  if (pendingUpdates.length === 0) return []

  const currentRows = await db
    .select()
    .from(accommodationTypologies)
    .where(
      inArray(
        accommodationTypologies.accommodationId,
        pendingUpdates.map((update) => update.id),
      ),
    )
  const currentByAccommodation = groupTypologiesByAccommodation(currentRows)

  const report: ReportRow[] = []
  for (const update of pendingUpdates) {
    const current = (currentByAccommodation.get(update.id) ?? []).map((row) => typologyDraft(row.type, row))
    const merged = mergeTypologyPatches(current, update.patches)
    const currentByType = new Map<string, TypologyDraft>(current.map((draft) => [draft.type, draft]))
    const mergedByType = new Map<string, TypologyDraft>(merged.map((draft) => [draft.type, draft]))

    for (const type of TYPE_ORDER) {
      const avant = currentByType.get(type)
      const apres = mergedByType.get(type)
      if (!avant && !apres) continue
      const action = !avant
        ? 'creee'
        : !apres
          ? 'supprimee'
          : avant.priceMin === apres.priceMin && avant.priceMax === apres.priceMax
            ? 'inchangee'
            : 'mise_a_jour'
      report.push({
        sourceId: update.sourceId,
        id: update.id,
        slug: update.slug,
        type,
        price_min_avant: avant?.priceMin ?? null,
        price_min_apres: apres?.priceMin ?? null,
        price_max_avant: avant?.priceMax ?? null,
        price_max_apres: apres?.priceMax ?? null,
        action,
      })
    }
  }
  return report
}

function reportToCsv(rows: ReportRow[]): string {
  const headers = ['sourceId', 'id', 'slug', 'type', 'price_min_avant', 'price_min_apres', 'price_max_avant', 'price_max_apres', 'action']
  const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCsv(row[header as keyof ReportRow])).join(','))].join('\n')
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

// Simple mise a jour de prix : seules les typologies presentes dans le fichier sont patchees,
// les autres lignes (y compris leurs prix existants) ne sont pas touchees.
function buildRentPatches(rents: Map<TypoCategory, MinMaxBounds>): TypologyPatch[] {
  return CATEGORIES.flatMap((category) => {
    const bounds = rents.get(category)
    if (!bounds || (bounds.min == null && bounds.max == null)) return []
    return [{ type: CATEGORY_TO_TYPE[category], priceMin: bounds.min, priceMax: bounds.max }]
  })
}

export async function importCrousRents(filePath: string, options: Options) {
  const result = { updated: 0, skipped: 0, errors: [] as string[] }

  const owner = options.owner ?? 'crous'
  const expectedResidences = await loadExpectedRents(filePath, options.limit)
  const dbResidences = await loadDbResidences(owner)
  const { bySourceId, byName, bySlug } = buildResidenceLookup(dbResidences)

  console.log(`Import des loyers CROUS: ${expectedResidences.length} residences fichier, ${dbResidences.length} residences BDD.`)
  if (options.dryRun) console.log('(mode dry-run, aucune ecriture)')

  const pendingUpdates: PendingUpdate[] = []

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

      pendingUpdates.push({ id: actual.id, slug: actual.slug, sourceId: expected.sourceId, patches: buildRentPatches(expected.rents) })
      result.updated++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.errors.push(`${expected.name} (${expected.sourceId}): ${message}`)
    }
  }

  if (options.report) {
    const reportRows = await buildReportRows(pendingUpdates)
    await fs.writeFile(options.report, reportToCsv(reportRows), 'utf8')
    console.log(`Rapport avant/apres ecrit: ${options.report} (${reportRows.length} lignes)`)
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
}
