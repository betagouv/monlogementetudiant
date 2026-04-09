import { TRPCError } from '@trpc/server'
import { and, between, count, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { adminOwnerLinks } from '~/server/db/schema/admin-owner-links'
import { user } from '~/server/db/schema/auth'
import { cities } from '~/server/db/schema/cities'
import { eventStats } from '~/server/db/schema/event-stats'
import { owners } from '~/server/db/schema/owners'
import { stats } from '~/server/db/schema/stats'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '~/server/utils/slug'
import { adminProcedure, createTRPCRouter } from '../init'

const PAGE_SIZE = 20

const nbAvailableApartmentsSum = sql<number>`(
  coalesce(nb_t1_available, 0) + coalesce(nb_t1_bis_available, 0) +
  coalesce(nb_t2_available, 0) + coalesce(nb_t3_available, 0) +
  coalesce(nb_t4_available, 0) + coalesce(nb_t5_available, 0) +
  coalesce(nb_t6_available, 0) + coalesce(nb_t7_more_available, 0)
)::int`
const getAdminErrorTranslations = () => getTranslations('trpc.admin.errors')

const usersRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        search: z.string().optional(),
        role: z.enum(['user', 'owner', 'admin']).optional(),
        unlinked: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const roleFilter = eq(user.role, input.role ?? 'user')
      const conditions = [input.unlinked ? isNull(user.ownerId) : roleFilter]

      if (input.search && input.search.length >= 2) {
        const searchCondition = or(
          ilike(user.email, `%${input.search}%`),
          ilike(user.firstname, `%${input.search}%`),
          ilike(user.lastname, `%${input.search}%`),
          ilike(user.name, `%${input.search}%`),
        )
        if (searchCondition) conditions.push(searchCondition)
      }

      const where = and(...conditions)
      const offset = (input.page - 1) * PAGE_SIZE

      const [countResult, results] = await Promise.all([
        db.select({ count: count() }).from(user).where(where),
        db
          .select({
            id: user.id,
            email: user.email,
            name: user.name,
            firstname: user.firstname,
            lastname: user.lastname,
            createdAt: user.createdAt,
            lastLoginAt: sql<Date | null>`(SELECT max(created_at) FROM "session" WHERE user_id = "user"."id")`,
            favoritesCount: sql<number>`(SELECT count(*)::int FROM accommodation_favoriteaccommodation WHERE user_id = "user"."id")`,
            alertsCount: sql<number>`(SELECT count(*)::int FROM student_alert WHERE user_id = "user"."id")`,
            ownerId: user.ownerId,
            ownerName: owners.name,
          })
          .from(user)
          .leftJoin(owners, eq(user.ownerId, owners.id))
          .where(where)
          .orderBy(user.createdAt)
          .limit(PAGE_SIZE)
          .offset(offset),
      ])

      const total = countResult[0]?.count ?? 0

      return {
        items: results,
        total,
        pageCount: Math.ceil(total / PAGE_SIZE),
        page: input.page,
      }
    }),

  getById: adminProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const result = await db.query.user.findFirst({
      where: eq(user.id, input.id),
      with: { owner: true, adminOwnerLinks: { with: { owner: true } } },
    })

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: (await getAdminErrorTranslations())('userNotFound') })
    }

    return result
  }),

  create: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        firstname: z.string().min(1),
        lastname: z.string().min(1),
        role: z.enum(['admin', 'owner', 'user']).default('user'),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await db.query.user.findFirst({ where: eq(user.email, input.email) })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: (await getAdminErrorTranslations())('userAlreadyExists') })
      }

      const id = crypto.randomUUID()
      const [created] = await db
        .insert(user)
        .values({
          id,
          email: input.email,
          name: `${input.firstname} ${input.lastname}`,
          firstname: input.firstname,
          lastname: input.lastname,
          role: input.role,
        })
        .returning()

      return created
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        email: z.string().email().optional(),
        firstname: z.string().min(1).optional(),
        lastname: z.string().min(1).optional(),
        role: z.enum(['admin', 'owner', 'user']).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input
      const updateData: Record<string, unknown> = {}

      if (fields.email !== undefined) updateData.email = fields.email
      if (fields.firstname !== undefined) updateData.firstname = fields.firstname
      if (fields.lastname !== undefined) updateData.lastname = fields.lastname
      if (fields.role !== undefined) updateData.role = fields.role
      if (fields.firstname !== undefined || fields.lastname !== undefined) {
        const current = await db.query.user.findFirst({ where: eq(user.id, id) })
        if (current) {
          updateData.name = `${fields.firstname ?? current.firstname} ${fields.lastname ?? current.lastname}`
        }
      }

      updateData.updatedAt = new Date()

      const [updated] = await db.update(user).set(updateData).where(eq(user.id, id)).returning()
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: (await getAdminErrorTranslations())('userNotFound') })
      }

      return updated
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const [deleted] = await db.delete(user).where(eq(user.id, input.id)).returning({ id: user.id })
    if (!deleted) {
      throw new TRPCError({ code: 'NOT_FOUND', message: (await getAdminErrorTranslations())('userNotFound') })
    }
    return deleted
  }),

  linkToOwner: adminProcedure.input(z.object({ userId: z.string(), ownerId: z.number() })).mutation(async ({ input }) => {
    const [updated] = await db
      .update(user)
      .set({ ownerId: input.ownerId, updatedAt: new Date() })
      .where(eq(user.id, input.userId))
      .returning()

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: (await getAdminErrorTranslations())('userNotFound') })
    }

    return updated
  }),

  unlinkFromOwner: adminProcedure.input(z.object({ userId: z.string() })).mutation(async ({ input }) => {
    const [updated] = await db.update(user).set({ ownerId: null, updatedAt: new Date() }).where(eq(user.id, input.userId)).returning()

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: (await getAdminErrorTranslations())('userNotFound') })
    }

    return updated
  }),

  linkAdminToOwner: adminProcedure.input(z.object({ userId: z.string(), ownerId: z.number() })).mutation(async ({ input }) => {
    const targetUser = await db.query.user.findFirst({ where: eq(user.id, input.userId) })
    if (!targetUser) {
      throw new TRPCError({ code: 'NOT_FOUND', message: (await getAdminErrorTranslations())('userNotFound') })
    }
    if (targetUser.role !== 'admin') {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: "L'utilisateur doit avoir le rôle admin" })
    }

    const [created] = await db
      .insert(adminOwnerLinks)
      .values({ userId: input.userId, ownerId: input.ownerId })
      .onConflictDoNothing({ target: [adminOwnerLinks.userId, adminOwnerLinks.ownerId] })
      .returning()

    return created ?? { userId: input.userId, ownerId: input.ownerId }
  }),

  unlinkAdminFromOwner: adminProcedure.input(z.object({ userId: z.string(), ownerId: z.number() })).mutation(async ({ input }) => {
    const [deleted] = await db
      .delete(adminOwnerLinks)
      .where(and(eq(adminOwnerLinks.userId, input.userId), eq(adminOwnerLinks.ownerId, input.ownerId)))
      .returning()

    if (!deleted) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Lien admin-gestionnaire non trouvé' })
    }

    return deleted
  }),

  myLinkedOwners: adminProcedure.query(async ({ ctx }) => {
    const links = await db.query.adminOwnerLinks.findMany({
      where: eq(adminOwnerLinks.userId, ctx.session.user.id),
      with: { owner: true },
    })

    return links.map(({ owner }) => {
      const { image, ...rest } = owner
      return {
        ...rest,
        imageBase64: image ? `data:image/jpeg;base64,${Buffer.from(image).toString('base64')}` : null,
      }
    })
  }),
})

const ownersRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const conditions = []

      if (input.search && input.search.length >= 2) {
        conditions.push(ilike(owners.name, `%${input.search}%`))
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined
      const offset = (input.page - 1) * PAGE_SIZE

      const [countResult, results] = await Promise.all([
        db.select({ count: count() }).from(owners).where(where),
        db
          .select({
            id: owners.id,
            name: owners.name,
            slug: owners.slug,
            url: owners.url,
            image: owners.image,
            accommodationCount: sql<number>`(SELECT count(*)::int FROM accommodation_accommodation WHERE owner_id = "account_owner"."id")`,
            userCount: sql<number>`(SELECT count(*)::int FROM "user" WHERE owner_id = "account_owner"."id")`,
            availableApartments: sql<number>`(
              WITH available_counts AS (
                SELECT ${nbAvailableApartmentsSum} as total_available
                FROM accommodation_accommodation
                WHERE owner_id = "account_owner"."id"
              )
              SELECT coalesce(sum(total_available), 0)::int FROM available_counts
            )`,
          })
          .from(owners)
          .where(where)
          .orderBy(owners.name)
          .limit(PAGE_SIZE)
          .offset(offset),
      ])

      const total = countResult[0]?.count ?? 0

      return {
        items: results.map(({ image, ...r }) => ({
          ...r,
          imageBase64: image ? `data:image/jpeg;base64,${Buffer.from(image).toString('base64')}` : null,
        })),
        total,
        pageCount: Math.ceil(total / PAGE_SIZE),
        page: input.page,
      }
    }),

  getById: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const result = await db.query.owners.findFirst({
      where: eq(owners.id, input.id),
      with: {
        users: {
          columns: { id: true, email: true, name: true, firstname: true, lastname: true, role: true },
        },
        adminOwnerLinks: {
          with: {
            user: {
              columns: { id: true, email: true, name: true, firstname: true, lastname: true, role: true },
            },
          },
        },
      },
    })

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: (await getAdminErrorTranslations())('ownerNotFound') })
    }

    const { image, ...rest } = result
    return {
      ...rest,
      imageBase64: image ? `data:image/jpeg;base64,${Buffer.from(image).toString('base64')}` : null,
    }
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        url: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const slug = await findAvailableSlug(generateSlug(input.name), db, owners)

      const [created] = await db
        .insert(owners)
        .values({
          name: input.name,
          slug,
          url: input.url ?? null,
        })
        .returning()

      const { image, ...rest } = created
      return rest
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        url: z.string().url().nullable().optional(),
        acceptDossierFacileApplications: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input
      const updateData: Record<string, unknown> = {}

      if (fields.name !== undefined) updateData.name = fields.name
      if (fields.url !== undefined) updateData.url = fields.url
      if (fields.acceptDossierFacileApplications !== undefined)
        updateData.acceptDossierFacileApplications = fields.acceptDossierFacileApplications

      const [updated] = await db.update(owners).set(updateData).where(eq(owners.id, id)).returning()
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: (await getAdminErrorTranslations())('ownerNotFound') })
      }

      const { image, ...rest } = updated
      return rest
    }),

  updateLogo: adminProcedure
    .input(
      z.object({
        id: z.number(),
        image: z.string().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      let imageBuffer: Buffer | null = null
      if (input.image) {
        const base64Data = input.image.replace(/^data:image\/\w+;base64,/, '')
        imageBuffer = Buffer.from(base64Data, 'base64')
      }

      const [updated] = await db.update(owners).set({ image: imageBuffer }).where(eq(owners.id, input.id)).returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: (await getAdminErrorTranslations())('ownerNotFound') })
      }

      const { image, ...rest } = updated
      return rest
    }),

  delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const accomCount = await db.select({ count: count() }).from(accommodations).where(eq(accommodations.ownerId, input.id))

    if ((accomCount[0]?.count ?? 0) > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: (await getAdminErrorTranslations())('ownerDeleteHasAccommodations'),
      })
    }

    // Unlink users and admin links
    await db.update(user).set({ ownerId: null }).where(eq(user.ownerId, input.id))
    await db.delete(adminOwnerLinks).where(eq(adminOwnerLinks.ownerId, input.id))

    const [deleted] = await db.delete(owners).where(eq(owners.id, input.id)).returning({ id: owners.id })
    if (!deleted) {
      throw new TRPCError({ code: 'NOT_FOUND', message: (await getAdminErrorTranslations())('ownerNotFound') })
    }

    return deleted
  }),

  accommodations: adminProcedure.input(z.object({ ownerId: z.number() })).query(async ({ input }) => {
    return db
      .select({
        id: accommodations.id,
        name: accommodations.name,
        slug: accommodations.slug,
        city: cities.name,
        citySlug: cities.slug,
        available: accommodations.available,
        published: accommodations.published,
        nbTotalApartments: accommodations.nbTotalApartments,
        nbAvailableApartments: nbAvailableApartmentsSum,
        lat: sql<number | null>`ST_Y(${accommodations.geom}::geometry)`,
        lng: sql<number | null>`ST_X(${accommodations.geom}::geometry)`,
      })
      .from(accommodations)
      .innerJoin(cities, eq(accommodations.cityId, cities.id))
      .where(eq(accommodations.ownerId, input.ownerId))
      .orderBy(accommodations.name)
  }),

  stats: adminProcedure.input(z.object({ ownerId: z.number() })).query(async ({ input }) => {
    const result = await db
      .select({
        nbT1: sql<number>`coalesce(sum(coalesce(nb_t1, 0)), 0)::int`,
        nbT1Bis: sql<number>`coalesce(sum(coalesce(nb_t1_bis, 0)), 0)::int`,
        nbT2: sql<number>`coalesce(sum(coalesce(nb_t2, 0)), 0)::int`,
        nbT3: sql<number>`coalesce(sum(coalesce(nb_t3, 0)), 0)::int`,
        nbT4: sql<number>`coalesce(sum(coalesce(nb_t4, 0)), 0)::int`,
        nbT5: sql<number>`coalesce(sum(coalesce(nb_t5, 0)), 0)::int`,
        nbT6: sql<number>`coalesce(sum(coalesce(nb_t6, 0)), 0)::int`,
        nbT7More: sql<number>`coalesce(sum(coalesce(nb_t7_more, 0)), 0)::int`,
        nbColiving: sql<number>`coalesce(sum(coalesce(nb_coliving_apartments, 0)), 0)::int`,
      })
      .from(accommodations)
      .where(eq(accommodations.ownerId, input.ownerId))

    return result[0]!
  }),
})

const residencesRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const conditions = []

      if (input.search && input.search.length >= 2) {
        conditions.push(
          or(
            ilike(accommodations.name, `%${input.search}%`),
            ilike(cities.name, `%${input.search}%`),
            ilike(owners.name, `%${input.search}%`),
          ),
        )
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined

      const results = await db
        .select({
          id: accommodations.id,
          name: accommodations.name,
          slug: accommodations.slug,
          city: cities.name,
          citySlug: cities.slug,
          available: accommodations.available,
          published: accommodations.published,
          nbTotalApartments: accommodations.nbTotalApartments,
          nbAvailableApartments: nbAvailableApartmentsSum,
          ownerName: owners.name,
        })
        .from(accommodations)
        .leftJoin(owners, eq(accommodations.ownerId, owners.id))
        .innerJoin(cities, eq(accommodations.cityId, cities.id))
        .where(where)
        .orderBy(accommodations.name)
        .limit(100)

      return results.map((r) => ({
        ...r,
        ownerName: r.ownerName ?? '-',
      }))
    }),
})

const statsRouter = createTRPCRouter({
  overview: adminProcedure.query(async () => {
    const [usersCount, ownersCount, accommodationsCount, apartmentsStats] = await Promise.all([
      db
        .select({
          total: count(),
          admins: sql<number>`count(*) filter (where role = 'admin')`.mapWith(Number),
          ownerUsers: sql<number>`count(*) filter (where role = 'owner')`.mapWith(Number),
          students: sql<number>`count(*) filter (where role = 'user')`.mapWith(Number),
        })
        .from(user),
      db.select({ count: count() }).from(owners),
      db.select({ count: count() }).from(accommodations),
      db
        .select({
          totalApartments: sql<number>`coalesce(sum(coalesce(nb_total_apartments, 0)), 0)::int`,
          availableApartments: sql<number>`coalesce(sum(${nbAvailableApartmentsSum}), 0)::int`,
        })
        .from(accommodations),
    ])

    const totalApartments = apartmentsStats[0]?.totalApartments ?? 0
    const availableApartments = apartmentsStats[0]?.availableApartments ?? 0

    return {
      users: {
        total: usersCount[0]?.total ?? 0,
        admins: usersCount[0]?.admins ?? 0,
        owners: usersCount[0]?.ownerUsers ?? 0,
        students: usersCount[0]?.students ?? 0,
      },
      owners: ownersCount[0]?.count ?? 0,
      accommodations: accommodationsCount[0]?.count ?? 0,
      availableAccommodations: availableApartments,
      occupation: {
        total: totalApartments,
        available: availableApartments,
        occupied: totalApartments - availableApartments,
      },
    }
  }),
})

