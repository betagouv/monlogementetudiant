import * as Sentry from '@sentry/nextjs'
import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, gte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { type ESupportTicketStatus, SUPPORT_TICKET_STATUSES, ZSupportTicketStatus } from '~/enums/support-ticket'
import { ZSupportTicketCreate } from '~/schemas/support-tickets/support-ticket'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodationReports } from '~/server/db/schema/accommodation-reports'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { cities } from '~/server/db/schema/cities'
import { owners } from '~/server/db/schema/owners'
import { supportTickets } from '~/server/db/schema/support-tickets'
import { env } from '~/server/env'
import { sendRawEmail } from '~/server/services/brevo'
import { buildSupportTicketEmail } from '~/server/support/ticket-email'
import { adminProcedure, createTRPCRouter, userProcedure } from '../init'

const PAGE_SIZE = 20

const emptyStatusCounts = () =>
  Object.fromEntries(SUPPORT_TICKET_STATUSES.map((status) => [status, 0])) as Record<ESupportTicketStatus, number>

/** Plafond de tickets par étudiant sur 24 h — évite l'engorgement de la boîte support. */
const MAX_TICKETS_PER_DAY = 5

export const supportTicketsRouter = createTRPCRouter({
  create: userProcedure.input(ZSupportTicketCreate).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    const since = new Date(Date.now() - 24 * 3_600_000)
    const [recent] = await db
      .select({ count: count() })
      .from(supportTickets)
      .where(and(eq(supportTickets.userId, userId), gte(supportTickets.createdAt, since)))
    if ((recent?.count ?? 0) >= MAX_TICKETS_PER_DAY) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Vous avez atteint la limite de signalements pour aujourd’hui, réessayez demain',
      })
    }

    const [ticket] = await db.insert(supportTickets).values({ userId, category: input.category, message: input.message }).returning()

    if (!env.SUPPORT_TICKET_EMAIL) {
      console.info(`[supportTickets.create] SUPPORT_TICKET_EMAIL absent, notification non envoyée : ${ticket.id}`)
      return { success: true }
    }

    const { subject, textContent } = buildSupportTicketEmail({
      category: input.category,
      message: input.message,
      userName: ctx.session.user.name,
      userEmail: ctx.session.user.email,
      url: `${env.BASE_URL}/administration/tickets`,
      date: ticket.createdAt,
    })

    // La notification est best-effort : le ticket est déjà enregistré et visible dans l'admin.
    try {
      await sendRawEmail({ to: [env.SUPPORT_TICKET_EMAIL], subject, textContent, senderName: 'Mon Logement Étudiant' })
    } catch (error) {
      Sentry.captureException(error, { tags: { step: 'sendSupportTicketEmail' } })
    }

    return { success: true }
  }),

  admin: createTRPCRouter({
    count: adminProcedure.query(async () => {
      const [[tickets], [reports]] = await Promise.all([
        db.select({ count: count() }).from(supportTickets),
        db.select({ count: count() }).from(accommodationReports),
      ])
      return (tickets?.count ?? 0) + (reports?.count ?? 0)
    }),

    list: adminProcedure
      .input(z.object({ page: z.number().default(1), status: ZSupportTicketStatus.optional() }))
      .query(async ({ input }) => {
        const where = input.status ? eq(supportTickets.status, input.status) : undefined
        const offset = (input.page - 1) * PAGE_SIZE

        const [countResult, items, statusRows] = await Promise.all([
          db.select({ count: count() }).from(supportTickets).where(where),
          db
            .select({
              id: supportTickets.id,
              category: supportTickets.category,
              message: supportTickets.message,
              status: supportTickets.status,
              createdAt: supportTickets.createdAt,
              updatedAt: supportTickets.updatedAt,
              userName: user.name,
              userEmail: user.email,
            })
            .from(supportTickets)
            .innerJoin(user, eq(supportTickets.userId, user.id))
            .where(where)
            .orderBy(desc(supportTickets.createdAt))
            .limit(PAGE_SIZE)
            .offset(offset),
          db.select({ status: supportTickets.status, n: count() }).from(supportTickets).groupBy(supportTickets.status),
        ])

        const statusCounts = emptyStatusCounts()
        for (const row of statusRows) statusCounts[row.status] = row.n

        const total = countResult[0]?.count ?? 0
        return { items, total, pageCount: Math.ceil(total / PAGE_SIZE), page: input.page, statusCounts }
      }),

    updateStatus: adminProcedure.input(z.object({ id: z.string(), status: ZSupportTicketStatus })).mutation(async ({ input }) => {
      const [updated] = await db
        .update(supportTickets)
        .set({ status: input.status, updatedAt: sql`now()` })
        .where(eq(supportTickets.id, input.id))
        .returning()
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket introuvable' })
      return updated
    }),

    reports: createTRPCRouter({
      list: adminProcedure
        .input(z.object({ page: z.number().default(1), status: ZSupportTicketStatus.optional() }))
        .query(async ({ input }) => {
          const where = input.status ? eq(accommodationReports.status, input.status) : undefined
          const offset = (input.page - 1) * PAGE_SIZE

          const [countResult, items, statusRows] = await Promise.all([
            db.select({ count: count() }).from(accommodationReports).where(where),
            db
              .select({
                id: accommodationReports.id,
                field: accommodationReports.field,
                details: accommodationReports.details,
                status: accommodationReports.status,
                createdAt: accommodationReports.createdAt,
                updatedAt: accommodationReports.updatedAt,
                accommodationId: accommodations.id,
                accommodationName: accommodations.name,
                accommodationSlug: accommodations.slug,
                citySlug: cities.slug,
                ownerName: owners.name,
              })
              .from(accommodationReports)
              .innerJoin(accommodations, eq(accommodationReports.accommodationId, accommodations.id))
              .leftJoin(
                accommodationAddresses,
                and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
              )
              .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
              .leftJoin(owners, eq(accommodations.ownerId, owners.id))
              .where(where)
              .orderBy(desc(accommodationReports.createdAt))
              .limit(PAGE_SIZE)
              .offset(offset),
            db.select({ status: accommodationReports.status, n: count() }).from(accommodationReports).groupBy(accommodationReports.status),
          ])

          const statusCounts = emptyStatusCounts()
          for (const row of statusRows) statusCounts[row.status] = row.n

          const total = countResult[0]?.count ?? 0
          return { items, total, pageCount: Math.ceil(total / PAGE_SIZE), page: input.page, statusCounts }
        }),

      updateStatus: adminProcedure.input(z.object({ id: z.uuid(), status: ZSupportTicketStatus })).mutation(async ({ input }) => {
        const [updated] = await db
          .update(accommodationReports)
          .set({ status: input.status, updatedAt: sql`now()` })
          .where(eq(accommodationReports.id, input.id))
          .returning()
        if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Signalement introuvable' })
        return updated
      }),
    }),
  }),
})
