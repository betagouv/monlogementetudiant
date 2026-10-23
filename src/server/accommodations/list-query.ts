import { and, eq, inArray, notInArray, or, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { EResidenceType } from '~/enums/residence-type'
import { ETargetAudience } from '~/enums/target-audience'
import type { TAccomodation, TTypologiesRecord } from '~/schemas/accommodations/accommodations'
import { db } from '~/server/db'
import { academies } from '~/server/db/schema/academies'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { departments } from '~/server/db/schema/departments'
import { externalSources } from '~/server/db/schema/external-sources'
import { owners } from '~/server/db/schema/owners'
import { groupTypologiesByAccommodation, typologiesByType } from '~/server/lib/typologies'

/**
 * Query builders partagés pour lister les accommodations.
 *
 * Ce module est la source de vérité de la requête « liste de résidences » : il est consommé à la fois
 * par le router tRPC interne (`accommodationsRouter`) et par l'API publique REST v1, garantissant que
 * les deux surfaces renvoient exactement le même contenu (iso carte).
 *
 * Modèle de données : les typologies vivent dans la table `accommodation_typologies`. Le tri/pagination
 * et les bornes de prix s'appuient sur les agrégats dénormalisés maintenus à l'écriture sur
 * `accommodation` (`nbAvailableApartments`, `priceMin`, `priceMax`) ; le détail par typologie est
 * hydraté par lot après la requête (`rowsToAccommodationDTOs`).
 */

// Raw column names used inside CTE ordering (no table qualification).
// Backed by the denormalized parent aggregate (NULL = availability unknown).
const totalAvailable = sql<number>`COALESCE("nbAvailableApartments", 0)`

const unknownAvailability = sql<boolean>`"nbAvailableApartments" IS NULL`

const priorityOrder = sql`CASE
  WHEN ${totalAvailable} > 0 THEN 1
  WHEN ${totalAvailable} = 0 AND "acceptWaitingList" = true AND NOT ${unknownAvailability} THEN 2
  WHEN ${unknownAvailability} AND "acceptWaitingList" = true THEN 3
  WHEN ${unknownAvailability} AND ("acceptWaitingList" IS NULL OR "acceptWaitingList" = false) THEN 4
  WHEN ${totalAvailable} = 0 AND ("acceptWaitingList" IS NULL OR "acceptWaitingList" = false) AND NOT ${unknownAvailability} THEN 5
  ELSE 6
END`

// Denormalized parent aggregate (MAX of typology priceMax), maintained on write.
export const priceMaxComputed = sql<number | null>`${accommodations.priceMax}`

export const crousExistsCondition = sql`EXISTS (SELECT 1 FROM ${externalSources} WHERE ${externalSources.accommodationId} = ${accommodations.id} AND ${externalSources.source} = 'crous')`

const residenceTypeValues = new Set<string>(Object.values(EResidenceType))
const targetAudienceValues = new Set<string>(Object.values(ETargetAudience))

export function toResidenceType(value: string | null): EResidenceType | null {
  return value && residenceTypeValues.has(value) ? (value as EResidenceType) : null
}

export function toTargetAudience(value: string | null): ETargetAudience | null {
  return value && targetAudienceValues.has(value) ? (value as ETargetAudience) : null
}

/**
 * Shape des rows consommées par `toAccommodationDTO`. Les selects Drizzle typés (favoris, bailleur,
 * get-my) s'y conforment au compile-time ; la sortie brute du CTE de recherche (`db.execute`, non
 * inférée par Drizzle) est validée par `ZAccommodationDTORow` avant d'y accéder.
 *
 * `id` remonte en string depuis le driver pour les colonnes bigint, en number depuis un select typé.
 * `updatedAt` est nullable en base mais l'API (`ZAccomodation`) le contractualise non-null : en
 * pratique toujours renseigné (voir le narrowing dans `toAccommodationDTO`).
 */
const ZAccommodationDTORow = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  postalCode: z.string(),
  published: z.boolean(),
  // `db.execute` (CTE brut) renvoie le timestamp en string, là où un select Drizzle typé renvoie une
  // Date : on coerce pour aligner le chemin recherche sur le contrat `ZAccomodation` (updatedAt: Date).
  updatedAt: z.coerce.date().nullable(),
  residenceType: z.string().nullable(),
  targetAudience: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  nbTotalApartments: z.number().nullable(),
  nbAccessibleApartments: z.number().nullable(),
  nbColivingApartments: z.number().nullable(),
  priceMin: z.number().nullable(),
  priceMaxComputed: z.number().nullable(),
  imagesUrls: z.array(z.string()).nullable(),
  citySlug: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  rentalChargesDetails: z.string().nullable().optional(),
  externalUrl: z.string().nullable().optional(),
  virtualTourUrl: z.string().nullable().optional(),
  acceptWaitingList: z.boolean().nullable().optional(),
  scholarshipHoldersPriority: z.boolean().nullable().optional(),
  socialHousingRequired: z.boolean().nullable().optional(),
  wifi: z.boolean().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  ownerUrl: z.string().nullable().optional(),
})

