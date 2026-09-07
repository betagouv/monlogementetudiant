import { and, eq, notInArray, sql } from 'drizzle-orm'
import type { TypologyType } from '~/schemas/accommodations/typology'
import { db } from '~/server/db'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { isPerPersonTypology } from '~/utils/is-per-person-typology'

type Database = typeof db
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type DbOrTx = Database | Transaction

type TypologyRow = typeof accommodationTypologies.$inferSelect

/** Value of the keyed `typologies` object exposed in API responses (camelCase, like ZTypologyView). */
export type TTypologyView = {
  priceMin: number | null
  priceMax: number | null
  superficieMin: number | null
  superficieMax: number | null
  nbTotal: number | null
  nbAvailable: number | null
  colocation: boolean
}

/** Build the keyed `typologies` object from child rows, indexed by the typology type (= suffix). */
export function typologiesByType(rows: TypologyRow[]): Partial<Record<TypologyType, TTypologyView>> {
  const out: Partial<Record<TypologyType, TTypologyView>> = {}
  for (const r of rows) {
    out[r.type] = {
      priceMin: r.priceMin,
      priceMax: r.priceMax,
      superficieMin: r.superficieMin,
      superficieMax: r.superficieMax,
      nbTotal: r.nbTotal,
      nbAvailable: r.nbAvailable,
      colocation: r.colocation,
    }
  }
  return out
}

/**
 * Group typology rows by their parent accommodation id. Used by list endpoints that batch-fetch
 * the typologies for a page of rows (one `inArray` query) then hydrate each accommodation.
 */
export function groupTypologiesByAccommodation<T extends { accommodationId: number }>(rows: T[]): Map<number, T[]> {
  const byAccommodation = new Map<number, T[]>()
  for (const row of rows) {
    const list = byAccommodation.get(row.accommodationId) ?? []
    list.push(row)
    byAccommodation.set(row.accommodationId, list)
  }
  return byAccommodation
}

/** Parent aggregates derived from a set of typologies (denormalized on `accommodation`). */
export type TypologyAggregates = {
  nbTotalApartments: number | null
  priceMin: number | null
  priceMax: number | null
  nbAvailableApartments: number | null
}

type AggregateInput = {
  priceMin?: number | null
  priceMax?: number | null
  nbTotal?: number | null
  nbAvailable?: number | null
}

/**
 * Pure aggregate computation from a typology array. `nbAvailableApartments` stays null when every
 * availability is null, so the search ordering keeps "unknown availability" distinct from "0 available".
 */
export function typologyAggregates(typologies: AggregateInput[]): TypologyAggregates {
  const totals = typologies.map((t) => t.nbTotal).filter((v): v is number => v != null)
  const mins = typologies.map((t) => t.priceMin).filter((v): v is number => v != null && v > 0)
  const maxs = typologies.map((t) => t.priceMax).filter((v): v is number => v != null && v > 0)
  const avails = typologies.map((t) => t.nbAvailable).filter((v): v is number => v != null)

  return {
    nbTotalApartments: totals.length > 0 ? totals.reduce((a, b) => a + b, 0) : null,
    priceMin: mins.length > 0 ? Math.min(...mins) : null,
    priceMax: maxs.length > 0 ? Math.max(...maxs) : null,
    nbAvailableApartments: avails.length > 0 ? avails.reduce((a, b) => a + b, 0) : null,
  }
}

// A typology to persist. Numeric fields are nullable so "unknown" values (e.g. null availability)
// are preserved as NULL. The domain TTypology (strict numbers) is assignable to this.
export type TypologyDraft = {
  type: TypologyType
  priceMin: number | null
  priceMax: number | null
  superficieMin: number | null
  superficieMax: number | null
  nbTotal: number | null
  nbAvailable: number | null
  colocation: boolean
}

/** A partial typology update keyed by `type`: only the provided fields are applied (see mergeTypologies). */
export type TypologyPatch = { type: TypologyType } & Partial<Omit<TypologyDraft, 'type'>>

/**
 * Build a TypologyDraft from partial fields. Missing numeric fields default to null (preserving
 * "unknown"); `colocation` defaults to isPerPersonTypology(type). This is the ergonomic primitive
 * importers and test fixtures use to declare typologies — there is no flat camelCase intermediate.
 */
