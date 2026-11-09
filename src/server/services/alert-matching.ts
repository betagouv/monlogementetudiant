import { eq, type SQL, sql } from 'drizzle-orm'
import { computeExpandedPriceMax, EXPANDED_SEARCH_RADIUS_KM } from '~/lib/accommodations-expanded-search'
import { academies } from '~/server/db/schema/academies'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { departments } from '~/server/db/schema/departments'
import { owners } from '~/server/db/schema/owners'

/**
 * Critères d'une alerte étudiant utilisés pour décider quels logements la satisfont.
 * Partagé entre la recherche (compteur d'alertes) et le détecteur d'alertes, afin que
 * les deux appliquent rigoureusement les mêmes conditions de matching.
 */
export type AlertMatchInput = {
  cityId: number | null
  departmentId: number | null
  academyId: number | null
  hasColiving: boolean
  isAccessible: boolean
  maxPrice: number
}

/**
 * Disponibilité totale courante d'une résidence :
 *   - NULL  si la dispo n'est pas renseignée (aucune typologie n'a de `nbAvailable`)
 *   - sinon la somme des logements disponibles tous types confondus.
 *
 * Cette valeur est dénormalisée sur `accommodation`
 * (`nbAvailableApartments`, maintenue à l'écriture, NULL = non-renseignée) : le détecteur
 * (delta vs snapshot) et le flux d'amorçage à la création d'alerte (`dispo > 0`) s'appuient
 * sur exactement la même définition.
 */
export const accommodationAvailableCount = sql<number | null>`${accommodations.nbAvailableApartments}`

/**
 * Construit la condition d'intersection spatiale pour le niveau de territoire de l'alerte
 * (ville > département > académie, le premier renseigné l'emporte).
 * Retourne `null` si aucun territoire n'est défini (l'alerte couvre alors tout le pays).
 */
export function buildTerritoryCondition(alert: Pick<AlertMatchInput, 'cityId' | 'departmentId' | 'academyId'>): SQL | null {
  const territoryLevels: { id: number | null; table: typeof cities | typeof departments | typeof academies }[] = [
    { id: alert.cityId, table: cities },
    { id: alert.departmentId, table: departments },
    { id: alert.academyId, table: academies },
  ]

  for (const { id, table } of territoryLevels) {
    if (id) {
      return sql`EXISTS (SELECT 1 FROM ${accommodationAddresses} WHERE ${accommodationAddresses.accommodationId} = ${accommodations.id} AND ST_Intersects(${accommodationAddresses.geom}, (SELECT ${table.boundary} FROM ${table} WHERE ${table.id} = ${id})))`
    }
  }
  return null
}

/**
 * Conditions SQL qu'un logement doit remplir pour correspondre à une alerte :
 * publié, prix d'entrée sous le plafond, hors CROUS, et selon les critères coliving /
 * accessibilité / territoire de l'alerte.
 */
export function buildAlertMatchConditions(alert: AlertMatchInput): SQL[] {
  const conditions = buildCommonConditions(alert, alert.maxPrice)

  const territory = buildTerritoryCondition(alert)
  if (territory) {
    conditions.push(territory)
  }

  return conditions
}

/** Critères communs aux correspondances exactes et aux suggestions, à plafond de prix près. */
function buildCommonConditions(alert: Pick<AlertMatchInput, 'hasColiving' | 'isAccessible'>, maxPrice: number): SQL[] {
  const conditions: SQL[] = [
    eq(accommodations.published, true),
    sql`${accommodations.priceMin} <= ${maxPrice}`,
    sql`(${accommodations.ownerId} IS NULL OR ${accommodations.ownerId} NOT IN (SELECT ${owners.id} FROM ${owners} WHERE ${owners.slug} = 'crous'))`,
  ]

  if (alert.hasColiving) {
    conditions.push(sql`${accommodations.nbColivingApartments} > 0`)
  }
  if (alert.isAccessible) {
    conditions.push(sql`${accommodations.nbAccessibleApartments} > 0`)
  }

  return conditions
}

/**
 * Conditions de la zone « suggestions similaires » d'une alerte **ville** : résidences hors de
 * la ville mais à moins de `EXPANDED_SEARCH_RADIUS_KM` de sa frontière, avec un budget élargi
 * de 25 % — les mêmes règles que la section « Plus de résultats » du moteur de recherche.
 * Retourne `null` pour les alertes département/académie (pas d'élargissement pertinent).
 */
export function buildSimilarMatchConditions(alert: AlertMatchInput): SQL[] | null {
  if (!alert.cityId) return null
  const expandedPrice = computeExpandedPriceMax(alert.maxPrice)
  if (expandedPrice === undefined) return null

  const boundary = sql`(SELECT ${cities.boundary} FROM ${cities} WHERE ${cities.id} = ${alert.cityId})`
  const conditions = buildCommonConditions(alert, expandedPrice)
  conditions.push(
    sql`EXISTS (SELECT 1 FROM ${accommodationAddresses} WHERE ${accommodationAddresses.accommodationId} = ${accommodations.id} AND ST_DWithin(${accommodationAddresses.geom}::geography, ${boundary}::geography, ${EXPANDED_SEARCH_RADIUS_KM * 1000}) AND NOT ST_Intersects(${accommodationAddresses.geom}, ${boundary}))`,
  )
  return conditions
}