export type TAccommodationDTORow = z.infer<typeof ZAccommodationDTORow>

export type TCommonListFiltersInput = {
  hasColiving?: boolean
  isAccessible?: boolean
  onlyWithAvailability?: boolean
  ownerSlug?: string
  priceMax?: number
  viewCrous: boolean
  // Quand true, ne pas appliquer le filtre crous ici (l'appelant l'applique lui-même, ex. pour compter les deux buckets).
  skipCrous?: boolean
}

export const priceMaxCondition = (priceMax: number) =>
  sql`${accommodations.priceMin} IS NOT NULL AND ${accommodations.priceMin} <= ${priceMax}`

export const applyCommonListFilters = async (conditions: SQL[], input: TCommonListFiltersInput) => {
  const { hasColiving, isAccessible, onlyWithAvailability, ownerSlug, priceMax, viewCrous, skipCrous } = input

  if (isAccessible) {
    conditions.push(sql`${accommodations.nbAccessibleApartments} > 0`)
  }

  if (hasColiving) {
    conditions.push(sql`${accommodations.nbColivingApartments} > 0`)
  }

  if (onlyWithAvailability) {
    conditions.push(sql`${accommodations.nbAvailableApartments} > 0`)
  }

  if (priceMax != null) {
    conditions.push(priceMaxCondition(priceMax))
  }

  if (!skipCrous) {
    conditions.push(viewCrous ? crousExistsCondition : sql`NOT (${crousExistsCondition})`)
  }

  if (ownerSlug) {
    const ownerResult = await db.select({ id: owners.id }).from(owners).where(eq(owners.slug, ownerSlug)).limit(1)

    if (ownerResult.length > 0) {
      conditions.push(eq(accommodations.ownerId, ownerResult[0].id))
    }
  }
}

export const applyCenterRadiusFilter = (conditions: SQL[], center: string, radius: number) => {
  const [lng, lat] = center.split(',').map(Number)
  const radiusMeters = radius * 1000
  conditions.push(
    sql`ST_DWithin(${accommodationAddresses.geom}::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})`,
  )
}

/**
 * Construit le filtre de localisation géométrique (iso carte) pour l'API publique.
 *
 * Chaque dimension fournie (slugs de villes, départements par slug/code, académies par slug) produit
 * une sous-requête `EXISTS` corrélée qui applique `ST_Within(geom, boundary)` — exactement la même
 * sémantique que le filtre mono-ville de la carte, mais généralisée au multi-territoire et
 * index-friendly (pas de polygone matérialisé côté application). Les codes postaux sont un filtre
 * attributaire (`postal_code IN (...)`).
 *
 * Les dimensions renseignées sont combinées en `OR` (union des zones/attributs) : un consommateur qui
 * passe plusieurs villes récupère l'union de ces villes.
 *
 * @returns un prédicat SQL, ou `null` si aucune dimension de localisation n'est fournie.
 */
