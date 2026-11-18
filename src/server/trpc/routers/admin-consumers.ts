import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, gte, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { apikey } from '~/server/db/schema/api-key'
import { apiKeyOwners } from '~/server/db/schema/api-key-owner'
import { apiKeyUsageDaily } from '~/server/db/schema/api-key-usage'
import { owners } from '~/server/db/schema/owners'
import { auth } from '~/services/better-auth'
import { getDateFrom } from '~/utils/date-helpers'
import { adminProcedure, createTRPCRouter } from '../init'

/**
 * Gestion des « Consommateurs » de l'API publique v1 : les clés d'API émises pour des tiers.
 * La création passe par Better Auth (génération + hashing de la clé) ; la lecture/mise à jour/révocation
 * opèrent directement sur la table `apikey` (l'admin voit et gère toutes les clés, pas seulement les siennes).
 */

const PAGE_SIZE = 20
const KEY_PREFIX = 'mle_'

type ConsumerMetadata = { contact?: string; description?: string }

const parseMetadata = (raw: string | null): ConsumerMetadata => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as ConsumerMetadata) : {}
  } catch {
    return {}
  }
}

const assertOwnerExists = async (ownerId: number) => {
  const [found] = await db.select({ id: owners.id }).from(owners).where(eq(owners.id, ownerId)).limit(1)
  if (!found) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bailleur introuvable' })
  }
}

