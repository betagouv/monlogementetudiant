import { and, eq, or, sql } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { db } from '~/server/db'
import { accommodations, externalSources, owners } from '~/server/db/schema'

export type TypoCategory = 't1' | 't1bis' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7more'

export const CATEGORIES: TypoCategory[] = ['t1', 't1bis', 't2', 't3', 't4', 't5', 't6', 't7more']

export type MinMaxBounds = { min: number | null; max: number | null }

export type CrousResidenceRow = {
  code_crous?: number
  code_residence?: number
  nom_residence?: string
  uairne?: string
}

export type DbResidence = {
  id: number
  name: string
  slug: string
  externalReference: string | null
  sourceId: string | null
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

export function cleanNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value !== 'string') return null
  const parsed = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed)
}

export function minValue(a: number | null | undefined, b: number | null): number | null {
  const values = [a, b].filter((v): v is number => v != null)
  return values.length > 0 ? Math.min(...values) : null
}

export function maxValue(a: number | null | undefined, b: number | null): number | null {
  const values = [a, b].filter((v): v is number => v != null)
  return values.length > 0 ? Math.max(...values) : null
}

export function mergeMinMaxBounds(current: MinMaxBounds | undefined, next: MinMaxBounds): MinMaxBounds {
  return {
    min: minValue(current?.min, next.min),
    max: maxValue(current?.max, next.max),
  }
}

export function mapTypologie(typologie: string | undefined): TypoCategory {
  const value = (typologie ?? '').trim().toUpperCase()
  if (value === 'APT1' || value === 'APT1+' || value === 'CHAMBRE') return 't1'
  if (value === 'APT1BIS' || value === 'APT1BIS+') return 't1bis'
  if (value === 'APT2' || value === 'APT2+') return 't2'
  if (value === 'APT3' || value === 'APT3+') return 't3'
  if (value === 'APT4' || value === 'APT4+') return 't4'
  if (value === 'APT5' || value === 'APT5+') return 't5'
  if (value === 'APT6' || value === 'APT6+') return 't6'
  if (value === 'APT7' || value === 'APT7+') return 't7more'
  return 't1'
}

export function getSheet(workbook: XLSX.WorkBook, name: string, fallbackIndex: number): XLSX.WorkSheet {
  const normalizedName = normalizeText(name)
  const sheetName =
    workbook.SheetNames.find((candidate) => normalizeText(candidate) === normalizedName) ?? workbook.SheetNames[fallbackIndex]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Onglet XLSX introuvable: ${name}`)
  return sheet
}

export function buildDisplaySourceId(row: CrousResidenceRow): string {
  const uairne = row.uairne?.trim()
  if (uairne) return uairne
  return `${row.code_crous}-${row.code_residence}`
}

export function buildMatchSourceId(row: CrousResidenceRow, duplicatedUairnes: Set<string>): string {
  const uairne = row.uairne?.trim()
  if (uairne && !duplicatedUairnes.has(uairne)) return uairne
  return `${row.code_crous}-${row.code_residence}`
}

export function getDuplicatedUairnes(rows: CrousResidenceRow[]): Set<string> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const uairne = row.uairne?.trim()
    if (uairne) counts.set(uairne, (counts.get(uairne) ?? 0) + 1)
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([uairne]) => uairne))
}

export async function loadDbResidences(ownerNameOrSlug: string): Promise<DbResidence[]> {
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

export function buildResidenceLookup(dbResidences: DbResidence[]): {
  bySourceId: Map<string, DbResidence>
  byName: Map<string, DbResidence[]>
  bySlug: Map<string, DbResidence>
} {
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
  return { bySourceId, byName, bySlug }
}

export function summarizeBounds(data: Map<TypoCategory, MinMaxBounds>): string {
  return CATEGORIES.map((category) => {
    const bounds = data.get(category)
    if (!bounds || (bounds.min == null && bounds.max == null)) return null
    return `${category}=${bounds.min ?? '-'}-${bounds.max ?? '-'}`
  })
    .filter((v): v is string => v != null)
    .join(', ')
}