export const resolveLocationConditions = (input: {
  citySlugs?: string[]
  departments?: string[]
  academies?: string[]
  postalCodes?: string[]
}): SQL | null => {
  const terms: SQL[] = []

  if (input.citySlugs?.length) {
    const values = input.citySlugs.map((s) => sql`${s.trim().toLowerCase()}`)
    terms.push(
      sql`EXISTS (SELECT 1 FROM ${cities} loc_c WHERE LOWER(loc_c.slug) IN (${sql.join(values, sql`, `)}) AND ST_Within(${accommodationAddresses.geom}, loc_c.boundary))`,
    )
  }

  if (input.departments?.length) {
    const tokens = input.departments.map((d) => d.trim())
    const lowered = tokens.map((d) => sql`${d.toLowerCase()}`)
    const codes = tokens.map((d) => sql`${d}`)
    terms.push(
      sql`EXISTS (SELECT 1 FROM ${departments} loc_d WHERE (LOWER(loc_d.slug) IN (${sql.join(lowered, sql`, `)}) OR loc_d.code IN (${sql.join(codes, sql`, `)})) AND ST_Within(${accommodationAddresses.geom}, loc_d.boundary))`,
    )
  }

  if (input.academies?.length) {
    const values = input.academies.map((s) => sql`${s.trim().toLowerCase()}`)
    terms.push(
      sql`EXISTS (SELECT 1 FROM ${academies} loc_a WHERE LOWER(loc_a.slug) IN (${sql.join(values, sql`, `)}) AND ST_Within(${accommodationAddresses.geom}, loc_a.boundary))`,
    )
  }

  if (input.postalCodes?.length) {
    const values = input.postalCodes.map((p) => sql`${p.trim()}`)
    terms.push(sql`${accommodationAddresses.postalCode} IN (${sql.join(values, sql`, `)})`)
  }

  if (terms.length === 0) return null
  return terms.length === 1 ? terms[0] : (or(...terms) as SQL)
}

