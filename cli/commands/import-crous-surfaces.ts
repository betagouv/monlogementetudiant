import { and, eq, or, sql } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { closeDb, db } from '~/server/db'
import { accommodations, externalSources, owners } from '~/server/db/schema'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'

type TypoCategory = 't1' | 't1bis' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7more'

type CrousResidenceRow = {
  code_crous?: number
  code_residence?: number
  nom_residence?: string
  uairne?: string
}

type CrousTypologyRow = {
  code_crous?: number
  code_residence?: number
  typologie?: string
  surface_min?: number | string
  surface_max?: number | string
}

type SurfaceBounds = {
  min: number | null
  max: number | null
}

type ExpectedResidenceSurfaces = {
  sourceId: string
  matchSourceId: string
  hasDuplicatedSourceId: boolean
  name: string
  surfaces: Map<TypoCategory, SurfaceBounds>
}

type DbResidence = {
  id: number
  name: string
  slug: string
  externalReference: string | null
  sourceId: string | null
}

type Options = {
  owner?: string
  dryRun?: boolean
  verbose?: boolean
  limit?: number
}

const CATEGORIES: TypoCategory[] = ['t1', 't1bis', 't2', 't3', 't4', 't5', 't6', 't7more']

const SURFACE_FIELDS: Record<
  TypoCategory,
  {
    min: string
    max: string
  }
> = {
  t1: { min: 'superficieMinT1', max: 'superficieMaxT1' },
  t1bis: { min: 'superficieMinT1Bis', max: 'superficieMaxT1Bis' },
  t2: { min: 'superficieMinT2', max: 'superficieMaxT2' },
  t3: { min: 'superficieMinT3', max: 'superficieMaxT3' },
  t4: { min: 'superficieMinT4', max: 'superficieMaxT4' },
  t5: { min: 'superficieMinT5', max: 'superficieMaxT5' },
  t6: { min: 'superficieMinT6', max: 'superficieMaxT6' },
  t7more: { min: 'superficieMinT7More', max: 'superficieMaxT7More' },
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value !== 'string') return null

  const parsed = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed)
}

function minValue(a: number | null | undefined, b: number | null): number | null {
  const values = [a, b].filter((value): value is number => value != null)
  return values.length > 0 ? Math.min(...values) : null
}

function maxValue(a: number | null | undefined, b: number | null): number | null {
  const values = [a, b].filter((value): value is number => value != null)
  return values.length > 0 ? Math.max(...values) : null
}

function mergeBounds(current: SurfaceBounds | undefined, next: SurfaceBounds): SurfaceBounds {
  return {
    min: minValue(current?.min, next.min),
    max: maxValue(current?.max, next.max),
  }
}

function mapTypologie(typologie: string | undefined): TypoCategory {
  const value = (typologie ?? '').trim().toUpperCase()
  if (value === 'APT1BIS' || value === 'APT1BIS+') return 't1bis'
  if (value === 'APT2' || value === 'APT2+') return 't2'
  if (value === 'APT3' || value === 'APT3+') return 't3'
  if (value === 'APT4' || value === 'APT4+') return 't4'
  if (value === 'APT5' || value === 'APT5+') return 't5'
  if (value === 'APT6' || value === 'APT6+') return 't6'
  if (value === 'APT7' || value === 'APT7+') return 't7more'
  return 't1'
}

