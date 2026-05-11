import fs from 'node:fs/promises'
import { and, eq, or, sql } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { closeDb, db } from '~/server/db'
import { accommodations, externalSources, owners } from '~/server/db/schema'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import {
  buildDisplaySourceId,
  buildMatchSourceId,
  CATEGORIES,
  cleanNumber,
  getDuplicatedUairnes,
  getSheet,
  mapTypologie,
  maxValue,
  minValue,
  normalizeText,
  type TypoCategory,
} from '../lib/crous-helpers'

type CrousResidenceRow = {
  code_crous?: number
  nom_crous?: string
  code_residence?: number
  nom_residence?: string
  uairne?: string
}

type CrousTypologyRow = {
  code_crous?: number
  code_residence?: number
  nom_residence?: string
  typologie?: string
  surface_min?: number
  surface_max?: number
  loyer_min?: number
  loyer_max?: number
}

type Bounds = {
  loyerMin: number | null
  loyerMax: number | null
  surfaceMin: number | null
  surfaceMax: number | null
}

type ExpectedResidence = {
  sourceId: string
  matchSourceId: string
  hasDuplicatedSourceId: boolean
  codeCrous: number | null
  codeResidence: number
  name: string
  normalizedName: string
  typologies: Map<TypoCategory, Bounds>
}

type DbResidence = {
  id: number
  name: string
  slug: string
  externalReference: string | null
  sourceId: string | null
  typologies: Map<TypoCategory, Bounds>
}

type Difference = {
  status: 'different' | 'missing_in_db' | 'missing_in_file'
  sourceId: string
  dbId?: number
  dbSlug?: string
  residence: string
  field: string
  fileValue: string
  dbValue: string
  reason?: string
}

type Options = {
  owner?: string
  csv?: string
  json?: boolean
  verbose?: boolean
  limit?: number
  exitCode?: boolean
}

const DB_FIELDS: Record<
  TypoCategory,
  {
    loyerMin: keyof typeof accommodations.$inferSelect
    loyerMax: keyof typeof accommodations.$inferSelect
    surfaceMin: keyof typeof accommodations.$inferSelect
    surfaceMax: keyof typeof accommodations.$inferSelect
  }
> = {
  t1: { loyerMin: 'priceMinT1', loyerMax: 'priceMaxT1', surfaceMin: 'superficieMinT1', surfaceMax: 'superficieMaxT1' },
  t1bis: { loyerMin: 'priceMinT1Bis', loyerMax: 'priceMaxT1Bis', surfaceMin: 'superficieMinT1Bis', surfaceMax: 'superficieMaxT1Bis' },
  t2: { loyerMin: 'priceMinT2', loyerMax: 'priceMaxT2', surfaceMin: 'superficieMinT2', surfaceMax: 'superficieMaxT2' },
  t3: { loyerMin: 'priceMinT3', loyerMax: 'priceMaxT3', surfaceMin: 'superficieMinT3', surfaceMax: 'superficieMaxT3' },
  t4: { loyerMin: 'priceMinT4', loyerMax: 'priceMaxT4', surfaceMin: 'superficieMinT4', surfaceMax: 'superficieMaxT4' },
  t5: { loyerMin: 'priceMinT5', loyerMax: 'priceMaxT5', surfaceMin: 'superficieMinT5', surfaceMax: 'superficieMaxT5' },
  t6: { loyerMin: 'priceMinT6', loyerMax: 'priceMaxT6', surfaceMin: 'superficieMinT6', surfaceMax: 'superficieMaxT6' },
  t7more: {
    loyerMin: 'priceMinT7More',
    loyerMax: 'priceMaxT7More',
    surfaceMin: 'superficieMinT7More',
    surfaceMax: 'superficieMaxT7More',
  },
}

function formatValue(value: number | string | null | undefined): string {
  if (value == null || value === '') return '-'
  return String(value)
}

function titleCaseLikeSql(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase())
    .replace(/(^|\s)(Des)(\s|$)/g, '$1des$3')
    .replace(/(^|\s)(De)(\s|$)/g, '$1de$3')
    .replace(/(^|\s)(Du)(\s|$)/g, '$1du$3')
    .replace(/(^|\s)(En)(\s|$)/g, '$1en$3')
    .replace(/(^|\s)(Les)(\s|$)/g, '$1les$3')
    .replace(/(^|\s)(La)(\s|$)/g, '$1la$3')
    .replace(/(^|\s)(Le)(\s|$)/g, '$1le$3')
    .replace(/(^|\s)(Aux)(\s|$)/g, '$1aux$3')
    .replace(/(^|\s)(Sur)(\s|$)/g, '$1sur$3')
    .replace(/(^|\s)(Et)(\s|$)/g, '$1et$3')
    .replace(/(^|\s)(Pour)(\s|$)/g, '$1pour$3')
    .replace(/(^|\s)(L)([''])/g, '$1l$3')
    .replace(/(^|\s)(D)([''])/g, '$1d$3')
    .replace(/\s+/g, ' ')
    .trim()
}