export const consumersRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const where = input.search && input.search.length >= 2 ? ilike(apikey.name, `%${input.search}%`) : undefined
      const offset = (input.page - 1) * PAGE_SIZE

      const [countResult, rows] = await Promise.all([
        db.select({ count: count() }).from(apikey).where(where),
        db
          .select({
            id: apikey.id,
            name: apikey.name,
            prefix: apikey.prefix,
            start: apikey.start,
            enabled: apikey.enabled,
            rateLimitEnabled: apikey.rateLimitEnabled,
            rateLimitMax: apikey.rateLimitMax,
            rateLimitTimeWindow: apikey.rateLimitTimeWindow,
            requestCount: apikey.requestCount,
            remaining: apikey.remaining,
            lastRequest: apikey.lastRequest,
            createdAt: apikey.createdAt,
            metadata: apikey.metadata,
            ownerId: owners.id,
            ownerName: owners.name,
            ownerContactMode: owners.contactMode,
            usage30d: sql<number>`COALESCE((SELECT SUM(u.count) FROM api_key_usage_daily u WHERE u.api_key_id = ${apikey.id} AND u.day >= CURRENT_DATE - 30), 0)::int`,
          })
          .from(apikey)
          .leftJoin(apiKeyOwners, eq(apiKeyOwners.apiKeyId, apikey.id))
          .leftJoin(owners, eq(owners.id, apiKeyOwners.ownerId))
          .where(where)
          .orderBy(desc(apikey.createdAt))
          .limit(PAGE_SIZE)
          .offset(offset),
      ])

      const total = countResult[0]?.count ?? 0

      return {
        items: rows.map(({ metadata, ownerId, ownerName, ownerContactMode, ...row }) => ({
          ...row,
          metadata: parseMetadata(metadata),
          owner:
            ownerId != null && ownerName != null && ownerContactMode != null
              ? { id: ownerId, name: ownerName, contactMode: ownerContactMode }
              : null,
        })),
        total,
        pageCount: Math.ceil(total / PAGE_SIZE),
        page: input.page,
      }
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, { message: 'Veuillez saisir un nom de consommateur' }).max(120),
        contact: z.string().max(255).optional(),
        description: z.string().max(500).optional(),
        rateLimitMax: z.number().int().positive().optional(),
        rateLimitWindowSeconds: z.number().int().positive().optional(),
        ownerId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.ownerId != null) await assertOwnerExists(input.ownerId)

      const metadata: ConsumerMetadata = {}
      if (input.contact) metadata.contact = input.contact
      if (input.description) metadata.description = input.description

      const created = await auth.api.createApiKey({
        body: {
          name: input.name,
          prefix: KEY_PREFIX,
          userId: ctx.session.user.id,
          rateLimitEnabled: true,
          ...(input.rateLimitMax != null ? { rateLimitMax: input.rateLimitMax } : {}),
          ...(input.rateLimitWindowSeconds != null ? { rateLimitTimeWindow: input.rateLimitWindowSeconds * 1000 } : {}),
          metadata,
        },
      })

      if (input.ownerId != null) {
        await db.insert(apiKeyOwners).values({ apiKeyId: created.id, ownerId: input.ownerId })
      }

      // `key` (en clair) n'est renvoyé qu'ici, une seule fois.
      return { id: created.id, key: created.key, name: created.name }
    }),

  update: adminProcedure
    .input(
      z.object({
        keyId: z.string().min(1),
        name: z.string().min(1).max(120).optional(),
        enabled: z.boolean().optional(),
        contact: z.string().max(255).optional(),
        description: z.string().max(500).optional(),
        rateLimitEnabled: z.boolean().optional(),
        rateLimitMax: z.number().int().positive().optional(),
        rateLimitWindowSeconds: z.number().int().positive().optional(),
        ownerId: z.number().int().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [existing] = await db.select({ metadata: apikey.metadata }).from(apikey).where(eq(apikey.id, input.keyId)).limit(1)
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Consommateur introuvable' })
      }

      if (input.ownerId != null) await assertOwnerExists(input.ownerId)

      // Métadonnées : fusion partielle, réécrites uniquement si contact/description sont fournis.
      let metadata: string | undefined
      if (input.contact !== undefined || input.description !== undefined) {
        const merged = parseMetadata(existing.metadata)
        if (input.contact !== undefined) merged.contact = input.contact || undefined
        if (input.description !== undefined) merged.description = input.description || undefined
        metadata = JSON.stringify(merged)
      }

      // Drizzle ignore les clés `undefined` dans `.set()` : les champs non fournis ne sont pas modifiés.
      await db
        .update(apikey)
        .set({
          updatedAt: new Date(),
          name: input.name,
          enabled: input.enabled,
          rateLimitEnabled: input.rateLimitEnabled,
          rateLimitMax: input.rateLimitMax,
          rateLimitTimeWindow: input.rateLimitWindowSeconds != null ? input.rateLimitWindowSeconds * 1000 : undefined,
          metadata,
        })
        .where(eq(apikey.id, input.keyId))

      if (input.ownerId === null) {
        await db.delete(apiKeyOwners).where(eq(apiKeyOwners.apiKeyId, input.keyId))
      } else if (input.ownerId !== undefined) {
        await db
          .insert(apiKeyOwners)
          .values({ apiKeyId: input.keyId, ownerId: input.ownerId })
          .onConflictDoUpdate({ target: apiKeyOwners.apiKeyId, set: { ownerId: input.ownerId } })
      }
      return { success: true }
    }),

  revoke: adminProcedure.input(z.object({ keyId: z.string().min(1) })).mutation(async ({ input }) => {
    const deleted = await db.delete(apikey).where(eq(apikey.id, input.keyId)).returning({ id: apikey.id })
    if (deleted.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Consommateur introuvable' })
    }
    return { success: true }
  }),

  // Volume de requêtes par jour d'un consommateur, sur une fenêtre glissante (défaut 30 jours).
  usage: adminProcedure
    .input(z.object({ keyId: z.string().min(1), days: z.number().int().positive().max(365).default(30) }))
    .query(async ({ input }) => {
      const cutoff = getDateFrom(input.days)
      const daily = await db
        .select({ day: apiKeyUsageDaily.day, count: apiKeyUsageDaily.count })
        .from(apiKeyUsageDaily)
        .where(and(eq(apiKeyUsageDaily.apiKeyId, input.keyId), gte(apiKeyUsageDaily.day, cutoff)))
        .orderBy(desc(apiKeyUsageDaily.day))

      return { total: daily.reduce((sum, row) => sum + row.count, 0), daily }
    }),
})
