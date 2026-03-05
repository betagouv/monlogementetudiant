import { TRPCError } from '@trpc/server'
import { and, count, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { owners } from '~/server/db/schema/owners'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import { adminProcedure, createTRPCRouter } from '../init'

const PAGE_SIZE = 20

const usersRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        role: z.enum(['admin', 'owner', 'user']).optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const conditions = []

      if (input.role) {
        conditions.push(eq(user.role, input.role))
      }

      if (input.search && input.search.length >= 2) {
        conditions.push(
          or(
            ilike(user.email, `%${input.search}%`),
            ilike(user.firstname, `%${input.search}%`),
            ilike(user.lastname, `%${input.search}%`),
            ilike(user.name, `%${input.search}%`),
          ),
        )
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined
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
            role: user.role,
            ownerId: user.ownerId,
            createdAt: user.createdAt,
          })
          .from(user)
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
      with: { owner: true },
    })

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
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
        throw new TRPCError({ code: 'CONFLICT', message: 'Un utilisateur avec cet email existe deja' })
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
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
      }

      return updated
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const [deleted] = await db.delete(user).where(eq(user.id, input.id)).returning({ id: user.id })
    if (!deleted) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
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
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    }

    return updated
  }),

  unlinkFromOwner: adminProcedure.input(z.object({ userId: z.string() })).mutation(async ({ input }) => {
    const [updated] = await db.update(user).set({ ownerId: null, updatedAt: new Date() }).where(eq(user.id, input.userId)).returning()

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    }

    return updated
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
            accommodationCount: sql<number>`(SELECT count(*)::int FROM accommodation_accommodation WHERE owner_id = ${owners.id})`,
            userCount: sql<number>`(SELECT count(*)::int FROM "user" WHERE owner_id = ${owners.id})`,
          })
          .from(owners)
          .where(where)
          .orderBy(owners.name)
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

  getById: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const result = await db.query.owners.findFirst({
      where: eq(owners.id, input.id),
      with: {
        users: {
          columns: { id: true, email: true, name: true, firstname: true, lastname: true, role: true },
        },
      },
    })

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' })
    }

    return result
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        url: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const slug = generateSlug(input.name)

      const [created] = await db
        .insert(owners)
        .values({
          name: input.name,
          slug,
          url: input.url ?? null,
        })
        .returning()

      return created
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        url: z.string().url().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input
      const updateData: Record<string, unknown> = {}

      if (fields.name !== undefined) updateData.name = fields.name
      if (fields.url !== undefined) updateData.url = fields.url

      const [updated] = await db.update(owners).set(updateData).where(eq(owners.id, id)).returning()
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' })
      }

      return updated
    }),

  delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const accomCount = await db.select({ count: count() }).from(accommodations).where(eq(accommodations.ownerId, input.id))

    if ((accomCount[0]?.count ?? 0) > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Ce bailleur a des residences associees. Supprimez-les ou reassignez-les avant.',
      })
    }

    // Unlink users
    await db.update(user).set({ ownerId: null }).where(eq(user.ownerId, input.id))

    const [deleted] = await db.delete(owners).where(eq(owners.id, input.id)).returning({ id: owners.id })
    if (!deleted) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Owner not found' })
    }

    return deleted
  }),

  accommodations: adminProcedure.input(z.object({ ownerId: z.number() })).query(async ({ input }) => {
    return db
      .select({
        id: accommodations.id,
        name: accommodations.name,
        slug: accommodations.slug,
        city: accommodations.city,
        available: accommodations.available,
        published: accommodations.published,
        nbTotalApartments: accommodations.nbTotalApartments,
      })
      .from(accommodations)
      .where(eq(accommodations.ownerId, input.ownerId))
      .orderBy(accommodations.name)
  }),
})

const statsRouter = createTRPCRouter({
  overview: adminProcedure.query(async () => {
    const [usersCount, ownersCount, accommodationsCount, availableCount] = await Promise.all([
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
      db.select({ count: count() }).from(accommodations).where(eq(accommodations.available, true)),
    ])

    return {
      users: {
        total: usersCount[0]?.total ?? 0,
        admins: usersCount[0]?.admins ?? 0,
        owners: usersCount[0]?.ownerUsers ?? 0,
        students: usersCount[0]?.students ?? 0,
      },
      owners: ownersCount[0]?.count ?? 0,
      accommodations: accommodationsCount[0]?.count ?? 0,
      availableAccommodations: availableCount[0]?.count ?? 0,
    }
  }),
})

export const adminRouter = createTRPCRouter({
  users: usersRouter,
  owners: ownersRouter,
  stats: statsRouter,
})