function applyResidenceSqlNameNormalization(name: string): string | null {
  const trimmed = name.trim()
  if (!/^r[eé]sidences?\s/i.test(trimmed)) return null

  const keepResidence = /^r[eé]sidences?\s+(le|la|les|du|de|des|en|l['']|d[''])(\s|$)/i.test(trimmed)
  const body = trimmed.replace(/^r[eé]sidences?\s+/i, '')
  const pretty = titleCaseLikeSql(body)

  return keepResidence ? `Résidence ${pretty}`.trim() : pretty
}

function isResidenceSqlNameDiff(fileName: string, dbName: string): boolean {
  const normalized = applyResidenceSqlNameNormalization(fileName)
  return normalized != null && normalizeText(normalized) === normalizeText(dbName)
}

function mergeBounds(current: Bounds | undefined, next: Bounds): Bounds {
  return {
    loyerMin: minValue(current?.loyerMin, next.loyerMin),
    loyerMax: maxValue(current?.loyerMax, next.loyerMax),
    surfaceMin: minValue(current?.surfaceMin, next.surfaceMin),
    surfaceMax: maxValue(current?.surfaceMax, next.surfaceMax),
  }
}

function loadExpectedResidences(filePath: string, limit?: number): ExpectedResidence[] {
  const workbook = XLSX.readFile(filePath)
  const residencesSheet = getSheet(workbook, 'Liste residences', 0)
  const typologiesSheet = getSheet(workbook, 'Liste types de lgt', 1)

  const residences = XLSX.utils.sheet_to_json<CrousResidenceRow>(residencesSheet)
  const typologies = XLSX.utils.sheet_to_json<CrousTypologyRow>(typologiesSheet)
  const duplicatedUairnes = getDuplicatedUairnes(residences)
  const typologiesByResidence = new Map<string, Map<TypoCategory, Bounds>>()

  for (const row of typologies) {
    if (!row.code_residence) continue
    const key = `${row.code_crous ?? ''}:${row.code_residence}`
    const category = mapTypologie(row.typologie)
    const byCategory = typologiesByResidence.get(key) ?? new Map<TypoCategory, Bounds>()
    byCategory.set(
      category,
      mergeBounds(byCategory.get(category), {
        loyerMin: cleanNumber(row.loyer_min),
        loyerMax: cleanNumber(row.loyer_max),
        surfaceMin: cleanNumber(row.surface_min),
        surfaceMax: cleanNumber(row.surface_max),
      }),
    )
    typologiesByResidence.set(key, byCategory)
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
        codeCrous: row.code_crous ?? null,
        codeResidence: row.code_residence,
        name,
        normalizedName: normalizeText(name),
        typologies: typologiesByResidence.get(`${row.code_crous ?? ''}:${row.code_residence}`) ?? new Map(),
      }
    })
}

function getDbTypologies(row: typeof accommodations.$inferSelect): Map<TypoCategory, Bounds> {
  const typologies = new Map<TypoCategory, Bounds>()

  for (const category of CATEGORIES) {
    const fields = DB_FIELDS[category]
    const bounds = {
      loyerMin: cleanNumber(row[fields.loyerMin]),
      loyerMax: cleanNumber(row[fields.loyerMax]),
      surfaceMin: cleanNumber(row[fields.surfaceMin]),
      surfaceMax: cleanNumber(row[fields.surfaceMax]),
    }
    if (Object.values(bounds).some((value) => value != null)) {
      typologies.set(category, bounds)
    }
  }

  return typologies
}

function pushDifference(
  differences: Difference[],
  expected: ExpectedResidence,
  actual: DbResidence | null,
  field: string,
  fileValue: string,
  dbValue: string,
  reason?: string,
) {
  differences.push({
    status: actual ? 'different' : 'missing_in_db',
    sourceId: expected.sourceId,
    dbId: actual?.id,
    dbSlug: actual?.slug,
    residence: expected.name,
    field,
    fileValue,
    dbValue,
    reason,
  })
}

function compareResidence(expected: ExpectedResidence, actual: DbResidence | null): Difference[] {
  const differences: Difference[] = []

  if (!actual) {
    pushDifference(differences, expected, null, 'residence', 'presente', 'absente')
    return differences
  }

  if (normalizeText(expected.name) !== normalizeText(actual.name)) {
    pushDifference(
      differences,
      expected,
      actual,
      'nom_residence',
      expected.name,
      actual.name,
      isResidenceSqlNameDiff(expected.name, actual.name) ? 'name_normalized_by_residence_sql' : undefined,
    )
  }

  const expectedCategories = new Set(expected.typologies.keys())
  const actualCategories = new Set(actual.typologies.keys())

  for (const category of expectedCategories) {
    if (!actualCategories.has(category)) {
      pushDifference(differences, expected, actual, `${category}.typologie`, 'presente', 'absente')
    }
  }

  for (const category of actualCategories) {
    if (!expectedCategories.has(category)) {
      pushDifference(differences, expected, actual, `${category}.typologie`, 'absente', 'presente')
    }
  }

  for (const category of CATEGORIES) {
    const expectedBounds = expected.typologies.get(category)
    const actualBounds = actual.typologies.get(category)
    if (!expectedBounds && !actualBounds) continue

    for (const field of ['loyerMin', 'loyerMax', 'surfaceMin', 'surfaceMax'] as const) {
      const expectedValue = expectedBounds?.[field] ?? null
      const actualValue = actualBounds?.[field] ?? null
      if (expectedValue !== actualValue) {
        pushDifference(differences, expected, actual, `${category}.${field}`, formatValue(expectedValue), formatValue(actualValue))
      }
    }
  }

  return differences
}