function getSheet(workbook: XLSX.WorkBook, name: string, fallbackIndex: number): XLSX.WorkSheet {
  const normalizedName = normalizeText(name)
  const sheetName =
    workbook.SheetNames.find((candidate) => normalizeText(candidate) === normalizedName) ?? workbook.SheetNames[fallbackIndex]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Onglet XLSX introuvable: ${name}`)
  return sheet
}

function buildDisplaySourceId(row: CrousResidenceRow): string {
  const uairne = row.uairne?.trim()
  if (uairne) return uairne
  return `${row.code_crous}-${row.code_residence}`
}

function buildMatchSourceId(row: CrousResidenceRow, duplicatedUairnes: Set<string>): string {
  const uairne = row.uairne?.trim()
  if (uairne && !duplicatedUairnes.has(uairne)) return uairne
  return `${row.code_crous}-${row.code_residence}`
}

function getDuplicatedUairnes(rows: CrousResidenceRow[]): Set<string> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const uairne = row.uairne?.trim()
    if (uairne) counts.set(uairne, (counts.get(uairne) ?? 0) + 1)
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([uairne]) => uairne))
}

function loadExpectedSurfaces(filePath: string, limit?: number): ExpectedResidenceSurfaces[] {
  const workbook = XLSX.readFile(filePath)
  const residences = XLSX.utils.sheet_to_json<CrousResidenceRow>(getSheet(workbook, 'Liste residences', 0))
  const typologies = XLSX.utils.sheet_to_json<CrousTypologyRow>(getSheet(workbook, 'Liste types de lgt', 1))
  const duplicatedUairnes = getDuplicatedUairnes(residences)

  const surfacesByResidence = new Map<string, Map<TypoCategory, SurfaceBounds>>()
  for (const row of typologies) {
    if (!row.code_residence) continue

    const key = `${row.code_crous ?? ''}:${row.code_residence}`
    const category = mapTypologie(row.typologie)
    const current = surfacesByResidence.get(key) ?? new Map<TypoCategory, SurfaceBounds>()

    current.set(
      category,
      mergeBounds(current.get(category), {
        min: cleanNumber(row.surface_min),
        max: cleanNumber(row.surface_max),
      }),
    )
    surfacesByResidence.set(key, current)
  }

  return residences
    .filter(
      (row): row is CrousResidenceRow & { code_residence: number; nom_residence: string } => !!row.code_residence && !!row.nom_residence,
    )
    .slice(0, limit)
    .map((row) => ({
      sourceId: buildDisplaySourceId(row),
      matchSourceId: buildMatchSourceId(row, duplicatedUairnes),
      hasDuplicatedSourceId: !!row.uairne?.trim() && duplicatedUairnes.has(row.uairne.trim()),
      name: row.nom_residence.trim(),
      surfaces: surfacesByResidence.get(`${row.code_crous ?? ''}:${row.code_residence}`) ?? new Map(),
    }))
}

async function loadDbResidences(ownerNameOrSlug: string): Promise<DbResidence[]> {
  const [owner] = await db
    .select({ id: owners.id })
    .from(owners)
    .where(or(eq(sql`lower(${owners.slug})`, ownerNameOrSlug.toLowerCase()), eq(sql`lower(${owners.name})`, ownerNameOrSlug.toLowerCase())))
    .limit(1)

  if (!owner) throw new Error(`Owner introuvable: ${ownerNameOrSlug}`)

  const rows = await db
    .select({ accommodation: accommodations, sourceId: externalSources.sourceId })
    .from(accommodations)
    .leftJoin(externalSources, and(eq(externalSources.accommodationId, accommodations.id), eq(externalSources.source, 'crous')))
    .where(eq(accommodations.ownerId, owner.id))

  return rows.map(({ accommodation, sourceId }) => ({
    id: accommodation.id,
    name: accommodation.name,
    slug: accommodation.slug,
    externalReference: accommodation.externalReference,
    sourceId,
  }))
}

function buildSurfaceUpdate(surfaces: Map<TypoCategory, SurfaceBounds>): Record<string, number | null | Date> {
  const update: Record<string, number | null | Date> = {}

  for (const category of CATEGORIES) {
    const bounds = surfaces.get(category)
    const fields = SURFACE_FIELDS[category]
    update[fields.min] = bounds?.min ?? null
    update[fields.max] = bounds?.max ?? null
  }

  update.updatedAt = new Date()
  return update
}

function summarizeSurfaces(surfaces: Map<TypoCategory, SurfaceBounds>): string {
  return CATEGORIES.map((category) => {
    const bounds = surfaces.get(category)
    if (!bounds || (bounds.min == null && bounds.max == null)) return null
    return `${category}=${bounds.min ?? '-'}-${bounds.max ?? '-'}`
  })
    .filter((value): value is string => value != null)
    .join(', ')
}

export async function importCrousSurfaces(filePath: string, options: Options) {
  const result = { updated: 0, skipped: 0, errors: [] as string[] }

  try {
    const owner = options.owner ?? 'crous'
    const expectedResidences = loadExpectedSurfaces(filePath, options.limit)
    const dbResidences = await loadDbResidences(owner)

    const bySourceId = new Map<string, DbResidence>()
    const byName = new Map<string, DbResidence[]>()
    const bySlug = new Map<string, DbResidence>()
    for (const residence of dbResidences) {
      if (residence.sourceId) bySourceId.set(residence.sourceId, residence)
      if (residence.externalReference) bySourceId.set(residence.externalReference, residence)

      const normalizedName = normalizeText(residence.name)
      byName.set(normalizedName, [...(byName.get(normalizedName) ?? []), residence])
      bySlug.set(residence.slug, residence)
    }

    console.log(`Import des superficies CROUS: ${expectedResidences.length} residences fichier, ${dbResidences.length} residences BDD.`)
    if (options.dryRun) console.log('(mode dry-run, aucune ecriture)')

    for (const expected of expectedResidences) {
      try {
        const bySource = bySourceId.get(expected.matchSourceId)
        const nameMatches = byName.get(normalizeText(expected.name)) ?? []
        const byExpectedSlug = bySlug.get(generateSlug(expected.name))
        const byUniqueName = nameMatches.length === 1 ? nameMatches[0] : null
        const actual = expected.hasDuplicatedSourceId ? (byUniqueName ?? byExpectedSlug ?? null) : (bySource ?? byUniqueName)

        if (!actual) {
          result.skipped++
          if (options.verbose) console.log(`  Ignoree, residence introuvable: ${expected.name} (${expected.sourceId})`)
          continue
        }

        const hasSurfaces = [...expected.surfaces.values()].some((bounds) => bounds.min != null || bounds.max != null)
        if (!hasSurfaces) {
          result.skipped++
          if (options.verbose) console.log(`  Ignoree, aucune superficie: ${expected.name} (${expected.sourceId})`)
          continue
        }

        const update = buildSurfaceUpdate(expected.surfaces)
        if (options.verbose) {
          console.log(`  ${options.dryRun ? '[dry-run] ' : ''}${actual.id} ${actual.slug}: ${summarizeSurfaces(expected.surfaces)}`)
        }

        if (!options.dryRun) {
          await db.update(accommodations).set(update).where(eq(accommodations.id, actual.id))
        }
        result.updated++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        result.errors.push(`${expected.name} (${expected.sourceId}): ${message}`)
      }
    }

    console.log('\nImport superficies termine:')
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