export function typologyDraft(type: TypologyType, fields: Partial<Omit<TypologyDraft, 'type'>> = {}): TypologyDraft {
  return {
    type,
    priceMin: fields.priceMin ?? null,
    priceMax: fields.priceMax ?? null,
    superficieMin: fields.superficieMin ?? null,
    superficieMax: fields.superficieMax ?? null,
    nbTotal: fields.nbTotal ?? null,
    nbAvailable: fields.nbAvailable ?? null,
    colocation: fields.colocation ?? isPerPersonTypology(type),
  }
}

/** A draft carries real data only if at least one numeric field is set; empty drafts are not persisted. */
function hasAnyValue(d: TypologyDraft): boolean {
  return [d.nbTotal, d.nbAvailable, d.priceMin, d.priceMax, d.superficieMin, d.superficieMax].some((v) => v != null)
}

function toRow(accommodationId: number, t: TypologyDraft): typeof accommodationTypologies.$inferInsert {
  return {
    accommodationId,
    type: t.type,
    priceMin: t.priceMin,
    priceMax: t.priceMax,
    superficieMin: t.superficieMin,
    superficieMax: t.superficieMax,
    nbTotal: t.nbTotal,
    nbAvailable: t.nbAvailable,
    colocation: t.colocation,
  }
}

/** Auteur de l'écriture, pour l'horodatage des disponibilités. Absent pour un import ou un script. */
export type PersistTypologiesOptions = { updatedBy?: string | null }

/**
 * Aligne les typologies d'une résidence sur `typologies` : les types fournis sont créés ou mis à
 * jour en place, les types absents sont supprimés.
 *
 * Historiquement un delete-then-insert, ce qui réattribuait un identifiant neuf à chaque
 * enregistrement — y compris quand rien ne changeait — et faisait perdre toute colonne portée par
 * la ligne. L'upsert conserve l'identité de la ligne, ce dont dépend l'horodatage des
 * disponibilités : sans lui, chaque enregistrement du formulaire, même sans toucher aux dispos,
 * remettrait le compteur à zéro.
 */
export async function persistTypologies(
  tx: DbOrTx,
  accommodationId: number,
  typologies: TypologyDraft[],
  options: PersistTypologiesOptions = {},
): Promise<void> {
  const keptTypes = typologies.map((t) => t.type)

  await tx
    .delete(accommodationTypologies)
    .where(
      keptTypes.length > 0
        ? and(eq(accommodationTypologies.accommodationId, accommodationId), notInArray(accommodationTypologies.type, keptTypes))
        : eq(accommodationTypologies.accommodationId, accommodationId),
    )

  if (typologies.length === 0) return

  const now = new Date()
  const updatedBy = options.updatedBy ?? null

  // Deux règles gouvernent l'horodatage, dans cet ordre :
  //
  // 1. une typologie sans disponibilité ne porte pas de date — dater une donnée absente n'aurait
  //    aucun sens ;
  // 2. seule une action de gestionnaire en pose une. Un import ou un script n'a pas d'auteur : il
  //    écrit la disponibilité sans toucher au suivi, et surtout sans effacer la trace laissée par
  //    un gestionnaire — ce qu'on mesure ici, c'est que le parc est tenu à jour par quelqu'un, pas
  //    qu'un flux automatique tourne.
  const stampsAvailability = (nbAvailable: number | null) => nbAvailable != null && updatedBy != null

  await tx
    .insert(accommodationTypologies)
    .values(
      typologies.map((t) => ({
        ...toRow(accommodationId, t),
        availabilityUpdatedAt: stampsAvailability(t.nbAvailable) ? now : null,
        availabilityUpdatedBy: stampsAvailability(t.nbAvailable) ? updatedBy : null,
      })),
    )
    .onConflictDoUpdate({
      target: [accommodationTypologies.accommodationId, accommodationTypologies.type],
      set: {
        priceMin: sql`excluded.price_min`,
        priceMax: sql`excluded.price_max`,
        superficieMin: sql`excluded.superficie_min`,
        superficieMax: sql`excluded.superficie_max`,
        nbTotal: sql`excluded.nb_total`,
        nbAvailable: sql`excluded.nb_available`,
        colocation: sql`excluded.colocation`,
        // Voir `stampsAvailability` : une disponibilité effacée repart sans date, et une écriture
        // sans auteur laisse le suivi tel quel. Réenregistrer un formulaire sans toucher aux
        // dispos ne les fait pas non plus passer pour fraîchement mises à jour.
        //
        // Les valeurs sont passées en littéral typé : hors d'un `values()`, Drizzle ne fait pas
        // passer le paramètre par le mapper de la colonne et postgres-js reçoit une `Date` brute.
        availabilityUpdatedAt: updatedBy
          ? sql`case
              when excluded.nb_available is null then null
              when ${accommodationTypologies.nbAvailable} is distinct from excluded.nb_available then ${now.toISOString()}::timestamptz
              else ${accommodationTypologies.availabilityUpdatedAt} end`
          : sql`case when excluded.nb_available is null then null else ${accommodationTypologies.availabilityUpdatedAt} end`,
        availabilityUpdatedBy: updatedBy
          ? sql`case
              when excluded.nb_available is null then null
              when ${accommodationTypologies.nbAvailable} is distinct from excluded.nb_available then ${updatedBy}::text
              else ${accommodationTypologies.availabilityUpdatedBy} end`
          : sql`case when excluded.nb_available is null then null else ${accommodationTypologies.availabilityUpdatedBy} end`,
      },
    })
}

