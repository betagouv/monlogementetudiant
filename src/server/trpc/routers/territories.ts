import { TRPCError } from '@trpc/server'
import { type AnyColumn, and, asc, eq, ne, type SQL, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { ZAlertAccommodationFormSchema } from '~/schemas/alert-accommodation/alert-accommodation'
import { db } from '~/server/db'
import { academies } from '~/server/db/schema/academies'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { departments } from '~/server/db/schema/departments'
import { newsletterSubscriptions } from '~/server/db/schema/newsletter-subscriptions'
import { owners } from '~/server/db/schema/owners'
import { bboxSelect } from '~/server/trpc/utils/spatial-helpers'
import { normalizeCitySearch, tokenizeQuery } from '~/server/utils/normalize-city-search'
import { sortCitiesByRelevance } from '~/server/utils/sort-cities-by-relevance'
import { baseProcedure, createTRPCRouter } from '../init'

let rentDataCache: Record<string, number> | null = null

function getRentData(): Record<string, number> {
  if (!rentDataCache) {
    const filePath = path.join(process.cwd(), 'public', 'loyers.json')
    const fileContents = fs.readFileSync(filePath, 'utf8')
    rentDataCache = JSON.parse(fileContents)
  }
  return rentDataCache!
}

function buildWhere(nameCol: AnyColumn, tokens: string[]): SQL {
  const conditions = tokens.map((token) => sql`immutable_unaccent(${nameCol}) ILIKE ${'%' + token + '%'}`)
  return and(...conditions)!
}

function buildRank(nameCol: AnyColumn, normalized: string): SQL {
  const normalizedCol = sql`LOWER(REPLACE(immutable_unaccent(${nameCol}), '-', ' '))`
  return sql`GREATEST(
    CASE WHEN ${normalizedCol} = ${normalized} THEN 2.0 ELSE 0.0 END,
    CASE WHEN ${normalizedCol} ILIKE ${normalized + '%'} THEN 1.0 ELSE 0.0 END,
    ts_rank(to_tsvector('simple', immutable_unaccent(${nameCol})), plainto_tsquery('simple', ${normalized}))
  ) DESC, ${nameCol} ASC`
}

type CityRow = {
  id: number
  name: string
  slug: string
  departmentCode: string | null
  postalCodes: string[] | null
  epciCode: string
  inseeCodes: string[] | null
  averageIncome: string | number | null
  averageRent: string | number | null
  popular: boolean
  nbStudents: number
  nbTotalApartments?: number | null
  nbCrousApartments?: number | null
  priceMin?: number | null
  bbox: { xmin: number; xmax: number; ymin: number; ymax: number }
}

type CityStats = {
  cityId?: number | null
  nbTotalApartments?: number | null
  priceMin?: number | null
  nbT1?: number | null
  nbT1Bis?: number | null
  nbT2?: number | null
  nbT3?: number | null
  nbT4?: number | null
  nbT5?: number | null
  nbT6?: number | null
  nbT7More?: number | null
}

function mapCityRow(c: CityRow, stats?: CityStats, nearbyCities: { name: string; slug: string }[] = []) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    department_code: c.departmentCode ?? '',
    postal_codes: c.postalCodes ?? [],
    epci_code: c.epciCode ?? '',
    insee_codes: c.inseeCodes ?? [],
    average_income: Number(c.averageIncome) || 0,
    average_rent: Number(c.averageRent) || 0,
    popular: c.popular,
    nb_students: c.nbStudents ?? 0,
    nb_total_apartments: stats ? Number(stats.nbTotalApartments) || 0 : Number(c.nbTotalApartments) || 0,
    price_min: stats?.priceMin != null ? Number(stats.priceMin) : c.priceMin != null ? Number(c.priceMin) : null,
    nb_t1: stats?.nbT1 ?? null,
    nb_t1_bis: stats?.nbT1Bis ?? null,
    nb_t2: stats?.nbT2 ?? null,
    nb_t3: stats?.nbT3 ?? null,
    nb_t4: stats?.nbT4 ?? null,
    nb_t5: stats?.nbT5 ?? null,
    nb_t6: stats?.nbT6 ?? null,
    nb_t7_more: stats?.nbT7More ?? null,
    majority_crous: (Number(c.nbCrousApartments) || 0) > (Number(c.nbTotalApartments) || 0) / 2,
    nearby_cities: nearbyCities,
    bbox: c.bbox,
  }
}