function toCsv(differences: Difference[]): string {
  const headers = ['status', 'sourceId', 'dbId', 'dbSlug', 'residence', 'field', 'fileValue', 'dbValue', 'reason']
  const escapeCsv = (value: unknown) => `"${formatValue(value as string | number | null).replace(/"/g, '""')}"`
  return [
    headers.join(','),
    ...differences.map((row) => headers.map((header) => escapeCsv(row[header as keyof Difference])).join(',')),
  ].join('\n')
}

function printReport(differences: Difference[], verbose: boolean) {
  if (differences.length === 0) {
    console.log('Aucune incoherence detectee.')
    return
  }

  console.log(`\n${differences.length} incoherence(s) detectee(s):`)
  const rows = verbose ? differences : differences.slice(0, 100)
  console.table(
    rows.map((difference) => ({
      status: difference.status,
      sourceId: difference.sourceId,
      dbId: difference.dbId ?? '',
      residence: difference.residence,
      field: difference.field,
      fichier: difference.fileValue,
      bdd: difference.dbValue,
      reason: difference.reason ?? '',
    })),
  )

  if (!verbose && differences.length > rows.length) {
    console.log(`... ${differences.length - rows.length} incoherence(s) masquee(s). Relancer avec --verbose pour tout afficher.`)
  }
}

async function loadDbResidences(ownerNameOrSlug: string): Promise<DbResidence[]> {
  const [owner] = await db
    .select({ id: owners.id })
    .from(owners)
    .where(or(eq(sql`lower(${owners.slug})`, ownerNameOrSlug.toLowerCase()), eq(sql`lower(${owners.name})`, ownerNameOrSlug.toLowerCase())))
    .limit(1)

  if (!owner) {
    throw new Error(`Owner introuvable: ${ownerNameOrSlug}`)
  }

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
    typologies: getDbTypologies(accommodation),
  }))
}

export async function compareCrous(filePath: string, options: Options) {
  try {
    const owner = options.owner ?? 'crous'
    const expectedResidences = loadExpectedResidences(filePath, options.limit)
    const dbResidences = await loadDbResidences(owner)

    const bySourceId = new Map<string, DbResidence>()
    const byName = new Map<string, DbResidence[]>()
    const bySlug = new Map<string, DbResidence>()
    for (const residence of dbResidences) {
      if (residence.sourceId) bySourceId.set(residence.sourceId, residence)
      if (residence.externalReference) bySourceId.set(residence.externalReference, residence)
      const normalizedName = normalizeText(residence.name)
      const existing = byName.get(normalizedName)
      if (existing) existing.push(residence)
      else byName.set(normalizedName, [residence])
      bySlug.set(residence.slug, residence)
    }

    const matchedDbIds = new Set<number>()
    const differences: Difference[] = []

    for (const expected of expectedResidences) {
      const bySource = bySourceId.get(expected.matchSourceId)
      const nameMatches = byName.get(expected.normalizedName) ?? []
      const byExpectedSlug = bySlug.get(generateSlug(expected.name))
      const byUniqueName = nameMatches.length === 1 ? nameMatches[0] : null
      const actual = expected.hasDuplicatedSourceId ? (byUniqueName ?? byExpectedSlug ?? bySource ?? null) : (bySource ?? byUniqueName)
      if (actual) matchedDbIds.add(actual.id)
      differences.push(...compareResidence(expected, actual))
    }

    for (const residence of dbResidences) {
      if (matchedDbIds.has(residence.id)) continue
      differences.push({
        status: 'missing_in_file',
        sourceId: residence.sourceId ?? residence.externalReference ?? '',
        dbId: residence.id,
        dbSlug: residence.slug,
        residence: residence.name,
        field: 'residence',
        fileValue: 'absente',
        dbValue: 'presente',
      })
    }

    if (options.json) {
      console.log(JSON.stringify(differences, null, 2))
    } else {
      console.log(`${expectedResidences.length} residences fichier comparees a ${dbResidences.length} residences BDD (owner=${owner}).`)
      printReport(differences, options.verbose ?? false)
    }

    if (options.csv) {
      await fs.writeFile(options.csv, toCsv(differences), 'utf8')
      console.log(`Rapport CSV ecrit: ${options.csv}`)
    }

    if (options.exitCode && differences.length > 0) {
      process.exitCode = 1
    }
  } finally {
    await closeDb()
  }
}