const dateRangeInput = z.object({
  from: z.string(),
  to: z.string(),
})

function aggregateJsonbRanking(rows: { data: unknown }[], limit = 10): { label: string; nbVisits: number }[] {
  const map = new Map<string, number>()
  for (const row of rows) {
    const items = row.data as { label: string; nbVisits: number }[] | null
    if (!Array.isArray(items)) continue
    for (const item of items) {
      map.set(item.label, (map.get(item.label) ?? 0) + (item.nbVisits ?? 0))
    }
  }
  return Array.from(map.entries())
    .map(([label, nbVisits]) => ({ label, nbVisits }))
    .sort((a, b) => b.nbVisits - a.nbVisits)
    .slice(0, limit)
}

const matomoStatsRouter = createTRPCRouter({
  overview: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const result = await db
      .select({
        totalVisitors: sql<number>`coalesce(sum(${stats.uniqueVisitors}), 0)::int`,
        totalPageViews: sql<number>`coalesce(sum(${stats.pageViews}), 0)::int`,
        avgBounceRate: sql<number>`coalesce(avg(${stats.bounceRatePercentage}), 0)::float`,
        avgDuration: sql<number>`coalesce(avg(${stats.averageDuration}), 0)::float`,
        avgNewVisitsPercentage: sql<number>`coalesce(avg(${stats.newVisitsPercentage}), 0)::float`,
        avgVisitorsPerPage: sql<number>`coalesce(avg(${stats.visitorsPerPage}), 0)::float`,
        days: sql<number>`count(*)::int`,
      })
      .from(stats)
      .where(between(stats.date, input.from, input.to))

    return result[0]!
  }),

  visitorsOverTime: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    return db
      .select({
        date: stats.date,
        uniqueVisitors: stats.uniqueVisitors,
        pageViews: stats.pageViews,
      })
      .from(stats)
      .where(between(stats.date, input.from, input.to))
      .orderBy(stats.date)
  }),

  trendsOverTime: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    return db
      .select({
        date: stats.date,
        bounceRatePercentage: stats.bounceRatePercentage,
        averageDuration: stats.averageDuration,
        newVisitsPercentage: stats.newVisitsPercentage,
      })
      .from(stats)
      .where(between(stats.date, input.from, input.to))
      .orderBy(stats.date)
  }),

  topPages: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const rows = await db
      .select({ data: stats.topPages })
      .from(stats)
      .where(between(stats.date, input.from, input.to))
    return aggregateJsonbRanking(rows)
  }),

  topEntryPages: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const rows = await db
      .select({ data: stats.mainEntryPages })
      .from(stats)
      .where(between(stats.date, input.from, input.to))
    return aggregateJsonbRanking(rows)
  }),

  topSources: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const rows = await db
      .select({ data: stats.mainSources })
      .from(stats)
      .where(between(stats.date, input.from, input.to))
    return aggregateJsonbRanking(rows)
  }),

  eventsByCategory: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    return db
      .select({
        category: eventStats.category,
        nbEvents: sql<number>`coalesce(sum(${eventStats.nbEvents}), 0)::int`,
        nbUniqueEvents: sql<number>`coalesce(sum(${eventStats.nbUniqueEvents}), 0)::int`,
      })
      .from(eventStats)
      .where(between(eventStats.date, input.from, input.to))
      .groupBy(eventStats.category)
      .orderBy(sql`sum(${eventStats.nbEvents}) desc`)
  }),

  topEventActions: adminProcedure.input(dateRangeInput.extend({ category: z.string().optional() })).query(async ({ input }) => {
    const conditions = [between(eventStats.date, input.from, input.to)]
    if (input.category) conditions.push(eq(eventStats.category, input.category))

    return db
      .select({
        category: eventStats.category,
        action: eventStats.action,
        nbEvents: sql<number>`coalesce(sum(${eventStats.nbEvents}), 0)::int`,
      })
      .from(eventStats)
      .where(and(...conditions))
      .groupBy(eventStats.category, eventStats.action)
      .orderBy(sql`sum(${eventStats.nbEvents}) desc`)
      .limit(20)
  }),
})

export const adminRouter = createTRPCRouter({
  users: usersRouter,
  owners: ownersRouter,
  residences: residencesRouter,
  stats: statsRouter,
  matomoStats: matomoStatsRouter,
})