function cityAccommodationStatsSubquery() {
  return db
    .select({
      cityId: accommodations.cityId,
      nbTotalApartments: sql<number>`COALESCE(SUM(${accommodations.nbTotalApartments}), 0)::int`,
      priceMin: sql<number | null>`MIN(${accommodations.priceMin})`,
      nbCrousApartments: sql<number>`
        COALESCE(
          SUM(
            CASE
              WHEN ${owners.name} = 'CROUS' THEN COALESCE(${accommodations.nbTotalApartments}, 0)
              ELSE 0
            END
          ),
          0
        )::int
      `,
    })
    .from(accommodations)
    .leftJoin(owners, eq(accommodations.ownerId, owners.id))
    .where(and(eq(accommodations.published, true), eq(accommodations.available, true)))
    .groupBy(accommodations.cityId)
    .as('city_accommodation_stats')
}

export const territoriesRouter = createTRPCRouter({
  search: baseProcedure.input(z.object({ q: z.string() })).query(async ({ input }) => {
    const { q } = input
    const empty = { academies: [], departments: [], cities: [] }
    const normalized = normalizeCitySearch(q)
    const tokens = tokenizeQuery(normalized)
    if (tokens.length === 0) return empty
    const cityStats = cityAccommodationStatsSubquery()

    const [academyResults, departmentResults, cityResults] = await Promise.all([
      db
        .select({
          id: academies.id,
          name: academies.name,
          slug: academies.slug,
          bbox: bboxSelect(academies),
        })
        .from(academies)
        .where(buildWhere(academies.name, tokens))
        .orderBy(buildRank(academies.name, normalized))
        .limit(10),

      db
        .select({
          id: departments.id,
          name: departments.name,
          slug: departments.slug,
          bbox: bboxSelect(departments),
        })
        .from(departments)
        .where(buildWhere(departments.name, tokens))
        .orderBy(buildRank(departments.name, normalized))
        .limit(10),

      db
        .select({
          id: cities.id,
          name: cities.name,
          slug: cities.slug,
          departmentCode: departments.code,
          postalCodes: cities.postalCodes,
          epciCode: sql<string>`COALESCE(${cities.epciCode}, '')`,
          inseeCodes: cities.inseeCodes,
          averageIncome: cities.averageIncome,
          averageRent: cities.averageRent,
          popular: cities.popular,
          nbStudents: sql<number>`COALESCE(${cities.nbStudents}, 0)`,
          nbTotalApartments: cityStats.nbTotalApartments,
          priceMin: cityStats.priceMin,
          bbox: bboxSelect(cities),
        })
        .from(cities)
        .leftJoin(departments, eq(cities.departmentId, departments.id))
        .leftJoin(cityStats, eq(cityStats.cityId, cities.id))
        .where(buildWhere(cities.name, tokens))
        .orderBy(buildRank(cities.name, normalized))
        .limit(10),
    ])

    return {
      academies: academyResults.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        bbox: a.bbox,
      })),
      departments: departmentResults.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        bbox: d.bbox,
      })),
      cities: cityResults.map((c) => mapCityRow(c)),
    }
  }),

  listAcademies: baseProcedure.query(async () => {
    const results = await db
      .select({
        id: academies.id,
        name: academies.name,
        slug: academies.slug,
        bbox: bboxSelect(academies),
      })
      .from(academies)
      .orderBy(asc(academies.name))

    return results.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      bbox: a.bbox,
    }))
  }),
  listDepartments: baseProcedure.query(async () => {
    const results = await db
      .select({
        id: departments.id,
        name: departments.name,
        slug: departments.slug,
        code: departments.code,
        bbox: bboxSelect(departments),
      })
      .from(departments)
      .where(ne(departments.name, ''))
      .orderBy(asc(departments.name))

    return results.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      code: d.code,
      bbox: d.bbox,
    }))
  }),
  listCities: baseProcedure
    .input(
      z
        .object({
          departmentCode: z.string().optional(),
          popular: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const departmentCode = input?.departmentCode
      const popular = input?.popular
      const cityStats = cityAccommodationStatsSubquery()

      const conditions: SQL[] = []
      if (departmentCode) conditions.push(eq(departments.code, departmentCode))
      if (popular) conditions.push(eq(cities.popular, true))

      const results = await db
        .select({
          id: cities.id,
          name: cities.name,
          slug: cities.slug,
          departmentCode: departments.code,
          postalCodes: cities.postalCodes,
          epciCode: sql<string>`COALESCE(${cities.epciCode}, '')`,
          inseeCodes: cities.inseeCodes,
          averageIncome: cities.averageIncome,
          averageRent: cities.averageRent,
          popular: cities.popular,
          nbStudents: sql<number>`COALESCE(${cities.nbStudents}, 0)`,
          nbTotalApartments: cityStats.nbTotalApartments,
          nbCrousApartments: cityStats.nbCrousApartments,
          priceMin: cityStats.priceMin,
          bbox: bboxSelect(cities),
        })
        .from(cities)
        .leftJoin(departments, eq(cities.departmentId, departments.id))
        .leftJoin(cityStats, eq(cityStats.cityId, cities.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(cities.name))

      return results.map((c) => mapCityRow(c))
    }),

  getCityDetails: baseProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const { slug } = input
    const slugLower = slug.toLowerCase()

    const c1 = alias(cities, 'c1')
    const c2 = alias(cities, 'c2')

    const [cityRows, accommodationStats, nearbyCities] = await Promise.all([
      db
        .select({
          id: cities.id,
          name: cities.name,
          slug: cities.slug,
          departmentCode: departments.code,
          postalCodes: cities.postalCodes,
          epciCode: sql<string>`COALESCE(${cities.epciCode}, '')`,
          inseeCodes: cities.inseeCodes,
          averageIncome: cities.averageIncome,
          averageRent: cities.averageRent,
          popular: cities.popular,
          nbStudents: sql<number>`COALESCE(${cities.nbStudents}, 0)`,
          bbox: bboxSelect(cities),
        })
        .from(cities)
        .leftJoin(departments, eq(cities.departmentId, departments.id))
        .where(eq(cities.slug, slugLower))
        .limit(1),

      db
        .select({
          nbTotalApartments: sql<number>`COALESCE(SUM(${accommodations.nbTotalApartments}), 0)::int`,
          priceMin: sql<number | null>`MIN(${accommodations.priceMin})`,
          nbT1: sql<number | null>`SUM(${accommodations.nbT1})::int`,
          nbT1Bis: sql<number | null>`SUM(${accommodations.nbT1Bis})::int`,
          nbT2: sql<number | null>`SUM(${accommodations.nbT2})::int`,
          nbT3: sql<number | null>`SUM(${accommodations.nbT3})::int`,
          nbT4: sql<number | null>`SUM(${accommodations.nbT4})::int`,
          nbT5: sql<number | null>`SUM(${accommodations.nbT5})::int`,
          nbT6: sql<number | null>`SUM(${accommodations.nbT6})::int`,
          nbT7More: sql<number | null>`SUM(${accommodations.nbT7More})::int`,
        })
        .from(accommodations)
        .where(
          and(
            sql`${accommodations.cityId} = (SELECT ${cities.id} FROM ${cities} WHERE ${cities.slug} = ${slugLower} LIMIT 1)`,
            eq(accommodations.published, true),
            eq(accommodations.available, true),
          ),
        ),

      db
        .select({ name: c2.name, slug: c2.slug })
        .from(c1)
        .innerJoin(c2, and(ne(c1.id, c2.id), sql`ST_DWithin(${c1.boundary}::geography, ${c2.boundary}::geography, 50000)`))
        .where(eq(c1.slug, slugLower))
        .orderBy(asc(c2.name)),
    ])

    const city = cityRows[0]
    if (!city) {
      throw new Error(`City not found: ${slug}`)
    }

    return mapCityRow(
      city,
      accommodationStats[0] ?? undefined,
      nearbyCities.map((nc) => ({ name: nc.name, slug: nc.slug })),
    )
  }),

  getBySlug: baseProcedure
    .input(z.object({ type: z.enum(['ville', 'academie', 'departement']), slug: z.string() }))
    .query(async ({ input }) => {
      const slugLower = input.slug.toLowerCase()

      if (input.type === 'ville') {
        const [cityRows, accommodationStats] = await Promise.all([
          db
            .select({
              id: cities.id,
              name: cities.name,
              slug: cities.slug,
              departmentCode: departments.code,
              postalCodes: cities.postalCodes,
              epciCode: sql<string>`COALESCE(${cities.epciCode}, '')`,
              inseeCodes: cities.inseeCodes,
              averageIncome: cities.averageIncome,
              averageRent: cities.averageRent,
              popular: cities.popular,
              nbStudents: sql<number>`COALESCE(${cities.nbStudents}, 0)`,
              bbox: bboxSelect(cities),
            })
            .from(cities)
            .leftJoin(departments, eq(cities.departmentId, departments.id))
            .where(eq(cities.slug, slugLower))
            .limit(1),

          db
            .select({
              nbTotalApartments: sql<number>`COALESCE(SUM(${accommodations.nbTotalApartments}), 0)::int`,
              priceMin: sql<number | null>`MIN(${accommodations.priceMin})`,
              nbT1: sql<number | null>`SUM(${accommodations.nbT1})::int`,
              nbT1Bis: sql<number | null>`SUM(${accommodations.nbT1Bis})::int`,
              nbT2: sql<number | null>`SUM(${accommodations.nbT2})::int`,
              nbT3: sql<number | null>`SUM(${accommodations.nbT3})::int`,
              nbT4: sql<number | null>`SUM(${accommodations.nbT4})::int`,
              nbT5: sql<number | null>`SUM(${accommodations.nbT5})::int`,
              nbT6: sql<number | null>`SUM(${accommodations.nbT6})::int`,
              nbT7More: sql<number | null>`SUM(${accommodations.nbT7More})::int`,
            })
            .from(accommodations)
            .where(
              and(
                sql`${accommodations.cityId} = (SELECT ${cities.id} FROM ${cities} WHERE ${cities.slug} = ${slugLower} LIMIT 1)`,
                eq(accommodations.published, true),
                eq(accommodations.available, true),
              ),
            ),
        ])

        const city = cityRows[0]
        if (!city) throw new TRPCError({ code: 'NOT_FOUND', message: `City not found: ${input.slug}` })

        return mapCityRow(city, accommodationStats[0] ?? undefined)
      }

      if (input.type === 'academie') {
        const rows = await db
          .select({ id: academies.id, name: academies.name, slug: academies.slug, bbox: bboxSelect(academies) })
          .from(academies)
          .where(eq(academies.slug, slugLower))
          .limit(1)

        if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND', message: `Academy not found: ${input.slug}` })
        return rows[0]
      }

      // departement
      const rows = await db
        .select({ id: departments.id, name: departments.name, slug: departments.slug, bbox: bboxSelect(departments) })
        .from(departments)
        .where(eq(departments.slug, slugLower))
        .limit(1)

      if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND', message: `Department not found: ${input.slug}` })
      return rows[0]
    }),

  rentSearch: baseProcedure.input(z.object({ q: z.string().min(1) })).query(({ input }) => {
    const rentData = getRentData()
    const searchTerm = input.q.toLowerCase()

    const filteredCities = sortCitiesByRelevance(
      Object.entries(rentData)
        .filter(([city]) => city.toLowerCase().includes(searchTerm))
        .map(([city, rentPerM2]) => ({
          city,
          rentPerM2,
          rentFor20M2: rentPerM2 * 20,
        })),
      searchTerm,
    )

    return {
      cities: filteredCities,
      total: filteredCities.length,
    }
  }),

  subscribeNewsletter: baseProcedure.input(ZAlertAccommodationFormSchema).mutation(async ({ input }) => {
    const [row] = await db
      .insert(newsletterSubscriptions)
      .values({
        email: input.email,
        payload: input,
      })
      .returning()

    return { id: row.id, email: row.email }
  }),
})