/** Replace all typologies of an accommodation with `drafts` (empty drafts skipped), then refresh aggregates. */
export async function syncTypologies(
  tx: DbOrTx,
  accommodationId: number,
  drafts: TypologyDraft[],
  options: PersistTypologiesOptions = {},
): Promise<void> {
  await persistTypologies(tx, accommodationId, drafts.filter(hasAnyValue), options)
  await recomputeAndPersistAggregates(tx, accommodationId)
}

/**
 * Field-level MERGE of partial typologies onto the current rows (partial importers, e.g. ARPEJ / CROUS
 * rents/surfaces): for each patch, only the provided fields overwrite the existing row of that type;
 * untouched dimensions are preserved. Types that end up all-null are dropped. Refreshes aggregates.
 */
export async function mergeTypologies(
  tx: DbOrTx,
  accommodationId: number,
  patches: TypologyPatch[],
  options: PersistTypologiesOptions = {},
): Promise<void> {
  const current = await tx.select().from(accommodationTypologies).where(eq(accommodationTypologies.accommodationId, accommodationId))
  const byType = new Map<TypologyType, TypologyDraft>(current.map((r) => [r.type, typologyDraft(r.type, r)]))
  for (const patch of patches) {
    const base = byType.get(patch.type) ?? typologyDraft(patch.type)
    const merged: TypologyDraft = { ...base }
    for (const [key, value] of Object.entries(patch)) {
      if (key !== 'type' && value !== undefined) (merged as Record<string, unknown>)[key] = value
    }
    byType.set(patch.type, merged)
  }
  await persistTypologies(tx, accommodationId, [...byType.values()].filter(hasAnyValue), options)
  await recomputeAndPersistAggregates(tx, accommodationId)
}

/**
 * Recompute the denormalized parent aggregates from the current child rows and persist them.
 * Reads the rows from the DB so it is correct after partial updates (e.g. availability-only edits).
 * Does NOT touch nbColivingApartments / nbAccessibleApartments — those are caller-set, not derived here.
 */
export async function recomputeAndPersistAggregates(tx: DbOrTx, accommodationId: number): Promise<void> {
  const rows = await tx
    .select({
      priceMin: accommodationTypologies.priceMin,
      priceMax: accommodationTypologies.priceMax,
      nbTotal: accommodationTypologies.nbTotal,
      nbAvailable: accommodationTypologies.nbAvailable,
    })
    .from(accommodationTypologies)
    .where(eq(accommodationTypologies.accommodationId, accommodationId))

  const { nbTotalApartments, priceMin, priceMax, nbAvailableApartments } = typologyAggregates(rows)
  await tx
    .update(accommodations)
    .set({ nbTotalApartments, priceMin, priceMax, nbAvailableApartments })
    .where(eq(accommodations.id, accommodationId))
}