export const listAccommodationsWithConditions = async ({
  page,
  pageSize,
  where,
  whereWithoutCrous,
  priceBoundsWhere = where,
  addressOrderHint,
}: {
  page: number
  pageSize: number
  where: SQL | undefined
  // Mêmes conditions que `where` mais sans le filtre crous : sert à compter les deux buckets (crous / autres).
  whereWithoutCrous?: SQL
  // Mêmes conditions que `where` mais sans le filtre prix : les bornes ne bougent pas quand on ajuste le budget.
  priceBoundsWhere?: SQL
  addressOrderHint?: SQL
}) => {
  const offset = (page - 1) * pageSize
  const addressOrder = addressOrderHint ?? sql`${accommodationAddresses.isMain} DESC`
  const whereClause = where ? sql`WHERE ${where}` : sql``

  // Use a CTE: first deduplicate with DISTINCT ON, then sort + paginate on top
  const [countResult, priceBounds, results, crousCountsResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(DISTINCT ${accommodations.id})::int` })
      .from(accommodations)
      .innerJoin(accommodationAddresses, eq(accommodationAddresses.accommodationId, accommodations.id))
      .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
      .where(where),

    db
      .select({
        minPrice: sql<number | null>`MIN(NULLIF(${accommodations.priceMin}, 0))`,
        maxPrice: sql<number | null>`MAX(NULLIF(${accommodations.priceMax}, 0))`,
      })
      .from(accommodations)
      .innerJoin(accommodationAddresses, eq(accommodationAddresses.accommodationId, accommodations.id))
      .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
      .where(priceBoundsWhere),

    db.execute<Record<string, unknown>>(sql`
      WITH deduped AS (
        SELECT DISTINCT ON (${accommodations.id})
          ${accommodations.id} as id,
          ${accommodations.name} as name,
          ${accommodations.slug} as slug,
          ${accommodations.description} as description,
          ${accommodationAddresses.address} as address,
          ${cities.name} as city,
          ${cities.slug} as "citySlug",
          ${accommodationAddresses.postalCode} as "postalCode",
          ${accommodations.residenceType} as "residenceType",
          ${accommodations.targetAudience} as "targetAudience",
          ${accommodations.published} as published,
          ${accommodations.nbTotalApartments} as "nbTotalApartments",
          ${accommodations.nbAccessibleApartments} as "nbAccessibleApartments",
          ${accommodations.nbColivingApartments} as "nbColivingApartments",
          ${accommodations.nbAvailableApartments} as "nbAvailableApartments",
          ${accommodations.priceMin} as "priceMin",
          ${priceMaxComputed} as "priceMaxComputed",
          ${accommodations.acceptWaitingList} as "acceptWaitingList",
          ${accommodations.scholarshipHoldersPriority} as "scholarshipHoldersPriority",
          ${accommodations.socialHousingRequired} as "socialHousingRequired",
          ${accommodations.wifi} as wifi,
          ${accommodations.imagesUrls} as "imagesUrls",
          ${accommodations.externalUrl} as "externalUrl",
          ${accommodations.virtualTourUrl} as "virtualTourUrl",
          ${accommodations.updatedAt} as "updatedAt",
          ${owners.name} as "ownerName",
          ${owners.url} as "ownerUrl",
          ST_Y(${accommodationAddresses.geom}::geometry) as lat,
          ST_X(${accommodationAddresses.geom}::geometry) as lng
        FROM ${accommodations}
        INNER JOIN ${accommodationAddresses} ON ${accommodationAddresses.accommodationId} = ${accommodations.id}
        INNER JOIN ${cities} ON ${cities.id} = ${accommodationAddresses.cityId}
        LEFT JOIN ${owners} ON ${owners.id} = ${accommodations.ownerId}
        ${whereClause}
        ORDER BY ${accommodations.id}, ${addressOrder}
      )
      SELECT * FROM deduped
      ORDER BY ${priorityOrder} ASC, "updatedAt" DESC NULLS LAST, id ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `),

    // Counts par bucket crous / autres, sur les mêmes conditions mais sans le filtre crous.
    whereWithoutCrous
      ? db
          .select({
            crous: sql<number>`count(DISTINCT ${accommodations.id}) FILTER (WHERE ${crousExistsCondition})::int`,
            others: sql<number>`count(DISTINCT ${accommodations.id}) FILTER (WHERE NOT (${crousExistsCondition}))::int`,
          })
          .from(accommodations)
          .innerJoin(accommodationAddresses, eq(accommodationAddresses.accommodationId, accommodations.id))
          .innerJoin(cities, eq(accommodationAddresses.cityId, cities.id))
          .where(whereWithoutCrous)
      : Promise.resolve(null),
  ])

  const count = countResult[0]?.count ?? 0
  const totalPages = Math.ceil(count / pageSize)

  // Sortie brute du CTE (`db.execute`) : seule frontière non typée par Drizzle → on la valide avant
  // de la passer au DTO. En cas de dérive de shape, on log et on renvoie une liste vide plutôt que
  // de laisser des `undefined` se propager silencieusement.
  const rawRows = Array.isArray(results) ? results : (results as { rows: unknown[] }).rows
  const parsed = z.array(ZAccommodationDTORow).safeParse(rawRows)
  if (!parsed.success) {
    console.error('[queryAccommodations] Shape de rows accommodation invalide', parsed.error)
  }

  return {
    count,
    pageSize,
    minPrice: priceBounds[0]?.minPrice != null ? Number(priceBounds[0].minPrice) : null,
    maxPrice: priceBounds[0]?.maxPrice != null ? Number(priceBounds[0].maxPrice) : null,
    crousCounts: crousCountsResult?.[0] ? { crous: crousCountsResult[0].crous, others: crousCountsResult[0].others } : undefined,
    next: page < totalPages ? String(page + 1) : null,
    previous: page > 1 ? String(page - 1) : null,
    results: parsed.success ? await rowsToAccommodationDTOs(parsed.data) : [],
  }
}

/**
 * Batch-fetch typology rows for a page of result rows and map each to the flat accommodation DTO.
 * Search ranking/pagination stays in the raw CTE (which uses the parent aggregates); this only
 * hydrates the typologies (keyed object) for the page being returned.
 */
export async function rowsToAccommodationDTOs(rows: TAccommodationDTORow[]): Promise<TAccomodation[]> {
  const ids = rows.map((r) => (typeof r.id === 'string' ? Number(r.id) : r.id))
  const typologyRows =
    ids.length > 0 ? await db.select().from(accommodationTypologies).where(inArray(accommodationTypologies.accommodationId, ids)) : []
  const byAccommodation = groupTypologiesByAccommodation(typologyRows)
  return rows.map((r) => {
    const id = typeof r.id === 'string' ? Number(r.id) : (r.id as number)
    return toAccommodationDTO(r, typologiesByType(byAccommodation.get(id) ?? []))
  })
}

/**
 * Map a row (from the search CTE or a typed select sharing the same key names) plus its keyed
 * typologies object into the flat accommodation DTO. No GeoJSON wrapper: coordinates inline.
 * bigint id comes back as a string from raw SQL (db.execute) but as a number from typed selects.
 */
export function toAccommodationDTO(row: TAccommodationDTORow, typologies: TTypologiesRecord): TAccomodation {
  const id = typeof row.id === 'string' ? Number(row.id) : row.id
  return {
    id,
    name: row.name,
    slug: row.slug,
    citySlug: row.citySlug ?? undefined,
    address: row.address ?? '',
    city: row.city,
    postalCode: row.postalCode,
    residenceType: toResidenceType(row.residenceType),
    targetAudience: toTargetAudience(row.targetAudience),
    published: row.published,
    acceptWaitingList: row.acceptWaitingList ?? false,
    imagesUrls: row.imagesUrls ?? null,
    description: row.description ?? null,
    rentalChargesDetails: row.rentalChargesDetails ?? null,
    externalUrl: row.externalUrl ?? undefined,
    virtualTourUrl: row.virtualTourUrl ?? null,
    // Colonne nullable en base, contractualisée non-null par l'API : en pratique toujours renseignée.
    updatedAt: row.updatedAt as Date,
    scholarshipHoldersPriority: row.scholarshipHoldersPriority ?? false,
    socialHousingRequired: row.socialHousingRequired ?? false,
    wifi: row.wifi ?? false,
    latitude: row.lat,
    longitude: row.lng,
    nbTotalApartments: row.nbTotalApartments,
    nbAccessibleApartments: row.nbAccessibleApartments,
    nbColivingApartments: row.nbColivingApartments,
    priceMin: row.priceMin,
    priceMax: row.priceMaxComputed,
    ownerName: row.ownerName ?? null,
    ownerUrl: row.ownerUrl ?? null,
    typologies,
  }
}

/**
 * Requête haut-niveau consommée par l'API publique REST v1 (`GET /v1/accommodations`).
 *
 * Elle reprend la logique du router tRPC `accommodations.list` (mêmes filtres communs, même shape de
 * sortie) mais en remplaçant le scope mono-ville par le filtre de localisation multi-territoire de
 * `resolveLocationConditions`. `bbox` / `center` restent disponibles comme scopes géométriques
 * alternatifs, avec la même priorité que le router.
 *
 * Le filtre CROUS est tri-état, plus adapté à un consommateur d'API que le binaire de la carte :
 * `undefined` = toutes les résidences, `true` = CROUS uniquement, `false` = hors CROUS.
 */
export const queryPublicAccommodations = async (input: {
  page: number
  pageSize: number
  citySlugs?: string[]
  departments?: string[]
  academies?: string[]
  postalCodes?: string[]
  bbox?: string
  center?: string
  radius: number
  isAccessible?: boolean
  hasColiving?: boolean
  onlyWithAvailability?: boolean
  priceMax?: number
  viewCrous?: boolean
  ownerSlug?: string
  excludeIds?: number[]
}) => {
  const { page, pageSize, bbox, center, radius } = input

  const conditions: SQL[] = [eq(accommodations.published, true), sql`${accommodationAddresses.geom} IS NOT NULL`]
  // On applique tous les filtres SAUF crous (skipCrous), le filtre crous est ajouté par-dessus ci-dessous.
  await applyCommonListFilters(conditions, { ...input, viewCrous: input.viewCrous ?? false, skipCrous: true })

  // Localisation : d'abord les dimensions slug/CP (union), sinon bbox, sinon center+rayon.
  const locationCondition = resolveLocationConditions(input)
  if (locationCondition) {
    conditions.push(locationCondition)
  } else if (bbox) {
    const parts = bbox.split(',').map(Number)
    if (parts.length === 4) {
      const [xmin, ymin, xmax, ymax] = parts
      conditions.push(sql`ST_Intersects(${accommodationAddresses.geom}, ST_MakeEnvelope(${xmin}, ${ymin}, ${xmax}, ${ymax}, 4326))`)
    }
  } else if (center) {
    applyCenterRadiusFilter(conditions, center, radius)
  }

  if (input.excludeIds?.length) {
    conditions.push(notInArray(accommodations.id, input.excludeIds))
  }

  const whereWithoutCrous = and(...conditions)
  // CROUS tri-état : undefined → pas de filtre (toutes) + pas de comptage par bucket.
  const where =
    input.viewCrous === undefined
      ? whereWithoutCrous
      : and(whereWithoutCrous, input.viewCrous ? crousExistsCondition : sql`NOT (${crousExistsCondition})`)
  return listAccommodationsWithConditions({
    page,
    pageSize,
    where,
    whereWithoutCrous: input.viewCrous === undefined ? undefined : whereWithoutCrous,
  })
}
